const hre = require("hardhat");
const fs = require('fs');
// npx hardhat run scripts\02_factory.js --network harmony
async function main() {
    const distributor = '0x669aBa76A65c9A538760Ce8A66171e49F10BA1Ff';
    const [dev] = await hre.ethers.getSigners();
    const _HermesFactory = await hre.ethers.getContractFactory("HermesFactory");
    const HermesFactory = await _HermesFactory.deploy(dev.address);
    await HermesFactory.deployed();
    console.log("HermesFactory:", HermesFactory.address);
    const pairCodeHash = await HermesFactory.pairCodeHash();
    await HermesFactory.setFeeTo(distributor);
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
