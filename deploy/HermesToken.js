module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy("HermesToken", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
  });
};

module.exports.tags = ["HermesToken", "chef"];
// module.exports.dependencies = ["HermesFactory", "HermesRouter02"];
