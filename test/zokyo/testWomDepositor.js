const chai = require("chai");
const { solidity } = require("ethereum-waffle");
const { ethers } = require("hardhat");
const hre = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const { BigNumber } = require("ethers");

const { expect } = chai;
chai.use(solidity);
chai.use(smock.matchers);

describe("Test WomDepositor", () => {
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    let owner, minter, user2, user3, user4;
    let womDepositorContract, zokyoStaker2, erc20Wom, zokyoRewards, zokyoTokenMinter;

    before(async () => {
        [owner, minter, user2, user3, user4] = await ethers.getSigners();
    });

    const increaseTime = async length => {
        await ethers.provider.send("evm_increaseTime", [BN.from(length).toNumber()]);
        await advanceBlock();
    };

    beforeEach(async () => {
        let zokyoStaker2Factory = await hre.ethers.getContractFactory("ZokyoStaker2");
        zokyoStaker2 = await zokyoStaker2Factory.deploy();

        let zokyoTokenMinterFactory = await hre.ethers.getContractFactory("ZokyoTokenMinter");
        zokyoTokenMinter = await zokyoTokenMinterFactory.deploy("wmxTest", "wmx");

        let erc20Factory = await hre.ethers.getContractFactory("ZokyoERC20");
        erc20Wom = await erc20Factory.deploy("womTest", "wom");

        let zokyoRewardsFactory = await hre.ethers.getContractFactory("ZokyoRewards");
        zokyoRewards = await zokyoRewardsFactory.deploy(zokyoTokenMinter.address);

        let womDepositorContractFactory = await hre.ethers.getContractFactory("WomDepositor");
        womDepositorContract = await womDepositorContractFactory.deploy(
            erc20Wom.address,
            zokyoStaker2.address,
            zokyoTokenMinter.address,
        );
    });

    describe("Should set configs for WomDepositor contract", async () => {
        it("set lock config", async () => {
            await expect(womDepositorContract.setLockConfig(1, 1))
                .to.emit(womDepositorContract, "SetLockConfig")
                .withArgs(1, 1);
        });

        it("Should not allow non owner to set lock config", async () => {
            await expect(womDepositorContract.connect(user2).setLockConfig(1, 1)).to.be.revertedWith(
                "Ownable: caller is not the owner",
            );
        });

        it("set custom Lock", async () => {
            await expect(womDepositorContract.setCustomLock(user3.address, 1, 1))
                .to.emit(womDepositorContract, "SetCustomLockDays")
                .withArgs(user3.address, 1, 1);
        });
    });

    describe("Deposit tokens without setting configs", async () => {
        it("Should deposit user's tokens", async () => {
            expect(await erc20Wom.balanceOf(womDepositorContract.address)).to.be.equal(0);

            await erc20Wom.mint(user2.address, 3);
            await erc20Wom.connect(user2).approve(womDepositorContract.address, 3);

            await expect(womDepositorContract.connect(user2)["deposit(uint256,address)"](1, zokyoRewards.address))
                .to.emit(womDepositorContract, "Deposit")
                .withArgs(user2.address, zokyoRewards.address, 1);

            await expect(
                womDepositorContract.connect(user2)["deposit(uint256,bool,address)"](1, true, zokyoRewards.address),
            )
                .to.emit(womDepositorContract, "Deposit")
                .withArgs(user2.address, zokyoRewards.address, 1);

            await expect(
                womDepositorContract
                    .connect(user2)
                    ["deposit(uint256,uint256,bool,address)"](1, 1, true, zokyoRewards.address),
            )
                .to.emit(womDepositorContract, "Deposit")
                .withArgs(user2.address, zokyoRewards.address, 1);

            expect(await erc20Wom.balanceOf(womDepositorContract.address)).to.be.equal(0);
            expect(await erc20Wom.balanceOf(zokyoStaker2.address)).to.be.equal(3);
        });

        it("Should check if zero transfer is allowed", async () => {
            expect(await erc20Wom.balanceOf(womDepositorContract.address)).to.be.equal(0);

            await erc20Wom.mint(user2.address, 3);
            await erc20Wom.connect(user2).approve(womDepositorContract.address, 3);
            await expect(womDepositorContract.connect(user2)["deposit(uint256,address)"](0, zokyoRewards.address))
                .to.emit(womDepositorContract, "Deposit")
                .withArgs(user2.address, zokyoRewards.address, 0);
        });

        it("Should deposit without staking", async () => {
            expect(await erc20Wom.balanceOf(womDepositorContract.address)).to.be.equal(0);

            await erc20Wom.mint(user2.address, 3);
            await erc20Wom.connect(user2).approve(womDepositorContract.address, 3);

            await expect(womDepositorContract.connect(user2)["deposit(uint256,address)"](1, ZERO_ADDRESS))
                .to.emit(womDepositorContract, "Deposit")
                .withArgs(user2.address, ZERO_ADDRESS, 1);

            await expect(womDepositorContract.connect(user2)["deposit(uint256,bool,address)"](1, true, ZERO_ADDRESS))
                .to.emit(womDepositorContract, "Deposit")
                .withArgs(user2.address, ZERO_ADDRESS, 1);

            await expect(
                womDepositorContract.connect(user2)["deposit(uint256,uint256,bool,address)"](1, 1, true, ZERO_ADDRESS),
            )
                .to.emit(womDepositorContract, "Deposit")
                .withArgs(user2.address, ZERO_ADDRESS, 1);

            expect(await erc20Wom.balanceOf(womDepositorContract.address)).to.be.equal(0);
            expect(await erc20Wom.balanceOf(zokyoStaker2.address)).to.be.equal(3);
        });

        it("Should deposit with lock configs set", async () => {
            expect(await erc20Wom.balanceOf(womDepositorContract.address)).to.be.equal(0);

            await erc20Wom.mint(user2.address, 3);
            await erc20Wom.connect(user2).approve(womDepositorContract.address, 3);

            expect(await erc20Wom.balanceOf(womDepositorContract.address)).to.be.equal(0);
            expect(await erc20Wom.balanceOf(zokyoStaker2.address)).to.be.equal(3);
        });
    });

    describe("Deposit tokens with custom config", async () => {
        it("Should deposit user's tokens", async () => {
            expect(await erc20Wom.balanceOf(womDepositorContract.address)).to.be.equal(0);

            await erc20Wom.mint(user2.address, 3);
            await erc20Wom.connect(user2).approve(womDepositorContract.address, 3);

            await expect(womDepositorContract.connect(user2)["depositCustomLock(uint256)"](1)).to.be.revertedWith(
                "!custom",
            );

            await expect(womDepositorContract.setCustomLock(user2.address, 1, 1))
                .to.emit(womDepositorContract, "SetCustomLockDays")
                .withArgs(user2.address, 1, 1);

            await expect(womDepositorContract.connect(user2)["depositCustomLock(uint256)"](1))
                .to.emit(womDepositorContract, "SmartLock")
                .withArgs(user2.address, true, 0, 1, 1, 1, 0, false);

            expect(await erc20Wom.balanceOf(womDepositorContract.address)).to.be.equal(0);
            expect(await erc20Wom.balanceOf(zokyoStaker2.address)).to.be.equal(1);
        });
    });
});
