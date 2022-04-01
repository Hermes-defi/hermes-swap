import { ethers, network } from "hardhat"
import { expect } from "chai"
import { ADDRESS_ZERO, advanceTimeAndBlock, advanceBlockTo, latest, duration, increase } from "./utilities"


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
    expect(pairCodeHash).to.be.eq('0xe904430f935916413f6aa2bae1e94e125c95246681f88b478047b24443cea87b');

  })

  beforeEach(async function () {
    this.hermes = await this.ERC20MockDecimals.deploy(18)
    await this.hermes.deployed()
    await this.hermes.mint(this.dev.address, ethers.utils.parseUnits('9000000', 18).toString() );

    this.dai = await this.ERC20MockDecimals.deploy(18)
    await this.dai.deployed()
    await this.dai.mint(this.dev.address, ethers.utils.parseUnits('9000000', 18).toString() );

    this.main = await this.Distributor.deploy(this.router.address, this.treasure.address, this.xHRMSAddress.address, this.sHRMSAddress.address);
    await this.main.deployed()
    await this.factory.setFeeTo(this.main.address);

    await this.hermes.approve(this.router.address, ethers.utils.parseUnits('9000000', 18).toString() );
    await this.dai.approve(this.router.address, ethers.utils.parseUnits('9000000', 18).toString() );

    this.router.addLiquidity(
        this.hermes.address, this.dai.address,
        ethers.utils.parseUnits('1000000', 18).toString(),
        ethers.utils.parseUnits('1000000', 18).toString(),
        '0', '0', this.dev.address, '9647704139')

    const amount = ethers.utils.parseUnits('100', 18).toString();
    const path = [this.hermes.address, this.dai.address];
    await this.router.swapExactTokensForTokensSupportingFeeOnTransferTokens(amount,'0',path,this.dev.address, '9647704139');

    this.router.addLiquidity(
        this.hermes.address, this.dai.address,
        ethers.utils.parseUnits('1000000', 18).toString(),
        ethers.utils.parseUnits('1000000', 18).toString(),
        '0', '0', this.dev.address, '9647704139')

    this.pair_hrms_dai_addr = await this.factory.getPair(this.hermes.address, this.dai.address);
    console.log('this.pair_hrms_dai_addr', this.pair_hrms_dai_addr);

    this.hrmsdai = this.HermesPair.attach(this.pair_hrms_dai_addr);

    const hrmsdaiBalanceOfMain =  fromWei( (await this.hrmsdai.balanceOf(this.main.address)).toString() );
    console.log('hrmsdaiBalanceOfMain', hrmsdaiBalanceOfMain);
    await expect(hrmsdaiBalanceOfMain).to.be.eq("0")

    // const hrmsdaiBalanceOfDev = (await this.hrmsdai.balanceOf(this.dev.address)).toString();
    // await expect(hrmsdaiBalanceOfDev).to.be.eq("0")

  })

  it("check balances", async function () {
    // const amount = ethers.utils.parseUnits('100000', 18).toString();
    // const path = [this.hermes.address, this.dai.address];
    // await this.router.swapExactTokensForTokensSupportingFeeOnTransferTokens(amount,'0',path,this.dev.address, '9647704139');
  })



  after(async function () {
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    })
  })
})
