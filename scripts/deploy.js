require('dotenv').config();
const hre = require('hardhat');

async function main() {
  const aavePool = process.env.AAVE_POOL;
  if (!aavePool) throw new Error('AAVE_POOL is required in .env');

  const minProfitUSDC = process.env.MIN_PROFIT_USDC || '1000000'; // 1 USDC (6 decimals)

  const Factory = await hre.ethers.getContractFactory('FlashLoanArbitrage');
  const c = await Factory.deploy(aavePool, minProfitUSDC);
  await c.waitForDeployment();
  const addr = await c.getAddress();

  console.log('FlashLoanArbitrage deployed:', addr);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
