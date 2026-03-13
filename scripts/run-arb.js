const { loadEnv, requireEnv } = require('./load-env');
const { checkRpcHealth } = require('./rpc-health');
const { normalizeAddress } = require('./address-utils');
const hre = require('hardhat');

const ERC20_ABI = [
  'function decimals() external view returns (uint8)',
  'function balanceOf(address) external view returns (uint256)'
];

const ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)'
];

const WMATIC = '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270';
const WETH = '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619';

function parsePath(raw, defaults) {
  if (!raw || !raw.trim()) return defaults;
  return raw.split(',').map((p) => normalizeAddress(p.trim(), 'PATH_ITEM'));
}

async function quotePath(router, amountIn, path) {
  try {
    const out = await router.getAmountsOut(amountIn, path);
    return { ok: true, out: out[out.length - 1], path };
  } catch (e) {
    return { ok: false, error: e?.shortMessage || e?.message || String(e), path };
  }
}

function pathToStr(path) {
  return path.join(' -> ');
}

function uniquePaths(paths) {
  return paths.filter((p, i, a) => a.findIndex((x) => x.join('-') === p.join('-')) === i);
}

async function main() {
  const { loadedFrom } = loadEnv();

  const required = [
    'ARB_CONTRACT',
    'USDC',
    'CRV',
    'SUSHISWAP_ROUTER',
    'QUICKSWAP_ROUTER',
    'FLASH_AMOUNT_USDC'
  ];
  const missing = requireEnv(required);
  if (missing.length > 0) {
    throw new Error(
      `Missing required env vars: ${missing.join(', ')}\n` +
      `Loaded .env from: ${loadedFrom || 'not found'}\n` +
      'Tip: ensure values exist in .env (project root) or export them in the same terminal session.'
    );
  }

  const {
    FLASH_AMOUNT_USDC,
    SLIPPAGE_BPS,
    FLASH_FEE_BPS,
    REQUIRE_NON_NEGATIVE,
    BUY_PATH,
    SELL_PATH,
    MAX_BUY_PRICE_USDC,
    MIN_SELL_PRICE_USDC
  } = process.env;

  const ARB_CONTRACT = normalizeAddress(process.env.ARB_CONTRACT, 'ARB_CONTRACT');
  const USDC = normalizeAddress(process.env.USDC, 'USDC');
  const CRV = normalizeAddress(process.env.CRV, 'CRV');
  const SUSHISWAP_ROUTER = normalizeAddress(process.env.SUSHISWAP_ROUTER, 'SUSHISWAP_ROUTER');
  const QUICKSWAP_ROUTER = normalizeAddress(process.env.QUICKSWAP_ROUTER, 'QUICKSWAP_ROUTER');

  const effectiveRpcUrl = process.env.POLYGON_RPC_URL || process.env.POLYGON_FALLBACK_RPC_URL || '';
  if (!effectiveRpcUrl) {
    throw new Error('Neither POLYGON_RPC_URL nor POLYGON_FALLBACK_RPC_URL is set in .env');
  }

  const rpcStatus = await checkRpcHealth(effectiveRpcUrl);
  if (!rpcStatus.ok) {
    throw new Error(
      `POLYGON_RPC_URL is not usable: ${rpcStatus.reason}\n` +
      'Your provider key may be disabled. Put a valid RPC URL in .env and retry.'
    );
  }

  const [signer] = await hre.ethers.getSigners();
  const arb = await hre.ethers.getContractAt('FlashLoanArbitrage', ARB_CONTRACT, signer);
  const usdc = new hre.ethers.Contract(USDC, ERC20_ABI, signer);
  const crv = new hre.ethers.Contract(CRV, ERC20_ABI, signer);
  const sushiRouter = new hre.ethers.Contract(SUSHISWAP_ROUTER, ROUTER_ABI, signer);
  const quickRouter = new hre.ethers.Contract(QUICKSWAP_ROUTER, ROUTER_ABI, signer);

  const usdcDecimals = await usdc.decimals();
  const crvDecimals = await crv.decimals();
  const amountIn = hre.ethers.parseUnits(FLASH_AMOUNT_USDC, usdcDecimals);

  const buyPathDirect = [USDC, CRV];
  const buyPathViaWmatic = [USDC, WMATIC, CRV];
  const buyPathViaWeth = [USDC, WETH, CRV];
  const buyPathConfigured = parsePath(BUY_PATH, buyPathDirect);
  const buyCandidates = uniquePaths([buyPathConfigured, buyPathDirect, buyPathViaWmatic, buyPathViaWeth]);

  const sellPathDirect = [CRV, USDC];
  const sellPathViaWmatic = [CRV, WMATIC, USDC];
  const sellPathViaWeth = [CRV, WETH, USDC];
  const sellPathConfigured = parsePath(SELL_PATH, sellPathDirect);
  const sellCandidates = uniquePaths([sellPathConfigured, sellPathDirect, sellPathViaWmatic, sellPathViaWeth]);

  const buyQuotes = [];
  for (const p of buyCandidates) {
    console.log('Trying buy path:', pathToStr(p));
    buyQuotes.push(await quotePath(sushiRouter, amountIn, p));
  }

  const validBuyQuotes = buyQuotes.filter((q) => q.ok);
  if (validBuyQuotes.length === 0) {
    throw new Error('No valid buy path on SushiSwap. Set BUY_PATH in .env (comma-separated addresses).');
  }

  // Evaluate full (buyPath, sellPath) combinations and choose by max final USDC.
  let bestCombo = null;
  const comboLogs = [];
  for (const b of validBuyQuotes) {
    for (const sPath of sellCandidates) {
      console.log('Trying sell path:', pathToStr(sPath));
      const s = await quotePath(quickRouter, b.out, sPath);
      comboLogs.push({ buyPath: b.path, buyOut: b.out, sellPath: sPath, sellOk: s.ok, sellOut: s.ok ? s.out : 0n, err: s.ok ? '' : s.error });
      if (s.ok && (!bestCombo || s.out > bestCombo.usdcBack)) {
        bestCombo = {
          buyPath: b.path,
          sellPath: sPath,
          crvAmount: b.out,
          usdcBack: s.out
        };
      }
    }
  }

  if (!bestCombo) {
    throw new Error('No valid sell path on QuickSwap. Set SELL_PATH in .env (comma-separated addresses).');
  }
  const crvAmount = bestCombo.crvAmount;
  const usdcBack = bestCombo.usdcBack;

  const flashFeeBps = Number(FLASH_FEE_BPS || '9'); // Aave default 0.09%
  const flashFee = (amountIn * BigInt(flashFeeBps)) / 10000n;
  const repaymentEst = amountIn + flashFee;
  const estNet = usdcBack - repaymentEst;

  const requireNonNegative = (REQUIRE_NON_NEGATIVE || '1') !== '0';

  const usdcUnit = 10n ** BigInt(usdcDecimals);
  const crvUnit = 10n ** BigInt(crvDecimals);
  const buyPriceScaled = (amountIn * crvUnit) / (crvAmount || 1n);
  const sellPriceScaled = (usdcBack * crvUnit) / (crvAmount || 1n);
  const maxBuyPrice = MAX_BUY_PRICE_USDC ? hre.ethers.parseUnits(MAX_BUY_PRICE_USDC, usdcDecimals) : null;
  const minSellPrice = MIN_SELL_PRICE_USDC ? hre.ethers.parseUnits(MIN_SELL_PRICE_USDC, usdcDecimals) : null;

  if (maxBuyPrice && buyPriceScaled > maxBuyPrice) {
    throw new Error(`Precheck failed: buy implied price too high (${buyPriceScaled} > ${maxBuyPrice}). Route likely wrong.`);
  }
  if (minSellPrice && sellPriceScaled < minSellPrice) {
    throw new Error(`Precheck failed: sell implied price too low (${sellPriceScaled} < ${minSellPrice}). Route likely wrong.`);
  }

  if (requireNonNegative && estNet <= 0n) {
    throw new Error(
      `Precheck failed: estimated net <= 0. amountIn=${amountIn} usdcBack=${usdcBack} repaymentEst=${repaymentEst}. ` +
      'Set REQUIRE_NON_NEGATIVE=0 to bypass (not recommended).'
    );
  }

  const slippageBps = Number(SLIPPAGE_BPS || '30');
  const minOutBuy = (crvAmount * BigInt(10000 - slippageBps)) / 10000n;
  const minOutSell = (usdcBack * BigInt(10000 - slippageBps)) / 10000n;

  const now = Math.floor(Date.now() / 1000);
  const deadline = now + 120;

  const params = {
    buyRouter: SUSHISWAP_ROUTER,
    sellRouter: QUICKSWAP_ROUTER,
    tokenBorrow: USDC,
    tokenOther: CRV,
    buyPath: bestCombo.buyPath,
    sellPath: bestCombo.sellPath,
    minOutBuy,
    minOutSell,
    deadline
  };

  console.log('Loaded .env from:', loadedFrom || 'not found');
  for (const c of comboLogs) {
    if (c.sellOk) {
      console.log(`Combo quote OK | buy: ${pathToStr(c.buyPath)} => ${c.buyOut} | sell: ${pathToStr(c.sellPath)} => ${c.sellOut}`);
    } else {
      console.log(`Combo quote FAIL | buy: ${pathToStr(c.buyPath)} => ${c.buyOut} | sell: ${pathToStr(c.sellPath)} | err: ${c.err}`);
    }
  }
  console.log('Selected buy path:', pathToStr(bestCombo.buyPath));
  console.log('Selected sell path:', pathToStr(bestCombo.sellPath));
  console.log('Estimated CRV bought:', crvAmount.toString());
  console.log('Estimated USDC back:', usdcBack.toString());
  console.log('Estimated repayment (with flash fee):', repaymentEst.toString());
  console.log('Estimated net before gas:', estNet.toString());
  console.log('Implied buy price (USDC per CRV, scaled):', buyPriceScaled.toString());
  console.log('Implied sell price (USDC per CRV, scaled):', sellPriceScaled.toString());

  try {
    await arb.startArbitrage.staticCall(amountIn, params, { gasLimit: 2_500_000 });
    console.log('Simulation staticCall: OK');
  } catch (e) {
    const data = e?.data || e?.error?.data || e?.info?.error?.data;
    try {
      if (data) {
        const decoded = arb.interface.parseError(data);
        if (decoded && decoded.name === 'Unprofitable') {
          const finalBalance = decoded.args[0];
          const repayment = decoded.args[1];
          throw new Error(
            `Simulation reverted: Unprofitable(finalBalance=${finalBalance}, repayment=${repayment}). ` +
            'Route is not profitable at current state.'
          );
        }
        throw new Error(`Simulation reverted with contract error: ${decoded?.name || 'unknown'}`);
      }
    } catch (_) {
      // fall through to generic error below
    }
    throw new Error(`Simulation failed before sending tx: ${e?.shortMessage || e?.message || String(e)}`);
  }

  const tx = await arb.startArbitrage(amountIn, params, { gasLimit: 2_500_000 });
  console.log('Submitted tx:', tx.hash);
  const rc = await tx.wait();
  console.log('Confirmed in block:', rc.blockNumber);

  const contractBalance = await usdc.balanceOf(ARB_CONTRACT);
  console.log('Contract USDC balance (profit kept in contract):', contractBalance.toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
