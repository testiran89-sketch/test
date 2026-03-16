import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  paths: {
    tests: "tests/unit"
  },
  networks: {
    hardhat: {
      forking: process.env.ARBITRUM_RPC_URL
        ? {
            url: process.env.ARBITRUM_RPC_URL,
            blockNumber: process.env.ARBITRUM_FORK_BLOCK ? Number(process.env.ARBITRUM_FORK_BLOCK) : undefined
          }
        : undefined
    }
  }
};

export default config;
