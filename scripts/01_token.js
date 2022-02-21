const hre = require("hardhat");
// npx hardhat run scripts\main.js --network one
async function main() {

    const network = await ethers.getDefaultProvider().getNetwork();
    console.log("Network name=", network.name);
    console.log("Network chain id=", network.chainId);

    const _HermesToken = await hre.ethers.getContractFactory("HermesToken");
    const HermesToken = await _HermesToken.deploy();
    await HermesToken.deployed();
    console.log("HermesToken:", HermesToken.address);
    await HermesToken.mint(process.env.DEV, process.env.MINT_AMOUNT);
    console.log('MINT_AMOUNT', process.env.DEV, process.env.MINT_AMOUNT/1e18);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
