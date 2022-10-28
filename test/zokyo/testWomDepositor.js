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
    const ONE_DAY = BigNumber.from(60 * 60 * 24);
    const ONE_HOUR = BigNumber.from(60 * 60);
    const ONE_MIN = BigNumber.from(60);

    let owner, minter, user2, user3, user4;
    let womDepositorContract, zokyoStaker2, erc20Wom, zokyoRewards, zokyoRewardsPOC, zokyoTokenMinter;

    before(async () => {
        [owner, minter, user2, user3, user4] = await ethers.getSigners();
    });

    const increaseTime = async length => {
        await ethers.provider.send("evm_increaseTime", [BigNumber.from(length).toNumber()]);
        await ethers.provider.send("evm_mine", []);
    };

    beforeEach(async () => {
        let zokyoTokenMinterFactory = await hre.ethers.getContractFactory("ZokyoTokenMinter");
        zokyoTokenMinter = await zokyoTokenMinterFactory.deploy("wmxTest", "wmx");

        let erc20Factory = await hre.ethers.getContractFactory("ZokyoERC20");
        erc20Wom = await erc20Factory.deploy("womTest", "wom");

        let zokyoStaker2Factory = await hre.ethers.getContractFactory("ZokyoStaker2");
        zokyoStaker2 = await zokyoStaker2Factory.deploy(erc20Wom.address);

        let zokyoRewardsFactory = await hre.ethers.getContractFactory("ZokyoRewards");
        zokyoRewards = await zokyoRewardsFactory.deploy(zokyoTokenMinter.address);

        let zokyoRewardsPOCFactory = await hre.ethers.getContractFactory("ZokyoRewards2");
        zokyoRewardsPOC = await zokyoRewardsPOCFactory.deploy(zokyoTokenMinter.address);

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
            expect(await erc20Wom.balanceOf(user2.address)).to.be.equal(3);

            await expect(womDepositorContract.setLockConfig(1, 1))
                .to.emit(womDepositorContract, "SetLockConfig")
                .withArgs(1, 1);

            await expect(womDepositorContract.connect(user2)["deposit(uint256,address)"](1, ZERO_ADDRESS))
                .to.emit(womDepositorContract, "Deposit")
                .withArgs(user2.address, ZERO_ADDRESS, 1);

            expect(await womDepositorContract.callStatic.getCustomLockSlotsLength(user2.address)).to.be.equal(0);
        });
    });

    describe("Deposit tokens with setting configs", async () => {
        it("Should deposit not trigger lock until lock period expires", async () => {
            await expect(womDepositorContract.setLockConfig(1, ONE_MIN))
                .to.emit(womDepositorContract, "SetLockConfig")
                .withArgs(1, ONE_MIN);

            expect(await erc20Wom.balanceOf(womDepositorContract.address)).to.be.equal(0);

            await erc20Wom.mint(user2.address, 3);
            await erc20Wom.connect(user2).approve(womDepositorContract.address, 3);
            const tx1 = await womDepositorContract.connect(user2)["deposit(uint256,address)"](1, zokyoRewards.address);
            await tx1.wait();

            expect(tx1).to.emit(womDepositorContract, "Deposit").withArgs(user2.address, zokyoRewards.address, 1);
            expect(tx1).to.emit(womDepositorContract, "SmartLock").withArgs(user2.address, false, 0, 1, 1, 1, 0, false);

            expect(await erc20Wom.balanceOf(womDepositorContract.address)).to.be.equal(0);
            expect(await erc20Wom.balanceOf(zokyoStaker2.address)).to.be.equal(1);

            const tx2 = await womDepositorContract.connect(user2)["deposit(uint256,address)"](1, zokyoRewards.address);
            await tx2.wait();

            expect(tx2).to.emit(womDepositorContract, "Deposit").withArgs(user2.address, zokyoRewards.address, 1);
            expect(tx2)
                .not.to.emit(womDepositorContract, "SmartLock")
                .withArgs(user2.address, false, 0, 1, 1, 1, 0, false);
            // expect(await womDepositorContract.callStatic.checkOldSlot()).to.be.equal(0);
            expect(await womDepositorContract.currentSlot()).to.be.equal(1);
            expect(await womDepositorContract.callStatic.checkOldSlot()).to.be.equal(0);

            expect(await erc20Wom.balanceOf(womDepositorContract.address)).to.be.equal(1);
            expect(await erc20Wom.balanceOf(zokyoStaker2.address)).to.be.equal(1);
        });

        it("Should trigger deposit lock after period expires", async () => {
            await expect(womDepositorContract.setLockConfig(1, ONE_MIN))
                .to.emit(womDepositorContract, "SetLockConfig")
                .withArgs(1, ONE_MIN);

            expect(await erc20Wom.balanceOf(womDepositorContract.address)).to.be.equal(0);

            await erc20Wom.mint(user2.address, 3);
            await erc20Wom.connect(user2).approve(womDepositorContract.address, 3);
            const tx1 = await womDepositorContract.connect(user2)["deposit(uint256,address)"](1, zokyoRewards.address);
            await tx1.wait();

            expect(tx1).to.emit(womDepositorContract, "Deposit").withArgs(user2.address, zokyoRewards.address, 1);
            expect(tx1).to.emit(womDepositorContract, "SmartLock").withArgs(user2.address, false, 0, 1, 1, 1, 0, false);

            expect(await erc20Wom.balanceOf(womDepositorContract.address)).to.be.equal(0);
            expect(await erc20Wom.balanceOf(zokyoStaker2.address)).to.be.equal(1);

            // await wait(2000 * 60);
            await increaseTime(ONE_MIN * 2);
            const tx2 = await womDepositorContract.connect(user2)["deposit(uint256,address)"](1, zokyoRewards.address);
            await tx2.wait();

            expect(tx2).to.emit(womDepositorContract, "Deposit").withArgs(user2.address, zokyoRewards.address, 1);
            expect(tx2).to.emit(womDepositorContract, "SmartLock").withArgs(user2.address, false, 1, 1, 1, 2, 0, false);
            // // expect(await womDepositorContract.callStatic.checkOldSlot()).to.be.equal(0);
            expect(await womDepositorContract.currentSlot()).to.be.equal(2);
            expect(await womDepositorContract.callStatic.checkOldSlot()).to.be.equal(0);

            expect(await erc20Wom.balanceOf(womDepositorContract.address)).to.be.equal(0);
            expect(await erc20Wom.balanceOf(zokyoStaker2.address)).to.be.equal(2);
        });
    });

    describe("Deposit tokens with custom lock", async () => {
        it("Should deposit user's tokens", async () => {
            expect(await erc20Wom.balanceOf(womDepositorContract.address)).to.be.equal(0);

            await erc20Wom.mint(user2.address, 3);
            await erc20Wom.connect(user2).approve(womDepositorContract.address, 3);

            await expect(womDepositorContract.connect(user2)["depositCustomLock(uint256)"](1)).to.be.revertedWith(
                "!custom",
            );

            await expect(womDepositorContract.setCustomLock(user2.address, 1, 2))
                .to.emit(womDepositorContract, "SetCustomLockDays")
                .withArgs(user2.address, 1, 2);

            await expect(womDepositorContract.connect(user2)["depositCustomLock(uint256)"](1)).to.be.revertedWith(
                "<customLockMinAmount",
            );
            await expect(womDepositorContract.connect(user2)["depositCustomLock(uint256)"](2))
                .to.emit(womDepositorContract, "SmartLock")
                .withArgs(user2.address, true, 0, 2, 1, 1, 0, false);

            expect(await erc20Wom.balanceOf(womDepositorContract.address)).to.be.equal(0);
            expect(await erc20Wom.balanceOf(zokyoStaker2.address)).to.be.equal(2);

            await expect(
                womDepositorContract.connect(user2)["deposit(uint256,address)"](1, zokyoRewards.address),
            ).to.be.revertedWith("custom");
        });
    });

    describe("Test release lock funciton", async () => {
        it("Should revert if slot is not ended", async () => {
            await expect(womDepositorContract.setLockConfig(1, ONE_MIN))
                .to.emit(womDepositorContract, "SetLockConfig")
                .withArgs(1, ONE_MIN);
            await erc20Wom.mint(user2.address, 4);
            await erc20Wom.connect(user2).approve(womDepositorContract.address, 4);

            await expect(womDepositorContract.setCustomLock(user2.address, 1, 1))
                .to.emit(womDepositorContract, "SetCustomLockDays")
                .withArgs(user2.address, 1, 1);

            await expect(womDepositorContract.connect(user2)["depositCustomLock(uint256)"](2))
                .to.emit(womDepositorContract, "SmartLock")
                .withArgs(user2.address, true, 0, 2, 1, 1, 0, false);

            await expect(womDepositorContract.connect(user2)["depositCustomLock(uint256)"](2))
                .to.emit(womDepositorContract, "SmartLock")
                .withArgs(user2.address, true, 1, 2, 1, 2, 0, false);

            expect(await womDepositorContract.customLockSlots(user2.address, 0).then(s => s.number)).eq(0);
            expect(await womDepositorContract.customLockSlots(user2.address, 0).then(s => s.amount)).eq(2);

            expect(await womDepositorContract.customLockSlots(user2.address, 1).then(s => s.number)).eq(1);
            expect(await womDepositorContract.customLockSlots(user2.address, 1).then(s => s.amount)).eq(2);

            expect(await womDepositorContract.lockedCustomSlots(0)).eq(true);
            expect(await womDepositorContract.lockedCustomSlots(1)).eq(true);

            await expect(womDepositorContract.connect(user2)["releaseCustomLock(uint256)"](0)).to.be.revertedWith(
                "!ends",
            );
        });
        it("Should release slot after it ends", async () => {
            await expect(womDepositorContract.setLockConfig(1, ONE_MIN))
                .to.emit(womDepositorContract, "SetLockConfig")
                .withArgs(1, ONE_MIN);
            await erc20Wom.mint(user2.address, 4);
            await erc20Wom.connect(user2).approve(womDepositorContract.address, 4);

            await expect(womDepositorContract.setCustomLock(user2.address, 1, 1))
                .to.emit(womDepositorContract, "SetCustomLockDays")
                .withArgs(user2.address, 1, 1);

            await expect(womDepositorContract.connect(user2)["depositCustomLock(uint256)"](2))
                .to.emit(womDepositorContract, "SmartLock")
                .withArgs(user2.address, true, 0, 2, 1, 1, 0, false);

            await expect(womDepositorContract.connect(user2)["depositCustomLock(uint256)"](2))
                .to.emit(womDepositorContract, "SmartLock")
                .withArgs(user2.address, true, 1, 2, 1, 2, 0, false);

            expect(await womDepositorContract.customLockSlots(user2.address, 0).then(s => s.number)).eq(0);
            expect(await womDepositorContract.customLockSlots(user2.address, 0).then(s => s.amount)).eq(2);

            expect(await womDepositorContract.customLockSlots(user2.address, 1).then(s => s.number)).eq(1);
            expect(await womDepositorContract.customLockSlots(user2.address, 1).then(s => s.amount)).eq(2);

            expect(await womDepositorContract.lockedCustomSlots(0)).eq(true);
            expect(await womDepositorContract.lockedCustomSlots(1)).eq(true);
            await increaseTime(ONE_DAY);

            expect(await erc20Wom.balanceOf(zokyoStaker2.address)).to.be.equal(4);

            await expect(womDepositorContract.connect(user2)["releaseCustomLock(uint256)"](0))
                .to.emit(womDepositorContract, "ReleaseCustomLock")
                .withArgs(user2.address, 0, 0, 2);
        });

        it("Should release slot after it ends", async () => {
            await expect(womDepositorContract.setLockConfig(1, ONE_MIN))
                .to.emit(womDepositorContract, "SetLockConfig")
                .withArgs(1, ONE_MIN);
            await erc20Wom.mint(user2.address, 4);
            await erc20Wom.connect(user2).approve(womDepositorContract.address, 4);

            await expect(womDepositorContract.setCustomLock(user2.address, 1, 1))
                .to.emit(womDepositorContract, "SetCustomLockDays")
                .withArgs(user2.address, 1, 1);

            await expect(womDepositorContract.connect(user2)["depositCustomLock(uint256)"](2))
                .to.emit(womDepositorContract, "SmartLock")
                .withArgs(user2.address, true, 0, 2, 1, 1, 0, false);

            await expect(womDepositorContract.connect(user2)["depositCustomLock(uint256)"](2))
                .to.emit(womDepositorContract, "SmartLock")
                .withArgs(user2.address, true, 1, 2, 1, 2, 0, false);

            expect(await womDepositorContract.customLockSlots(user2.address, 0).then(s => s.number)).eq(0);
            expect(await womDepositorContract.customLockSlots(user2.address, 0).then(s => s.amount)).eq(2);

            expect(await womDepositorContract.customLockSlots(user2.address, 1).then(s => s.number)).eq(1);
            expect(await womDepositorContract.customLockSlots(user2.address, 1).then(s => s.amount)).eq(2);

            expect(await womDepositorContract.lockedCustomSlots(0)).eq(true);
            expect(await womDepositorContract.lockedCustomSlots(1)).eq(true);

            await increaseTime(ONE_DAY);

            expect(await erc20Wom.balanceOf(zokyoStaker2.address)).to.be.equal(4);

            await expect(womDepositorContract.connect(user2)["releaseCustomLock(uint256)"](1))
                .to.emit(womDepositorContract, "ReleaseCustomLock")
                .withArgs(user2.address, 1, 1, 2);

            await expect(womDepositorContract.connect(user2)["releaseCustomLock(uint256)"](0))
                .to.emit(womDepositorContract, "ReleaseCustomLock")
                .withArgs(user2.address, 0, 0, 2);
        });
    });

    // describe("POC test for staker contract", async () => {
    //     it("Should deposit trigger lock until lock period expires", async () => {
    //         await expect(womDepositorContract.setLockConfig(1, ONE_MIN))
    //             .to.emit(womDepositorContract, "SetLockConfig")
    //             .withArgs(1, ONE_MIN);

    //         expect(await erc20Wom.balanceOf(womDepositorContract.address)).to.be.equal(0);

    //         await erc20Wom.mint(user2.address, 3);
    //         await erc20Wom.connect(user2).approve(womDepositorContract.address, 3);
    //         const tx1 = await womDepositorContract
    //             .connect(user2)
    //             ["deposit(uint256,address)"](1, zokyoRewardsPOC.address);
    //         await tx1.wait();

    //         expect(tx1).to.emit(womDepositorContract, "Deposit").withArgs(user2.address, zokyoRewardsPOC.address, 1);
    //         expect(tx1).to.emit(womDepositorContract, "SmartLock").withArgs(user2.address, false, 0, 1, 1, 1, 0, false);

    //         expect(await erc20Wom.balanceOf(womDepositorContract.address)).to.be.equal(0);
    //         expect(await erc20Wom.balanceOf(zokyoStaker2.address)).to.be.equal(1);

    //         await increaseTime(ONE_MIN * 2);

    //         const tx2 = await womDepositorContract
    //             .connect(user2)
    //             ["deposit(uint256,address)"](1, zokyoRewardsPOC.address);
    //         await tx2.wait();

    //         expect(tx2).to.emit(womDepositorContract, "Deposit").withArgs(user2.address, zokyoRewardsPOC.address, 1);
    //         expect(tx2).to.emit(womDepositorContract, "SmartLock").withArgs(user2.address, false, 1, 1, 1, 2, 0, false);
    //         expect(await womDepositorContract.currentSlot()).to.be.equal(2);
    //         expect(await womDepositorContract.callStatic.checkOldSlot()).to.be.equal(0);

    //         expect(await erc20Wom.balanceOf(womDepositorContract.address)).to.be.equal(0);
    //         expect(await erc20Wom.balanceOf(zokyoStaker2.address)).to.be.equal(2);

    //         expect(await zokyoTokenMinter.balanceOf(womDepositorContract.address)).to.be.equal(2);

    //         expect(await zokyoTokenMinter.connect(user2).takeTokens(womDepositorContract.address, user3.address, 1));

    //         // expect(await zokyoTokenMinter.transferFrom(womDepositorContract.address, user3.address, 1));
    //     });
    // });
});
