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
    REQUIRE_NON_NEGATIVE
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
  const sushiRouter = new hre.ethers.Contract(SUSHISWAP_ROUTER, ROUTER_ABI, signer);
  const quickRouter = new hre.ethers.Contract(QUICKSWAP_ROUTER, ROUTER_ABI, signer);

  const usdcDecimals = await usdc.decimals();
  const amountIn = hre.ethers.parseUnits(FLASH_AMOUNT_USDC, usdcDecimals);

  const buyOuts = await sushiRouter.getAmountsOut(amountIn, [USDC, CRV]);
  const crvAmount = buyOuts[1];

  const sellOuts = await quickRouter.getAmountsOut(crvAmount, [CRV, USDC]);
  const usdcBack = sellOuts[1];

  const flashFeeBps = Number(FLASH_FEE_BPS || '9'); // Aave default 0.09%
  const flashFee = (amountIn * BigInt(flashFeeBps)) / 10000n;
  const repaymentEst = amountIn + flashFee;
  const estNet = usdcBack - repaymentEst;

  const requireNonNegative = (REQUIRE_NON_NEGATIVE || '1') !== '0';
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
    minOutBuy,
    minOutSell,
    deadline
  };

  console.log('Loaded .env from:', loadedFrom || 'not found');
  console.log('Estimated CRV bought:', crvAmount.toString());
  console.log('Estimated USDC back:', usdcBack.toString());
  console.log('Estimated repayment (with flash fee):', repaymentEst.toString());
  console.log('Estimated net before gas:', estNet.toString());

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
