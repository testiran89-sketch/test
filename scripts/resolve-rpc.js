const { checkRpcHealth } = require('./rpc-health');

async function resolveRpcUrl(env) {
  const primary = (env.POLYGON_RPC_URL || '').trim();
  const fallback = (env.POLYGON_FALLBACK_RPC_URL || '').trim();

  if (!primary && !fallback) {
    return {
      ok: false,
      reason: 'Neither POLYGON_RPC_URL nor POLYGON_FALLBACK_RPC_URL is set.'
    };
  }

  if (primary) {
    const p = await checkRpcHealth(primary);
    if (p.ok) {
      return { ok: true, url: primary, source: 'POLYGON_RPC_URL', chainIdHex: p.chainIdHex };
    }

    if (fallback) {
      const f = await checkRpcHealth(fallback);
      if (f.ok) {
        return {
          ok: true,
          url: fallback,
          source: 'POLYGON_FALLBACK_RPC_URL',
          chainIdHex: f.chainIdHex,
          warning: `Primary RPC failed: ${p.reason}`
        };
      }
      return {
        ok: false,
        reason: `Primary RPC failed: ${p.reason} | Fallback RPC failed: ${f.reason}`
      };
    }

    return { ok: false, reason: `Primary RPC failed: ${p.reason}` };
  }

  const f = await checkRpcHealth(fallback);
  if (f.ok) {
    return { ok: true, url: fallback, source: 'POLYGON_FALLBACK_RPC_URL', chainIdHex: f.chainIdHex };
  }
  return { ok: false, reason: `Fallback RPC failed: ${f.reason}` };
}

module.exports = { resolveRpcUrl };
