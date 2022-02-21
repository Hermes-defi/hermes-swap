const hre = require("hardhat");
const fs = require('fs');
// npx hardhat run scripts\main.js --network one
async function main() {
    const _HermesFactory = await hre.ethers.getContractFactory("HermesFactory");
    const HermesFactory = await _HermesFactory.deploy(process.env.DEV);
    await HermesFactory.deployed();
    console.log("HermesFactory:", HermesFactory.address);
    const pairCodeHash = await HermesFactory.pairCodeHash();
    console.log('pairCodeHash', pairCodeHash);
    let env = fs.readFileSync('./contracts.json','utf-8');
    env = env && env!=='' ? JSON.parse(env) : {};
    env.FACTORY = HermesFactory.address;
    env.pairCodeHash = pairCodeHash;
    fs.writeFileSync('./contracts.json', JSON.stringify(env));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
