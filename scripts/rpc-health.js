async function checkRpcHealth(rpcUrl) {
  if (!rpcUrl) {
    return { ok: false, reason: 'POLYGON_RPC_URL is empty' };
  }

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] })
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (_) {
      payload = null;
    }

    if (!response.ok) {
      const msg = payload?.error?.message || `${response.status} ${response.statusText}`;
      return { ok: false, reason: `RPC HTTP error: ${msg}` };
    }

    if (payload?.error) {
      const msg = payload.error.message || 'unknown rpc error';
      const code = payload.error.code;
      return { ok: false, reason: `RPC error${code !== undefined ? ` (${code})` : ''}: ${msg}` };
    }

    if (!payload?.result) {
      return { ok: false, reason: 'RPC responded without result for eth_chainId' };
    }

    return { ok: true, chainIdHex: payload.result };
  } catch (e) {
    return { ok: false, reason: e?.message || String(e) };
  }
}

module.exports = { checkRpcHealth };
