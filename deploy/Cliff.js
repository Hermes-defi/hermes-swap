module.exports = async function ({ ethers, getNamedAccounts, deployments }) {
  const { deploy } = deployments;

  const { deployer, dev } = await getNamedAccounts();

  const chainId = await getChainId();

  const hermes = await ethers.getContract("HermesToken");

  await deploy("Cliff", {
    from: deployer,
    args: [hermes.address, dev, 0, 3],
    log: true,
    deterministicDeployment: false,
  });
};

module.exports.tags = ["Cliff"];
module.exports.dependencies = ["HermesToken"];
