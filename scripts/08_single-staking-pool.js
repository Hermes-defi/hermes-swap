const hre = require("hardhat");

// npx hardhat run scripts\08_single-staking-pool.js --network testnet
//
async function main() {
    const _stakeToken = '0xBf4d0BC6A6E1f356151D8258a2f801990A3EF307';
    const _rewardToken = '0x53EA989fbD576d162C534aD371992842f1fE791B';
    const _rewardPerBlock = '200000000';
    const _startBlock = '24393533';
    const _bonusEndBlock = '26393533';

    const _main = await hre.ethers.getContractFactory("StakingPool");
    const main = await _main.deploy();
    await main.deployed();
    console.log("main:", main.address);
    await main.initialize(_stakeToken,_rewardToken,
        _rewardPerBlock, _startBlock, _bonusEndBlock);


}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
