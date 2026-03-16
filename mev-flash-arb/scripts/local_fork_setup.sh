#!/usr/bin/env bash
set -euo pipefail

: "${ARBITRUM_RPC_URL:?ARBITRUM_RPC_URL is required}"
: "${AVALANCHE_RPC_URL:?AVALANCHE_RPC_URL is required}"

anvil --fork-url "$ARBITRUM_RPC_URL" --chain-id 42161 --port 8545 --host 0.0.0.0 &
ARB_PID=$!
anvil --fork-url "$AVALANCHE_RPC_URL" --chain-id 43114 --port 8546 --host 0.0.0.0 &
AVAX_PID=$!

echo "Arbitrum fork PID: $ARB_PID"
echo "Avalanche fork PID: $AVAX_PID"
wait
