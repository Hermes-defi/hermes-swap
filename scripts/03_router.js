const hre = require("hardhat");
const fs = require("fs");

// npx hardhat run scripts\main.js --network one
async function main() {


    let weth;
    const network = await ethers.getDefaultProvider().getNetwork();
    if (network.chainId == 1) {
        const _WAVAX9Mock = await hre.ethers.getContractFactory("WAVAX9Mock");
        const WAVAX9Mock = await _WAVAX9Mock.deploy();
        await WAVAX9Mock.deployed();
        weth = WAVAX9Mock.address;
    }

    if (!weth) {
        console.log('!weth');
        process.exit(1);
    }

    console.log('weth', weth);

    let env = fs.readFileSync('./contracts.json', 'utf-8');
    env = env ? JSON.parse(env) : {};
    const FACTORY = env.FACTORY;
    console.log('FACTORY', FACTORY);


    const _HermesRouter02 = await hre.ethers.getContractFactory("HermesRouter02");
    const HermesRouter02 = await _HermesRouter02.deploy(FACTORY, weth);
    await HermesRouter02.deployed();
    console.log('HermesRouter02', HermesRouter02.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
