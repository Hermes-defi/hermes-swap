const HERMES_AVAX_LP = new Map();
HERMES_AVAX_LP.set("4", "0xab9ba8c7e7b00381027061a8506d895e8938060b");

module.exports = async function ({ ethers, getNamedAccounts, deployments }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const chainId = await getChainId();

  if (!HERMES_AVAX_LP.has(chainId)) {
    throw Error("No HERMES-AVAX LP");
  }

  const hermesAvaxLpAddress = HERMES_AVAX_LP.get(chainId);
  const bar = await ethers.getContract("HermesBar");
  const hermes = await ethers.getContract("HermesToken");
  const chef = await ethers.getContract("MasterChefHermesV2");
  const pid = 0;

  await deploy("HermesVote", {
    from: deployer,
    args: [hermesAvaxLpAddress, bar.address, hermes.address, chef.address, pid],
    log: true,
    deterministicDeployment: false,
  });
};

module.exports.tags = ["HermesVote"];
module.exports.dependencies = ["HermesBar", "HermesToken", "MasterChefHermesV2"];
