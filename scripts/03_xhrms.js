const hre = require("hardhat");

// npx hardhat run scripts\03_xhrms.js --network harmony
async function main() {
    let _HRMS = '0xba4476a302f5bc1dc4053cf79106dc43455904a3'
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
