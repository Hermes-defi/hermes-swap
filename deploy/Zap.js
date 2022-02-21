module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy("Zap", {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: false,
  });

  const zap = await ethers.getContract("Zap");
  const hermes = await deployments.get("HermesToken");
  const router = await deployments.get("HermesRouter02");
  await zap.initialize(hermes.address, router.address);
};

module.exports.tags = ["Zap"];
module.exports.dependencies = ["HermesRouter02", "HermesToken"];
