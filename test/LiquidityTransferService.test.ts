import {ethers, network} from "hardhat"
import {expect} from "chai"
import exp = require("constants");

describe("LiquidityTransfer", function () {
    before(async function () {
        this.HermesPair = await ethers.getContractFactory("HermesPair")
        this.HermesFactory = await ethers.getContractFactory("HermesFactory")
        this.HermesRouter02 = await ethers.getContractFactory("HermesRouter02")
        this.WONE9Mock = await ethers.getContractFactory("WONE9Mock")
        this.LiquidityTransferService = await ethers.getContractFactory("LiquidityTransferService")
        this.HermesToken = await ethers.getContractFactory("Hermes")
        this.signers = await ethers.getSigners()
        this.dev = this.signers[0]
        this.user = this.signers[1]
        this.user1 = this.signers[2]
        this.user2 = this.signers[3]


        this.wone9 = await this.WONE9Mock.deploy();
        await this.wone9.deployed()

        this.factoryA = await this.HermesFactory.deploy(this.dev.address);
        await this.factoryA.deployed()
        this.routerA = await this.HermesRouter02.deploy(this.factoryA.address, this.wone9.address);
        await this.routerA.deployed()

        this.factoryB = await this.HermesFactory.deploy(this.dev.address);
        await this.factoryB.deployed()
        this.routerB = await this.HermesRouter02.deploy(this.factoryB.address, this.wone9.address);
        await this.routerB.deployed()

        const pairCodeHash = await this.factoryA.pairCodeHash();
        expect(pairCodeHash).to.be.eq('0x03c9640d9393b1b682a303babdafdc02f951d2fbb496894041dd62c9704a2663');

    })

    beforeEach(async function () {

        this.tokenA = await this.HermesToken.deploy()
        this.tokenB = await this.HermesToken.deploy()

        await this.tokenA.deployed()
        await this.tokenB.deployed()


    })

    it("should move liquidity for erc20", async function () {
        this.amount = '100000'
        await this.tokenA.mint(this.dev.address, this.amount);
        await this.tokenB.mint(this.dev.address, this.amount);

        await this.tokenA.approve(this.routerA.address, this.amount);
        await this.tokenB.approve(this.routerA.address, this.amount);

        this.routerA.addLiquidity(
            this.tokenA.address,
            this.tokenB.address,
            this.amount,
            this.amount,
            '0',
            '0',
            this.dev.address,
            '9647704139'
        )

        this.main = await this.LiquidityTransferService.deploy(
            this.routerA.address,
            this.routerB.address,
            this.tokenA.address,
            this.tokenB.address
        );
        await this.main.deployed()

        const srcPairAddress = await this.main.srcPair();
        const dstPairAddress = await this.main.dstPair();
        this.srcPair = this.HermesPair.attach(srcPairAddress);
        this.dstPair = this.HermesPair.attach(dstPairAddress);

        let srcBalanceOfLpDev = await this.srcPair.balanceOf(this.dev.address);
        expect(srcBalanceOfLpDev.toString()).to.be.eq('99000')

        let dstBalanceOfLpDev = await this.dstPair.balanceOf(this.dev.address);
        expect(dstBalanceOfLpDev).to.be.eq('0')

        srcBalanceOfLpDev = await this.srcPair.balanceOf(this.dev.address);
        await this.srcPair.approve(this.main.address, srcBalanceOfLpDev);
        await this.main.run();

        dstBalanceOfLpDev = await this.dstPair.balanceOf(this.dev.address);
        expect(dstBalanceOfLpDev.toString()).to.be.eq('98000')

    })

    it("should move liquidity for erc20/one", async function () {
        const amountONE = '1000000000000000000';
        this.amount = '1000000000'
        await this.tokenA.mint(this.dev.address, this.amount);

        await this.tokenA.approve(this.routerA.address, this.amount);
        await this.wone9.approve(this.routerA.address, this.amount);

        this.routerA.addLiquidityONE(
            this.tokenA.address,
            this.amount,
            '0',
            '0',
            this.dev.address,
            '9647704139'
            , {value: amountONE})

        this.main = await this.LiquidityTransferService.deploy(
            this.routerA.address,
            this.routerB.address,
            this.tokenA.address,
            this.wone9.address
        );
        await this.main.deployed()

        const srcPairAddress = await this.main.srcPair();
        const dstPairAddress = await this.main.dstPair();
        this.srcPair = this.HermesPair.attach(srcPairAddress);
        this.dstPair = this.HermesPair.attach(dstPairAddress);

        let srcBalanceOfLpDev = await this.srcPair.balanceOf(this.dev.address);
        expect(srcBalanceOfLpDev.toString()).to.be.eq('31622776600683')

        let dstBalanceOfLpDev = await this.dstPair.balanceOf(this.dev.address);
        expect(dstBalanceOfLpDev).to.be.eq('0')

        srcBalanceOfLpDev = await this.srcPair.balanceOf(this.dev.address);
        await this.srcPair.approve(this.main.address, srcBalanceOfLpDev);
        await this.main.run();

        dstBalanceOfLpDev = (await this.dstPair.balanceOf(this.dev.address)).toString();
        expect(dstBalanceOfLpDev).to.be.eq('31622776584372')

        let devOneBalanceBefore = (await this.main.provider.getBalance(this.dev.address)).toString();
        let tokenABalanceBefore = (await this.tokenA.balanceOf(this.dev.address)).toString();
        expect(devOneBalanceBefore).to.be.eq('9998955788554538112304')
        expect(tokenABalanceBefore).to.be.eq('0')

        await this.dstPair.approve(this.routerB.address, dstBalanceOfLpDev);

        await this.routerB.removeLiquidityONE(
            this.tokenA.address, '31622776584372',
            0, 0, this.dev.address, '9647704139')

        devOneBalanceBefore = (await this.main.provider.getBalance(this.dev.address)).toString();
        tokenABalanceBefore = (await this.tokenA.balanceOf(this.dev.address)).toString();
        console.log('devOneBalanceBefore', devOneBalanceBefore);
        console.log('tokenABalanceBefore', tokenABalanceBefore);

        expect(devOneBalanceBefore).to.be.eq('9999955524822264678870')
        expect(tokenABalanceBefore).to.be.eq('999999998')

    })
})
