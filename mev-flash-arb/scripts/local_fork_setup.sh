#!/usr/bin/env bash
set -euo pipefail

: "${ARBITRUM_RPC_URL:?ARBITRUM_RPC_URL is required}"
: "${AVALANCHE_RPC_URL:?AVALANCHE_RPC_URL is required}"

ARB_PORT="${ARBITRUM_FORK_PORT:-8545}"
AVAX_PORT="${AVALANCHE_FORK_PORT:-8546}"

port_in_use() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"${port}" -sTCP:LISTEN -n -P >/dev/null 2>&1
  else
    ss -ltn "sport = :${port}" | tail -n +2 | grep -q .
  fi
}

if port_in_use "$ARB_PORT" || port_in_use "$AVAX_PORT"; then
  echo "One or more fork ports are already in use (ARB:${ARB_PORT}, AVAX:${AVAX_PORT})." >&2
  echo "Stop existing Anvil processes or change ARBITRUM_FORK_PORT/AVALANCHE_FORK_PORT." >&2
  exit 1
fi

anvil --fork-url "$ARBITRUM_RPC_URL" --chain-id 42161 --port "$ARB_PORT" --host 0.0.0.0 &
ARB_PID=$!
anvil --fork-url "$AVALANCHE_RPC_URL" --chain-id 43114 --port "$AVAX_PORT" --host 0.0.0.0 &
AVAX_PID=$!

cleanup() {
  kill "$ARB_PID" "$AVAX_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "Arbitrum fork PID: $ARB_PID (port ${ARB_PORT})"
echo "Avalanche fork PID: $AVAX_PID (port ${AVAX_PORT})"
wait
