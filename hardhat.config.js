require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-web3");
require("@nomiclabs/hardhat-etherscan");
require('dotenv').config({ path: '.env' });
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {

    },
    localhost: {
      url: 'http://localhost:8545',
    },
    testnet: {
      url: 'https://api.s0.b.hmny.io',
      accounts: [`${process.env.PRIVATE_KEY}`]
    },
    mainnet: {
      url: 'https://api.s0.t.hmny.io',
      accounts: [`${process.env.PRIVATE_KEY}`]
    },
  },
};
