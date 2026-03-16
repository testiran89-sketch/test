import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const executor = await ethers.deployContract("ArbitrageExecutor", [
    process.env.USDC!,
    process.env.AAVE_POOL!,
    process.env.BALANCER_VAULT!,
    deployer.address
  ]);
  await executor.waitForDeployment();
  console.log("ArbitrageExecutor:", await executor.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
