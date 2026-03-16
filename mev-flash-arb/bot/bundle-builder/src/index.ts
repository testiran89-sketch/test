import axios from "axios";

export interface BundleTx {
  signedTransaction: string;
}

export async function buildAndSubmitBundle(relayUrl: string, txs: BundleTx[], targetBlockHex: string) {
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_sendBundle",
    params: [{ txs: txs.map((t) => t.signedTransaction), blockNumber: targetBlockHex }]
  };
  const response = await axios.post(relayUrl, payload, {
    headers: {
      "Content-Type": "application/json"
    }
  });
  return response.data;
}
