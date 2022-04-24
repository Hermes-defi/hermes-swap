const hre = require("hardhat");

// npx hardhat run scripts\04_shrms.js --network testnet
async function main() {
    const _rewardToken = '0x57dDc3FffECe5FfcfDB3170266cB564A52Ee2540' // UST
    let _hermes = '0x53EA989fbD576d162C534aD371992842f1fE791B'
    const _feeCollector = '0x78B3Ec25D285F7a9EcA8Da8eb6b20Be4d5D70E84'
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
