import { ethers, network } from "hardhat"
import { expect } from "chai"
import { duration, increase } from "./utilities"

describe("Cliff", function () {
  before(async function () {
    this.signers = await ethers.getSigners()
    this.alice = this.signers[0]

    this.HermesToken = await ethers.getContractFactory("HermesToken")
    this.Cliff = await ethers.getContractFactory("Cliff")
  })

  beforeEach(async function () {
    this.hermes = await this.HermesToken.deploy()
    this.cliff = await this.Cliff.deploy(this.hermes.address, this.alice.address, 0, 3)
    this.hermes.mint(this.cliff.address, 100)
  })

  it("should only allow release of tokens once cliff is passed", async function () {
    await expect(this.cliff.release()).to.be.revertedWith("Cliff: No tokens to release")
    await increase(duration.days(89))
    await expect(this.cliff.release()).to.be.revertedWith("Cliff: No tokens to release")
    await increase(duration.days(1))
    await this.cliff.release()
    expect(await this.hermes.balanceOf(this.alice.address)).to.equal(100)
    expect(await this.hermes.balanceOf(this.cliff.address)).to.equal(0)

    await this.hermes.mint(this.cliff.address, 500)
    await this.cliff.release()
    expect(await this.hermes.balanceOf(this.alice.address)).to.equal(600)
    expect(await this.hermes.balanceOf(this.cliff.address)).to.equal(0)
  })

  after(async function () {
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    })
  })
})
