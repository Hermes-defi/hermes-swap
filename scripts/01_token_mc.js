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
    console.log('MINT_AMOUNT', process.env.DEV, process.env.MINT_AMOUNT / 1e18);

    const _MasterChefHermesV2 = await hre.ethers.getContractFactory("MasterChefHermesV2");

    const _hermes = HermesToken.address;
    const _devAddr = process.env.DEV;
    const _treasuryAddr = process.env.DEV;
    const _investorAddr = process.env.DEV;
    const _hermesPerSec = '100000000000000000'; // 0.1
    const _startTimestamp = '1';
    const _devPercent = '100';
    const _treasuryPercent = '100';
    const _investorPercent = '100';

    const MasterChefHermesV2 = await _MasterChefHermesV2.deploy(
        _hermes,
        _devAddr,
        _treasuryAddr,
        _investorAddr,
        _hermesPerSec, // 0.1
        _startTimestamp,
        _devPercent,
        _treasuryPercent,
        _investorPercent);
    await MasterChefHermesV2.deployed();
    console.log("MasterChefHermesV2:", MasterChefHermesV2.address);
    await HermesToken.setMinter(MasterChefHermesV2.address, true);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
