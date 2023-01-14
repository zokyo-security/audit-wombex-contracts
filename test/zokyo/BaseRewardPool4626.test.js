const { ethers } = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const { expect } = require('chai')
const  chai  = require('chai')
const { BigNumber, constants } = require('ethers');

chai.should();
chai.use(smock.matchers);

describe("BaseRewardPool4626", async () => {

    let owner, tester1, tester2;
    let baseRewardPool,fakeRewardToken, FakeRewardToken, 
    fakestakingToken, boosterRewardToken, booster, rewardFactory,
    fakeLpToken, FakeLpToken , operator  ;

    beforeEach(async () => {

        const signers = await hre.ethers.getSigners();

        owner = signers[0];
        tester1 = signers[1];
        tester2 = signers[2];

        booster = await smock.fake("Booster");
        rewardFactory = await smock.fake("RewardFactory");

        stakingToken = await smock.fake("MockERC20")
        fakestakingToken = await smock.fake("MockSafeERC20");
        await fakestakingToken.connect(owner).setToken(stakingToken.address)

        FakeLpToken = await smock.fake("MockERC20")
        fakeLpToken = await smock.fake("MockSafeERC20");
        await fakeLpToken.connect(owner).setToken(FakeLpToken.address)

        FakeRewardToken = await smock.fake("MockERC20")
        fakeRewardToken = await smock.fake("MockSafeERC20");
        await fakeRewardToken.connect(owner).setToken(FakeRewardToken.address);

        operator = await smock.fake("Booster")

        await fakeLpToken.safeApprove.whenCalledWith(owner.address, constants.MaxUint256);

        const BaseRewardPool4626Factory = await smock.mock("BaseRewardPool4626");
        
        baseRewardPool = await BaseRewardPool4626Factory.deploy(
            0,
            fakestakingToken.address,
            fakeRewardToken.address,
            operator.address,
            operator.address,
            fakeLpToken.address
        );

    });
    

    describe("deposit()", async () => {

        it("deposit", async () => {

            await fakeLpToken.safeTransferFrom.whenCalledWith(owner.address, baseRewardPool.address, 10000000).returns();
            await fakestakingToken.balanceOf.whenCalledWith(baseRewardPool.address).returns(10000000);
    
            await fakestakingToken.balanceOf.returnsAtCall(1, 20000000);
            await fakestakingToken.balanceOf.returnsAtCall(2, 40000000);

            await operator.deposit.whenCalledWith(0, 1000, false).returns(true)

            await baseRewardPool.deposit(100, owner.address)

        })


        it("deposit", async () => {

            await fakeLpToken.safeTransferFrom.whenCalledWith(owner.address, baseRewardPool.address, 10000000).returns();

            await expect(baseRewardPool.deposit(100, owner.address)).to.be.revertedWith("!deposit")

        })
    });

    describe("totalAssets", async () => {

        it("totalAssets", async () => {
            

            let totalAssets = await baseRewardPool.totalAssets();
            // console.log(totalAssets)

            let shares = await baseRewardPool.convertToShares(1000);
            // console.log(shares)

            let maxDeposit = await baseRewardPool.maxDeposit(owner.address);
            // console.log(maxDeposit)

            let previewDeposit = await baseRewardPool.previewDeposit(1000);
            // console.log(previewDeposit)

            let maxMint = await baseRewardPool.maxMint(owner.address);
            // console.log(maxMint)

            let convertToAssets = await baseRewardPool.convertToAssets(1000);
            // console.log(convertToAssets)

            let previewMint = await baseRewardPool.previewMint(1000);
            // console.log(previewMint)

            let maxWithdraw = await baseRewardPool.maxWithdraw(owner.address);
            // console.log(maxWithdraw)

            let previewWithdraw = await baseRewardPool.previewWithdraw(owner.address);
            // console.log(previewWithdraw)

            let maxRedeem = await baseRewardPool.maxRedeem(owner.address);
            // console.log(maxRedeem)

            let previewRedeem = await baseRewardPool.previewRedeem(owner.address);
            // console.log(previewRedeem)

            // await stakingToken.name.returns("Test Name")
            // let name = await baseRewardPool.name();
            // console.log(name)

            // await stakingToken.symbol.returns("TST")
            // let symbol = await baseRewardPool.symbol();
            // console.log(symbol)

            // await stakingToken.decimals.returns()
            // let decimals = await baseRewardPool.decimals();
            // console.log(decimals)

        })

    })
          

    describe("mint()", async () => {

        it("mint", async () => {

            await fakeLpToken.safeTransferFrom.whenCalledWith(owner.address, baseRewardPool.address, 10000000).returns();
            await fakestakingToken.balanceOf.whenCalledWith(baseRewardPool.address).returns(10000000);
    
            await fakestakingToken.balanceOf.returnsAtCall(1, 20000000);
            await fakestakingToken.balanceOf.returnsAtCall(2, 40000000);

            await operator.deposit.whenCalledWith(0, 1000, false).returns(true)
            await baseRewardPool.mint(1000, owner.address)
        })
    });

    describe("withdraw()", async () => {

        it("withdraw", async () => {
            
            await fakeLpToken.safeTransferFrom.whenCalledWith(owner.address, baseRewardPool.address, 10000000).returns();
            await fakestakingToken.balanceOf.whenCalledWith(baseRewardPool.address).returns(10000000);
    
            await fakestakingToken.balanceOf.returnsAtCall(1, 20000000);
            await fakestakingToken.balanceOf.returnsAtCall(2, 40000000);

            await operator.deposit.whenCalledWith(0, 1000, false).returns(true)

            await baseRewardPool.deposit(1000, owner.address)

            await baseRewardPool.connect(owner)['withdraw(uint256,address,address)'](
                10, tester1.address, owner.address
              );

        });

        it("withdraw", async () => {
            
            await fakeLpToken.safeTransferFrom.whenCalledWith(owner.address, baseRewardPool.address, 10000000).returns();
            await fakeLpToken.safeTransferFrom.whenCalledWith(owner.address, tester2.address, 10000000).returns();
            fakeLpToken.safeApprove.returns()
            await fakestakingToken.balanceOf.whenCalledWith(baseRewardPool.address).returns(10000000);
    
            await fakestakingToken.balanceOf.returnsAtCall(1, 20000000);
            await fakestakingToken.balanceOf.returnsAtCall(2, 40000000);

            await operator.deposit.whenCalledWith(0, 1000, false).returns(true)

            await baseRewardPool.deposit(1000, tester2.address)

            await expect(baseRewardPool.connect(tester2)['withdraw(uint256,address,address)'](
                10, tester1.address, owner.address
              )).to.be.revertedWith("ERC4626: withdrawal amount exceeds allowance")

        })
    });

    describe("approve()", async () => {
        it("approve", async () => {
            
            await baseRewardPool.approve(tester1.address, 1000)

            await expect(baseRewardPool.approve(constants.AddressZero, 1000)).to.be.revertedWith("ERC4626: approve to the zero address")

            const allowance = await baseRewardPool.allowance(owner.address, tester1.address)
            // console.log(allowance)
        })
    });

    describe("transfer()", async () => {
        it("transfer", async () => {

            await expect(baseRewardPool.transferFrom(owner.address, tester2.address, 100)).to.be.revertedWith("ERC4626: Not supported")

            await expect(baseRewardPool.transfer(owner.address, tester2.address)).to.be.revertedWith("ERC4626: Not supported")
        })
    });

    describe("decimals()", async () => {

        it("decimals", async () => {
            await baseRewardPool.decimals();
        })
    });

    describe("symbol()", async () => {

        it("symbol", async () => {
            await expect(baseRewardPool.symbol()).to.be.reverted;
        })
    });

    describe("totalSupply()", async () => {

        it("totalSupply", async () => {
            await baseRewardPool.totalSupply()
        })
    });

    describe("name()", async () => {

        it("name", async () => {
            await expect(baseRewardPool.name()).to.be.reverted;
        })
    });

    describe("redeem()", async () => {

        it("redeem", async () => {
            await fakeLpToken.safeTransferFrom.whenCalledWith(owner.address, baseRewardPool.address, 10000000).returns();
            await fakestakingToken.balanceOf.whenCalledWith(baseRewardPool.address).returns(10000000);
    
            await fakestakingToken.balanceOf.returnsAtCall(1, 20000000);
            await fakestakingToken.balanceOf.returnsAtCall(2, 40000000);

            await operator.deposit.whenCalledWith(0, 1000, false).returns(true)

            await baseRewardPool.deposit(1000, owner.address)

            await baseRewardPool.connect(owner)['withdraw(uint256,address,address)'](
                10, tester1.address, owner.address
            );
            await baseRewardPool.redeem(1, tester2.address, owner.address)

        })
    });
            
})
