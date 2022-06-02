const hre = require("hardhat");
const fs = require("fs");

// npx hardhat run scripts\03_router.js --network harmony
async function main() {


    // 0x4Ea23f80A911b3535Fe4b95254Fd939553950aaa
    const weth = '0xcF664087a5bB0237a0BAd6742852ec6c8d69A27a';
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
