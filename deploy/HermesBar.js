module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const hermes = await deployments.get("HermesToken");

  await deploy("HermesBar", {
    from: deployer,
    args: [hermes.address],
    log: true,
    deterministicDeployment: false,
  });
};

module.exports.tags = ["HermesBar"];
module.exports.dependencies = ["HermesFactory", "HermesRouter02", "HermesToken"];
