const { ethers } = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const { expect } = require('chai')
const  chai  = require('chai')
const { BigNumber, constants } = require('ethers');

chai.should();
chai.use(smock.matchers);

describe("DepositToken", async () => {

let owner, tester1, tester2, tester3;
let booster, depositToken, mockedBooster;

    beforeEach(async () => {

        const signers = await hre.ethers.getSigners();
        owner = signers[0];
        tester1 = signers[1];
        tester2 = signers[2];
        tester3 = signers[3];

        const lptoken = await smock.fake("MockERC20");

        const DepositTokenFactory = await hre.ethers.getContractFactory("DepositToken");
        depositToken  = await DepositTokenFactory.deploy(
            owner.address,
            lptoken.address,
            "TEST",
            "TST"
        );
    });

    describe("burn", async () => {
        it("burn", async () => {        
        await expect(depositToken.connect(tester2).burn(tester3.address, 1000)).to.be.revertedWith("!authorized");
        await expect(depositToken.connect(tester2).mint(tester3.address, 1000)).to.be.revertedWith("!authorized");

        await depositToken.mint(tester3.address, 1000);
        const totalSupplyAfterMint = await depositToken.totalSupply();
        console.log(totalSupplyAfterMint)
        await depositToken.burn(tester3.address, 1000);
        const totalSupplyAfterBurn = await depositToken.totalSupply();
        console.log(totalSupplyAfterBurn)
        })
    });

    
})


describe("contract: depositToken", async () => {

    let owner, tester1, tester2, tester3, tester4; 
    let depositToken;

    beforeEach(async () => {

        
        const signers = await hre.ethers.getSigners();
        owner = signers[0];
        tester1 = signers[1];
        tester2 = signers[2];
        tester3 = signers[3];
        tester4 = signers[4];

        const lptoken = await smock.fake("MockERC20");

        const DepositTokenFactory = await hre.ethers.getContractFactory("DepositToken");
        depositToken  = await DepositTokenFactory.deploy(
            owner.address,
            lptoken.address,
            "Deposit Token",
            "DPT"
        );
    });

    describe("Initialization", async () => {
        it("Should have correct initial values", async () => {
            const name = await depositToken.name();
            const symbol = await depositToken.symbol();
            const decimals = await depositToken.decimals();
            const totalSupply = await depositToken.totalSupply();
            const operator = await depositToken.operator();

            expect(name).to.eq("Deposit Token")
            expect(symbol).to.eq("DPT")
            expect(decimals).to.eq(18)
            expect(totalSupply).to.eq(0)
            expect(operator).to.eq(owner.address)
        })

    })


    describe("increaseAllowance()", async () => {
        it("increases allowances for specified account", async () => {

            await depositToken.mint(owner.address,10000000)
            await depositToken.approve(tester1.address, 1000)

            await expect(depositToken.transferFrom( owner.address, tester1.address, 1000))
                .to.be.revertedWith("ERC20: transfer amount exceeds allowance")

            const allowance = await depositToken.allowance(owner.address, tester1.address);
            expect(allowance).to.eq(1000)

            await depositToken.increaseAllowance(tester1.address, 500)

            const allowanceAfter = await depositToken.allowance(owner.address, tester1.address);
            expect(allowanceAfter).to.eq(1500)

        })
    });

    describe("decreaseAllowance()", async () => {
        it("Should decrease allowances for account", async () => {
            await depositToken.mint(owner.address, 100000)
            await depositToken.approve(tester1.address, 1000)

            const allowance = await depositToken.allowance(owner.address, tester1.address);

            expect(allowance).to.eq(1000)

            await depositToken.decreaseAllowance(tester1.address, 500)

            const allowanceAfter = await depositToken.allowance(owner.address, tester1.address);
            expect(allowanceAfter).to.eq(500)

        })
    });

    describe("transfer()", async () => {
        it("transfer to account specified amount of tokens", async () => {
            
            await depositToken.mint(owner.address,1000)
            const balanceBefore = await depositToken.balanceOf(tester1.address);

            expect(balanceBefore).to.eq(0)
            
            await depositToken.transfer(tester1.address, 200)

            const balanceAfter = await depositToken.balanceOf(tester1.address);
            expect(balanceAfter).to.eq(200)

        })
    });
    
});