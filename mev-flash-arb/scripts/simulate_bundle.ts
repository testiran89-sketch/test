import { JsonRpcProvider } from "ethers";

async function main() {
  const provider = new JsonRpcProvider(process.env.RPC_URL);
  const result = await provider.send("eth_callBundle", [
    {
      txs: process.env.BUNDLE_TXS?.split(",") ?? [],
      blockNumber: process.env.TARGET_BLOCK_HEX,
      stateBlockNumber: "latest"
    }
  ]);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
