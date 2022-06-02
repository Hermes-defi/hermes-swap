const hre = require("hardhat");

// npx hardhat run scripts\04_shrms.js --network harmony
async function main() {
    const _rewardToken = '0x985458E523dB3d53125813eD68c274899e9DfAb4' // 1USDC
    let _hermes = '0xba4476a302f5bc1dc4053cf79106dc43455904a3'
    const _feeCollector = '0x79dE631fFb7291Acdb50d2717AE32D44D5D00732'
    const _depositFeePercent = '50000000000000000';
    const _main = await hre.ethers.getContractFactory("StableHermesStaking");
    const main = await _main.deploy(_rewardToken, _hermes, _feeCollector, _depositFeePercent);
    await main.deployed();
    console.log("sHRMS:", main.address);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
