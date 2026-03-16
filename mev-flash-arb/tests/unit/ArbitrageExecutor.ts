import { expect } from "chai";
import { ethers } from "hardhat";

describe("ArbitrageExecutor", function () {
  it("sets owner and risk params", async function () {
    const [owner] = await ethers.getSigners();
    const c = await ethers.deployContract("ArbitrageExecutor", [
      owner.address,
      owner.address,
      owner.address,
      owner.address
    ]);
    await c.waitForDeployment();
    await c.setRiskParams(100, 1_000_000, 100e9);
    expect(await c.minProfitThreshold()).to.equal(1_000_000);
  });

  it("pauses trading", async function () {
    const [owner] = await ethers.getSigners();
    const c = await ethers.deployContract("ArbitrageExecutor", [owner.address, owner.address, owner.address, owner.address]);
    await c.setPaused(true);
    expect(await c.paused()).to.equal(true);
  });
});
