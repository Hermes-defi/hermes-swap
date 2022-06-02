const hre = require("hardhat");

// npx hardhat run scripts\01_token_mc.js --network harmony
async function main() {
    const [_dev] = await ethers.getSigners();
    const dev = _dev.address;

    const _HermesToken = await hre.ethers.getContractFactory("Hermes");
    const HermesToken = await _HermesToken.attach('0xba4476a302f5bc1dc4053cf79106dc43455904a3')
    /*
        await HermesToken.deployed();
        console.log("HermesToken:", HermesToken.address);
        await HermesToken.mint(process.env.DEV, process.env.MINT_AMOUNT);
        console.log('MINT_AMOUNT', process.env.DEV, process.env.MINT_AMOUNT / 1e9);
    */
    const _MasterChefHermesV2 = await hre.ethers.getContractFactory("MasterChefHermesV2");

    const _hermes = '0xba4476a302f5bc1dc4053cf79106dc43455904a3';
    const _devAddr = '0x7cef2432A2690168Fb8eb7118A74d5f8EfF9Ef55';
    const _treasuryAddr = '0x79dE631fFb7291Acdb50d2717AE32D44D5D00732';
    const _investorAddr = '0x7cef2432A2690168Fb8eb7118A74d5f8EfF9Ef55';
    const _hermesPerSec = '416700000';
    const _startTimestamp = '1654029000';
    const _devPercent = '0';
    const _treasuryPercent = '0';
    const _investorPercent = '0';

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
    await HermesToken.grantMinterRole(MasterChefHermesV2.address);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
