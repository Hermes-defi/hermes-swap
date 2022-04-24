const hre = require("hardhat");

// npx hardhat run scripts\06_migrator.js --network testnet
// 0xB6800483EA5D0FaD6d0F3D551E586bA187d2103D
async function main() {
    const vyper = '0xda3dd48726278a7f478efae3bef9a5756ccdb4d0';
    const hermes = '0x6397d74A7724287a5A58e625afF8D396DbeE2f9B';
    const hrms = '0x6D401016d0515F6d471952001b8e571364D666d6';
    const wone = '0x7466d7d0c21fa05f32f5a0fa27e12bdc06348ce2';
    const _main = await hre.ethers.getContractFactory("LiquidityTransferService");
    const main = await _main.deploy(vyper, hermes, hrms, wone );
    await main.deployed();
    console.log("main:", main.address);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
