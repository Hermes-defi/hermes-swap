const { ethers, network } = require("hardhat")
const { expect } = require("chai")

const { BigNumber } = require("ethers")

const BASE_TEN = 10
const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000"


describe("MasterChefHermesV2", function () {
    before(async function () {
        this.signers = await ethers.getSigners()
        this.alice = this.signers[0]
        this.bob = this.signers[1]
        this.carol = this.signers[2]
        this.dev = this.signers[3]
        this.treasury = this.signers[4]
        this.investor = this.signers[5]
        this.minter = this.signers[6]

        this.Token = await ethers.getContractFactory("Hermes")
        this.main = await ethers.getContractFactory("MasterChefHermesV2")
        this.ERC20Mock = await ethers.getContractFactory("ERC20Mock", this.minter)

        this.devPercent = 200
        this.treasuryPercent = 200
        this.investorPercent = 100

        this.tokenPerSec = 100

    })

    beforeEach(async function () {
        this.token = await this.Token.deploy() // b=1
        await this.token.deployed()

        this.partner = await this.Token.deploy() // b=2
        await this.partner.deployed()
    })

    it("Hermes Token: should allow mint only by authorized", async function () {
        await expect(
            this.token.connect(this.treasury).mint(this.dev.address, '1')
        ).to.be.revertedWith("'minter: caller is not a minter")

        await this.token.mint(this.dev.address, '1')
        const balanceOfDev = (await this.token.balanceOf(this.dev.address)).toString();
        expect(balanceOfDev).to.be.eq('1');

        await this.token.grantMinterRole(this.chef.address);
        await this.token.connect(this.treasury).mint(this.treasury.address, '1');

    });



    it("Hermes: apply 1% fee on deposit/withdraw instantly", async function () {
        const startTime = (await latest()).add(60)
        this.chef = await this.main.deploy(
            this.token.address,
            this.dev.address,
            this.treasury.address,
            this.investor.address,
            this.tokenPerSec,
            startTime,
            this.devPercent,
            this.treasuryPercent,
            this.investorPercent
        )
        await this.chef.deployed();
        await this.token.grantMinterRole(this.chef.address);
        await this.chef.add('1', this.token.address, ADDRESS_ZERO);

        await this.token.connect(this.dev).approve(this.chef.address, '1000');
        await this.token.mint(this.dev.address, '1000');
        await this.chef.connect(this.dev).deposit('0', '1000');
        await this.chef.connect(this.dev).withdraw('0', '1000');

        const balanceOfDev = (await this.token.balanceOf(this.dev.address)).toString();
        expect(balanceOfDev).to.be.eq('990');

        const balanceOfTreasure = (await this.token.balanceOf(this.treasury.address)).toString();
        expect(balanceOfTreasure).to.be.eq('10');

    });

    it("Hermes: apply 0.2% fee on deposit/withdraw after 1 week", async function () {
        const startTime = (await latest()).add(60)
        this.chef = await this.main.deploy(
            this.token.address,
            this.dev.address,
            this.treasury.address,
            this.investor.address,
            this.tokenPerSec,
            startTime,
            this.devPercent,
            this.treasuryPercent,
            this.investorPercent
        )
        await this.chef.deployed();
        await this.token.grantMinterRole(this.chef.address);
        await this.chef.add('1', this.partner.address, ADDRESS_ZERO);

        const depoistAmount = '10000';
        await this.partner.connect(this.dev).approve(this.chef.address, depoistAmount);
        await this.partner.mint(this.dev.address, depoistAmount);
        await this.chef.connect(this.dev).deposit('0', depoistAmount);

        const oneWeek = duration.weeks(1).toNumber();
        await advanceTimeAndBlock(oneWeek);
        await advanceTime(oneWeek)

        await this.chef.connect(this.dev).withdraw('0', depoistAmount);

        const balanceOfDev = (await this.partner.balanceOf(this.dev.address)).toString();
        expect(balanceOfDev).to.be.eq('9980');

        const balanceOfTreasure = (await this.partner.balanceOf(this.treasury.address)).toString();
        expect(balanceOfTreasure).to.be.eq('20');

    });


    it("Hermes: apply 0.05% fee on deposit/withdraw after 2 week", async function () {
        const startTime = (await latest()).add(60)
        this.chef = await this.main.deploy(
            this.token.address,
            this.dev.address,
            this.treasury.address,
            this.investor.address,
            this.tokenPerSec,
            startTime,
            this.devPercent,
            this.treasuryPercent,
            this.investorPercent
        )
        await this.chef.deployed();
        await this.token.grantMinterRole(this.chef.address);
        await this.chef.add('1', this.partner.address, ADDRESS_ZERO);

        const depoistAmount = '10000';
        await this.partner.connect(this.dev).approve(this.chef.address, depoistAmount);
        await this.partner.mint(this.dev.address, depoistAmount);
        await this.chef.connect(this.dev).deposit('0', depoistAmount);

        let twoWeek = duration.weeks(2).toNumber();
        await advanceTimeAndBlock(twoWeek++);
        await advanceTime(twoWeek)

        await this.chef.connect(this.dev).withdraw('0', depoistAmount);

        const balanceOfDev = (await this.partner.balanceOf(this.dev.address)).toString();
        expect(balanceOfDev).to.be.eq('9995');

        const balanceOfTreasure = (await this.partner.balanceOf(this.treasury.address)).toString();
        expect(balanceOfTreasure).to.be.eq('5');

    });


    it("should revert contract creation if dev and treasury percents don't meet criteria", async function () {
        const startTime = (await latest()).add(60)
        // Invalid dev percent failure
        await expect(
            this.main.deploy(
                this.token.address,
                this.dev.address,
                this.treasury.address,
                this.investor.address,
                "100",
                startTime,
                "1100",
                this.treasuryPercent,
                this.investorPercent
            )
        ).to.be.revertedWith("constructor: invalid dev percent value")

        // Invalid treasury percent failure
        await expect(
            this.main.deploy(
                this.token.address,
                this.dev.address,
                this.treasury.address,
                this.investor.address,
                "100",
                startTime,
                this.devPercent,
                "1100",
                this.investorPercent
            )
        ).to.be.revertedWith("constructor: invalid treasury percent value")

        // Invalid treasury percent failure
        await expect(
            this.main.deploy(
                this.token.address,
                this.dev.address,
                this.treasury.address,
                this.investor.address,
                "100",
                startTime,
                this.devPercent,
                this.treasuryPercent,
                "1100"
            )
        ).to.be.revertedWith("constructor: invalid investor percent value")

        // Sum of dev, treasury and investor  precent too high
        await expect(
            this.main.deploy(this.token.address, this.dev.address, this.treasury.address, this.investor.address, "100", startTime, "300", "300", "401")
        ).to.be.revertedWith("constructor: total percent over max")
    })

    it("should set correct state variables", async function () {
        // We make start time 60 seconds past the last block
        const startTime = (await latest()).add(60)
        this.chef = await this.main.deploy(
            this.token.address,
            this.dev.address,
            this.treasury.address,
            this.investor.address,
            this.tokenPerSec,
            startTime,
            this.devPercent,
            this.treasuryPercent,
            this.investorPercent
        )
        await this.chef.deployed()

        await this.token.transferOwnership(this.chef.address)

        const joe = await this.chef.hermes()
        const devAddr = await this.chef.devAddr()
        const treasuryAddr = await this.chef.treasuryAddr()
        const investorAddr = await this.chef.investorAddr()
        const owner = await this.token.owner()
        const devPercent = await this.chef.devPercent()
        const treasuryPercent = await this.chef.treasuryPercent()
        const investorPercent = await this.chef.investorPercent()

        expect(joe).to.equal(this.token.address)
        expect(devAddr).to.equal(this.dev.address)
        expect(treasuryAddr).to.equal(this.treasury.address)
        expect(investorAddr).to.equal(this.investor.address)
        expect(owner).to.equal(this.chef.address)
        expect(devPercent).to.equal(this.devPercent)
        expect(treasuryPercent).to.equal(this.treasuryPercent)
        expect(investorPercent).to.equal(this.investorPercent)
    })

    it("should allow dev, treasury and investor to update themselves", async function () {
        const startTime = (await latest()).add(60)
        this.chef = await this.main.deploy(
            this.token.address,
            this.dev.address,
            this.treasury.address,
            this.investor.address,
            this.tokenPerSec,
            startTime,
            this.devPercent,
            this.treasuryPercent,
            this.investorPercent
        )
        await this.chef.deployed()

        expect(await this.chef.devAddr()).to.equal(this.dev.address)

        await expect(this.chef.connect(this.bob).dev(this.bob.address, { from: this.bob.address })).to.be.revertedWith("dev: wut?")
        await this.chef.connect(this.dev).dev(this.bob.address, { from: this.dev.address })
        expect(await this.chef.devAddr()).to.equal(this.bob.address)

        await expect(this.chef.connect(this.bob).setTreasuryAddr(this.bob.address, { from: this.bob.address })).to.be.revertedWith(
            "setTreasuryAddr: wut?"
        )
        await this.chef.connect(this.treasury).setTreasuryAddr(this.bob.address, { from: this.treasury.address })
        expect(await this.chef.treasuryAddr()).to.equal(this.bob.address)

        await expect(this.chef.connect(this.bob).setInvestorAddr(this.bob.address, { from: this.bob.address })).to.be.revertedWith(
            "setInvestorAddr: wut?"
        )
        await this.chef.connect(this.investor).setInvestorAddr(this.bob.address, { from: this.investor.address })
        expect(await this.chef.investorAddr()).to.equal(this.bob.address)
    })

    it("should check dev, treasury and investor percents are set correctly", async function () {
        const startTime = (await latest()).add(60)
        this.chef = await this.main.deploy(
            this.token.address,
            this.dev.address,
            this.treasury.address,
            this.investor.address,
            this.tokenPerSec,
            startTime,
            this.devPercent,
            this.treasuryPercent,
            this.investorPercent
        )
        await this.chef.deployed()

        await this.chef.setDevPercent(100)
        await this.chef.setTreasuryPercent(100)
        await this.chef.setInvestorPercent(800)
        expect(await this.chef.devPercent()).to.equal("100")
        expect(await this.chef.treasuryPercent()).to.equal("100")
        expect(await this.chef.investorPercent()).to.equal("800")
        // We don't test negative values because function only takes in unsigned ints
        await expect(this.chef.setDevPercent("1200")).to.be.revertedWith("setDevPercent: invalid percent value")
        await expect(this.chef.setDevPercent("900")).to.be.revertedWith("setDevPercent: total percent over max")
        await expect(this.chef.setTreasuryPercent("1200")).to.be.revertedWith("setTreasuryPercent: invalid percent value")
        await expect(this.chef.setTreasuryPercent("900")).to.be.revertedWith("setTreasuryPercent: total percent over max")
    })

    after(async function () {
        await network.provider.request({
            method: "hardhat_reset",
            params: [],
        })
    })
})


function encodeParameters(types, values) {
    const abi = new ethers.utils.AbiCoder()
    return abi.encode(types, values)
}

async function prepare(thisObject, contracts) {
    for (let i in contracts) {
        let contract = contracts[i]
        thisObject[contract] = await ethers.getContractFactory(contract)
    }
    thisObject.signers = await ethers.getSigners()
    thisObject.alice = thisObject.signers[0]
    thisObject.bob = thisObject.signers[1]
    thisObject.carol = thisObject.signers[2]
    thisObject.dev = thisObject.signers[3]
    thisObject.alicePrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    thisObject.bobPrivateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
    thisObject.carolPrivateKey = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
}

async function deploy(thisObject, contracts) {
    for (let i in contracts) {
        let contract = contracts[i]
        thisObject[contract[0]] = await contract[1].deploy(...(contract[2] || []))
        await thisObject[contract[0]].deployed()
    }
}

async function createSLP(thisObject, name, tokenA, tokenB, amount) {
    const createPairTx = await thisObject.factory.createPair(tokenA.address, tokenB.address)

    const _pair = (await createPairTx.wait()).events[0].args.pair

    thisObject[name] = await thisObject.JoePair.attach(_pair)

    await tokenA.transfer(thisObject[name].address, amount)
    await tokenB.transfer(thisObject[name].address, amount)

    await thisObject[name].mint(thisObject.alice.address)
}

// Defaults to e18 using amount * 10^18
function getBigNumber(amount, decimals = 18) {
    return BigNumber.from(amount).mul(BigNumber.from(BASE_TEN).pow(decimals))
}

async function advanceBlock() {
    return ethers.provider.send("evm_mine", [])
}

async function advanceBlockTo(blockNumber) {
    for (let i = await ethers.provider.getBlockNumber(); i < blockNumber; i++) {
        await advanceBlock()
    }
}

async function increase(value) {
    await ethers.provider.send("evm_increaseTime", [value.toNumber()])
    await advanceBlock()
}

async function latest() {
    const block = await ethers.provider.getBlock("latest")
    return BigNumber.from(block.timestamp)
}

async function advanceTimeAndBlock(time) {
    await advanceTime(time)
    await advanceBlock()
}

async function advanceTime(time) {
    await ethers.provider.send("evm_increaseTime", [time])
}

const duration = {
    seconds: function (val) {
        return BigNumber.from(val)
    },
    minutes: function (val) {
        return BigNumber.from(val).mul(this.seconds("60"))
    },
    hours: function (val) {
        return BigNumber.from(val).mul(this.minutes("60"))
    },
    days: function (val) {
        return BigNumber.from(val).mul(this.hours("24"))
    },
    weeks: function (val) {
        return BigNumber.from(val).mul(this.days("7"))
    },
    years: function (val) {
        return BigNumber.from(val).mul(this.days("365"))
    },
}

