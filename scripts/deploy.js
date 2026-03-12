const { loadEnv, requireEnv } = require('./load-env');
const { checkRpcHealth } = require('./rpc-health');
const hre = require('hardhat');

async function main() {
  const { loadedFrom } = loadEnv();

  const missing = requireEnv(['POLYGON_RPC_URL', 'AAVE_POOL']);
  if (missing.length > 0) {
    throw new Error(
      `Missing required env vars: ${missing.join(', ')}\n` +
      `Loaded .env from: ${loadedFrom || 'not found'}`
    );
  }

  const polygonRpcUrl = process.env.POLYGON_RPC_URL || '';
  if (polygonRpcUrl.includes('YOUR_API_KEY')) {
    throw new Error(
      'POLYGON_RPC_URL still contains placeholder YOUR_API_KEY. Set a real RPC URL in .env (e.g. https://polygon-rpc.com or your provider URL).'
    );
  }

  const rpcStatus = await checkRpcHealth(polygonRpcUrl);
  if (!rpcStatus.ok) {
    throw new Error(
      `POLYGON_RPC_URL is not usable: ${rpcStatus.reason}\n` +
      'Fix: replace the RPC URL/API key in .env (or switch provider), then retry.'
    );
  }

  const aavePool = process.env.AAVE_POOL;

  const Factory = await hre.ethers.getContractFactory('FlashLoanArbitrage');
  const c = await Factory.deploy(aavePool);
  await c.waitForDeployment();
  const addr = await c.getAddress();

  console.log('Loaded .env from:', loadedFrom || 'not found');
  console.log('FlashLoanArbitrage deployed:', addr);
}

main().catch((e) => {
  if (e && e.code === 'ENOTFOUND') {
    console.error('DNS error for RPC host. Check POLYGON_RPC_URL in .env; it is likely invalid or contains a placeholder.');
  }
  console.error(e);
  process.exit(1);
});
