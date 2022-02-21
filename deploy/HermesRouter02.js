const { WAVAX } = require("@traderjoe-xyz/sdk");

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const chainId = await getChainId();

  let wavaxAddress;

  if (chainId === "31337") {
    wavaxAddress = (await deployments.get("WAVAX9Mock")).address;
  } else if (chainId in WAVAX) {
    wavaxAddress = WAVAX[chainId].address;
  } else {
    throw Error("No WAVAX!");
  }

  const factoryAddress = (await deployments.get("HermesFactory")).address;

  await deploy("HermesRouter02", {
    from: deployer,
    args: [factoryAddress, wavaxAddress],
    log: true,
    deterministicDeployment: false,
  });
};

module.exports.tags = ["HermesRouter02", "AMM"];
module.exports.dependencies = ["HermesFactory", "Mocks"];
