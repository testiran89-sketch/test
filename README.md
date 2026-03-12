# Polygon Flash-Loan Arbitrage (SushiSwap -> QuickSwap, CRV/USDC)

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
