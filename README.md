# About

This is a minimalist hardhat deployment enviroment specific for Harmony Network.

There is 3 scripts in scripts folder used for deployment:

- 01_token_mc.js: deploy the token and MasterChef contract.
- 02_factory.js: deploy the factory and save contract info in contracts.json
- 03_router.js: deploy the router with linked factory.

# How to deploy

This are instructions how to deploy the set of contracts.

## Swap & Farming

Do `yarn` to install modules dependencies in the enviroment.
You need a .env file, here is a sample:

```javascript
PRIVATE_KEY=the private key to be used in deployment
DEV=0x7cef2432A2690168Fb8eb7118A74d5f8EfF9Ef55
MINT_AMOUNT=12000000000000000000000000
```

After installed modules dependencies, do:

### to deploy token and farming:

```bash
npx hardhat run scripts/01_token_mc.js --network testnet
```

### to deploy the swap

- deploy the factory: `npx hardhat run scripts/02_factory.js --network testnet`
- now the factory will print the current init code hash, change it in the file `contracts/hermesswap/libraries/HermesLibrary.sol`
- now the factory and the hash has been saved to contracts.json
- open the file `scripts/03_router.js` to check the weth address, you should add a if for one on your network.
- deploy the router: `npx hardhat run scripts/03_router.js --network testnet`

At this point you should have a factory and a router linked.

# Current contracts

## testnet

- factory 0xE229Be87174a3Bb7Fda09208C81469e694fD9cd4
- init code 0x5cf59abc84cd7f68c883a009ad37629c4d0f17c6446d4593f96965fafa849147
- router 0xa533fA4376e9996D7902909a174A52058032Cf84
- wone 0x4Ea23f80A911b3535Fe4b95254Fd939553950aaa
- distributor 0x669aBa76A65c9A538760Ce8A66171e49F10BA1Ff
