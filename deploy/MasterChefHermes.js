module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, dev, treasury } = await getNamedAccounts();

  const hermes = await ethers.getContract("HermesToken");

  const { address } = await deploy("MasterChefHermes", {
    from: deployer,
    args: [
      hermes.address,
      dev,
      treasury,
      "100000000000000000000",
      "1619065864",
      "200",
      "200",
    ],
    log: true,
    deterministicDeployment: false,
  });

  // if ((await hermes.owner()) !== address) {
  //   // Transfer Hermes Ownership to Hermes
  //   console.log("Transfer Hermes Ownership to Hermes");
  //   await (await hermes.transferOwnership(address)).wait();
  // }
};

module.exports.tags = ["MasterChefHermes"];
module.exports.dependencies = ["HermesFactory", "HermesRouter02", "HermesToken"];
