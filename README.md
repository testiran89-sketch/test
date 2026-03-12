# Polygon Flash-Loan Arbitrage (QuickSwap -> Uniswap)

> Educational code. Use at your own risk.

## 1) Setup

```bash
npm install
cp .env.example .env
```

Fill `.env` with your Polygon RPC API key and wallet private key.

## 2) Compile

```bash
npm run build
```

## 3) Deploy contract

```bash
npm run deploy
```

Copy deployed address into `ARB_CONTRACT` in `.env`.

## 4) Run one arbitrage attempt

```bash
npm run arb
```

If profitable under `MIN_PROFIT_USDC`, the transaction succeeds and profit remains in contract.

## 5) Withdraw profit

Use Hardhat console or a script to call:

- `withdrawToken(USDC, amount, yourWallet)`

## Notes

- Contract reverts if `finalBalance < repayment + minProfitUSDC`.
- Uses `amountOutMin` on both swaps for slippage protection.
- You should run simulations on a fork before mainnet.
