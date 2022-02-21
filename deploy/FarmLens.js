const { WAVAX } = require("@hermesswap-xyz/sdk");

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const chainId = await getChainId();

  let wavaxAddress;
  let wavaxUsdtAddress;
  let wavaxUsdcAddress;
  let wavaxDaiAddress;

  if (chainId === "31337") {
    wavaxAddress = (await deployments.get("WAVAX9Mock")).address;
  } else if (chainId in WAVAX) {
    wavaxAddress = WAVAX[chainId].address;
  } else {
    throw Error("No WAVAX!");
  }
  if (chainId === "43114") {
    wavaxUsdtAddress = address("0xeD8CBD9F0cE3C6986b22002F03c6475CEb7a6256");
    wavaxUsdcAddress = address("0x87Dee1cC9FFd464B79e058ba20387c1984aed86a");
    wavaxDaiAddress = address("0xA389f9430876455C36478DeEa9769B7Ca4E3DDB1");
  } else if (chainId === "4") {
    wavaxUsdtAddress = address("0x63fce17ba68c82a322fdd5a4d03aedbedbd730fd");
    wavaxUsdcAddress = address("0x63fce17ba68c82a322fdd5a4d03aedbedbd730fd");
    wavaxDaiAddress = address("0x63fce17ba68c82a322fdd5a4d03aedbedbd730fd");
  }

  const hermesAddress = (await deployments.get("HermesToken")).address;
  const hermesFactoryAddress = (await deployments.get("HermesFactory")).address;
  const chefAddress = (await deployments.get("MasterChefHermesV2")).address;
  const chefAddressV3 = (await deployments.get("MasterChefHermesV3")).address;

  await deploy("FarmLens", {
    from: deployer,
    args: [
      hermesAddress,
      wavaxAddress,
      wavaxUsdtAddress,
      wavaxUsdcAddress,
      wavaxDaiAddress,
      hermesFactoryAddress,
      chefAddress,
      chefAddressV3,
    ],
    log: true,
    deterministicDeployment: false,
  });
};

module.exports.tags = ["FarmLens"];
module.exports.dependencies = [
  "HermesToken",
  "HermesFactory",
  "MasterChefHermesV2",
  "MasterChefHermesV3",
  "WAVAX9Mock",
];
