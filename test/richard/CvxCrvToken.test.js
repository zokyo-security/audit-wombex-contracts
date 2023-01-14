const { ethers } = require("hardhat");
const {smock } = require("@defi-wonderland/smock");
const { expect } = require('chai')
const  chai  = require('chai')
const { BigNumber, constants } = require('ethers');

chai.should();
chai.use(smock.matchers);

describe("CvxCrvToken", async () => {

let owner, tester1, tester2, tester3;
let booster, CvxCrv, voterProxy, mockedBooster;

    beforeEach(async () => {

        const signers = await hre.ethers.getSigners();
        owner = signers[0];
        tester1 = signers[1];
        tester2 = signers[2];
        tester3 = signers[3];

        const CvxCrvTokenFactory = await hre.ethers.getContractFactory("CvxCrvToken");
        CvxCrv = await CvxCrvTokenFactory.deploy(
            "CVXCRV Token",
            "CRXCVTK"
        );
    });

    
    describe("setOperator", async () => {
        it("setOperator", async () => {

            await expect(CvxCrv.connect(tester2).setOperator(tester1.address)).to.be.revertedWith("!auth");
            await CvxCrv.setOperator(tester2.address);
        })
    });

    describe("mint", async () => {
        it("mint", async () => {

            await expect(CvxCrv.connect(tester2).mint(tester3.address, 1000)).to.be.revertedWith("!authorized");
            await CvxCrv.mint(tester3.address, 1000);

        })
    });

    describe("burn", async () => {
        it("burn", async () => {
        
        await expect(CvxCrv.connect(tester2).burn(tester3.address, 1000)).to.be.revertedWith("!authorized");
        await CvxCrv.mint(tester3.address, 1000);

        await CvxCrv.burn(tester3.address, 1000);
        })
    });

    
})


describe("contract: CvxCrv", async () => {

    let owner, tester1, tester2, tester3, tester4; 
    let CvxCrv;

    beforeEach(async () => {

        
        const signers = await hre.ethers.getSigners();
        owner = signers[0];
        tester1 = signers[1];
        tester2 = signers[2];
        tester3 = signers[3];
        tester4 = signers[4];

        const ERC20Factory = await hre.ethers.getContractFactory("CvxCrvToken");
        CvxCrv = await ERC20Factory.deploy("Test Token", "TST");
        await CvxCrv.setOperator(owner.address)
        await CvxCrv.mint(owner.address, 1000000000);
    });

    describe("Initialization", async () => {
        it("Should have correct initial values", async () => {
            const name = await CvxCrv.name();
            const symbol = await CvxCrv.symbol();
            const decimals = await CvxCrv.decimals();
            const totalSupply = await CvxCrv.totalSupply();
            const operator = await CvxCrv.operator();

            expect(name).to.eq("Test Token")
            expect(symbol).to.eq("TST")
            expect(decimals).to.eq(18)
            expect(totalSupply).to.eq(1000000000)
            expect(operator).to.eq(owner.address)
        })

    })


    describe("increaseAllowance()", async () => {
        it("increases allowances for specified account", async () => {

            await CvxCrv.mint(tester1.address, 100000)
            await CvxCrv.approve(tester1.address, 1000)

            await expect(CvxCrv.transferFrom( owner.address, tester1.address, 1000))
                .to.be.revertedWith("ERC20: transfer amount exceeds allowance")

            const allowance = await CvxCrv.allowance(owner.address, tester1.address);
            expect(allowance).to.eq(1000)

            await CvxCrv.increaseAllowance(tester1.address, 500)

            const allowanceAfter = await CvxCrv.allowance(owner.address, tester1.address);
            expect(allowanceAfter).to.eq(1500)

        })
    });

    describe("decreaseAllowance()", async () => {
        it("Should decrease allowances for account", async () => {
            await CvxCrv.mint(tester1.address, 100000)
            await CvxCrv.approve(tester1.address, 1000)

            const allowance = await CvxCrv.allowance(owner.address, tester1.address);

            expect(allowance).to.eq(1000)

            await CvxCrv.decreaseAllowance(tester1.address, 500)

            const allowanceAfter = await CvxCrv.allowance(owner.address, tester1.address);
            expect(allowanceAfter).to.eq(500)

        })
    });

    describe("transfer()", async () => {
        it("transfer to account specified amount of tokens", async () => {
            
            const balanceBefore = await CvxCrv.balanceOf(tester1.address);

            expect(balanceBefore).to.eq(0)
            
            await CvxCrv.transfer(tester1.address, 200)

            const balanceAfter = await CvxCrv.balanceOf(tester1.address);
            expect(balanceAfter).to.eq(200)

        })
    });
    
});