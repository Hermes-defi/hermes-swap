import {ethers, network} from "hardhat"
import {expect} from "chai"
import {ADDRESS_ZERO, advanceTimeAndBlock, advanceBlockTo, latest, duration, increase} from "./utilities"


function toWei(v: string): string {
    return ethers.utils.parseUnits(v, 18).toString();
}

function fromWei(v: string): string {
    return ethers.utils.formatUnits(v, 18).toString();
}

function toGWei(v: string): string {
    return ethers.utils.parseUnits(v, 9).toString();
}

function fromGWei(v: string): string {
    return ethers.utils.formatUnits(v, 9).toString();
}

function now(x: number) {
    let t = new Date().getTime() / 1000;
    t += x;
    return parseInt(t.toString());
}


describe("Distributor", function () {
    before(async function () {
        this.signers = await ethers.getSigners()
        this.dev = this.signers[0]
        this.treasure = this.signers[1]
        this.xHRMSAddress = this.signers[2]
        this.sHRMSAddress = this.signers[3]

        this.Distributor = await ethers.getContractFactory("Distributor")
        this.ERC20MockDecimals = await ethers.getContractFactory("ERC20MockDecimals")
        this.HermesPair = await ethers.getContractFactory("HermesPair")
        this.HermesFactory = await ethers.getContractFactory("HermesFactory")
        this.HermesRouter02 = await ethers.getContractFactory("HermesRouter02")
        this.WONE9Mock = await ethers.getContractFactory("WONE9Mock")

        this.wone = await this.WONE9Mock.deploy();
        await this.wone.deployed()

        this.factory = await this.HermesFactory.deploy(this.dev.address);
        await this.factory.deployed()
        this.router = await this.HermesRouter02.deploy(this.factory.address, this.wone.address);
        await this.router.deployed()

        const pairCodeHash = await this.factory.pairCodeHash();
        // expect(pairCodeHash).to.be.eq('0x83bc7bb34b67d17e1f2fc8ad5d7a0f8a374a52474546c4ecbfb368acdc0ff2e1');
        expect(pairCodeHash).to.be.eq('0x2b5c1f92763cc808d46f799ed176bc720efdf2600b6b6ba91296a61afd2aa00b');

    })

    it("swap fees and check balances", async function () {
        this.hermes = await this.ERC20MockDecimals.deploy(18)
        await this.hermes.deployed()
        await this.hermes.mint(this.dev.address, ethers.utils.parseUnits('9000000', 18).toString());

        this.ust = await this.ERC20MockDecimals.deploy(18)
        await this.ust.deployed()
        await this.ust.mint(this.dev.address, ethers.utils.parseUnits('9000000', 18).toString());

        this.dai = await this.ERC20MockDecimals.deploy(18)
        await this.dai.deployed()
        await this.dai.mint(this.dev.address, ethers.utils.parseUnits('9000000', 18).toString());

        this.main = await this.Distributor.deploy(
            this.router.address, this.treasure.address,
            this.xHRMSAddress.address, this.sHRMSAddress.address,
            this.ust.address, this.hermes.address);
        await this.main.deployed()
        await this.factory.setFeeTo(this.main.address);

        await this.main.addNewToken(this.hermes.address,
            [this.hermes.address, this.wone.address],
            [this.hermes.address, this.wone.address]);

        await this.hermes.approve(this.router.address, ethers.utils.parseUnits('9000000', 18).toString());
        await this.dai.approve(this.router.address, ethers.utils.parseUnits('9000000', 18).toString());
        await this.ust.approve(this.router.address, ethers.utils.parseUnits('9000000', 18).toString());

        const amount = ethers.utils.parseUnits('1000000', 18).toString();
        const amount1000 = ethers.utils.parseUnits('1000', 18).toString();
        this.router.addLiquidity(
            this.hermes.address, this.dai.address, amount, amount,
            '0', '0', this.dev.address, '9647704139')
        this.router.addLiquidity(
            this.hermes.address, this.ust.address, amount, amount,
            '0', '0', this.dev.address, '9647704139')

        this.router.addLiquidityONE(
            this.hermes.address,
            amount, '0', '0', this.dev.address, '9647704139', {value: amount1000})

        this.router.addLiquidityONE(
            this.ust.address,
            amount, '0', '0', this.dev.address, '9647704139', {value: amount1000})

        const amount1 = ethers.utils.parseUnits('10000', 18).toString();
        const path1 = [this.hermes.address, this.dai.address];
        const path2 = [this.hermes.address, this.wone.address];
        await this.router.swapExactTokensForTokensSupportingFeeOnTransferTokens(amount1, '0', path1, this.dev.address, '9647704139');
        await this.router.swapExactTokensForTokensSupportingFeeOnTransferTokens(amount1, '0', path2, this.dev.address, '9647704139');

        this.router.addLiquidity(
            this.hermes.address, this.dai.address,
            amount,
            amount,
            '0', '0', this.dev.address, '9647704139')

        this.pair_hrms_dai_addr = await this.factory.getPair(this.hermes.address, this.dai.address);

        // console.log('this.pair_hrms_dai_addr', this.pair_hrms_dai_addr);

        this.hrmsdai = this.HermesPair.attach(this.pair_hrms_dai_addr);

        const hrmsdaiBalanceOfMain = fromWei((await this.hrmsdai.balanceOf(this.main.address)).toString());
        // console.log('hrmsdaiBalanceOfMain', hrmsdaiBalanceOfMain);
        await expect(hrmsdaiBalanceOfMain).to.be.eq("2.121660991929858591")

        await this.main.run();

        const xHRMSBalance = (await this.hermes.balanceOf(this.xHRMSAddress.address)).toString();
        await expect(xHRMSBalance).to.be.eq("532509624773258313")

        const sHRMSBalance = (await this.ust.balanceOf(this.sHRMSAddress.address)).toString();
        await expect(sHRMSBalance).to.be.eq("522030378254482673")

        const treasureBalance = (await this.wone.balanceOf(this.treasure.address)).toString();
        await expect(treasureBalance).to.be.eq("1047202910271497")

    })

    after(async function () {
        await network.provider.request({
            method: "hardhat_reset",
            params: [],
        })
    })
})
