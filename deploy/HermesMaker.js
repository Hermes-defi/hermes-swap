const { WAVAX } = require("@hermesswap-xyz/sdk");

module.exports = async function ({ ethers, getNamedAccounts, deployments }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const chainId = await getChainId();

  const factory = await ethers.getContract("HermesFactory");
  const bar = await ethers.getContract("HermesBar");
  const hermes = await ethers.getContract("HermesToken");

  let wavaxAddress;

  if (chainId === "31337") {
    wavaxAddress = (await deployments.get("WAVAX9Mock")).address;
  } else if (chainId in WAVAX) {
    wavaxAddress = WAVAX[chainId].address;
  } else {
    throw Error("No WAVAX!");
  }

  await deploy("HermesMaker", {
    from: deployer,
    args: [factory.address, bar.address, hermes.address, wavaxAddress],
    log: true,
    deterministicDeployment: false,
  });
};

module.exports.tags = ["HermesMaker"];
module.exports.dependencies = [
  "HermesFactory",
  "HermesRouter02",
  "HermesBar",
  "HermesToken",
];
