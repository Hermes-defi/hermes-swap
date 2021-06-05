import { ethers, network } from "hardhat"
import { expect } from "chai"
import { ADDRESS_ZERO, advanceTimeAndBlock, advanceBlockTo, latest, duration, increase } from "./utilities"

describe("MasterChefJoeV2", function () {
  before(async function () {
    this.signers = await ethers.getSigners()
    this.alice = this.signers[0]
    this.bob = this.signers[1]
    this.carol = this.signers[2]
    this.dev = this.signers[3]
    this.treasury = this.signers[4]
    this.minter = this.signers[5]

    this.MCV1PerBlock = await ethers.getContractFactory("MasterChef")
    this.MCV1PerSec = await ethers.getContractFactory("MasterChefPerSec")
    this.MCV2 = await ethers.getContractFactory("MasterChefJoeV2")
    this.RewarderPerBlock = await ethers.getContractFactory("MasterChefRewarderPerBlockMock")
    this.RewarderPerSec = await ethers.getContractFactory("MasterChefRewarderPerSecMock")
    this.JoeToken = await ethers.getContractFactory("JoeToken")
    this.ERC20Mock = await ethers.getContractFactory("ERC20Mock", this.minter)
    this.SushiToken = await ethers.getContractFactory("SushiToken")

    this.devPercent = 200
    this.treasuryPercent = 200
    this.lpPercent = 1000 - this.devPercent - this.treasuryPercent
    this.joePerSec = 100
    this.secOffset = 1
    this.tokenOffset = 1
    this.reward = (sec: number, percent: number) => (sec * this.joePerSec * percent) / 1000

    // Partner MasterChef parameters
    this.partnerDev = this.signers[6]
    this.partnerRewardPerBlock = 40
    this.partnerRewardPerSec = 40
    this.partnerStartBlock = 0
    this.partnerBonusEndBlock = 10
    this.partnerChefPid = 0
  })

  beforeEach(async function () {
    this.joe = await this.JoeToken.deploy() // b=1
    await this.joe.deployed()

    this.partnerToken = await this.SushiToken.deploy() // b=2
    await this.partnerToken.deployed()
  })

  it("should revert contract creation if dev and treasury percents don't meet criteria", async function () {
    const startTime = (await latest()).add(60)
    // dev percent failure
    await expect(
      this.MCV2.deploy(this.joe.address, this.dev.address, this.treasury.address, "100", startTime, "1100", this.treasuryPercent)
    ).to.be.revertedWith("constructor: invalid dev percent value")

    // Invalid treasury percent failure
    await expect(
      this.MCV2.deploy(this.joe.address, this.dev.address, this.treasury.address, "100", startTime, this.devPercent, "1100")
    ).to.be.revertedWith("constructor: invalid treasury percent value")

    // Sum of dev and treasury precent too high
    await expect(this.MCV2.deploy(this.joe.address, this.dev.address, this.treasury.address, "100", startTime, "500", "501")).to.be.revertedWith(
      "constructor: total percent over max"
    )
  })

  it("should set correct state variables", async function () {
    // We make start time 60 seconds past the last block
    const startTime = (await latest()).add(60)
    this.chef = await this.MCV2.deploy(
      this.joe.address,
      this.dev.address,
      this.treasury.address,
      this.joePerSec,
      startTime,
      this.devPercent,
      this.treasuryPercent
    )
    await this.chef.deployed()

    await this.joe.transferOwnership(this.chef.address)

    const joe = await this.chef.joe()
    const devaddr = await this.chef.devaddr()
    const treasuryaddr = await this.chef.treasuryaddr()
    const owner = await this.joe.owner()
    const devPercent = await this.chef.devPercent()
    const treasuryPercent = await this.chef.treasuryPercent()

    expect(joe).to.equal(this.joe.address)
    expect(devaddr).to.equal(this.dev.address)
    expect(treasuryaddr).to.equal(this.treasury.address)
    expect(owner).to.equal(this.chef.address)
    expect(devPercent).to.equal(this.devPercent)
    expect(treasuryPercent).to.equal(this.treasuryPercent)
  })

  it("should allow dev and only dev to update dev", async function () {
    const startTime = (await latest()).add(60)
    this.chef = await this.MCV2.deploy(
      this.joe.address,
      this.dev.address,
      this.treasury.address,
      this.joePerSec,
      startTime,
      this.devPercent,
      this.treasuryPercent
    )
    await this.chef.deployed()

    expect(await this.chef.devaddr()).to.equal(this.dev.address)

    await expect(this.chef.connect(this.bob).dev(this.bob.address, { from: this.bob.address })).to.be.revertedWith("dev: wut?")

    await this.chef.connect(this.dev).dev(this.bob.address, { from: this.dev.address })

    expect(await this.chef.devaddr()).to.equal(this.bob.address)

    await this.chef.connect(this.bob).dev(this.alice.address, { from: this.bob.address })

    expect(await this.chef.devaddr()).to.equal(this.alice.address)
  })

  it("should check dev percent is set correctly", async function () {
    const startTime = (await latest()).add(60)
    this.chef = await this.MCV2.deploy(
      this.joe.address,
      this.dev.address,
      this.treasury.address,
      this.joePerSec,
      startTime,
      this.devPercent,
      this.treasuryPercent
    )
    await this.chef.deployed()

    await this.chef.setDevPercent(this.devPercent) // t-57
    await this.chef.setTreasuryPercent(this.treasuryPercent) // t-56
    expect(await this.chef.devPercent()).to.equal("200")
    // We don't test negative values because function only takes in unsigned ints
    await expect(this.chef.setDevPercent("1200")).to.be.revertedWith("setDevPercent: invalid percent value")
    await expect(this.chef.setDevPercent("900")).to.be.revertedWith("setDevPercent: total percent over max")
  })

  it("should check treasury percent is set correctly", async function () {
    const startTime = (await latest()).add(60)
    this.chef = await this.MCV2.deploy(
      this.joe.address,
      this.dev.address,
      this.treasury.address,
      this.joePerSec,
      startTime,
      this.devPercent,
      this.treasuryPercent
    )
    await this.chef.deployed()

    await this.chef.setDevPercent(this.devPercent) // t-57
    await this.chef.setTreasuryPercent(this.treasuryPercent) // t-56
    expect(await this.chef.treasuryPercent()).to.equal("200")
    // We don't test negative values because function only takes in unsigned ints
    await expect(this.chef.setTreasuryPercent("1200")).to.be.revertedWith("setTreasuryPercent: invalid percent value")
    await expect(this.chef.setTreasuryPercent("900")).to.be.revertedWith("setTreasuryPercent: total percent over max")
  })

  context("With ERC/LP token added to the field and using per block MasterChef for partner", function () {
    beforeEach(async function () {
      this.lp = await this.ERC20Mock.deploy("LPToken", "LP", "10000000000") // b=3
      await this.lp.transfer(this.alice.address, "1000") // b=4
      await this.lp.transfer(this.bob.address, "1000") // b=5
      await this.lp.transfer(this.carol.address, "1000") // b=6

      this.lp2 = await this.ERC20Mock.deploy("LPToken2", "LP2", "10000000000") // b=7
      await this.lp2.transfer(this.alice.address, "1000") // b=8
      await this.lp2.transfer(this.bob.address, "1000") // b=9
      await this.lp2.transfer(this.carol.address, "1000") // b=10

      this.dummyToken = await this.ERC20Mock.deploy("DummyToken", "DUMMY", "1") // b=11
      await this.dummyToken.transfer(this.partnerDev.address, "1") // b=12

      this.partnerChef = await this.MCV1PerBlock.deploy(
        this.partnerToken.address,
        this.partnerDev.address,
        this.partnerRewardPerBlock,
        this.partnerStartBlock,
        this.partnerBonusEndBlock
      ) // b=13
      await this.partnerChef.deployed()
    })

    it("should check LP token is a contract", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MCV2.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed()

      // Use address that is not a contract
      await expect(this.chef.add("100", this.dev.address, ADDRESS_ZERO)).to.be.revertedWith("add: LP token must be a valid contract")
    })

    it("should not allow same LP token to be added twice", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MCV2.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed()
      expect(await this.chef.poolLength()).to.equal("0")

      await this.chef.add("100", this.lp.address, ADDRESS_ZERO)
      expect(await this.chef.poolLength()).to.equal("1")
      await expect(this.chef.add("100", this.lp.address, ADDRESS_ZERO)).to.be.revertedWith("add: LP already added")
    })

    it("should check rewarder's arguments are contracts", async function () {
      await expect(
        this.RewarderPerBlock.deploy(
          ADDRESS_ZERO,
          this.lp.address,
          this.partnerRewardPerBlock,
          this.partnerChefPid,
          this.partnerChef.address,
          this.chef.address
        )
      ).to.be.revertedWith("constructor: reward token must be a valid contract")

      await expect(
        this.RewarderPerBlock.deploy(
          this.joe.address,
          ADDRESS_ZERO,
          this.partnerRewardPerBlock,
          this.partnerChefPid,
          this.partnerChef.address,
          this.chef.address
        )
      ).to.be.revertedWith("constructor: LP token must be a valid contract")

      await expect(
        this.RewarderPerBlock.deploy(
          this.joe.address,
          this.lp.address,
          this.partnerRewardPerBlock,
          this.partnerChefPid,
          ADDRESS_ZERO,
          this.chef.address
        )
      ).to.be.revertedWith("constructor: MasterChef must be a valid contract")

      await expect(
        this.RewarderPerBlock.deploy(
          this.joe.address,
          this.lp.address,
          this.partnerRewardPerBlock,
          this.partnerChefPid,
          this.partnerChef.address,
          ADDRESS_ZERO
        )
      ).to.be.revertedWith("constructor: MasterChefJoeV2 must be a valid contract")
    })

    it("should check rewarder added and set properly", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MCV2.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed()

      this.rewarder = await this.RewarderPerBlock.deploy(
        this.joe.address,
        this.lp.address,
        this.partnerRewardPerBlock,
        this.partnerChefPid,
        this.partnerChef.address,
        this.chef.address
      )
      await this.rewarder.deployed()

      // Try to add rewarder that is neither zero address or contract address
      await expect(this.chef.add("100", this.lp.address, this.dev.address)).to.be.revertedWith("add: rewarder must be contract or zero")

      await this.chef.add("100", this.lp.address, this.rewarder.address)

      // Try to set rewarder that is neither zero address or contract address
      await expect(this.chef.set("0", "200", this.dev.address, true)).to.be.revertedWith("set: rewarder must be contract or zero")

      await this.chef.set("0", "200", this.rewarder.address, false)
      expect((await this.chef.poolInfo(0)).allocPoint).to.equal("200")

      // Alice has no DummyToken, so it should fail to init
      await expect(this.rewarder.connect(this.alice).init(this.dummyToken.address)).to.be.revertedWith("init: Balance must exceed 0")

      // Successfully init the rewarder
      await this.partnerChef.add("100", this.dummyToken.address, true)
      await this.dummyToken.connect(this.partnerDev).approve(this.rewarder.address, "1")
      await this.rewarder.connect(this.partnerDev).init(this.dummyToken.address)
      expect((await this.partnerChef.poolInfo(this.partnerChefPid)).lpToken).to.equal(this.dummyToken.address)
    })

    it("should allow a given pool's allocation weight and rewarder to be updated", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MCV2.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed()

      this.rewarder = await this.RewarderPerBlock.deploy(
        this.joe.address,
        this.lp.address,
        this.partnerRewardPerBlock,
        this.partnerChefPid,
        this.partnerChef.address,
        this.chef.address
      )
      await this.rewarder.deployed()

      await this.chef.add("100", this.lp.address, ADDRESS_ZERO)
      expect((await this.chef.poolInfo(0)).allocPoint).to.equal("100")
      expect((await this.chef.poolInfo(0)).rewarder).to.equal(ADDRESS_ZERO)

      await this.chef.set("0", "150", this.rewarder.address, true)
      expect((await this.chef.poolInfo(0)).allocPoint).to.equal("150")
      expect((await this.chef.poolInfo(0)).rewarder).to.equal(this.rewarder.address)
    })

    it("should allow emergency withdraw", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MCV2.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed()

      await this.chef.add("100", this.lp.address, ADDRESS_ZERO)

      await this.lp.connect(this.bob).approve(this.chef.address, "1000")

      await this.chef.connect(this.bob).deposit(0, "100")

      expect(await this.lp.balanceOf(this.bob.address)).to.equal("900")

      await this.chef.connect(this.bob).emergencyWithdraw(0)

      expect(await this.lp.balanceOf(this.bob.address)).to.equal("1000")
    })

    it("should only allow MasterChefJoeV2 to call onJoeReward", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MCV2.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed() // t-59, b=14

      this.rewarder = await this.RewarderPerBlock.deploy(
        this.partnerToken.address,
        this.lp.address,
        this.partnerRewardPerBlock,
        this.partnerChefPid,
        this.partnerChef.address,
        this.chef.address
      )
      await this.rewarder.deployed() // t-58, b=15

      await this.partnerToken.transferOwnership(this.partnerChef.address) // t-57, b=16
      await this.partnerChef.add("100", this.dummyToken.address, true) // t-56, b=17

      await this.dummyToken.connect(this.partnerDev).approve(this.rewarder.address, "1") // t-55, b=18
      await this.rewarder.connect(this.partnerDev).init(this.dummyToken.address) // t-54, b=19

      await this.joe.transferOwnership(this.chef.address) // t-53, b=20
      await this.chef.setDevPercent(this.devPercent) // t-52, b=21
      await this.chef.setTreasuryPercent(this.treasuryPercent) // t-51, b=22

      await this.chef.add("100", this.lp.address, this.rewarder.address) // t-50, b=23

      await this.lp.connect(this.bob).approve(this.chef.address, "1000") // t-49, b=24
      await this.chef.connect(this.bob).deposit(0, "100") // t-48, b=25
      await advanceTimeAndBlock(37) // t-11, b=26

      await expect(this.rewarder.onJoeReward(this.bob.address, "100")).to.be.revertedWith("onlyMCV2: only MasterChef V2 can call this function") // t-10, b=27
      await this.chef.connect(this.bob).deposit(0, "0") // t-9, b=28
      // Bob should have:
      //   - 0 JoeToken
      //   - 3*40 = 80 PartnerToken
      expect(await this.joe.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.partnerToken.balanceOf(this.bob.address)).to.equal("120")
    })

    it("should allow rewarder to be set and removed mid farming", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MCV2.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed() // t-59, b=14

      this.rewarder = await this.RewarderPerBlock.deploy(
        this.partnerToken.address,
        this.lp.address,
        this.partnerRewardPerBlock,
        this.partnerChefPid,
        this.partnerChef.address,
        this.chef.address
      )
      await this.rewarder.deployed() // t-58, b=15

      await this.partnerToken.transferOwnership(this.partnerChef.address) // t-57, b=16
      await this.partnerChef.add("100", this.dummyToken.address, true) // t-56, b=17

      await this.dummyToken.connect(this.partnerDev).approve(this.rewarder.address, "1") // t-55, b=18
      await this.rewarder.connect(this.partnerDev).init(this.dummyToken.address) // t-54, b=19

      await this.joe.transferOwnership(this.chef.address) // t-53, b=20
      await this.chef.setDevPercent(this.devPercent) // t-52, b=21
      await this.chef.setTreasuryPercent(this.treasuryPercent) // t-51, b=22

      await this.chef.add("100", this.lp.address, ADDRESS_ZERO) // t-50, b=23

      await this.lp.connect(this.bob).approve(this.chef.address, "1000") // t-49, b=24
      await this.chef.connect(this.bob).deposit(0, "100") // t-48, b=25
      await advanceTimeAndBlock(37) // t-11, b=26

      await this.chef.connect(this.bob).deposit(0, "0") // t-10, b=27
      expect(await this.joe.balanceOf(this.bob.address)).to.equal("0")
      // At t+10, Bob should have pending:
      //   - 10*60 = 600 (+60) JoeToken
      //   - 0 PartnerToken
      await advanceTimeAndBlock(20) // t+10, b=28
      expect((await this.chef.pendingTokens(0, this.bob.address)).pendingJoe).to.be.within(600, 660)
      expect((await this.chef.pendingTokens(0, this.bob.address)).bonusTokenAddress).to.equal(ADDRESS_ZERO)
      expect((await this.chef.pendingTokens(0, this.bob.address)).pendingBonusToken).to.equal(0)

      // Pass rewarder but don't overwrite
      await this.chef.set(0, 100, this.rewarder.address, false) // t+11 ,b=29

      // At t+20, Bob should have pending:
      //   - 600 + 10*60 = 1200 (+60) JoeToken
      //   - 0 PartnerToken
      await advanceTimeAndBlock(9) // t+20, b=30
      expect((await this.chef.pendingTokens(0, this.bob.address)).pendingJoe).to.be.within(1200, 12060)
      expect((await this.chef.pendingTokens(0, this.bob.address)).bonusTokenAddress).to.equal(ADDRESS_ZERO)
      expect((await this.chef.pendingTokens(0, this.bob.address)).pendingBonusToken).to.equal(0)

      // Pass rewarder and overwrite
      await this.chef.set(0, 100, this.rewarder.address, true) // t+21, b=31

      // At t+30, Bob should have pending:
      //   - 1200 + 10*60 = 1800 (+60) JoeToken
      //   - 0 PartnerToken - this is because rewarder hasn't registered the user yet! User needs to call deposit again
      await advanceTimeAndBlock(4) // t+25, b=32
      await advanceTimeAndBlock(5) // t+30, b=33
      expect((await this.chef.pendingTokens(0, this.bob.address)).pendingJoe).to.be.within(1800, 1860)
      expect((await this.chef.pendingTokens(0, this.bob.address)).bonusTokenAddress).to.equal(this.partnerToken.address)
      expect((await this.chef.pendingTokens(0, this.bob.address)).bonusTokenSymbol).to.equal("SUSHI")
      expect((await this.chef.pendingTokens(0, this.bob.address)).pendingBonusToken).to.equal(0)

      // Call deposit to start receiving PartnerTokens
      await this.chef.connect(this.bob).deposit(0, 0) // t+31, b=34

      // At t+40, Bob should have pending:
      //   - 9*60 = 540 (+60) JoeToken
      //   - 2*40 = 80 PartnerToken
      await advanceTimeAndBlock(4) // t+35, b=35
      await advanceTimeAndBlock(5) // t+40, b=36
      expect((await this.chef.pendingTokens(0, this.bob.address)).pendingJoe).to.be.within(540, 600)
      expect((await this.chef.pendingTokens(0, this.bob.address)).bonusTokenAddress).to.equal(this.partnerToken.address)
      expect((await this.chef.pendingTokens(0, this.bob.address)).bonusTokenSymbol).to.equal("SUSHI")
      expect((await this.chef.pendingTokens(0, this.bob.address)).pendingBonusToken).to.equal(80)
    })

    it("should give out JOEs only after farming time", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MCV2.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed() // t-59, b=14

      this.rewarder = await this.RewarderPerBlock.deploy(
        this.partnerToken.address,
        this.lp.address,
        this.partnerRewardPerBlock,
        this.partnerChefPid,
        this.partnerChef.address,
        this.chef.address
      )
      await this.rewarder.deployed() // t-58, b=15

      await this.partnerToken.transferOwnership(this.partnerChef.address) // t-57, b=16
      await this.partnerChef.add("100", this.dummyToken.address, true) // t-56, b=17

      await this.dummyToken.connect(this.partnerDev).approve(this.rewarder.address, "1") // t-55, b=18
      await this.rewarder.connect(this.partnerDev).init(this.dummyToken.address) // t-54, b=19

      await this.joe.transferOwnership(this.chef.address) // t-53, b=20
      await this.chef.setDevPercent(this.devPercent) // t-52, b=21
      await this.chef.setTreasuryPercent(this.treasuryPercent) // t-51, b=22

      await this.chef.add("100", this.lp.address, this.rewarder.address) // t-50, b=23

      await this.lp.connect(this.bob).approve(this.chef.address, "1000") // t-49, b=24
      await this.chef.connect(this.bob).deposit(0, "100") // t-48, b=25
      await advanceTimeAndBlock(37) // t-11, b=26

      await this.chef.connect(this.bob).deposit(0, "0") // t-10, b=27
      // Bob should have:
      //   - 0 JoeToken
      //   - 2*40 = 80 PartnerToken
      expect(await this.joe.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.partnerToken.balanceOf(this.bob.address)).to.equal("80")
      await advanceTimeAndBlock(8) // t-2, b=28

      await this.chef.connect(this.bob).deposit(0, "0") // t-1, b=29
      expect(await this.joe.balanceOf(this.bob.address)).to.equal("0")
      await advanceTimeAndBlock(10) // t+9, b=30

      await this.chef.connect(this.bob).deposit(0, "0") // t+10, b=31
      // Bob should have:
      //   - 10*60 = 600 (+60) JoeToken
      //   - 80 + 4*40 = 240 PartnerToken
      expect(await this.joe.balanceOf(this.bob.address)).to.be.within(600, 660)
      expect(await this.partnerToken.balanceOf(this.bob.address)).to.equal("240")

      await advanceTimeAndBlock(4) // t+14, b=32
      await this.chef.connect(this.bob).deposit(0, "0") // t+15, b=33

      // At this point:
      //   Bob should have:
      //     - 600 + 5*60 = 900 (+60) JoeToken
      //     - 240 + 2*40 = 320 PartnerToken
      //   Dev should have: 15*20 = 300 (+20)
      //   Tresury should have: 15*20 = 300 (+20)
      expect(await this.joe.balanceOf(this.bob.address)).to.be.within(900, 960)
      expect(await this.partnerToken.balanceOf(this.bob.address)).to.equal("320")
      expect(await this.joe.balanceOf(this.dev.address)).to.be.within(300, 320)
      expect(await this.joe.balanceOf(this.treasury.address)).to.be.within(300, 320)
      expect(await this.joe.totalSupply()).to.be.within(1500, 1600)
    })

    it("should not distribute JOEs if no one deposit", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MCV2.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed() // t-59, b=14

      this.rewarder = await this.RewarderPerBlock.deploy(
        this.partnerToken.address,
        this.lp.address,
        this.partnerRewardPerBlock,
        this.partnerChefPid,
        this.partnerChef.address,
        this.chef.address
      )
      await this.rewarder.deployed() // t-58, b=15

      await this.partnerToken.transferOwnership(this.partnerChef.address) // t-57, b=16
      await this.partnerChef.add("100", this.dummyToken.address, true) // t-56, b=17

      await this.dummyToken.connect(this.partnerDev).approve(this.rewarder.address, "1") // t-55, b=18
      await this.rewarder.connect(this.partnerDev).init(this.dummyToken.address) // t-54, b=19

      await this.joe.transferOwnership(this.chef.address) // t-53, b=20
      await this.chef.setDevPercent(this.devPercent) // t-52, b=21
      await this.chef.setTreasuryPercent(this.treasuryPercent) // t-51, b=22

      await this.chef.add("100", this.lp.address, this.rewarder.address) // t-50, b=23
      await this.lp.connect(this.bob).approve(this.chef.address, "1000") // t-49, b=24
      await advanceTimeAndBlock(103) // t+54, b=25

      expect(await this.joe.totalSupply()).to.equal("0")
      expect(await this.partnerToken.balanceOf(this.bob.address)).to.equal("0")
      await advanceTimeAndBlock(5) // t+59, b=26
      expect(await this.joe.totalSupply()).to.equal("0")
      expect(await this.partnerToken.balanceOf(this.bob.address)).to.equal("0")
      await advanceTimeAndBlock(5) // t+64, b=27
      await this.chef.connect(this.bob).deposit(0, "10") // t+65, b=28
      expect(await this.joe.totalSupply()).to.equal("0")
      expect(await this.joe.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.partnerToken.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.joe.balanceOf(this.dev.address)).to.equal("0")
      expect(await this.lp.balanceOf(this.bob.address)).to.equal("990")
      await advanceTimeAndBlock(10) // t+75, b=29
      // Revert if Bob withdraws more than he deposited
      await expect(this.chef.connect(this.bob).withdraw(0, "11")).to.be.revertedWith("withdraw: not good") // t+76, b=30
      await this.chef.connect(this.bob).withdraw(0, "10") // t+77, b=31

      // At this point:
      //   Bob should have:
      //     - 12*60 = 720 (+60) JoeToken
      //     - 3*40 = 120 PartnerToken
      //  Dev should have:
      //     - 12*20 = 240 (+20) JoeToken
      //  Treasury should have:
      //     - 12*20 = 240 (+20) JoeToken
      expect(await this.joe.totalSupply()).to.be.within(1200, 1300)
      expect(await this.joe.balanceOf(this.bob.address)).to.be.within(720, 780)
      expect(await this.joe.balanceOf(this.dev.address)).to.be.within(240, 260)
      expect(await this.joe.balanceOf(this.treasury.address)).to.be.within(240, 260)
      expect(await this.partnerToken.balanceOf(this.bob.address)).to.equal(120)
    })

    it("should distribute JOEs properly for each staker", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MCV2.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed() // t-59, b=14

      this.rewarder = await this.RewarderPerBlock.deploy(
        this.partnerToken.address,
        this.lp.address,
        this.partnerRewardPerBlock,
        this.partnerChefPid,
        this.partnerChef.address,
        this.chef.address
      )
      await this.rewarder.deployed() // t-58, b=15

      await this.partnerToken.transferOwnership(this.partnerChef.address) // t-57, b=16
      await this.partnerChef.add("100", this.dummyToken.address, true) // t-56, b=17

      await this.dummyToken.connect(this.partnerDev).approve(this.rewarder.address, "1") // t-55, b=18
      await this.rewarder.connect(this.partnerDev).init(this.dummyToken.address) // t-54, b=19

      await this.joe.transferOwnership(this.chef.address) // t-53, b=20
      await this.chef.setDevPercent(this.devPercent) // t-52, b=21
      await this.chef.setTreasuryPercent(this.treasuryPercent) // t-51, b=22

      await this.chef.add("100", this.lp.address, this.rewarder.address) // t-50, b=23
      await this.lp.connect(this.alice).approve(this.chef.address, "1000", {
        from: this.alice.address,
      }) // t-49, b=24
      await this.lp.connect(this.bob).approve(this.chef.address, "1000", {
        from: this.bob.address,
      }) // t-48, b=25
      await this.lp.connect(this.carol).approve(this.chef.address, "1000", {
        from: this.carol.address,
      }) // t-47, b=26

      // Alice deposits 10 LPs at t+10
      await advanceTimeAndBlock(56) // t+9, b=27
      await this.chef.connect(this.alice).deposit(0, "10", { from: this.alice.address }) // t+10, b=28
      // Bob deposits 20 LPs at t+14
      await advanceTimeAndBlock(3) // t+13, b=29
      await this.chef.connect(this.bob).deposit(0, "20") // t+14, b=30
      // Carol deposits 30 LPs at block t+18
      await advanceTimeAndBlock(3) // t+17, b=31
      await this.chef.connect(this.carol).deposit(0, "30", { from: this.carol.address }) // t+18, b=32
      // Alice deposits 10 more LPs at t+20. At this point:
      //   Alice should have:
      //      - 4*60 + 4*60*1/3 + 2*60*1/6 = 340 (+60) JoeToken
      //      - 2*40 + 2*40*1/3 + 2*40*1/6 = 120 PartnerToken
      //   Dev should have: 10*100*0.2 = 200 (+20)
      //   Treasury should have: 10*100*0.2 = 200 (+20)
      //   MasterChef should have: 1000 - 340 - 200 - 200 = 260 (+100)
      await advanceTimeAndBlock(1) // t+19, b=33
      await this.chef.connect(this.alice).deposit(0, "10", { from: this.alice.address }) // t+20, b=34
      expect(await this.joe.totalSupply()).to.be.within(1000, 1100)
      // Because LP rewards are divided among participants and rounded down, we account
      // for rounding errors with an offset
      expect(await this.joe.balanceOf(this.alice.address)).to.be.within(340 - this.tokenOffset, 400 + this.tokenOffset)
      expect(await this.partnerToken.balanceOf(this.alice.address)).to.be.within(120 - this.tokenOffset, 120 + this.tokenOffset)

      expect(await this.joe.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.partnerToken.balanceOf(this.bob.address)).to.equal("0")

      expect(await this.joe.balanceOf(this.carol.address)).to.equal("0")
      expect(await this.partnerToken.balanceOf(this.carol.address)).to.equal("0")

      expect(await this.joe.balanceOf(this.dev.address)).to.be.within(200 - this.tokenOffset, 220 + this.tokenOffset)
      expect(await this.joe.balanceOf(this.treasury.address)).to.be.within(200 - this.tokenOffset, 220 + this.tokenOffset)
      expect(await this.joe.balanceOf(this.chef.address)).to.be.within(260 - this.tokenOffset, 360 + this.tokenOffset)
      // Bob withdraws 5 LPs at t+30. At this point:
      //   Bob should have:
      //     - 4*60*2/3 + 2*60*2/6 + 10*60*2/7 = 371 (+60) JoeToken
      //     - 2*40*2/3 + 2*40*2/6 + 2*40*2/7 = 102 PartnerToken
      //   Dev should have: 20*100*0.2= 400 (+20)
      //   Treasury should have: 20*100*0.2 = 400 (+20)
      //   MasterChef should have: 260 + 1000 - 371 - 200 - 200 = 489 (+100)
      await advanceTimeAndBlock(9) // t+29, b=35
      await this.chef.connect(this.bob).withdraw(0, "5", { from: this.bob.address }) // t+30, b=36
      expect(await this.joe.totalSupply()).to.be.within(2000, 2100)
      // Because of rounding errors, we use token offsets
      expect(await this.joe.balanceOf(this.alice.address)).to.be.within(340 - this.tokenOffset, 400 + this.tokenOffset)
      expect(await this.partnerToken.balanceOf(this.alice.address)).to.be.within(119 - this.tokenOffset, 119 + this.tokenOffset)

      expect(await this.joe.balanceOf(this.bob.address)).to.be.within(371 - this.tokenOffset, 431 + this.tokenOffset)
      expect(await this.partnerToken.balanceOf(this.bob.address)).to.be.within(101 - this.tokenOffset, 101 + this.tokenOffset)

      expect(await this.joe.balanceOf(this.carol.address)).to.equal("0")
      expect(await this.partnerToken.balanceOf(this.carol.address)).to.equal("0")

      expect(await this.joe.balanceOf(this.dev.address)).to.be.within(400 - this.tokenOffset, 420 + this.tokenOffset)
      expect(await this.joe.balanceOf(this.treasury.address)).to.be.within(400 - this.tokenOffset, 420 + this.tokenOffset)
      expect(await this.joe.balanceOf(this.chef.address)).to.be.within(489 - this.tokenOffset, 589 + this.tokenOffset)
      // Alice withdraws 20 LPs at t+40
      // Bob withdraws 15 LPs at t+50
      // Carol withdraws 30 LPs at t+60
      await advanceTimeAndBlock(9) // t+39, b=37
      await this.chef.connect(this.alice).withdraw(0, "20", { from: this.alice.address }) // t+40, b=38
      await advanceTimeAndBlock(9) // t+49, b=39
      await this.chef.connect(this.bob).withdraw(0, "15", { from: this.bob.address }) // t+50, b=40
      await advanceTimeAndBlock(9) // t+59, b=41
      await this.chef.connect(this.carol).withdraw(0, "30", { from: this.carol.address }) // t+60, b=42
      expect(await this.joe.totalSupply()).to.be.within(5000, 5100)
      // Alice should have:
      //  - 340 + 10*60*2/7 + 10*60*20/65 = 696 (+60) JoeToken
      //  - 120 + 2*40*2/7 + 2*40*20/65 = 167 PartnerToken
      expect(await this.joe.balanceOf(this.alice.address)).to.be.within(696 - this.tokenOffset, 756 + this.tokenOffset)
      expect(await this.partnerToken.balanceOf(this.alice.address)).to.be.within(167 - this.tokenOffset, 167 + this.tokenOffset)
      // Bob should have:
      //  - 371 + 10*60*15/65 + 10*60*15/45 = 709 (+60) JoeToken
      //  - 102 + 2*40*15/65 + 2*40*15/45 = 147 PartnerToken
      expect(await this.joe.balanceOf(this.bob.address)).to.be.within(709 - this.tokenOffset, 769 + this.tokenOffset)
      expect(await this.partnerToken.balanceOf(this.bob.address)).to.be.within(147 - this.tokenOffset, 147 + this.tokenOffset)
      // Carol should have:
      //  - 2*60*3/6 + 10*60*3/7 + 10*60*30/65 + 10*60*30/45 + 10*60 = 1594 (+60) JoeToken
      //  - 2*40*1/2 + 2*40*3/7 + 2*40*30/65 + 2*40*30/45 + 2*40 = 244 PartnerToken
      expect(await this.joe.balanceOf(this.carol.address)).to.be.within(1594 - this.tokenOffset, 1654 + this.tokenOffset)
      expect(await this.partnerToken.balanceOf(this.carol.address)).to.be.within(244 - this.tokenOffset, 244 + this.tokenOffset)
      // Dev should have: 50*100*0.2 = 1000 (+20)
      // Treasury should have: 50*100*0.2 = 1000 (+20)
      expect(await this.joe.balanceOf(this.dev.address)).to.be.within(1000 - this.tokenOffset, 1020 + this.tokenOffset)
      expect(await this.joe.balanceOf(this.treasury.address)).to.be.within(1000 - this.tokenOffset, 1020 + this.tokenOffset)
      // MasterChefJoe and PartnerChef should have nothing
      expect(await this.joe.balanceOf(this.chef.address)).to.be.within(0, 0 + this.tokenOffset)
      expect(await this.partnerToken.balanceOf(this.partnerChef.address)).to.be.within(0, 0 + this.tokenOffset)

      // // All of them should have 1000 LPs back.
      expect(await this.lp.balanceOf(this.alice.address)).to.equal("1000")
      expect(await this.lp.balanceOf(this.bob.address)).to.equal("1000")
      expect(await this.lp.balanceOf(this.carol.address)).to.equal("1000")
    })

    it("should give proper JOEs allocation to each pool", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MCV2.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed() // t-59

      this.rewarder = await this.RewarderPerBlock.deploy(
        this.partnerToken.address,
        this.lp.address,
        this.partnerRewardPerBlock,
        this.partnerChefPid,
        this.partnerChef.address,
        this.chef.address
      )
      await this.rewarder.deployed() // t-58, b=15

      await this.partnerToken.transferOwnership(this.partnerChef.address) // t-57, b=16
      await this.partnerChef.add("100", this.dummyToken.address, true) // t-56, b=17

      await this.dummyToken.connect(this.partnerDev).approve(this.rewarder.address, "1") // t-55, b=18
      await this.rewarder.connect(this.partnerDev).init(this.dummyToken.address) // t-54, b=19

      await this.joe.transferOwnership(this.chef.address) // t-53, b=20
      await this.chef.setDevPercent(this.devPercent) // t-52, b=21
      await this.chef.setTreasuryPercent(this.treasuryPercent) // t-51, b=22

      await this.lp.connect(this.alice).approve(this.chef.address, "1000", { from: this.alice.address }) // t-50, b=23
      await this.lp2.connect(this.bob).approve(this.chef.address, "1000", { from: this.bob.address }) // t-49, b=24
      // Add first LP to the pool with allocation 10
      await this.chef.add("10", this.lp.address, this.rewarder.address) // t-48, b=25
      // Alice deposits 10 LPs at t+10
      await advanceTimeAndBlock(57) // t+9, b=26
      await this.chef.connect(this.alice).deposit(0, "10", { from: this.alice.address }) // t+10, b=27
      // Add LP2 to the pool with allocation 20 at t+20
      await advanceTimeAndBlock(9) // t+19, b=28
      await this.chef.add("20", this.lp2.address, ADDRESS_ZERO) // t+20, b=29
      // Alice's pending reward should be:
      //   - 10*60 = 600 (+60) JoeToken
      //   - 2*40 = 80 PartnerToken
      expect((await this.chef.pendingTokens(0, this.alice.address)).pendingJoe).to.be.within(600 - this.tokenOffset, 660 + this.tokenOffset)
      expect(await this.rewarder.pendingTokens(this.alice.address)).to.equal(80)
      // Bob deposits 10 LP2s at t+25
      await advanceTimeAndBlock(4) // t+24, b=30
      await this.chef.connect(this.bob).deposit(1, "10", { from: this.bob.address }) // t+25, b=31
      // Alice's pending reward should be:
      //   - 600 + 5*1/3*60 = 700 (+60) JoeToken
      //   - 80 + 2*40 = 160 PartnerToken
      expect((await this.chef.pendingTokens(0, this.alice.address)).pendingJoe).to.be.within(700 - this.tokenOffset, 760 + this.tokenOffset)
      expect(await this.rewarder.pendingTokens(this.alice.address)).to.equal(160)

      // At this point:
      //   Alice's pending reward should be:
      //     - 700 + 5*1/3*60 = 800 (+60) JoeToken
      //     - 160 + 1*40 = 200 PartnerToken
      // Bob's pending reward should be:
      //     - 5*2/3*60 = 200 (+60) JoeToken
      //     - 0 PartnerToken
      await advanceTimeAndBlock(5) // t+30, b=32
      expect((await this.chef.pendingTokens(0, this.alice.address)).pendingJoe).to.be.within(800 - this.tokenOffset, 860 + this.tokenOffset)
      expect(await this.rewarder.pendingTokens(this.alice.address)).to.equal(200)

      expect((await this.chef.pendingTokens(1, this.bob.address)).pendingJoe).to.be.within(200 - this.tokenOffset, 260 + this.tokenOffset)
      expect(await this.rewarder.pendingTokens(this.bob.address)).to.equal(0)

      // Alice and Bob should not have pending rewards in pools they're not staked in
      expect((await this.chef.pendingTokens(1, this.alice.address)).pendingJoe).to.equal("0")
      expect((await this.chef.pendingTokens(0, this.bob.address)).pendingJoe).to.equal("0")

      // Make sure they have receive the same amount as what was pending
      await this.chef.connect(this.alice).withdraw(0, "10", { from: this.alice.address }) // t+31, b=33
      // Alice should have:
      //   - 800 + 1*1/3*60 = 820 (+60) JoeToken
      //   - 200 + 1*40 = 240 PartnerToken
      expect(await this.joe.balanceOf(this.alice.address)).to.be.within(820 - this.tokenOffset, 880 + this.tokenOffset)
      expect(await this.partnerToken.balanceOf(this.alice.address)).to.equal(240)

      await this.chef.connect(this.bob).withdraw(1, "5", { from: this.bob.address }) // t+32, b=34
      // Bob should have:
      //   - 200 + 2*2/3*60 = 280 (+60) JoeToken
      //   - 0 PartnerToken
      expect(await this.joe.balanceOf(this.bob.address)).to.be.within(280 - this.tokenOffset, 340 + this.tokenOffset)
      expect(await this.rewarder.pendingTokens(this.bob.address)).to.equal(0)
    })

    it("should give proper JOEs after updating emission rate", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MCV2.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed() // t-59

      this.rewarder = await this.RewarderPerBlock.deploy(
        this.partnerToken.address,
        this.lp.address,
        this.partnerRewardPerBlock,
        this.partnerChefPid,
        this.partnerChef.address,
        this.chef.address
      )
      await this.rewarder.deployed() // t-58, b=15

      await this.partnerToken.transferOwnership(this.partnerChef.address) // t-57, b=16
      await this.partnerChef.add("100", this.dummyToken.address, true) // t-56, b=17

      await this.dummyToken.connect(this.partnerDev).approve(this.rewarder.address, "1") // t-55, b=18
      await this.rewarder.connect(this.partnerDev).init(this.dummyToken.address) // t-54, b=19

      await this.joe.transferOwnership(this.chef.address) // t-53, b=20
      await this.chef.setDevPercent(this.devPercent) // t-52, b=21
      await this.chef.setTreasuryPercent(this.treasuryPercent) // t-51, b=22

      await this.lp.connect(this.alice).approve(this.chef.address, "1000", { from: this.alice.address }) // t-50, b=23
      await this.chef.add("10", this.lp.address, this.rewarder.address) // t-49, b=24
      // Alice deposits 10 LPs at t+10
      await advanceTimeAndBlock(58) // t+9, b=25
      await this.chef.connect(this.alice).deposit(0, "10", { from: this.alice.address }) // t+10, b=26
      // At t+110, Alice should have:
      //   - 100*100*0.6 = 6000 (+60)) JoeToken
      //   - 1*40 = 40 PartnerToken
      await advanceTimeAndBlock(100) // t+110, b=27
      expect((await this.chef.pendingTokens(0, this.alice.address)).pendingJoe).to.be.within(6000, 6060)
      expect(await this.rewarder.pendingTokens(this.alice.address)).to.equal(40)
      // Lower JOE emission rate to 40 JOE per sec
      await this.chef.updateEmissionRate(40) // t+111, b=28
      // At t+115, Alice should have:
      //   - 6000 + 1*100*0.6 + 4*40*0.6 = 6156 (+24) JoeToken
      //   - 40 + 2*40 = 120 PartnerToken
      await advanceTimeAndBlock(4) // t+115, b=29
      expect((await this.chef.pendingTokens(0, this.alice.address)).pendingJoe).to.be.within(6156, 6216)
      expect(await this.rewarder.pendingTokens(this.alice.address)).to.equal(120)
      // Increase PartnerToken emission rate to 90 PartnerToken per block
      await this.rewarder.setRewardRate(90) // t+116, b=30
      // At b=35, Alice should have:
      //   - 6156 + 21*40*0.6 = 6660 (+24) JoeToken
      //   - 120 + 1*40 + 5*90 = 610 PartnerToken
      await advanceTimeAndBlock(2) // t+118, b=31
      await advanceTimeAndBlock(3) // t+121, b=32
      await advanceTimeAndBlock(4) // t+125, b=33
      await advanceTimeAndBlock(5) // t+130, b=34
      await advanceTimeAndBlock(6) // t+136, b=35
      expect((await this.chef.pendingTokens(0, this.alice.address)).pendingJoe).to.be.within(6660, 6684)
      expect(await this.rewarder.pendingTokens(this.alice.address)).to.equal(610)
    })
  })

  context("With ERC/LP token added to the field and using per sec MasterChef for partner", function () {
    beforeEach(async function () {
      this.lp = await this.ERC20Mock.deploy("LPToken", "LP", "10000000000")
      await this.lp.transfer(this.alice.address, "1000")
      await this.lp.transfer(this.bob.address, "1000")
      await this.lp.transfer(this.carol.address, "1000")

      this.lp2 = await this.ERC20Mock.deploy("LPToken2", "LP2", "10000000000")
      await this.lp2.transfer(this.alice.address, "1000")
      await this.lp2.transfer(this.bob.address, "1000")
      await this.lp2.transfer(this.carol.address, "1000")

      this.dummyToken = await this.ERC20Mock.deploy("DummyToken", "DUMMY", "1")
      await this.dummyToken.transfer(this.partnerDev.address, "1")

      this.partnerChef = await this.MCV1PerSec.deploy(
        this.partnerToken.address,
        this.partnerDev.address,
        this.partnerRewardPerSec,
        this.partnerStartBlock,
        this.partnerBonusEndBlock
      )
      await this.partnerChef.deployed()
    })

    it("should check rewarder's arguments are contracts", async function () {
      await expect(
        this.RewarderPerSec.deploy(
          ADDRESS_ZERO,
          this.lp.address,
          this.partnerRewardPerSec,
          this.partnerChefPid,
          this.partnerChef.address,
          this.chef.address
        )
      ).to.be.revertedWith("constructor: reward token must be a valid contract")

      await expect(
        this.RewarderPerSec.deploy(
          this.joe.address,
          ADDRESS_ZERO,
          this.partnerRewardPerSec,
          this.partnerChefPid,
          this.partnerChef.address,
          this.chef.address
        )
      ).to.be.revertedWith("constructor: LP token must be a valid contract")

      await expect(
        this.RewarderPerSec.deploy(
          this.joe.address,
          this.lp.address,
          this.partnerRewardPerSec,
          this.partnerChefPid,
          ADDRESS_ZERO,
          this.chef.address
        )
      ).to.be.revertedWith("constructor: MasterChef must be a valid contract")

      await expect(
        this.RewarderPerSec.deploy(
          this.joe.address,
          this.lp.address,
          this.partnerRewardPerSec,
          this.partnerChefPid,
          this.partnerChef.address,
          ADDRESS_ZERO
        )
      ).to.be.revertedWith("constructor: MasterChefJoeV2 must be a valid contract")
    })

    it("should check rewarder added and set properly", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MCV2.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed()

      this.rewarder = await this.RewarderPerSec.deploy(
        this.joe.address,
        this.lp.address,
        this.partnerRewardPerSec,
        this.partnerChefPid,
        this.partnerChef.address,
        this.chef.address
      )
      await this.rewarder.deployed()

      // Try to add rewarder that is neither zero address or contract address
      await expect(this.chef.add("100", this.lp.address, this.dev.address)).to.be.revertedWith("add: rewarder must be contract or zero")

      await this.chef.add("100", this.lp.address, this.rewarder.address)

      // Try to set rewarder that is neither zero address or contract address
      await expect(this.chef.set("0", "200", this.dev.address, true)).to.be.revertedWith("set: rewarder must be contract or zero")

      await this.chef.set("0", "200", this.rewarder.address, false)
      expect((await this.chef.poolInfo(0)).allocPoint).to.equal("200")

      // Alice has no DummyToken, so it should fail to init
      await expect(this.rewarder.connect(this.alice).init(this.dummyToken.address)).to.be.revertedWith("init: Balance must exceed 0")

      // Successfully init the rewarder
      await this.partnerChef.add("100", this.dummyToken.address, true)
      await this.dummyToken.connect(this.partnerDev).approve(this.rewarder.address, "1")
      await this.rewarder.connect(this.partnerDev).init(this.dummyToken.address)
      expect((await this.partnerChef.poolInfo(this.partnerChefPid)).lpToken).to.equal(this.dummyToken.address)
    })

    it("should allow a given pool's allocation weight and rewarder to be updated", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MCV2.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed()

      this.rewarder = await this.RewarderPerSec.deploy(
        this.joe.address,
        this.lp.address,
        this.partnerRewardPerSec,
        this.partnerChefPid,
        this.partnerChef.address,
        this.chef.address
      )
      await this.rewarder.deployed()

      await this.chef.add("100", this.lp.address, ADDRESS_ZERO)
      expect((await this.chef.poolInfo(0)).allocPoint).to.equal("100")
      expect((await this.chef.poolInfo(0)).rewarder).to.equal(ADDRESS_ZERO)

      await this.chef.set("0", "150", this.rewarder.address, true)
      expect((await this.chef.poolInfo(0)).allocPoint).to.equal("150")
      expect((await this.chef.poolInfo(0)).rewarder).to.equal(this.rewarder.address)
    })

    it("should allow emergency withdraw", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MCV2.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed()

      await this.chef.add("100", this.lp.address, ADDRESS_ZERO)

      await this.lp.connect(this.bob).approve(this.chef.address, "1000")

      await this.chef.connect(this.bob).deposit(0, "100")

      expect(await this.lp.balanceOf(this.bob.address)).to.equal("900")

      await this.chef.connect(this.bob).emergencyWithdraw(0)

      expect(await this.lp.balanceOf(this.bob.address)).to.equal("1000")
    })

    it("should only allow MasterChefJoeV2 to call onJoeReward", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MCV2.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed() // t-59

      this.rewarder = await this.RewarderPerSec.deploy(
        this.partnerToken.address,
        this.lp.address,
        this.partnerRewardPerSec,
        this.partnerChefPid,
        this.partnerChef.address,
        this.chef.address
      )
      await this.rewarder.deployed() // t-58

      await this.partnerToken.transferOwnership(this.partnerChef.address) // t-57
      await this.partnerChef.add("100", this.dummyToken.address, true) // t-56

      await this.dummyToken.connect(this.partnerDev).approve(this.rewarder.address, "1") // t-55
      await this.rewarder.connect(this.partnerDev).init(this.dummyToken.address) // t-54

      await this.joe.transferOwnership(this.chef.address) // t-53
      await this.chef.setDevPercent(this.devPercent) // t-52
      await this.chef.setTreasuryPercent(this.treasuryPercent) // t-51

      await this.chef.add("100", this.lp.address, this.rewarder.address) // t-50

      await this.lp.connect(this.bob).approve(this.chef.address, "1000") // t-49
      await this.chef.connect(this.bob).deposit(0, "100") // t-48
      await advanceTimeAndBlock(37) // t-11

      await expect(this.rewarder.onJoeReward(this.bob.address, "100")).to.be.revertedWith("onlyMCV2: only MasterChef V2 can call this function") // t-10
      await this.chef.connect(this.bob).deposit(0, "0") // t-9
      // Bob should have:
      //   - 0 JoeToken
      //   - 39*40 = 1560 (+40) PartnerToken
      expect(await this.joe.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.partnerToken.balanceOf(this.bob.address)).to.be.within(1560, 1600)
    })

    it("should allow rewarder to be set and removed mid farming", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MCV2.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed() // t-59

      this.rewarder = await this.RewarderPerSec.deploy(
        this.partnerToken.address,
        this.lp.address,
        this.partnerRewardPerSec,
        this.partnerChefPid,
        this.partnerChef.address,
        this.chef.address
      )
      await this.rewarder.deployed() // t-58

      await this.partnerToken.transferOwnership(this.partnerChef.address) // t-57
      await this.partnerChef.add("100", this.dummyToken.address, true) // t-56

      await this.dummyToken.connect(this.partnerDev).approve(this.rewarder.address, "1") // t-55
      await this.rewarder.connect(this.partnerDev).init(this.dummyToken.address) // t-54

      await this.joe.transferOwnership(this.chef.address) // t-53
      await this.chef.setDevPercent(this.devPercent) // t-52
      await this.chef.setTreasuryPercent(this.treasuryPercent) // t-51

      await this.chef.add("100", this.lp.address, ADDRESS_ZERO) // t-50

      await this.lp.connect(this.bob).approve(this.chef.address, "1000") // t-49
      await this.chef.connect(this.bob).deposit(0, "100") // t-48
      await advanceTimeAndBlock(37) // t-11

      await this.chef.connect(this.bob).deposit(0, "0") // t-10
      expect(await this.joe.balanceOf(this.bob.address)).to.equal("0")
      // At t+10, Bob should have pending:
      //   - 10*60 = 600 (+60) JoeToken
      //   - 0 PartnerToken
      await advanceTimeAndBlock(20) // t+10
      expect((await this.chef.pendingTokens(0, this.bob.address)).pendingJoe).to.be.within(600, 660)
      expect((await this.chef.pendingTokens(0, this.bob.address)).bonusTokenAddress).to.equal(ADDRESS_ZERO)
      expect((await this.chef.pendingTokens(0, this.bob.address)).pendingBonusToken).to.equal(0)

      // Pass rewarder but don't overwrite
      await this.chef.set(0, 100, this.rewarder.address, false) // t+11

      // At t+20, Bob should have pending:
      //   - 600 + 10*60 = 1200 (+60) JoeToken
      //   - 0 PartnerToken
      await advanceTimeAndBlock(9) // t+20
      expect((await this.chef.pendingTokens(0, this.bob.address)).pendingJoe).to.be.within(1200, 12060)
      expect((await this.chef.pendingTokens(0, this.bob.address)).bonusTokenAddress).to.equal(ADDRESS_ZERO)
      expect((await this.chef.pendingTokens(0, this.bob.address)).pendingBonusToken).to.equal(0)

      // Pass rewarder and overwrite
      await this.chef.set(0, 100, this.rewarder.address, true) // t+21

      // At t+30, Bob should have pending:
      //   - 1200 + 10*60 = 1800 (+60) JoeToken
      //   - 0 PartnerToken - this is because rewarder hasn't registered the user yet! User needs to call deposit again
      await advanceTimeAndBlock(9) // t+30
      expect((await this.chef.pendingTokens(0, this.bob.address)).pendingJoe).to.be.within(1800, 1860)
      expect((await this.chef.pendingTokens(0, this.bob.address)).bonusTokenAddress).to.equal(this.partnerToken.address)
      expect((await this.chef.pendingTokens(0, this.bob.address)).bonusTokenSymbol).to.equal("SUSHI")
      expect((await this.chef.pendingTokens(0, this.bob.address)).pendingBonusToken).to.equal(0)

      // Call deposit to start receiving PartnerTokens
      await this.chef.connect(this.bob).deposit(0, 0) // t+31

      // At t+40, Bob should have pending:
      //   - 9*60 = 540 (+60) JoeToken
      //   - 9*40 = 360 (+40) PartnerToken
      await advanceTimeAndBlock(9) // t+40
      expect((await this.chef.pendingTokens(0, this.bob.address)).pendingJoe).to.be.within(540, 600)
      expect((await this.chef.pendingTokens(0, this.bob.address)).bonusTokenAddress).to.equal(this.partnerToken.address)
      expect((await this.chef.pendingTokens(0, this.bob.address)).bonusTokenSymbol).to.equal("SUSHI")
      expect((await this.chef.pendingTokens(0, this.bob.address)).pendingBonusToken).to.be.within(360, 400)
    })

    it("should give out JOEs only after farming time", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MCV2.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed() // t-59

      this.rewarder = await this.RewarderPerSec.deploy(
        this.partnerToken.address,
        this.lp.address,
        this.partnerRewardPerSec,
        this.partnerChefPid,
        this.partnerChef.address,
        this.chef.address
      )
      await this.rewarder.deployed() // t-58

      await this.partnerToken.transferOwnership(this.partnerChef.address) // t-57
      await this.partnerChef.add("100", this.dummyToken.address, true) // t-56

      await this.dummyToken.connect(this.partnerDev).approve(this.rewarder.address, "1") // t-55
      await this.rewarder.connect(this.partnerDev).init(this.dummyToken.address) // t-54

      await this.joe.transferOwnership(this.chef.address) // t-53
      await this.chef.setDevPercent(this.devPercent) // t-52
      await this.chef.setTreasuryPercent(this.treasuryPercent) // t-51

      await this.chef.add("100", this.lp.address, this.rewarder.address) // t-50

      await this.lp.connect(this.bob).approve(this.chef.address, "1000") // t-49
      await this.chef.connect(this.bob).deposit(0, "100") // t-48
      await advanceTimeAndBlock(37) // t-11

      await this.chef.connect(this.bob).deposit(0, "0") // t-10
      // Bob should have:
      //   - 0 JoeToken
      //   - 38*40 = 1520 (+40) PartnerToken
      expect(await this.joe.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.partnerToken.balanceOf(this.bob.address)).to.be.within(1520, 1560)
      await advanceTimeAndBlock(8) // t-2

      await this.chef.connect(this.bob).deposit(0, "0") // t-1
      expect(await this.joe.balanceOf(this.bob.address)).to.equal("0")
      await advanceTimeAndBlock(10) // t+9

      await this.chef.connect(this.bob).deposit(0, "0") // t+10
      // Bob should have:
      //   - 10*60 = 600 (+60) JoeToken
      //   - 1520 + 20*40 = 2320 (+40) PartnerToken
      expect(await this.joe.balanceOf(this.bob.address)).to.be.within(600, 660)
      expect(await this.partnerToken.balanceOf(this.bob.address)).to.be.within(2320, 2360)

      await advanceTimeAndBlock(4) // t+14, b=32
      await this.chef.connect(this.bob).deposit(0, "0") // t+15, b=33

      // At this point:
      //   Bob should have:
      //     - 600 + 5*60 = 900 (+60) JoeToken
      //     - 2320 + 5*40 = 2520 (+40) PartnerToken
      //   Dev should have: 15*20 = 300 (+20)
      //   Tresury should have: 15*20 = 300 (+20)
      expect(await this.joe.balanceOf(this.bob.address)).to.be.within(900, 960)
      expect(await this.partnerToken.balanceOf(this.bob.address)).to.be.within(2520, 2560)
      expect(await this.joe.balanceOf(this.dev.address)).to.be.within(300, 320)
      expect(await this.joe.balanceOf(this.treasury.address)).to.be.within(300, 320)
      expect(await this.joe.totalSupply()).to.be.within(1500, 1600)
    })

    it("should not distribute JOEs if no one deposit", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MCV2.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed() // t-59

      this.rewarder = await this.RewarderPerSec.deploy(
        this.partnerToken.address,
        this.lp.address,
        this.partnerRewardPerSec,
        this.partnerChefPid,
        this.partnerChef.address,
        this.chef.address
      )
      await this.rewarder.deployed() // t-58

      await this.partnerToken.transferOwnership(this.partnerChef.address) // t-57
      await this.partnerChef.add("100", this.dummyToken.address, true) // t-56

      await this.dummyToken.connect(this.partnerDev).approve(this.rewarder.address, "1") // t-55
      await this.rewarder.connect(this.partnerDev).init(this.dummyToken.address) // t-54

      await this.joe.transferOwnership(this.chef.address) // t-53
      await this.chef.setDevPercent(this.devPercent) // t-52
      await this.chef.setTreasuryPercent(this.treasuryPercent) // t-51

      await this.chef.add("100", this.lp.address, this.rewarder.address) // t-50
      await this.lp.connect(this.bob).approve(this.chef.address, "1000") // t-49
      await advanceTimeAndBlock(103) // t+54

      expect(await this.joe.totalSupply()).to.equal("0")
      expect(await this.partnerToken.balanceOf(this.bob.address)).to.equal("0")
      await advanceTimeAndBlock(5) // t+59
      expect(await this.joe.totalSupply()).to.equal("0")
      expect(await this.partnerToken.balanceOf(this.bob.address)).to.equal("0")
      await advanceTimeAndBlock(5) // t+64
      await this.chef.connect(this.bob).deposit(0, "10") // t+65
      expect(await this.joe.totalSupply()).to.equal("0")
      expect(await this.joe.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.partnerToken.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.joe.balanceOf(this.dev.address)).to.equal("0")
      expect(await this.lp.balanceOf(this.bob.address)).to.equal("990")
      await advanceTimeAndBlock(10) // t+75
      // Revert if Bob withdraws more than he deposited
      await expect(this.chef.connect(this.bob).withdraw(0, "11")).to.be.revertedWith("withdraw: not good") // t+76
      await this.chef.connect(this.bob).withdraw(0, "10") // t+77

      // At this point:
      //   Bob should have:
      //     - 12*60 = 720 (+60) JoeToken
      //     - 12*40 = 480 (+40) PartnerToken
      //  Dev should have:
      //     - 12*20 = 240 (+20) JoeToken
      //  Treasury should have:
      //     - 12*20 = 240 (+20) JoeToken
      expect(await this.joe.totalSupply()).to.be.within(1200, 1300)
      expect(await this.joe.balanceOf(this.bob.address)).to.be.within(720, 780)
      expect(await this.joe.balanceOf(this.dev.address)).to.be.within(240, 260)
      expect(await this.joe.balanceOf(this.treasury.address)).to.be.within(240, 260)
      expect(await this.partnerToken.balanceOf(this.bob.address)).to.be.within(480, 520)
    })

    it("should distribute JOEs properly for each staker", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MCV2.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed() // t-59

      this.rewarder = await this.RewarderPerSec.deploy(
        this.partnerToken.address,
        this.lp.address,
        this.partnerRewardPerSec,
        this.partnerChefPid,
        this.partnerChef.address,
        this.chef.address
      )
      await this.rewarder.deployed() // t-58

      await this.partnerToken.transferOwnership(this.partnerChef.address) // t-57
      await this.partnerChef.add("100", this.dummyToken.address, true) // t-56

      await this.dummyToken.connect(this.partnerDev).approve(this.rewarder.address, "1") // t-55
      await this.rewarder.connect(this.partnerDev).init(this.dummyToken.address) // t-54

      await this.joe.transferOwnership(this.chef.address) // t-53
      await this.chef.setDevPercent(this.devPercent) // t-52
      await this.chef.setTreasuryPercent(this.treasuryPercent) // t-51

      await this.chef.add("100", this.lp.address, this.rewarder.address) // t-50
      await this.lp.connect(this.alice).approve(this.chef.address, "1000", {
        from: this.alice.address,
      }) // t-49
      await this.lp.connect(this.bob).approve(this.chef.address, "1000", {
        from: this.bob.address,
      }) // t-48
      await this.lp.connect(this.carol).approve(this.chef.address, "1000", {
        from: this.carol.address,
      }) // t-47

      // Alice deposits 10 LPs at t+10
      await advanceTimeAndBlock(56) // t+9
      await this.chef.connect(this.alice).deposit(0, "10", { from: this.alice.address }) // t+10
      // Bob deposits 20 LPs at t+14
      await advanceTimeAndBlock(3) // t+13
      await this.chef.connect(this.bob).deposit(0, "20") // t+14
      // Carol deposits 30 LPs at block t+18
      await advanceTimeAndBlock(3) // t+17
      await this.chef.connect(this.carol).deposit(0, "30", { from: this.carol.address }) // t+18
      // Alice deposits 10 more LPs at t+20. At this point:
      //   Alice should have:
      //      - 4*60 + 4*60*1/3 + 2*60*1/6 = 340 (+60) JoeToken
      //      - 4*40 + 4*40*1/3 + 2*40*1/6 = 226 (+40) PartnerToken
      //   Dev should have: 10*100*0.2 = 200 (+20)
      //   Treasury should have: 10*100*0.2 = 200 (+20)
      //   MasterChef should have: 1000 - 340 - 200 - 200 = 260 (+100)
      await advanceTimeAndBlock(1) // t+19
      await this.chef.connect(this.alice).deposit(0, "10", { from: this.alice.address }) // t+20,
      expect(await this.joe.totalSupply()).to.be.within(1000, 1100)
      // Because LP rewards are divided among participants and rounded down, we account
      // for rounding errors with an offset
      expect(await this.joe.balanceOf(this.alice.address)).to.be.within(340 - this.tokenOffset, 400 + this.tokenOffset)
      expect(await this.partnerToken.balanceOf(this.alice.address)).to.be.within(226 - this.tokenOffset, 266 + this.tokenOffset)

      expect(await this.joe.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.partnerToken.balanceOf(this.bob.address)).to.equal("0")

      expect(await this.joe.balanceOf(this.carol.address)).to.equal("0")
      expect(await this.partnerToken.balanceOf(this.carol.address)).to.equal("0")

      expect(await this.joe.balanceOf(this.dev.address)).to.be.within(200 - this.tokenOffset, 220 + this.tokenOffset)
      expect(await this.joe.balanceOf(this.treasury.address)).to.be.within(200 - this.tokenOffset, 220 + this.tokenOffset)
      expect(await this.joe.balanceOf(this.chef.address)).to.be.within(260 - this.tokenOffset, 360 + this.tokenOffset)
      // Bob withdraws 5 LPs at t+30. At this point:
      //   Bob should have:
      //     - 4*60*2/3 + 2*60*2/6 + 10*60*2/7 = 371 (+60) JoeToken
      //     - 4*40*2/3 + 2*40*2/6 + 10*40*2/7 = 247 (+40) PartnerToken
      //   Dev should have: 20*100*0.2= 400 (+20)
      //   Treasury should have: 20*100*0.2 = 400 (+20)
      //   MasterChef should have: 260 + 1000 - 371 - 200 - 200 = 489 (+100)
      await advanceTimeAndBlock(9) // t+29
      await this.chef.connect(this.bob).withdraw(0, "5", { from: this.bob.address }) // t+30
      expect(await this.joe.totalSupply()).to.be.within(2000, 2100)
      // Because of rounding errors, we use token offsets
      expect(await this.joe.balanceOf(this.alice.address)).to.be.within(340 - this.tokenOffset, 400 + this.tokenOffset)
      expect(await this.partnerToken.balanceOf(this.alice.address)).to.be.within(226 - this.tokenOffset, 266 + this.tokenOffset)

      expect(await this.joe.balanceOf(this.bob.address)).to.be.within(371 - this.tokenOffset, 431 + this.tokenOffset)
      expect(await this.partnerToken.balanceOf(this.bob.address)).to.be.within(247 - this.tokenOffset, 287 + this.tokenOffset)

      expect(await this.joe.balanceOf(this.carol.address)).to.equal("0")
      expect(await this.partnerToken.balanceOf(this.carol.address)).to.equal("0")

      expect(await this.joe.balanceOf(this.dev.address)).to.be.within(400 - this.tokenOffset, 420 + this.tokenOffset)
      expect(await this.joe.balanceOf(this.treasury.address)).to.be.within(400 - this.tokenOffset, 420 + this.tokenOffset)
      expect(await this.joe.balanceOf(this.chef.address)).to.be.within(489 - this.tokenOffset, 589 + this.tokenOffset)
      // Alice withdraws 20 LPs at t+40
      // Bob withdraws 15 LPs at t+50
      // Carol withdraws 30 LPs at t+60
      await advanceTimeAndBlock(9) // t+39
      await this.chef.connect(this.alice).withdraw(0, "20", { from: this.alice.address }) // t+40
      await advanceTimeAndBlock(9) // t+49
      await this.chef.connect(this.bob).withdraw(0, "15", { from: this.bob.address }) // t+50
      await advanceTimeAndBlock(9) // t+59
      await this.chef.connect(this.carol).withdraw(0, "30", { from: this.carol.address }) // t+60
      expect(await this.joe.totalSupply()).to.be.within(5000, 5100)
      // Alice should have:
      //  - 340 + 10*60*2/7 + 10*60*20/65 = 696 (+60) JoeToken
      //  - 226 + 10*40*2/7 + 10*40*20/65 = 463 (+40) PartnerToken
      expect(await this.joe.balanceOf(this.alice.address)).to.be.within(696 - this.tokenOffset, 756 + this.tokenOffset)
      expect(await this.partnerToken.balanceOf(this.alice.address)).to.be.within(463 - this.tokenOffset, 503 + this.tokenOffset)
      // Bob should have:
      //  - 371 + 10*60*15/65 + 10*60*15/45 = 709 (+60) JoeToken
      //  - 247 + 10*40*15/65 + 10*40*15/45 = 472 (+40) PartnerToken
      expect(await this.joe.balanceOf(this.bob.address)).to.be.within(709 - this.tokenOffset, 769 + this.tokenOffset)
      expect(await this.partnerToken.balanceOf(this.bob.address)).to.be.within(472 - this.tokenOffset, 512 + this.tokenOffset)
      // Carol should have:
      //  - 2*60*3/6 + 10*60*3/7 + 10*60*30/65 + 10*60*30/45 + 10*60 = 1594 (+60) JoeToken
      //  - 2*40*1/2 + 10*40*3/7 + 10*40*30/65 + 10*40*30/45 + 10*40 = 1062 (+40) PartnerToken
      expect(await this.joe.balanceOf(this.carol.address)).to.be.within(1594 - this.tokenOffset, 1654 + this.tokenOffset)
      expect(await this.partnerToken.balanceOf(this.carol.address)).to.be.within(1062 - this.tokenOffset, 1102 + this.tokenOffset)
      // Dev should have: 50*100*0.2 = 1000 (+20)
      // Treasury should have: 50*100*0.2 = 1000 (+20)
      expect(await this.joe.balanceOf(this.dev.address)).to.be.within(1000 - this.tokenOffset, 1020 + this.tokenOffset)
      expect(await this.joe.balanceOf(this.treasury.address)).to.be.within(1000 - this.tokenOffset, 1020 + this.tokenOffset)
      // MasterChefJoe and PartnerChef should have nothing
      expect(await this.joe.balanceOf(this.chef.address)).to.be.within(0, 0 + this.tokenOffset)
      expect(await this.partnerToken.balanceOf(this.partnerChef.address)).to.be.within(0, 0 + this.tokenOffset)

      // // All of them should have 1000 LPs back.
      expect(await this.lp.balanceOf(this.alice.address)).to.equal("1000")
      expect(await this.lp.balanceOf(this.bob.address)).to.equal("1000")
      expect(await this.lp.balanceOf(this.carol.address)).to.equal("1000")
    })

    it("should give proper JOEs allocation to each pool", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MCV2.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed() // t-59

      this.rewarder = await this.RewarderPerSec.deploy(
        this.partnerToken.address,
        this.lp.address,
        this.partnerRewardPerSec,
        this.partnerChefPid,
        this.partnerChef.address,
        this.chef.address
      )
      await this.rewarder.deployed() // t-58

      await this.partnerToken.transferOwnership(this.partnerChef.address) // t-57
      await this.partnerChef.add("100", this.dummyToken.address, true) // t-56

      await this.dummyToken.connect(this.partnerDev).approve(this.rewarder.address, "1") // t-55
      await this.rewarder.connect(this.partnerDev).init(this.dummyToken.address) // t-54

      await this.joe.transferOwnership(this.chef.address) // t-53
      await this.chef.setDevPercent(this.devPercent) // t-52
      await this.chef.setTreasuryPercent(this.treasuryPercent) // t-51

      await this.lp.connect(this.alice).approve(this.chef.address, "1000", { from: this.alice.address }) // t-50
      await this.lp2.connect(this.bob).approve(this.chef.address, "1000", { from: this.bob.address }) // t-49
      // Add first LP to the pool with allocation 10
      await this.chef.add("10", this.lp.address, this.rewarder.address) // t-48
      // Alice deposits 10 LPs at t+10
      await advanceTimeAndBlock(57) // t+9
      await this.chef.connect(this.alice).deposit(0, "10", { from: this.alice.address }) // t+10
      // Add LP2 to the pool with allocation 20 at t+20
      await advanceTimeAndBlock(9) // t+19
      await this.chef.add("20", this.lp2.address, ADDRESS_ZERO) // t+20
      // Alice's pending reward should be:
      //   - 10*60 = 600 (+60) JoeToken
      //   - 10*40 = 400 (+40)  PartnerToken
      expect((await this.chef.pendingTokens(0, this.alice.address)).pendingJoe).to.be.within(600 - this.tokenOffset, 660 + this.tokenOffset)
      expect(await this.rewarder.pendingTokens(this.alice.address)).to.be.within(400, 440)
      // Bob deposits 10 LP2s at t+25
      await advanceTimeAndBlock(4) // t+24
      await this.chef.connect(this.bob).deposit(1, "10", { from: this.bob.address }) // t+25
      // Alice's pending reward should be:
      //   - 600 + 5*1/3*60 = 700 (+60) JoeToken
      //   - 400 + 5*40 = 600 (+40) PartnerToken
      expect((await this.chef.pendingTokens(0, this.alice.address)).pendingJoe).to.be.within(700 - this.tokenOffset, 760 + this.tokenOffset)
      expect(await this.rewarder.pendingTokens(this.alice.address)).to.be.within(600, 640)

      // At this point:
      //   Alice's pending reward should be:
      //     - 700 + 5*1/3*60 = 800 (+60) JoeToken
      //     - 600 + 5*40 = 800 (+40) PartnerToken
      // Bob's pending reward should be:
      //     - 5*2/3*60 = 200 (+60) JoeToken
      //     - 0 PartnerToken
      await advanceTimeAndBlock(5) // t+30
      expect((await this.chef.pendingTokens(0, this.alice.address)).pendingJoe).to.be.within(800 - this.tokenOffset, 860 + this.tokenOffset)
      expect(await this.rewarder.pendingTokens(this.alice.address)).to.be.within(800, 840)

      expect((await this.chef.pendingTokens(1, this.bob.address)).pendingJoe).to.be.within(200 - this.tokenOffset, 260 + this.tokenOffset)
      expect(await this.rewarder.pendingTokens(this.bob.address)).to.equal(0)

      // Alice and Bob should not have pending rewards in pools they're not staked in
      expect((await this.chef.pendingTokens(1, this.alice.address)).pendingJoe).to.equal("0")
      expect((await this.chef.pendingTokens(0, this.bob.address)).pendingJoe).to.equal("0")

      // Make sure they have receive the same amount as what was pending
      await this.chef.connect(this.alice).withdraw(0, "10", { from: this.alice.address }) // t+31
      // Alice should have:
      //   - 800 + 1*1/3*60 = 820 (+60) JoeToken
      //   - 800 + 1*40 = 840 (+40) PartnerToken
      expect(await this.joe.balanceOf(this.alice.address)).to.be.within(820 - this.tokenOffset, 880 + this.tokenOffset)
      expect(await this.partnerToken.balanceOf(this.alice.address)).to.be.within(840, 880)

      await this.chef.connect(this.bob).withdraw(1, "5", { from: this.bob.address }) // t+32
      // Bob should have:
      //   - 200 + 2*2/3*60 = 280 (+60) JoeToken
      //   - 0 PartnerToken
      expect(await this.joe.balanceOf(this.bob.address)).to.be.within(280 - this.tokenOffset, 340 + this.tokenOffset)
      expect(await this.rewarder.pendingTokens(this.bob.address)).to.equal(0)
    })

    it("should give proper JOEs after updating emission rate", async function () {
      const startTime = (await latest()).add(60)
      this.chef = await this.MCV2.deploy(
        this.joe.address,
        this.dev.address,
        this.treasury.address,
        this.joePerSec,
        startTime,
        this.devPercent,
        this.treasuryPercent
      )
      await this.chef.deployed() // t-59

      this.rewarder = await this.RewarderPerSec.deploy(
        this.partnerToken.address,
        this.lp.address,
        this.partnerRewardPerSec,
        this.partnerChefPid,
        this.partnerChef.address,
        this.chef.address
      )
      await this.rewarder.deployed() // t-58

      await this.partnerToken.transferOwnership(this.partnerChef.address) // t-57
      await this.partnerChef.add("100", this.dummyToken.address, true) // t-56

      await this.dummyToken.connect(this.partnerDev).approve(this.rewarder.address, "1") // t-55
      await this.rewarder.connect(this.partnerDev).init(this.dummyToken.address) // t-54

      await this.joe.transferOwnership(this.chef.address) // t-53
      await this.chef.setDevPercent(this.devPercent) // t-52
      await this.chef.setTreasuryPercent(this.treasuryPercent) // t-51

      await this.lp.connect(this.alice).approve(this.chef.address, "1000", { from: this.alice.address }) // t-50
      await this.chef.add("10", this.lp.address, this.rewarder.address) // t-49
      // Alice deposits 10 LPs at t+10
      await advanceTimeAndBlock(58) // t+9
      await this.chef.connect(this.alice).deposit(0, "10", { from: this.alice.address }) // t+10
      // At t+110, Alice should have:
      //   - 100*100*0.6 = 6000 (+60) JoeToken
      //   - 100*40 = 4000 (+40) PartnerToken
      await advanceTimeAndBlock(100) // t+110
      expect((await this.chef.pendingTokens(0, this.alice.address)).pendingJoe).to.be.within(6000, 6060)
      expect(await this.rewarder.pendingTokens(this.alice.address)).to.be.within(4000, 4040)
      // Lower JOE emission rate to 40 JOE per sec
      await this.chef.updateEmissionRate(40) // t+111
      // At t+115, Alice should have:
      //   - 6000 + 1*100*0.6 + 4*40*0.6 = 6156 (+24) JoeToken
      //   - 4000 + 5*40 = 4200 (+40) PartnerToken
      await advanceTimeAndBlock(4) // t+115
      expect((await this.chef.pendingTokens(0, this.alice.address)).pendingJoe).to.be.within(6156, 6216)
      expect(await this.rewarder.pendingTokens(this.alice.address)).to.be.within(4200, 4240)
      // Increase PartnerToken emission rate to 90 PartnerToken per block
      await this.rewarder.setRewardRate(90) // t+116
      // At b=35, Alice should have:
      //   - 6156 + 21*40*0.6 = 6660 (+60) JoeToken
      //   - 4200 + 1*40 + 20*90 = 6040 (+90) PartnerToken
      await advanceTimeAndBlock(20) // t+136
      expect((await this.chef.pendingTokens(0, this.alice.address)).pendingJoe).to.be.within(6660, 6720)
      expect(await this.rewarder.pendingTokens(this.alice.address)).to.be.within(6040, 6130)
    })
  })

  after(async function () {
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    })
  })
})