const { ethers } = require("hardhat");
const { FakeContract, smock } = require('@defi-wonderland/smock');
const { expect } = require('chai')
const  chai  = require('chai')
const { BigNumber, constants } = require('ethers');

chai.should();
chai.use(smock.matchers);

describe("TokenManager", async () => {

let owner, tester1, tester2, tester3;
let booster, cvx, crv, factory, mockedBooster;

    beforeEach(async () => {

        const signers = await hre.ethers.getSigners();
        owner = signers[0];
        tester1 = signers[1];
        tester2 = signers[2];
        tester3 = signers[3];

        let TokenFactory = await hre.ethers.getContractFactory("TokenFactory");
        factory = await  TokenFactory.deploy(owner.address, "TEST", "TST");

    })

    describe("CreateDepositToken", async () => {
        it("CreateDepositToken", async () => {

            const lp = await smock.fake("MockERC20");
            const deptoken = await smock.fake("MockERC20");

            await expect(
                factory.connect(tester1).CreateDepositToken( lp.address)
            ).to.be.revertedWith("!authorized")
            await expect(factory.CreateDepositToken( lp.address)).to.emit(factory,"DepositTokenCreated")
        })
    })
    
})