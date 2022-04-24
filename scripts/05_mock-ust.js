const hre = require("hardhat");

// npx hardhat run scripts\05_mock-ust.js --network testnet
async function main() {
    const _main = await hre.ethers.getContractFactory("ERC20Mock");
    const main = await _main.deploy('UST', 'UST', '1000000000000000000000000');
    await main.deployed();
    console.log("UST:", main.address);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
