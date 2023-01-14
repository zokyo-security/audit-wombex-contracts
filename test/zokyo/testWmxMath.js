const chai = require("chai");
const { solidity } = require("ethereum-waffle");
const { ethers, waffle } = require("hardhat");
const hre = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const { BigNumber } = require("ethers");

const { expect } = chai;
chai.use(solidity);
chai.use(smock.matchers);

describe("Test WmxMath", () => {
    let owner, user1, user2, user3, user4;
    let wmxMathLibTestContract;

    before(async () => {
        [owner, user1, user2, user3, user4] = await ethers.getSigners();
    });

    beforeEach(async () => {
        let wmxMathLibTestContractFactory = await hre.ethers.getContractFactory("WmxMathLibTest");
        wmxMathLibTestContract = await wmxMathLibTestContractFactory.deploy();
    });

    before(async () => {
        [owner] = await ethers.getSigners();
    });

    describe("Test WmxMath", function () {
        describe("Should return min of two numbers", async () => {
            it("Should return min of two numbers", async function () {
                expect(await wmxMathLibTestContract.testWmxMathMin(0, 0)).to.be.eq(0);
            });
        });

        describe("Should return sum of two numbers", async () => {
            it("Should return v of two numbers", async function () {
                expect(await wmxMathLibTestContract.testWmxMathAdd(1, 1)).to.be.eq(2);
            });
        });

        describe("Should subtaract two numbers", async () => {
            it("1 - 1 = 0", async function () {
                expect(await wmxMathLibTestContract.testWmxMathSub(1, 1)).to.be.eq(0);
            });
        });

        describe("Should return product of two numbers", async () => {
            it("1 * 1 = 1", async function () {
                expect(await wmxMathLibTestContract.testWmxMathMul(1, 1)).to.be.eq(1);
            });
        });

        describe("Should return div of two numbers", async () => {
            it("1 / 1 = 1", async function () {
                expect(await wmxMathLibTestContract.testWmxMathDiv(1, 1)).to.be.eq(1);
            });
        });

        describe("Should return average of two numbers", async () => {
            it("avg(1, 1) = 1", async function () {
                expect(await wmxMathLibTestContract.testWmxMathAverage(1, 1)).to.be.eq(1);
            });
        });

        describe("Should convert uint type from uint256 to uint224", async () => {
            it("Should return average of two numbers", async function () {
                expect(await wmxMathLibTestContract.testWmxMathTo224(1)).to.be.eq(1);
            });

            it("Should revert due to overflow", async function () {
                const a = ethers.constants.MaxUint256;

                await expect(wmxMathLibTestContract.testWmxMathTo224(a)).to.be.revertedWith(
                    "WmxMath: uint224 Overflow",
                );

                const b = BigNumber.from(`0x${"f".repeat(56)}`).add(1);
                await expect(wmxMathLibTestContract.testWmxMathTo224(b)).to.be.revertedWith(
                    "WmxMath: uint224 Overflow",
                );
            });

            it("Should allow max uint224 to be converted", async function () {
                const a = BigNumber.from(`0x${"f".repeat(56)}`);
                expect(await wmxMathLibTestContract.testWmxMathTo224(a)).to.be.eq(a);
            });
        });

        describe("Should convert uint type from uint256 to uint128", async () => {
            it("Should return average of two numbers", async function () {
                expect(await wmxMathLibTestContract.testWmxMathTo128(1)).to.be.eq(1);
            });

            it("Should revert due to overflow", async function () {
                const a = ethers.constants.MaxUint256;

                await expect(wmxMathLibTestContract.testWmxMathTo128(a)).to.be.revertedWith(
                    "WmxMath: uint128 Overflow",
                );

                const b = BigNumber.from(`0x${"f".repeat(32)}`).add(1);
                await expect(wmxMathLibTestContract.testWmxMathTo128(b)).to.be.revertedWith(
                    "WmxMath: uint128 Overflow",
                );
            });

            it("Should allow max uint128 to be converted", async function () {
                const a = BigNumber.from(`0x${"f".repeat(32)}`);
                expect(await wmxMathLibTestContract.testWmxMathTo128(a)).to.be.eq(a);
            });
        });

        describe("Should convert uint type from uint256 to uint112", async () => {
            it("Should return average of two numbers", async function () {
                expect(await wmxMathLibTestContract.testWmxMathTo112(1)).to.be.eq(1);
            });

            it("Should revert due to overflow", async function () {
                const a = ethers.constants.MaxUint256;

                await expect(wmxMathLibTestContract.testWmxMathTo112(a)).to.be.revertedWith(
                    "WmxMath: uint112 Overflow",
                );

                const b = BigNumber.from(`0x${"f".repeat(28)}`).add(1);
                await expect(wmxMathLibTestContract.testWmxMathTo112(b)).to.be.revertedWith(
                    "WmxMath: uint112 Overflow",
                );
            });

            it("Should allow max uint112 to be converted", async function () {
                const a = BigNumber.from(`0x${"f".repeat(28)}`);
                expect(await wmxMathLibTestContract.testWmxMathTo112(a)).to.be.eq(a);
            });
        });

        describe("Should convert uint type from uint256 to uint96", async () => {
            it("Should return average of two numbers", async function () {
                expect(await wmxMathLibTestContract.testWmxMathTo96(1)).to.be.eq(1);
            });

            it("Should revert due to overflow", async function () {
                const a = ethers.constants.MaxUint256;

                await expect(wmxMathLibTestContract.testWmxMathTo96(a)).to.be.revertedWith("WmxMath: uint96 Overflow");

                const b = BigNumber.from(`0x${"f".repeat(24)}`).add(1);
                await expect(wmxMathLibTestContract.testWmxMathTo96(b)).to.be.revertedWith("WmxMath: uint96 Overflow");
            });

            it("Should allow max uint96 to be converted", async function () {
                const a = BigNumber.from(`0x${"f".repeat(24)}`);
                expect(await wmxMathLibTestContract.testWmxMathTo96(a)).to.be.eq(a);
            });
        });

        describe("Should convert uint type from uint256 to uint32", async () => {
            it("Should return average of two numbers", async function () {
                expect(await wmxMathLibTestContract.testWmxMathTo32(1)).to.be.eq(1);
            });

            it("Should revert due to overflow", async function () {
                const a = ethers.constants.MaxUint256;

                await expect(wmxMathLibTestContract.testWmxMathTo32(a)).to.be.revertedWith("WmxMath: uint32 Overflow");

                const b = BigNumber.from(`0x${"f".repeat(8)}`).add(1);
                await expect(wmxMathLibTestContract.testWmxMathTo32(b)).to.be.revertedWith("WmxMath: uint32 Overflow");
            });

            it("Should allow max uint32 to be converted", async function () {
                const a = BigNumber.from(`0x${"f".repeat(8)}`);
                expect(await wmxMathLibTestContract.testWmxMathTo32(a)).to.be.eq(a);
            });
        });
    });

    describe("Test WmxMath32", function () {
        describe("Should return sub of two numbers", async () => {
            it("Should return sub of two numbers", async function () {
                expect(await wmxMathLibTestContract.testWmxMath32Sub(0, 0)).to.be.eq(0);
            });
        });
    });

    describe("Test WmxMath112", function () {
        describe("Should return sum of two numbers", async () => {
            it("Should return sum of two numbers", async function () {
                expect(await wmxMathLibTestContract.testWmxMath112Add(0, 0)).to.be.eq(0);
            });
        });

        describe("Should return sub of two numbers", async () => {
            it("Should return sub of two numbers", async function () {
                expect(await wmxMathLibTestContract.testWmxMath112Sub(0, 0)).to.be.eq(0);
            });
        });
    });

    describe("Test WmxMath224", function () {
        describe("Should return sum of two numbers", async () => {
            it("Should return sum of two numbers", async function () {
                expect(await wmxMathLibTestContract.testWmxMath224Add(0, 0)).to.be.eq(0);
            });
        });
    });
});
