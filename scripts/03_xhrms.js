const hre = require("hardhat");

// npx hardhat run scripts\03_xhrms.js --network testnet
async function main() {
    let _HRMS = '0x53EA989fbD576d162C534aD371992842f1fE791B'
    const _HermesBar = await hre.ethers.getContractFactory("HermesBar");
    const HermesBar = await _HermesBar.deploy(_HRMS);
    await HermesBar.deployed();
    console.log("xHRMS:", HermesBar.address);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
