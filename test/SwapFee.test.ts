import {ethers, network} from "hardhat"
import {expect} from "chai"
import exp = require("constants");

describe("Fee Test", function () {
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
        this.fee = this.signers[2]
        this.lp = this.signers[3]


        this.wone9 = await this.WONE9Mock.deploy();
        await this.wone9.deployed()

        this.factory = await this.HermesFactory.deploy(this.dev.address);
        await this.factory.deployed()
        await this.factory.setFeeTo(this.fee.address);
        this.router = await this.HermesRouter02.deploy(this.factory.address, this.wone9.address);
        await this.router.deployed()

        const pairCodeHash = await this.factory.pairCodeHash();
        expect(pairCodeHash).to.be.eq('0x9c66fba717c8166e595d9849d865156b699a23cb3bf12174a296d0158470c328');

    })

    beforeEach(async function () {

        this.tokenA = await this.HermesToken.deploy()
        this.tokenB = await this.HermesToken.deploy()

        await this.tokenA.deployed()
        await this.tokenB.deployed()


    })

    it("swap and check fees", async function () {
        this.amount =  '100000000000000';
        this.amountSwap = '100000000000';

        await this.tokenA.mint(this.dev.address, this.amount);
        await this.tokenB.mint(this.dev.address, this.amount);
        await this.tokenA.approve(this.router.address, this.amount);
        await this.tokenB.approve(this.router.address, this.amount);
        await this.router.addLiquidity(this.tokenA.address, this.tokenB.address, this.amount, this.amount, '0', '0', this.dev.address, '9647704139');
        const pair = await this.factory.getPair(this.tokenA.address, this.tokenB.address);
        this.pair = await this.HermesPair.attach(pair);
        let balanceOfFee = (await this.pair.balanceOf(this.fee.address)).toString();
        console.log('balanceOfFee', balanceOfFee);

        // swap to generate fee
        await this.tokenA.mint(this.dev.address, this.amountSwap);
        await this.tokenA.approve(this.router.address, this.amountSwap);
        await this.router.swapExactTokensForTokensSupportingFeeOnTransferTokens(this.amountSwap, '0', [this.tokenA.address, this.tokenB.address], this.user.address, '9647704139');

        // add liquidity again to mint fee
        await this.tokenA.mint(this.dev.address, this.amount);
        await this.tokenB.mint(this.dev.address, this.amount);
        await this.tokenA.approve(this.router.address, this.amount);
        await this.tokenB.approve(this.router.address, this.amount);
        await this.router.addLiquidity(this.tokenA.address, this.tokenB.address, this.amount, this.amount, '0', '0', this.lp.address, '9647704139');

        balanceOfFee = (await this.pair.balanceOf(this.fee.address)).toString();
        console.log('fee balanceOfFee', balanceOfFee);

        // now break lp and check fee
        await this.pair.connect(this.fee).approve(this.router.address, balanceOfFee);
        await this.router.connect(this.fee).removeLiquidity(this.tokenA.address, this.tokenB.address, balanceOfFee, '0', '0', this.fee.address, '9647704139');

        // check fee collected
        let balanceOfFeeA = (await this.tokenA.balanceOf(this.fee.address)).toString();
        let balanceOfFeeB = (await this.tokenB.balanceOf(this.fee.address)).toString();

        console.log('fee amountSwap    ', ethers.utils.formatUnits(this.amountSwap, 'gwei') );
        console.log('fee balanceOfFeeA ', ethers.utils.formatUnits(balanceOfFeeA, 'gwei') );
        console.log('fee balanceOfFeeB ', ethers.utils.formatUnits(balanceOfFeeB, 'gwei') );
        console.log('fee total fee ', ethers.utils.formatUnits(parseFloat(balanceOfFeeA)+parseFloat(balanceOfFeeB), 'gwei') );





        /*
        balanceOfFee = (await this.pair.balanceOf(this.lp.address)).toString();
        console.log('lp balanceOfFee', balanceOfFee);

        // now break lp and check fee
        await this.pair.connect(this.fee).approve(this.router.address, balanceOfFee);
        await this.router.connect(this.fee).removeLiquidity(this.tokenA.address, this.tokenB.address, balanceOfFee, '0', '0', this.lp.address, '9647704139');

        // check fee collected
        balanceOfFeeA = (await this.tokenA.balanceOf(this.lp.address)).toString();
        balanceOfFeeB = (await this.tokenB.balanceOf(this.lp.address)).toString();

        console.log('lp amountSwap    ', ethers.utils.formatUnits(this.amountSwap, 'gwei') );
        console.log('lp balanceOfFeeA ', ethers.utils.formatUnits(balanceOfFeeA, 'gwei') );
        console.log('lp balanceOfFeeB ', ethers.utils.formatUnits(balanceOfFeeB, 'gwei') );
        console.log('lp total fee ', ethers.utils.formatUnits(parseFloat(balanceOfFeeA)+parseFloat(balanceOfFeeB), 'gwei') );
        */
    })


})
