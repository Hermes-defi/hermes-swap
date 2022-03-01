import { ethers, network } from "hardhat"
import { expect } from "chai"

describe("HermesToken", function () {
  before(async function () {
    this.HermesToken = await ethers.getContractFactory("HermesToken")
    this.signers = await ethers.getSigners()
    this.alice = this.signers[0]
    this.bob = this.signers[1]
    this.carol = this.signers[2]
  })

  beforeEach(async function () {
    this.hermes = await this.HermesToken.deploy()
    await this.hermes.deployed()
  })

  it("should have correct name and symbol and decimal", async function () {
    const name = await this.hermes.name()
    const symbol = await this.hermes.symbol()
    const decimals = await this.hermes.decimals()
    expect(name, "HermesToken")
    expect(symbol, "HERMES")
    expect(decimals, "18")
  })

  it("should only allow owner to mint token", async function () {
    await this.hermes.mint(this.alice.address, "100")
    await this.hermes.mint(this.bob.address, "1000")
    await expect(this.hermes.connect(this.bob).mint(this.carol.address, "1000", { from: this.bob.address })).to.be.revertedWith(
      "minter: caller is not a minter"
    )
    const totalSupply = await this.hermes.totalSupply()
    const aliceBal = await this.hermes.balanceOf(this.alice.address)
    const bobBal = await this.hermes.balanceOf(this.bob.address)
    const carolBal = await this.hermes.balanceOf(this.carol.address)
    expect(totalSupply).to.equal("1100")
    expect(aliceBal).to.equal("100")
    expect(bobBal).to.equal("1000")
    expect(carolBal).to.equal("0")
  })

  it("should supply token transfers properly", async function () {
    await this.hermes.mint(this.alice.address, "100")
    await this.hermes.mint(this.bob.address, "1000")
    await this.hermes.transfer(this.carol.address, "10")
    await this.hermes.connect(this.bob).transfer(this.carol.address, "100", {
      from: this.bob.address,
    })
    const totalSupply = await this.hermes.totalSupply()
    const aliceBal = await this.hermes.balanceOf(this.alice.address)
    const bobBal = await this.hermes.balanceOf(this.bob.address)
    const carolBal = await this.hermes.balanceOf(this.carol.address)
    expect(totalSupply, "1100")
    expect(aliceBal, "90")
    expect(bobBal, "900")
    expect(carolBal, "110")
  })

  it("should fail if you try to do bad transfers", async function () {
    await this.hermes.mint(this.alice.address, "100")
    await expect(this.hermes.transfer(this.carol.address, "110")).to.be.revertedWith("ERC20: transfer amount exceeds balance")
    await expect(this.hermes.connect(this.bob).transfer(this.carol.address, "1", { from: this.bob.address })).to.be.revertedWith(
      "ERC20: transfer amount exceeds balance"
    )
  })

  it("should not exceed max supply of 30m", async function () {
    await expect(this.hermes.mint(this.alice.address, "30000000000000000000000001")).to.be.revertedWith("HERMES::mint: cannot exceed max supply")
    await this.hermes.mint(this.alice.address, "30000000000000000000000000")
  })

  after(async function () {
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    })
  })
})
