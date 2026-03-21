import { JsonRpcProvider } from "ethers";
import pino from "pino";

export type Dex = "uniswapV3" | "sushiswap" | "curve";
export interface PathEdge {
  dex: Dex;
  tokenIn: string;
  tokenOut: string;
  feeBps: number;
  expectedOut: bigint;
}

export interface ArbPlan {
  chainId: number;
  baseToken: string;
  route: PathEdge[];
  estimatedGas: bigint;
  estimatedGrossProfit: bigint;
  estimatedNetProfit: bigint;
}

const logger = pino({ name: "pathfinder" });

export async function findBestPlan(baseToken: string, edges: PathEdge[], gasWei: bigint, gasUnits: bigint): Promise<ArbPlan | null> {
  let best: ArbPlan | null = null;
  for (const a of edges) {
    for (const b of edges) {
      if (a.tokenOut !== b.tokenIn) continue;
      for (const c of edges) {
        if (b.tokenOut !== c.tokenIn || c.tokenOut !== baseToken || a.tokenIn !== baseToken) continue;
        const gross = c.expectedOut - a.expectedOut;
        const gasCost = gasWei * gasUnits;
        const net = gross - gasCost;
        if (net <= 0n) continue;
        const plan: ArbPlan = {
          chainId: 0,
          baseToken,
          route: [a, b, c],
          estimatedGas: gasUnits,
          estimatedGrossProfit: gross,
          estimatedNetProfit: net
        };
        if (!best || plan.estimatedNetProfit > best.estimatedNetProfit) best = plan;
      }
    }
  }
  return best;
}

async function main() {
  const rpc = process.env.RPC_URL;
  if (!rpc) throw new Error("RPC_URL required");
  const provider = new JsonRpcProvider(rpc);
  const network = await provider.getNetwork();
  const gasPrice = (await provider.getFeeData()).gasPrice ?? 1n;
  const sampleEdges: PathEdge[] = [
    { dex: "uniswapV3", tokenIn: process.env.USDC!, tokenOut: process.env.WETH!, feeBps: 5, expectedOut: 1000000000000000000n },
    { dex: "sushiswap", tokenIn: process.env.WETH!, tokenOut: process.env.USDT!, feeBps: 30, expectedOut: 1800000000n },
    { dex: "curve", tokenIn: process.env.USDT!, tokenOut: process.env.USDC!, feeBps: 4, expectedOut: 1005000n }
  ];
  const plan = await findBestPlan(process.env.USDC!, sampleEdges, gasPrice, 500000n);
  logger.info({ chainId: Number(network.chainId), plan }, "pathfinder evaluated routes");
}

if (require.main === module) {
  main().catch((err) => {
    logger.error(err, "pathfinder failed");
    process.exit(1);
  });
}
