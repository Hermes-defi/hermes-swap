const hre = require("hardhat");

// npx hardhat run scripts\07_rewarder.js --network testnet
//
async function main() {
    const _rewardToken = '0x53EA989fbD576d162C534aD371992842f1fE791B'; // HRMS
    const _lpToken = '0x24eA73b8b3aEC751c7c96e5a75d2367DC104E97e';
    const _tokenPerSec = '100000000';
    const _MCJ = '0x0C2e9106c2ceCA2cC1e605b3de74887Ab8649361';
    const _main = await hre.ethers.getContractFactory("SimpleRewarderPerSec");
    const main = await _main.deploy(_rewardToken, _lpToken,_tokenPerSec, _MCJ, false );
    await main.deployed();
    console.log("main:", main.address);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
