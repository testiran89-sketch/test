const { spawn } = require('child_process');
const { loadEnv } = require('./load-env');
const { resolveRpcUrl } = require('./resolve-rpc');

async function main() {
  const mode = (process.argv[2] || '').toLowerCase();
  if (!['deploy', 'arb'].includes(mode)) {
    console.error('Usage: node scripts/run-hardhat-with-rpc.js <deploy|arb>');
    process.exit(1);
  }

  const { loadedFrom } = loadEnv();
  const resolved = await resolveRpcUrl(process.env);
  if (!resolved.ok) {
    console.error(`RPC resolution failed: ${resolved.reason}`);
    process.exit(1);
  }

  if (resolved.warning) {
    console.warn(`RPC warning: ${resolved.warning}`);
  }
  console.log(`Loaded .env from: ${loadedFrom || 'not found'}`);
  console.log(`Using RPC from ${resolved.source} (chainId ${resolved.chainIdHex})`);

  const script = mode === 'deploy' ? 'scripts/deploy.js' : 'scripts/run-arb.js';
  const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['hardhat', 'run', script, '--network', 'polygon'],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        POLYGON_RPC_URL: resolved.url
      }
    }
  );

  child.on('exit', (code) => process.exit(code ?? 1));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
