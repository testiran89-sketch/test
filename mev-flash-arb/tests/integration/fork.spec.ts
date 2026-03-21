import { expect } from "chai";

describe("Fork integration placeholders", () => {
  it("documents required fork env", async () => {
    expect(process.env.ARBITRUM_RPC_URL || process.env.AVALANCHE_RPC_URL).to.not.equal(undefined);
  });
});
