const chai = require("chai");
const { solidity } = require("ethereum-waffle");
const { ethers } = require("hardhat");
const hre = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const { BigNumber } = require("ethers");

const { expect } = chai;
chai.use(solidity);
chai.use(smock.matchers);

describe("Test WmxMath", () => {
    let owner;
    let wmxMath;

    before(async () => {
        [owner] = await ethers.getSigners();
    });

    beforeEach(async () => {
        let wmxMathFactory = await hre.ethers.getContractFactory("WmxMath");
        wmxMath = await wmxMathFactory.deploy();
    });

    describe("Should test min function", async () => {
        it("Find difference of two 0", async () => {
            expect(wmxMath.min(0, 0)).to.be.equal(0);
        });
    });
});
