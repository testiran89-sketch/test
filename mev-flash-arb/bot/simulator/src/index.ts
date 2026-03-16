import { JsonRpcProvider } from "ethers";
import pino from "pino";

const logger = pino({ name: "simulator" });

export interface SimulationRequest {
  to: string;
  data: string;
  from: string;
  blockTag?: string;
}

export async function simulateCall(req: SimulationRequest) {
  const provider = new JsonRpcProvider(process.env.RPC_URL);
  const result = await provider.call({ to: req.to, data: req.data, from: req.from }, req.blockTag ?? "pending");
  const gasEstimate = await provider.estimateGas({ to: req.to, data: req.data, from: req.from });
  return { ok: true, returnData: result, gasUsed: gasEstimate.toString() };
}

async function main() {
  if (!process.env.SIM_TO || !process.env.SIM_DATA || !process.env.SIM_FROM) {
    throw new Error("SIM_TO, SIM_DATA, SIM_FROM required");
  }
  const out = await simulateCall({ to: process.env.SIM_TO, data: process.env.SIM_DATA, from: process.env.SIM_FROM });
  logger.info(out, "simulation result");
}

if (require.main === module) {
  main().catch((err) => {
    logger.error(err, "simulation failed");
    process.exit(1);
  });
}
