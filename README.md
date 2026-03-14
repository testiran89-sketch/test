# Polygon Flash-Loan Arbitrage (SushiSwap -> QuickSwap, CRV/USDC)

> Educational code. Use at your own risk.

## 1) Setup

```bash
npm install
cp .env.example .env
```

Fill `.env` with your Polygon RPC API key and wallet private key.
You can keep `POLYGON_FALLBACK_RPC_URL=https://polygon-rpc.com` as backup.

Important: `echo $VAR` فقط متغیرهای **export شده در همان شل** را نشان می‌دهد. اگر فقط داخل `.env` ذخیره کردی، ممکن است `echo` خالی باشد ولی اسکریپت با dotenv آن را بخواند.

برای بررسی مطمئن از داخل پروژه:

```bash
npm run check-env:deploy
```

اگر می‌خواهی `.env` را وارد شل کنی (اختیاری):

```bash
set -a
source .env
set +a
```

If you see `getaddrinfo ENOTFOUND polygon-mainnet.g.alchemy.com`, your `POLYGON_RPC_URL` is invalid (usually because `YOUR_API_KEY` was not replaced). Use a real URL.

If you see `API key disabled / tenant disabled / 403`, your RPC provider key is disabled or suspended. Replace `POLYGON_RPC_URL` with an active endpoint and re-run checks.

If you see `401 Unauthorized`, your RPC key is invalid/expired. Quick fix:

1. set a valid `POLYGON_RPC_URL`, or
2. temporarily clear `POLYGON_RPC_URL` and rely on `POLYGON_FALLBACK_RPC_URL`.

If you see `bad address checksum`, your address casing is inconsistent. Scripts now auto-normalize addresses, and `npm run check-env` validates them before execution.

## 2) Compile

```bash
npm run build
```

## 2.1) Validate env quickly

```bash
npm run check-env
```

`check-env` now validates both env keys and RPC health (calls `eth_chainId`).

برای قبل از deploy:

```bash
npm run check-env:deploy
```

## 3) Deploy contract

```bash
npm run deploy
```

`npm run deploy` now auto-selects a healthy RPC: it tries `POLYGON_RPC_URL` first, and if that fails, falls back to `POLYGON_FALLBACK_RPC_URL`.

Quick pre-check:

```bash
echo $POLYGON_RPC_URL
```

Copy deployed address into `ARB_CONTRACT` in `.env`.

`ARB_CONTRACT` یعنی آدرس همان قرارداد `FlashLoanArbitrage` که با دستور `npm run deploy` روی شبکه Polygon برای خودت دیپلوی می‌کنی.

## 4) Run one arbitrage attempt

```bash
npm run arb
```

`npm run arb` uses the same RPC auto-selection logic as deploy.

> Tip: avoid running `npx hardhat run ... --network polygon` directly; use npm scripts so RPC fallback logic is applied.

Runner now does a preflight profitability/safety simulation before broadcast:
- estimates `repayment = amountIn + flashFee` (configurable via `FLASH_FEE_BPS`, default 9 bps),
- checks estimated net `usdcBack - repayment` (blocked when `REQUIRE_NON_NEGATIVE=1`),
- executes `startArbitrage.staticCall(...)` to catch on-chain revert reasons before spending gas.
- auto-tests multiple paths (`direct`, `via WMATIC`, `via WETH`) and chooses the **best full buy+sell combination by final USDC back**.

Optional routing/sanity envs:
- `BUY_PATH`, `SELL_PATH` (comma-separated addresses),
- `MAX_BUY_PRICE_USDC`, `MIN_SELL_PRICE_USDC` guard rails (set `0` to disable),
- `MIN_NET_USDC` minimum net profit threshold (recommended > gas buffer).

To change pair/venue (e.g. WBTC/USDC, QuickSwap->Uniswap), set in `.env`:
- `TOKEN_OTHER` (e.g. WBTC),
- `BUY_ROUTER` (cheaper venue),
- `SELL_ROUTER` (expensive venue),
- optional `BUY_PATH` / `SELL_PATH` for explicit routing.

Legacy names (`CRV`, `SUSHISWAP_ROUTER`, `QUICKSWAP_ROUTER`) are still accepted for backward compatibility.

Price sanity calculations now use token decimals correctly (`USDC=6`, `CRV=18`) by reading decimals of both tokens.

If spread collapses (e.g. ~0.01%), the runner should block by design via precheck (`estimated net <= 0` or below `MIN_NET_USDC`).

⚠️ If you pull this update, redeploy contract and update `ARB_CONTRACT` because `ArbParams` ABI changed (dynamic paths were added).

If loan repayment is possible, the transaction succeeds and any remaining USDC profit stays in the contract.

## 5) Withdraw profit

Use Hardhat console or a script to call:

- `withdrawToken(USDC, amount, yourWallet)`

## Notes

- Contract reverts only if it cannot repay the flash-loan (`finalBalance < repayment`).
- Uses `amountOutMin` on both swaps for slippage protection.
- You should run simulations on a fork before mainnet.
