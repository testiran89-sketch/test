const { loadEnv, requireEnv } = require('./load-env');

const mode = (process.argv[2] || 'arb').toLowerCase();

const requiredByMode = {
  deploy: ['POLYGON_RPC_URL', 'PRIVATE_KEY', 'AAVE_POOL'],
  arb: [
    'POLYGON_RPC_URL',
    'PRIVATE_KEY',
    'ARB_CONTRACT',
    'USDC',
    'CRV',
    'SUSHISWAP_ROUTER',
    'QUICKSWAP_ROUTER',
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
