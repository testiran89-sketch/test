require('dotenv').config();
const hre = require('hardhat');

async function main() {
  const polygonRpcUrl = process.env.POLYGON_RPC_URL || '';
  if (!polygonRpcUrl || polygonRpcUrl.includes('YOUR_API_KEY')) {
    throw new Error(
      'POLYGON_RPC_URL is missing or still contains placeholder YOUR_API_KEY. Set a real RPC URL in .env (e.g. https://polygon-rpc.com or your provider URL).'
    );
  }

  const aavePool = process.env.AAVE_POOL;
  if (!aavePool) throw new Error('AAVE_POOL is required in .env');

  const Factory = await hre.ethers.getContractFactory('FlashLoanArbitrage');
  const c = await Factory.deploy(aavePool);
  await c.waitForDeployment();
  const addr = await c.getAddress();

  console.log('FlashLoanArbitrage deployed:', addr);
}

main().catch((e) => {
  if (e && e.code === 'ENOTFOUND') {
    console.error('DNS error for RPC host. Check POLYGON_RPC_URL in .env; it is likely invalid or contains a placeholder.');
  }
  console.error(e);
  process.exit(1);
});
