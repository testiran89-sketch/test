# SECURITY CHECKLIST

## Threats and mitigations
- **Sandwich/backrun theft**: default to private relay submission (Flashbots / private RPC).
- **Stale state reverts**: two-phase sim (pre-check then full `eth_call` at pending block context).
- **Gas griefing/PGA overbid**: cap gas with `maxGasPrice` and ROI guard in bundle builder.
- **Flashloan callback abuse**: strict sender checks for Aave/Balancer callbacks.
- **Approval risks**: reset-to-zero then set exact allowance before each adapter swap.
- **Reentrancy**: `ReentrancyGuard` on entrypoint.
- **Admin key compromise**: owner should be multisig; private key in HSM/KMS.
- **Bridge latency (cross-chain)**: only plan cross-chain opportunities if expected net profit exceeds latency risk premium.

## CI security gates
- Slither static analysis.
- Mythril symbolic analysis for `ArbitrageExecutor.sol`.
- Unit + fork integration tests before deploy.

## Incident response
1. Pause contract.
2. Rotate signer.
3. Disable affected DEX adapters.
4. Re-run audits and dry-run fork tests before resume.
