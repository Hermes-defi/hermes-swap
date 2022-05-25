const hre = require("hardhat");
const fs = require("fs");

// npx hardhat run scripts\03_router.js --network testnet
async function main() {


    let weth;
    const network = await ethers.getDefaultProvider().getNetwork();
    if (network.chainId == 1) {
        // // testnet
        // const _WONE9Mock = await hre.ethers.getContractFactory("WONE9Mock");
        // const WONE9Mock = await _WONE9Mock.deploy();
        // await WONE9Mock.deployed();
        // weth = WONE9Mock.address;
        weth = '0x4Ea23f80A911b3535Fe4b95254Fd939553950aaa';
        console.log('weth testnet 1', weth);
    }else if (network.chainId == '1666700000') {
        // // testnet
        // const _WONE9Mock = await hre.ethers.getContractFactory("WONE9Mock");
        // const WONE9Mock = await _WONE9Mock.deploy();
        // await WONE9Mock.deployed();
        // weth = WONE9Mock.address;
        weth = '0x4Ea23f80A911b3535Fe4b95254Fd939553950aaa';
        console.log('weth testnet 7', weth);
    }else if (network.chainId == '1666600000') {
        // mainnet
        weth = '0xcF664087a5bB0237a0BAd6742852ec6c8d69A27a';
        console.log('weth mainnet', weth);
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
