// @ts-nocheck
const { ethers, network } = require("hardhat");
const { expect } = require("chai");
const { describe } = require("mocha");
const hre = require("hardhat");
const {parseUnits} = require("@ethersproject/units/src.ts");
describe("Swap Fee tests", function () {
    before(async function () {
        this.StableHermesStakingCF = await ethers.getContractFactory(
            "StableHermesStaking"
        );
        this.Token = await ethers.getContractFactory("Hermes");
        this.signers = await ethers.getSigners();

        this.dev = this.signers[0];
        this.alice = this.signers[1];
        this.bob = this.signers[2];
        this.carol = this.signers[3];
    });

    beforeEach(async function () {
        this.token1 = await this.Token.deploy();
        this.token2 = await this.HermesTokenCF.deploy();

        await this.hermes.mint(this.alice.address, ethers.utils.parseUnits("1000",'gwei'));
        await this.hermes.mint(this.bob.address, ethers.utils.parseUnits("1000", 'gwei'));
        await this.hermes.mint(this.carol.address, ethers.utils.parseUnits("1000", 'gwei'));

    });

    describe("should allow deposits and withdraws", function () {
        it("should allow deposits and withdraws of multiple users", async function () {
            await this.stableHermesStaking
                .connect(this.alice)
                .deposit(ethers.utils.parseEther("100"));
            expect(await this.hermes.balanceOf(this.alice.address)).to.be.equal(
                ethers.utils.parseEther("900")
            );
            expect(
                await this.hermes.balanceOf(this.stableHermesStaking.address)
            ).to.be.equal(ethers.utils.parseEther("97"));
            // 100 * 0.97 = 97
            expect(
                (
                    await this.stableHermesStaking.getUserInfo(
                        this.alice.address,
                        this.hermes.address
                    )
                )[0]
            ).to.be.equal(ethers.utils.parseEther("97"));

            await this.stableHermesStaking
                .connect(this.bob)
                .deposit(ethers.utils.parseEther("200"));
            expect(await this.hermes.balanceOf(this.bob.address)).to.be.equal(
                ethers.utils.parseEther("800")
                // 97 + 200 * 0.97 = 291
            );
        });
    });
});
