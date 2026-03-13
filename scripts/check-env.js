const { loadEnv, requireEnv } = require('./load-env');
const { resolveRpcUrl } = require('./resolve-rpc');
const { normalizeAddress } = require('./address-utils');

const mode = (process.argv[2] || 'arb').toLowerCase();

const requiredByMode = {
  deploy: ['PRIVATE_KEY', 'AAVE_POOL'],
  arb: [
    'PRIVATE_KEY',
    'ARB_CONTRACT',
    'USDC',
    'FLASH_AMOUNT_USDC'
  ]
};

if (!requiredByMode[mode]) {
  console.error('Unknown mode. Use: node scripts/check-env.js [deploy|arb]');
  process.exit(1);
}

const required = requiredByMode[mode];
const { loadedFrom } = loadEnv();
const missing = requireEnv(required);

console.log('Mode:', mode);
console.log('Loaded .env from:', loadedFrom || 'not found');
for (const key of required) {
  const val = process.env[key];
  console.log(`${key}=${val ? '[set]' : '[missing]'}`);
}

if (missing.length > 0) {
  console.error('\nMissing keys:', missing.join(', '));
  process.exit(1);
}

console.log('\nAll required env keys are present.');

const tokenOtherRaw = process.env.TOKEN_OTHER || process.env.CRV;
const buyRouterRaw = process.env.BUY_ROUTER || process.env.SUSHISWAP_ROUTER;
const sellRouterRaw = process.env.SELL_ROUTER || process.env.QUICKSWAP_ROUTER;

if (mode === 'arb' && (!tokenOtherRaw || !buyRouterRaw || !sellRouterRaw)) {
  console.error('Address validation: FAIL - set TOKEN_OTHER, BUY_ROUTER, SELL_ROUTER (or legacy CRV/SUSHISWAP_ROUTER/QUICKSWAP_ROUTER).');
  process.exit(1);
}

const addressFields = mode === 'deploy'
  ? ['AAVE_POOL']
  : ['ARB_CONTRACT', 'USDC'];

for (const field of addressFields) {
  try {
    normalizeAddress(process.env[field], field);
  } catch (e) {
    console.error(`Address validation: FAIL - ${e.message}`);
    process.exit(1);
  }
}


if (mode === 'arb') {
  try {
    normalizeAddress(tokenOtherRaw, 'TOKEN_OTHER');
    normalizeAddress(buyRouterRaw, 'BUY_ROUTER');
    normalizeAddress(sellRouterRaw, 'SELL_ROUTER');
  } catch (e) {
    console.error(`Address validation: FAIL - ${e.message}`);
    process.exit(1);
  }
}
console.log('Address validation: OK');

resolveRpcUrl(process.env)
  .then((resolved) => {
    if (!resolved.ok) {
      console.error(`RPC health: FAIL - ${resolved.reason}`);
      if (String(resolved.reason).includes('401') || String(resolved.reason).toLowerCase().includes('unauthorized')) {
        console.error('Tip: your RPC API key is invalid/disabled. Replace POLYGON_RPC_URL or clear it to use POLYGON_FALLBACK_RPC_URL.');
      }
      process.exit(1);
    }

    if (resolved.warning) {
      console.warn(`RPC health: WARN - ${resolved.warning}`);
    }
    console.log(`RPC health: OK via ${resolved.source} (chainId ${resolved.chainIdHex})`);
  })
  .catch((e) => {
    console.error(`RPC health: FAIL - ${e?.message || String(e)}`);
    process.exit(1);
  });
