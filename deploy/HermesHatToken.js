module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy("HermesHatToken", {
    from: deployer,
    args: [deployer],
    log: true,
    deterministicDeployment: false,
  });
};

module.exports.tags = ["HermesHatToken"];
