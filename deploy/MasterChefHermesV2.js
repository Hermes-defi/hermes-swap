module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, dev, treasury, investor } = await getNamedAccounts();

  const hermes = await ethers.getContract("HermesToken");

  const { address } = await deploy("MasterChefHermesV2", {
    from: deployer,
    args: [
      hermes.address,
      dev,
      treasury,
      investor,
      "30000000000000000000", // 30 HERMES per sec
      "1625320800", // Sat Jul 03 10:00
      "200", // 20%
      "200", // 20%
      "100", // 10%
    ],
    log: true,
    deterministicDeployment: false,
  });

  if ((await hermes.owner()) !== address) {
    // Transfer Hermes Ownership to MasterChefHermesV2
    console.log("Transfer Hermes Ownership to MasterChefHermesV2");
    await (await hermes.transferOwnership(address)).wait();
  }
};

module.exports.tags = ["MasterChefHermesV2", "chef"];
// module.exports.dependencies = ["HermesFactory", "HermesRouter02", "HermesToken"];
