import { ethers, network } from "hardhat"
import { expect } from "chai"
import { prepare, deploy, getBigNumber, createSLP } from "./utilities"

describe("HermesMaker", function () {
  before(async function () {
    await prepare(this, ["HermesMaker", "HermesBar", "HermesMakerExploitMock", "ERC20Mock", "HermesFactory", "HermesPair"])
  })

  beforeEach(async function () {
    await deploy(this, [
      ["hermes", this.ERC20Mock, ["HERMES", "HERMES", getBigNumber("10000000")]],
      ["dai", this.ERC20Mock, ["DAI", "DAI", getBigNumber("10000000")]],
      ["mic", this.ERC20Mock, ["MIC", "MIC", getBigNumber("10000000")]],
      ["usdc", this.ERC20Mock, ["USDC", "USDC", getBigNumber("10000000")]],
      ["weth", this.ERC20Mock, ["WETH", "ETH", getBigNumber("10000000")]],
      ["strudel", this.ERC20Mock, ["$TRDL", "$TRDL", getBigNumber("10000000")]],
      ["factory", this.HermesFactory, [this.alice.address]],
    ])
    await deploy(this, [["bar", this.HermesBar, [this.hermes.address]]])
    await deploy(this, [["hermesMaker", this.HermesMaker, [this.factory.address, this.bar.address, this.hermes.address, this.weth.address]]])
    await deploy(this, [["exploiter", this.HermesMakerExploitMock, [this.hermesMaker.address]]])
    await createSLP(this, "hermesEth", this.hermes, this.weth, getBigNumber(10))
    await createSLP(this, "strudelEth", this.strudel, this.weth, getBigNumber(10))
    await createSLP(this, "daiEth", this.dai, this.weth, getBigNumber(10))
    await createSLP(this, "usdcEth", this.usdc, this.weth, getBigNumber(10))
    await createSLP(this, "micUSDC", this.mic, this.usdc, getBigNumber(10))
    await createSLP(this, "hermesUSDC", this.hermes, this.usdc, getBigNumber(10))
    await createSLP(this, "daiUSDC", this.dai, this.usdc, getBigNumber(10))
    await createSLP(this, "daiMIC", this.dai, this.mic, getBigNumber(10))
  })
  describe("setBridge", function () {
    it("does not allow to set bridge for Hermes", async function () {
      await expect(this.hermesMaker.setBridge(this.hermes.address, this.weth.address)).to.be.revertedWith("HermesMaker: Invalid bridge")
    })

    it("does not allow to set bridge for WETH", async function () {
      await expect(this.hermesMaker.setBridge(this.weth.address, this.hermes.address)).to.be.revertedWith("HermesMaker: Invalid bridge")
    })

    it("does not allow to set bridge to itself", async function () {
      await expect(this.hermesMaker.setBridge(this.dai.address, this.dai.address)).to.be.revertedWith("HermesMaker: Invalid bridge")
    })

    it("emits correct event on bridge", async function () {
      await expect(this.hermesMaker.setBridge(this.dai.address, this.hermes.address))
        .to.emit(this.hermesMaker, "LogBridgeSet")
        .withArgs(this.dai.address, this.hermes.address)
    })
  })
  describe("convert", function () {
    it("should convert HERMES - ETH", async function () {
      await this.hermesEth.transfer(this.hermesMaker.address, getBigNumber(1))
      await this.hermesMaker.convert(this.hermes.address, this.weth.address)
      expect(await this.hermes.balanceOf(this.hermesMaker.address)).to.equal(0)
      expect(await this.hermesEth.balanceOf(this.hermesMaker.address)).to.equal(0)
      expect(await this.hermes.balanceOf(this.bar.address)).to.equal("1897569270781234370")
    })

    it("should convert USDC - ETH", async function () {
      await this.usdcEth.transfer(this.hermesMaker.address, getBigNumber(1))
      await this.hermesMaker.convert(this.usdc.address, this.weth.address)
      expect(await this.hermes.balanceOf(this.hermesMaker.address)).to.equal(0)
      expect(await this.usdcEth.balanceOf(this.hermesMaker.address)).to.equal(0)
      expect(await this.hermes.balanceOf(this.bar.address)).to.equal("1590898251382934275")
    })

    it("should convert $TRDL - ETH", async function () {
      await this.strudelEth.transfer(this.hermesMaker.address, getBigNumber(1))
      await this.hermesMaker.convert(this.strudel.address, this.weth.address)
      expect(await this.hermes.balanceOf(this.hermesMaker.address)).to.equal(0)
      expect(await this.strudelEth.balanceOf(this.hermesMaker.address)).to.equal(0)
      expect(await this.hermes.balanceOf(this.bar.address)).to.equal("1590898251382934275")
    })

    it("should convert USDC - HERMES", async function () {
      await this.hermesUSDC.transfer(this.hermesMaker.address, getBigNumber(1))
      await this.hermesMaker.convert(this.usdc.address, this.hermes.address)
      expect(await this.hermes.balanceOf(this.hermesMaker.address)).to.equal(0)
      expect(await this.hermesUSDC.balanceOf(this.hermesMaker.address)).to.equal(0)
      expect(await this.hermes.balanceOf(this.bar.address)).to.equal("1897569270781234370")
    })

    it("should convert using standard ETH path", async function () {
      await this.daiEth.transfer(this.hermesMaker.address, getBigNumber(1))
      await this.hermesMaker.convert(this.dai.address, this.weth.address)
      expect(await this.hermes.balanceOf(this.hermesMaker.address)).to.equal(0)
      expect(await this.daiEth.balanceOf(this.hermesMaker.address)).to.equal(0)
      expect(await this.hermes.balanceOf(this.bar.address)).to.equal("1590898251382934275")
    })

    it("converts MIC/USDC using more complex path", async function () {
      await this.micUSDC.transfer(this.hermesMaker.address, getBigNumber(1))
      await this.hermesMaker.setBridge(this.usdc.address, this.hermes.address)
      await this.hermesMaker.setBridge(this.mic.address, this.usdc.address)
      await this.hermesMaker.convert(this.mic.address, this.usdc.address)
      expect(await this.hermes.balanceOf(this.hermesMaker.address)).to.equal(0)
      expect(await this.micUSDC.balanceOf(this.hermesMaker.address)).to.equal(0)
      expect(await this.hermes.balanceOf(this.bar.address)).to.equal("1590898251382934275")
    })

    it("converts DAI/USDC using more complex path", async function () {
      await this.daiUSDC.transfer(this.hermesMaker.address, getBigNumber(1))
      await this.hermesMaker.setBridge(this.usdc.address, this.hermes.address)
      await this.hermesMaker.setBridge(this.dai.address, this.usdc.address)
      await this.hermesMaker.convert(this.dai.address, this.usdc.address)
      expect(await this.hermes.balanceOf(this.hermesMaker.address)).to.equal(0)
      expect(await this.daiUSDC.balanceOf(this.hermesMaker.address)).to.equal(0)
      expect(await this.hermes.balanceOf(this.bar.address)).to.equal("1590898251382934275")
    })

    it("converts DAI/MIC using two step path", async function () {
      await this.daiMIC.transfer(this.hermesMaker.address, getBigNumber(1))
      await this.hermesMaker.setBridge(this.dai.address, this.usdc.address)
      await this.hermesMaker.setBridge(this.mic.address, this.dai.address)
      await this.hermesMaker.convert(this.dai.address, this.mic.address)
      expect(await this.hermes.balanceOf(this.hermesMaker.address)).to.equal(0)
      expect(await this.daiMIC.balanceOf(this.hermesMaker.address)).to.equal(0)
      expect(await this.hermes.balanceOf(this.bar.address)).to.equal("1200963016721363748")
    })

    it("reverts if it loops back", async function () {
      await this.daiMIC.transfer(this.hermesMaker.address, getBigNumber(1))
      await this.hermesMaker.setBridge(this.dai.address, this.mic.address)
      await this.hermesMaker.setBridge(this.mic.address, this.dai.address)
      await expect(this.hermesMaker.convert(this.dai.address, this.mic.address)).to.be.reverted
    })

    it("reverts if caller is not EOA", async function () {
      await this.hermesEth.transfer(this.hermesMaker.address, getBigNumber(1))
      await expect(this.exploiter.convert(this.hermes.address, this.weth.address)).to.be.revertedWith("HermesMaker: must use EOA")
    })

    it("reverts if pair does not exist", async function () {
      await expect(this.hermesMaker.convert(this.mic.address, this.micUSDC.address)).to.be.revertedWith("HermesMaker: Invalid pair")
    })

    it("reverts if no path is available", async function () {
      await this.micUSDC.transfer(this.hermesMaker.address, getBigNumber(1))
      await expect(this.hermesMaker.convert(this.mic.address, this.usdc.address)).to.be.revertedWith("HermesMaker: Cannot convert")
      expect(await this.hermes.balanceOf(this.hermesMaker.address)).to.equal(0)
      expect(await this.micUSDC.balanceOf(this.hermesMaker.address)).to.equal(getBigNumber(1))
      expect(await this.hermes.balanceOf(this.bar.address)).to.equal(0)
    })
  })

  describe("convertMultiple", function () {
    it("should allow to convert multiple", async function () {
      await this.daiEth.transfer(this.hermesMaker.address, getBigNumber(1))
      await this.hermesEth.transfer(this.hermesMaker.address, getBigNumber(1))
      await this.hermesMaker.convertMultiple([this.dai.address, this.hermes.address], [this.weth.address, this.weth.address])
      expect(await this.hermes.balanceOf(this.hermesMaker.address)).to.equal(0)
      expect(await this.daiEth.balanceOf(this.hermesMaker.address)).to.equal(0)
      expect(await this.hermes.balanceOf(this.bar.address)).to.equal("3186583558687783097")
    })
  })

  after(async function () {
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    })
  })
})
