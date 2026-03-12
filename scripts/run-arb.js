require('dotenv').config();
const hre = require('hardhat');

const ERC20_ABI = [
  'function decimals() external view returns (uint8)',
  'function balanceOf(address) external view returns (uint256)'
];

const ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)'
];

async function main() {
  const {
    ARB_CONTRACT,
    USDC,
    SNX,
    QUICKSWAP_ROUTER,
    UNISWAP_ROUTER,
    FLASH_AMOUNT_USDC,
    SLIPPAGE_BPS
  } = process.env;

  if (!ARB_CONTRACT || !USDC || !SNX || !QUICKSWAP_ROUTER || !UNISWAP_ROUTER || !FLASH_AMOUNT_USDC) {
    throw new Error('Missing required env vars: ARB_CONTRACT, USDC, SNX, QUICKSWAP_ROUTER, UNISWAP_ROUTER, FLASH_AMOUNT_USDC');
  }

  const [signer] = await hre.ethers.getSigners();
  const arb = await hre.ethers.getContractAt('FlashLoanArbitrage', ARB_CONTRACT, signer);
  const usdc = new hre.ethers.Contract(USDC, ERC20_ABI, signer);
  const quickRouter = new hre.ethers.Contract(QUICKSWAP_ROUTER, ROUTER_ABI, signer);
  const uniRouter = new hre.ethers.Contract(UNISWAP_ROUTER, ROUTER_ABI, signer);

  const usdcDecimals = await usdc.decimals();
  const amountIn = hre.ethers.parseUnits(FLASH_AMOUNT_USDC, usdcDecimals);

  const buyOuts = await quickRouter.getAmountsOut(amountIn, [USDC, SNX]);
  const snxAmount = buyOuts[1];

  const sellOuts = await uniRouter.getAmountsOut(snxAmount, [SNX, USDC]);
  const usdcBack = sellOuts[1];

  const slippageBps = Number(SLIPPAGE_BPS || '30');
  const minOutBuy = (snxAmount * BigInt(10000 - slippageBps)) / 10000n;
  const minOutSell = (usdcBack * BigInt(10000 - slippageBps)) / 10000n;

  const now = Math.floor(Date.now() / 1000);
  const deadline = now + 120;

  const params = {
    buyRouter: QUICKSWAP_ROUTER,
    sellRouter: UNISWAP_ROUTER,
    tokenBorrow: USDC,
    tokenOther: SNX,
    minOutBuy,
    minOutSell,
    deadline
  };

  console.log('Estimated SNX bought:', snxAmount.toString());
  console.log('Estimated USDC back:', usdcBack.toString());

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
