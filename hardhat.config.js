require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    zerog: {
      url: "https://evmrpc-testnet.0g.ai",
      accounts: [process.env.ZEROG_PRIVATE_KEY]
    }
  }
};
