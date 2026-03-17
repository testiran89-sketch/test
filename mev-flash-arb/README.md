# mev-flash-arb

Production-oriented MEV arbitrage framework for **Arbitrum + Avalanche** with a mempool-first workflow and private submission.

## Architecture
- `bot/mempool-listener` (Go): low-latency pending tx stream parser.
- `bot/pathfinder` (TS): multi-hop/cross-DEX route evaluator returning `ArbPlan`.
- `bot/simulator` (TS): pre-check + full `eth_call` simulation.
- `bot/bundle-builder` (TS): Flashbots bundle build/sign and private fallback config.
- `bot/executor` (TS): orchestration, retries, metrics, DB persistence.
- `contracts/ArbitrageExecutor.sol`: flash loan + adapter-driven swap executor.

## Quick start
```bash
cp .env.example .env
npm install
npm run build
npm test
```

> Note: this scaffold currently uses `npm install` (not `npm ci`) because a committed lockfile is not yet shipped.

## Local fork setup
```bash
./scripts/local_fork_setup.sh
```
Starts dual anvil forks:
- Arbitrum on `:8545`
- Avalanche on `:8546`

## Run services
```bash
# mempool listener
cd bot/mempool-listener && go mod tidy && go run .

# pathfinder
npm run pathfinder

# simulator
SIM_TO=0x... SIM_FROM=0x... SIM_DATA=0x... npm run simulator

# executor metrics/db
npm run executor
```

## Deploy contracts
```bash
npx hardhat run scripts/deploy.ts --network hardhat
```

## Testing notes
- Unit tests run on in-memory Hardhat by default (no RPC fork needed):
```bash
npm test
```
- Enable fork mode only when you explicitly need live-state tests:
```bash
ENABLE_FORKING=true ARBITRUM_RPC_URL=https://... npm test
```


## Flashbots auth key (when you do not have one yet)
You do **not** need to request access manually. Create a local ephemeral signing key:
```bash
cast wallet new
```
Use the generated private key as `FLASHBOTS_AUTH_KEY` (do not fund it; it is only for relay identity/signing headers).

## Flashbots relay and Protect
- Default relay: `https://relay.flashbots.net`
- Protect fallback: `https://rpc.flashbots.net`
- Configure via `.env` + `configs/flashbots.config.example`
- Always use simulation before `eth_sendBundle` or Protect submission.

## Test bundle simulation
```bash
TARGET_BLOCK_HEX=0x... BUNDLE_TXS=0xsigned1,0xsigned2 npm run tsx scripts/simulate_bundle.ts
```

## Operational playbook
1. **Failed bundles:** inspect simulator diff vs latest pending state; increase safety buffer; reduce size.
2. **Gas spikes/PGA:** enforce ROI guard and `maxGasPrice`; increase only when inclusion probability is high.
3. **Emergency pause:** call `setPaused(true)` on `ArbitrageExecutor` and stop executor loop.
4. **Relay outage:** fail over to private RPC/Protect with tighter min-profit thresholds.

## Safety defaults
- `minProfitThreshold` should include gas + flashloan fee + 30% safety buffer.
- Never log private keys.
- Use HSM/KMS signer in production.
