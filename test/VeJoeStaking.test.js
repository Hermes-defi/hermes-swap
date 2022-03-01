// @ts-nocheck
const { ethers, network, upgrades } = require("hardhat");
const { expect } = require("chai");
const { describe } = require("mocha");

describe("VeHermes Staking", function () {
  before(async function () {
    this.VeHermesStakingCF = await ethers.getContractFactory("VeHermesStaking");
    this.VeHermesTokenCF = await ethers.getContractFactory("VeHermesToken");
    this.HermesTokenCF = await ethers.getContractFactory("HermesToken");

    this.signers = await ethers.getSigners();
    this.dev = this.signers[0];
    this.alice = this.signers[1];
    this.bob = this.signers[2];
    this.carol = this.signers[3];
  });

  beforeEach(async function () {
    this.veHermes = await this.VeHermesTokenCF.deploy();
    this.hermes = await this.HermesTokenCF.deploy();

    await this.hermes.mint(this.alice.address, ethers.utils.parseEther("1000"));
    await this.hermes.mint(this.bob.address, ethers.utils.parseEther("1000"));
    await this.hermes.mint(this.carol.address, ethers.utils.parseEther("1000"));

    this.baseGenerationRate = ethers.utils.parseEther("1");
    this.boostedGenerationRate = ethers.utils.parseEther("2");
    this.boostedThreshold = 5;
    this.boostedDuration = 50;
    this.maxCap = 200;

    this.veHermesStaking = await upgrades.deployProxy(this.VeHermesStakingCF, [
      this.hermes.address, // _hermes
      this.veHermes.address, // _veHermes
      this.baseGenerationRate, // _baseGenerationRate
      this.boostedGenerationRate, // _boostedGenerationRate
      this.boostedThreshold, // _boostedThreshold
      this.boostedDuration, // _boostedDuration
      this.maxCap, // _maxCap
    ]);
    await this.veHermes.transferOwnership(this.veHermesStaking.address);

    await this.hermes
      .connect(this.alice)
      .approve(this.veHermesStaking.address, ethers.utils.parseEther("100000"));
    await this.hermes
      .connect(this.bob)
      .approve(this.veHermesStaking.address, ethers.utils.parseEther("100000"));
    await this.hermes
      .connect(this.carol)
      .approve(this.veHermesStaking.address, ethers.utils.parseEther("100000"));
  });

  describe("setMaxCap", function () {
    it("should not allow non-owner to setMaxCap", async function () {
      await expect(
        this.veHermesStaking.connect(this.alice).setMaxCap(200)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should not allow owner to set lower maxCap", async function () {
      expect(await this.veHermesStaking.maxCap()).to.be.equal(this.maxCap);

      await expect(
        this.veHermesStaking.connect(this.dev).setMaxCap(99)
      ).to.be.revertedWith(
        "VeHermesStaking: expected new _maxCap to be greater than existing maxCap"
      );
    });

    it("should not allow owner to set maxCap greater than upper limit", async function () {
      await expect(
        this.veHermesStaking.connect(this.dev).setMaxCap(100001)
      ).to.be.revertedWith(
        "VeHermesStaking: expected new _maxCap to be non-zero and <= 100000"
      );
    });

    it("should allow owner to setMaxCap", async function () {
      expect(await this.veHermesStaking.maxCap()).to.be.equal(this.maxCap);

      await this.veHermesStaking.connect(this.dev).setMaxCap(this.maxCap + 100);

      expect(await this.veHermesStaking.maxCap()).to.be.equal(this.maxCap + 100);
    });
  });

  describe("setBaseGenerationRate", function () {
    it("should not allow non-owner to setMaxCap", async function () {
      await expect(
        this.veHermesStaking
          .connect(this.alice)
          .setBaseGenerationRate(ethers.utils.parseEther("1.5"))
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should not allow owner to setBaseGenerationRate greater than boostedGenerationRate", async function () {
      expect(await this.veHermesStaking.boostedGenerationRate()).to.be.equal(
        this.boostedGenerationRate
      );

      await expect(
        this.veHermesStaking
          .connect(this.dev)
          .setBaseGenerationRate(ethers.utils.parseEther("3"))
      ).to.be.revertedWith(
        "VeHermesStaking: expected new _baseGenerationRate to be less than boostedGenerationRate"
      );
    });

    it("should allow owner to setBaseGenerationRate", async function () {
      expect(await this.veHermesStaking.baseGenerationRate()).to.be.equal(
        this.baseGenerationRate
      );

      await this.veHermesStaking
        .connect(this.dev)
        .setBaseGenerationRate(ethers.utils.parseEther("1.5"));

      expect(await this.veHermesStaking.baseGenerationRate()).to.be.equal(
        ethers.utils.parseEther("1.5")
      );
    });
  });

  describe("setBoostedGenerationRate", function () {
    it("should not allow non-owner to setBoostedGenerationRate", async function () {
      await expect(
        this.veHermesStaking
          .connect(this.alice)
          .setBoostedGenerationRate(ethers.utils.parseEther("11"))
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should not allow owner to setBoostedGenerationRate leq to baseGenerationRate", async function () {
      expect(await this.veHermesStaking.baseGenerationRate()).to.be.equal(
        this.baseGenerationRate
      );

      await expect(
        this.veHermesStaking
          .connect(this.dev)
          .setBoostedGenerationRate(ethers.utils.parseEther("0.99"))
      ).to.be.revertedWith(
        "VeHermesStaking: expected new _boostedGenerationRate to be greater than baseGenerationRate"
      );
    });

    it("should allow owner to setBoostedGenerationRate", async function () {
      expect(await this.veHermesStaking.boostedGenerationRate()).to.be.equal(
        this.boostedGenerationRate
      );

      await this.veHermesStaking
        .connect(this.dev)
        .setBoostedGenerationRate(ethers.utils.parseEther("3"));

      expect(await this.veHermesStaking.boostedGenerationRate()).to.be.equal(
        ethers.utils.parseEther("3")
      );
    });
  });

  describe("setBoostedThreshold", function () {
    it("should not allow non-owner to setBoostedThreshold", async function () {
      await expect(
        this.veHermesStaking.connect(this.alice).setBoostedThreshold(10)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should not allow owner to setBoostedThreshold to 0", async function () {
      await expect(
        this.veHermesStaking.connect(this.dev).setBoostedThreshold(0)
      ).to.be.revertedWith(
        "VeHermesStaking: expected _boostedThreshold to be > 0 and <= 100"
      );
    });

    it("should not allow owner to setBoostedThreshold greater than 100", async function () {
      await expect(
        this.veHermesStaking.connect(this.dev).setBoostedThreshold(101)
      ).to.be.revertedWith(
        "VeHermesStaking: expected _boostedThreshold to be > 0 and <= 100"
      );
    });

    it("should allow owner to setBoostedThreshold", async function () {
      expect(await this.veHermesStaking.boostedThreshold()).to.be.equal(
        this.boostedThreshold
      );

      await this.veHermesStaking.connect(this.dev).setBoostedThreshold(10);

      expect(await this.veHermesStaking.boostedThreshold()).to.be.equal(10);
    });
  });

  describe("setBoostedDuration", function () {
    it("should not allow non-owner to setBoostedDuration", async function () {
      await expect(
        this.veHermesStaking.connect(this.alice).setBoostedDuration(100)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should not allow owner to setBoostedDuration greater than 365 days", async function () {
      const secondsInHour = 60 * 60;
      const secondsInDay = secondsInHour * 24;
      const secondsInYear = secondsInDay * 365;
      await expect(
        this.veHermesStaking
          .connect(this.dev)
          .setBoostedDuration(secondsInYear + 1)
      ).to.be.revertedWith(
        "VeHermesStaking: expected _boostedDuration to be <= 365 days"
      );
    });

    it("should allow owner to setBoostedThreshold to upper limit", async function () {
      const secondsInHour = 60 * 60;
      const secondsInDay = secondsInHour * 24;
      const secondsInYear = secondsInDay * 365;

      expect(await this.veHermesStaking.boostedDuration()).to.be.equal(
        this.boostedDuration
      );

      await this.veHermesStaking
        .connect(this.dev)
        .setBoostedDuration(secondsInYear);

      expect(await this.veHermesStaking.boostedDuration()).to.be.equal(
        secondsInYear
      );
    });
  });

  describe("deposit", function () {
    it("should not allow deposit 0", async function () {
      await expect(
        this.veHermesStaking.connect(this.alice).deposit(0)
      ).to.be.revertedWith(
        "VeHermesStaking: expected deposit amount to be greater than zero"
      );
    });

    it("should have correct updated user info after first time deposit", async function () {
      const beforeAliceUserInfo = await this.veHermesStaking.userInfos(
        this.alice.address
      );
      // balance
      expect(beforeAliceUserInfo[0]).to.be.equal(0);
      // lastRewardTimestamp
      expect(beforeAliceUserInfo[1]).to.be.equal(0);
      // boostEndTimestamp
      expect(beforeAliceUserInfo[2]).to.be.equal(0);

      // Check hermes balance before deposit
      expect(await this.hermes.balanceOf(this.alice.address)).to.be.equal(
        ethers.utils.parseEther("1000")
      );

      const depositAmount = ethers.utils.parseEther("100");
      await this.veHermesStaking.connect(this.alice).deposit(depositAmount);
      const depositBlock = await ethers.provider.getBlock();

      // Check hermes balance after deposit
      expect(await this.hermes.balanceOf(this.alice.address)).to.be.equal(
        ethers.utils.parseEther("900")
      );

      const afterAliceUserInfo = await this.veHermesStaking.userInfos(
        this.alice.address
      );
      // balance
      expect(afterAliceUserInfo[0]).to.be.equal(depositAmount);
      // lastRewardTimestamp
      expect(afterAliceUserInfo[1]).to.be.equal(depositBlock.timestamp);
      // boostEndTimestamp
      expect(afterAliceUserInfo[2]).to.be.equal(
        depositBlock.timestamp + this.boostedDuration
      );
    });

    it("should have correct updated user balance after deposit with non-zero balance", async function () {
      await this.veHermesStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("100"));

      await this.veHermesStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("5"));

      const afterAliceUserInfo = await this.veHermesStaking.userInfos(
        this.alice.address
      );
      // balance
      expect(afterAliceUserInfo[0]).to.be.equal(ethers.utils.parseEther("105"));
    });

    it("should claim pending veHERMES upon depositing with non-zero balance", async function () {
      await this.veHermesStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("100"));

      await increase(29);

      // Check veHermes balance before deposit
      expect(await this.veHermes.balanceOf(this.alice.address)).to.be.equal(0);

      await this.veHermesStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("1"));

      // Check veHermes balance after deposit
      // Should have 100 * 30 * 2 = 6000 veHERMES
      expect(await this.veHermes.balanceOf(this.alice.address)).to.be.equal(
        ethers.utils.parseEther("6000")
      );
    });

    it("should receive boosted benefits after depositing boostedThreshold with non-zero balance", async function () {
      await this.veHermesStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("100"));

      await increase(this.boostedDuration);

      await this.veHermesStaking.connect(this.alice).claim();

      const afterClaimAliceUserInfo = await this.veHermesStaking.userInfos(
        this.alice.address
      );
      // boostEndTimestamp
      expect(afterClaimAliceUserInfo[2]).to.be.equal(0);

      await this.veHermesStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("5"));

      const secondDepositBlock = await ethers.provider.getBlock();

      const seconDepositAliceUserInfo = await this.veHermesStaking.userInfos(
        this.alice.address
      );
      // boostEndTimestamp
      expect(seconDepositAliceUserInfo[2]).to.be.equal(
        secondDepositBlock.timestamp + this.boostedDuration
      );
    });

    it("should not receive boosted benefits after depositing less than boostedThreshold with non-zero balance", async function () {
      await this.veHermesStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("100"));

      await increase(this.boostedDuration);

      await this.veHermesStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("1"));

      const afterAliceUserInfo = await this.veHermesStaking.userInfos(
        this.alice.address
      );
      // boostEndTimestamp
      expect(afterAliceUserInfo[2]).to.be.equal(0);
    });

    it("should have boosted period extended after depositing boostedThreshold and currently receiving boosted benefits", async function () {
      await this.veHermesStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("100"));

      const initialDepositBlock = await ethers.provider.getBlock();

      const initialDepositAliceUserInfo = await this.veHermesStaking.userInfos(
        this.alice.address
      );
      const initialDepositBoostEndTimestamp = initialDepositAliceUserInfo[2];

      expect(initialDepositBoostEndTimestamp).to.be.equal(
        initialDepositBlock.timestamp + this.boostedDuration
      );

      // Increase by some amount of time less than boostedDuration
      await increase(this.boostedDuration / 2);

      // Deposit boostedThreshold amount so that boost period gets extended
      await this.veHermesStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("5"));

      const secondDepositBlock = await ethers.provider.getBlock();

      const secondDepositAliceUserInfo = await this.veHermesStaking.userInfos(
        this.alice.address
      );
      // boostEndTimestamp
      const secondDepositBoostEndTimestamp = secondDepositAliceUserInfo[2];

      expect(
        secondDepositBoostEndTimestamp.gt(initialDepositBoostEndTimestamp)
      ).to.be.equal(true);
      expect(secondDepositBoostEndTimestamp).to.be.equal(
        secondDepositBlock.timestamp + this.boostedDuration
      );
    });

    it("should have lastRewardTimestamp updated after depositing if holding max veHERMES cap", async function () {
      await this.veHermesStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("100"));

      // Increase by `maxCap` seconds to ensure that user will have max veHERMES
      // after claiming
      await increase(this.maxCap);

      await this.veHermesStaking.connect(this.alice).claim();

      const claimBlock = await ethers.provider.getBlock();

      const claimAliceUserInfo = await this.veHermesStaking.userInfos(
        this.alice.address
      );
      // lastRewardTimestamp
      expect(claimAliceUserInfo[1]).to.be.equal(claimBlock.timestamp);

      await increase(this.maxCap);

      const pendingVeHermes = await this.veHermesStaking.getPendingVeHermes(
        this.alice.address
      );
      expect(pendingVeHermes).to.be.equal(0);

      await this.veHermesStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("5"));

      const secondDepositBlock = await ethers.provider.getBlock();

      const secondDepositAliceUserInfo = await this.veHermesStaking.userInfos(
        this.alice.address
      );
      // lastRewardTimestamp
      expect(secondDepositAliceUserInfo[1]).to.be.equal(
        secondDepositBlock.timestamp
      );
    });
  });

  describe("withdraw", function () {
    it("should not allow withdraw 0", async function () {
      await expect(
        this.veHermesStaking.connect(this.alice).withdraw(0)
      ).to.be.revertedWith(
        "VeHermesStaking: expected withdraw amount to be greater than zero"
      );
    });

    it("should not allow withdraw amount greater than user balance", async function () {
      await expect(
        this.veHermesStaking.connect(this.alice).withdraw(1)
      ).to.be.revertedWith(
        "VeHermesStaking: cannot withdraw greater amount of HERMES than currently staked"
      );
    });

    it("should have correct updated user info and balances after withdraw", async function () {
      await this.veHermesStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("100"));
      const depositBlock = await ethers.provider.getBlock();

      expect(await this.hermes.balanceOf(this.alice.address)).to.be.equal(
        ethers.utils.parseEther("900")
      );

      await increase(this.boostedDuration / 2);

      await this.veHermesStaking.connect(this.alice).claim();
      const claimBlock = await ethers.provider.getBlock();

      expect(await this.veHermes.balanceOf(this.alice.address)).to.not.be.equal(0);

      const beforeAliceUserInfo = await this.veHermesStaking.userInfos(
        this.alice.address
      );
      // balance
      expect(beforeAliceUserInfo[0]).to.be.equal(
        ethers.utils.parseEther("100")
      );
      // lastRewardTimestamp
      expect(beforeAliceUserInfo[1]).to.be.equal(claimBlock.timestamp);
      // boostEndTimestamp
      expect(beforeAliceUserInfo[2]).to.be.equal(
        depositBlock.timestamp + this.boostedDuration
      );

      await this.veHermesStaking
        .connect(this.alice)
        .withdraw(ethers.utils.parseEther("5"));
      const withdrawBlock = await ethers.provider.getBlock();

      // Check user info fields are updated correctly
      const afterAliceUserInfo = await this.veHermesStaking.userInfos(
        this.alice.address
      );
      // balance
      expect(afterAliceUserInfo[0]).to.be.equal(ethers.utils.parseEther("95"));
      // lastRewardTimestamp
      expect(afterAliceUserInfo[1]).to.be.equal(withdrawBlock.timestamp);
      // boostEndTimestamp
      expect(afterAliceUserInfo[2]).to.be.equal(0);

      // Check user token balances are updated correctly
      expect(await this.veHermes.balanceOf(this.alice.address)).to.be.equal(0);
      expect(await this.hermes.balanceOf(this.alice.address)).to.be.equal(
        ethers.utils.parseEther("905")
      );
    });
  });

  describe("claim", function () {
    it("should not be able to claim with zero balance", async function () {
      await expect(
        this.veHermesStaking.connect(this.alice).claim()
      ).to.be.revertedWith(
        "VeHermesStaking: cannot claim veHERMES when no HERMES is staked"
      );
    });

    it("should update lastRewardTimestamp on claim", async function () {
      await this.veHermesStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("100"));

      await increase(100);

      await this.veHermesStaking.connect(this.alice).claim();
      const claimBlock = await ethers.provider.getBlock();

      const afterAliceUserInfo = await this.veHermesStaking.userInfos(
        this.alice.address
      );
      // lastRewardTimestamp
      expect(afterAliceUserInfo[1]).to.be.equal(claimBlock.timestamp);
    });

    it("should reset boostEndTimestamp on claim after boost period ends", async function () {
      await this.veHermesStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("100"));

      await increase(this.boostedDuration);

      await this.veHermesStaking.connect(this.alice).claim();

      const afterAliceUserInfo = await this.veHermesStaking.userInfos(
        this.alice.address
      );
      // boostEndTimestamp
      expect(afterAliceUserInfo[2]).to.be.equal(0);
    });

    it("should receive veHERMES on claim", async function () {
      await this.veHermesStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("100"));

      await increase(this.boostedDuration - 1);

      // Check veHermes balance before claim
      expect(await this.veHermes.balanceOf(this.alice.address)).to.be.equal(0);

      await this.veHermesStaking.connect(this.alice).claim();

      // Check veHermes balance after claim
      expect(await this.veHermes.balanceOf(this.alice.address)).to.be.equal(
        ethers.utils.parseEther("10000")
      );
    });

    it("should receive correct veHERMES amount on claim when lastRewardTimestamp < boostEndTimestamp < now", async function () {
      await this.veHermesStaking
        .connect(this.alice)
        .deposit(ethers.utils.parseEther("100"));

      // Increase by some duration before boost period ends
      await increase(this.boostedDuration / 2 - 1);

      // Ensure user has 0 veHermes balance before first claim
      expect(await this.veHermes.balanceOf(this.alice.address)).to.be.equal(0);

      // Perform first claim before boost period ends
      await this.veHermesStaking.connect(this.alice).claim();

      // Ensure user has 100 * 25 * 2 = 5000 veHERMES
      expect(await this.veHermes.balanceOf(this.alice.address)).to.be.equal(
        ethers.utils.parseEther("5000")
      );

      // Increase by some duration after boost period ends
      await increase(this.boostedDuration - 1);

      // Perform claim after boost period ended
      await this.veHermesStaking.connect(this.alice).claim();

      // Ensure user has 5000 + 100 * 25 * 2 + 100 * 25 * 1 = 12500 veHermes
      expect(await this.veHermes.balanceOf(this.alice.address)).to.be.equal(
        ethers.utils.parseEther("12500")
      );
    });
  });

  after(async function () {
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    });
  });
});

const increase = (seconds) => {
  ethers.provider.send("evm_increaseTime", [seconds]);
  ethers.provider.send("evm_mine", []);
};
