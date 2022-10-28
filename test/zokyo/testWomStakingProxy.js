const chai = require("chai");
const { solidity } = require("ethereum-waffle");
const { ethers } = require("hardhat");
const hre = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const { BigNumber } = require("ethers");
const { accessSync } = require("fs");

const { expect } = chai;
chai.use(solidity);
chai.use(smock.matchers);

describe("Test WomStakingProxy", () => {
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    const ONE_DAY = BigNumber.from(60 * 60 * 24);
    const ONE_HOUR = BigNumber.from(60 * 60);
    const ONE_MIN = BigNumber.from(60);

    let owner, minter, user2, user3, user4;
    let womStakingProxyContract, zokyoStaker2, erc20Wom, zokyoRewards, zokyoWmx, zokyoWmxWom, womDepositorContract;

    before(async () => {
        [owner, minter, user2, user3, user4] = await ethers.getSigners();
    });

    beforeEach(async () => {
        let zokyoWmxFactory = await hre.ethers.getContractFactory("ZokyoTokenMinter");
        zokyoWmx = await zokyoWmxFactory.deploy("wmxTest", "wom");

        let erc20Factory = await hre.ethers.getContractFactory("ZokyoERC20");
        erc20Wom = await erc20Factory.deploy("womTest", "wom");

        let zokyoStaker2Factory = await hre.ethers.getContractFactory("ZokyoStaker2");
        zokyoStaker2 = await zokyoStaker2Factory.deploy(erc20Wom.address);

        let zokyoWmxWomFactory = await hre.ethers.getContractFactory("ZokyoERC20");
        zokyoWmxWom = await zokyoWmxWomFactory.deploy("wmxWom Token", "womWom");

        let zokyoRewardsFactory = await hre.ethers.getContractFactory("ZokyoRewards");
        zokyoRewards = await zokyoRewardsFactory.deploy(zokyoWmx.address);

        let womDepositorContractFactory = await hre.ethers.getContractFactory("WomDepositor");
        womDepositorContract = await womDepositorContractFactory.deploy(
            erc20Wom.address,
            zokyoStaker2.address,
            zokyoWmx.address,
        );

        let womStakingProxyContractFactory = await hre.ethers.getContractFactory("WomStakingProxy");
        womStakingProxyContract = await womStakingProxyContractFactory.deploy(
            erc20Wom.address,
            zokyoWmx.address,
            zokyoWmxWom.address,
            womDepositorContract.address,
            zokyoRewards.address,
        );
    });

    describe("Test default values", async () => {
        it("Should check default values", async () => {
            expect(await womStakingProxyContract.wom()).to.be.equal(erc20Wom.address);
            expect(await womStakingProxyContract.wmx()).to.be.equal(zokyoWmx.address);
            expect(await womStakingProxyContract.wmxWom()).to.be.equal(zokyoWmxWom.address);
            expect(await womStakingProxyContract.womDepositor()).to.be.equal(womDepositorContract.address);
            expect(await womStakingProxyContract.rewards()).to.be.equal(zokyoRewards.address);
        });
    });

    describe("Test contract functions", async () => {
        it("Should update config values", async () => {
            expect(await womStakingProxyContract.setConfig(user2.address, user3.address));
            expect(await womStakingProxyContract.wom()).to.be.equal(erc20Wom.address);
            expect(await womStakingProxyContract.wmx()).to.be.equal(zokyoWmx.address);
            expect(await womStakingProxyContract.wmxWom()).to.be.equal(zokyoWmxWom.address);
            expect(await womStakingProxyContract.womDepositor()).to.be.equal(user2.address);
            expect(await womStakingProxyContract.rewards()).to.be.equal(user3.address);
        });

        it("Should set approvals", async () => {
            expect(await womStakingProxyContract.setApprovals());
        });
    });

    describe("Test contract rescueToken function", async () => {
        it("Should allow rescuing tokens", async () => {
            let erc20Factory = await hre.ethers.getContractFactory("ZokyoERC20");
            testerc20 = await erc20Factory.deploy("test erc20", "erc20");
            await testerc20.mint(womStakingProxyContract.address, 100000);

            await expect(
                womStakingProxyContract.connect(user3).rescueToken(testerc20.address, user2.address),
            ).to.be.revertedWith("Ownable: caller is not the owner");

            expect(await womStakingProxyContract.rescueToken(testerc20.address, user2.address));

            expect(await testerc20.balanceOf(user2.address)).to.be.eq(100000);
        });

        it("Should fail to rescuse", async () => {
            await expect(womStakingProxyContract.rescueToken(zokyoWmx.address, user2.address)).to.be.revertedWith(
                "not allowed",
            );

            await expect(womStakingProxyContract.rescueToken(zokyoWmxWom.address, user2.address)).to.be.revertedWith(
                "not allowed",
            );

            await expect(womStakingProxyContract.rescueToken(erc20Wom.address, user2.address)).to.be.revertedWith(
                "not allowed",
            );
        });
    });
});
