# Polygon Flash-Loan Arbitrage (SushiSwap -> QuickSwap, CRV/USDC)

> Educational code. Use at your own risk.

## 1) Setup

```bash
npm install
cp .env.example .env
```

Fill `.env` with your Polygon RPC API key and wallet private key.

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

If loan repayment is possible, the transaction succeeds and any remaining USDC profit stays in the contract.

## 5) Withdraw profit

Use Hardhat console or a script to call:

- `withdrawToken(USDC, amount, yourWallet)`

## Notes

- Contract reverts only if it cannot repay the flash-loan (`finalBalance < repayment`).
- Uses `amountOutMin` on both swaps for slippage protection.
- You should run simulations on a fork before mainnet.
