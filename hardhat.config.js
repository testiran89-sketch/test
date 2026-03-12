require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || '';

module.exports = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    polygon: {
      url: POLYGON_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    }
  }
};
