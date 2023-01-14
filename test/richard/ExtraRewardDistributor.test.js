
const { ethers } = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const { expect } = require('chai')
const  chai  = require('chai')
const { BigNumber, constants } = require('ethers');

chai.should();
chai.use(smock.matchers);

let IWmxLocker =  new ethers.utils.Interface([
    "function lock(address _account, uint256 _amount) external",
    "function checkpointEpoch() external",
    "function epochCount() external view returns (uint256)",
    "function balanceAtEpochOf(uint256 _epoch, address _user) external view returns (uint256 amount)",
    "function totalSupplyAtEpoch(uint256 _epoch) external view returns (uint256 supply)",
    "function queueNewRewards(address _rewardsToken, uint256 reward) external",
    "function getReward(address _account, bool _stake) external",
    "function getReward(address _account) external"

]);

let IERC20 = new ethers.utils.Interface([
        "function safeTransfer(address token, address to, uint256 value) external returns(bool)",
        "function safeTransferFrom(address, address from, address to, uint256 value) external returns(bool)",
        "function safeApprove(address, address spender, uint256 value) external returns(bool)",
        "function safeIncreaseAllowance(address, address spender, uint256 value) external returns(bool)",
        "function safeDecreaseAllowance(address, address spender, uint256 value) external returns(bool)",
        "function totalSupply() external view returns (uint256)",
        "function transfer(address recipient, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) external view returns (uint256)",
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)",

        ]);

describe("ExtraReward", async () => {

    let owner, tester1, tester2, extraRewardDistributor, fakeWmxLocker;

    beforeEach( async () => {

        const signers = await hre.ethers.getSigners();
        owner = signers[0];
        tester1 = signers[0];
        tester2 = signers[0];

        const ExtraRewardsDistributorFactory = await hre.ethers.getContractFactory("ExtraRewardsDistributor");
        fakeWmxLocker = await smock.fake({interface: IWmxLocker});

        extraRewardDistributor = await ExtraRewardsDistributorFactory.deploy(fakeWmxLocker.address);
    });

    describe("modifyWhitelist", async () => {
        it("modifyWhitelist", async () => {

            // await expect(
               await extraRewardDistributor.connect(tester2).modifyWhitelist(tester1.address, true)
            // ).to.be.revertedWith("");

            await expect(extraRewardDistributor.modifyWhitelist(tester1.address, true))
                .to.emit(extraRewardDistributor, "WhitelistModified").withArgs(tester1.address, true);

        })
    });


    describe("addReward()", async () => {

        it("addReward", async () => {

            const MockERC20 = await hre.ethers.getContractFactory("MockERC20");

            const rewardToken1 = await MockERC20.deploy(

                "Reward Token 1",
                "RT1",
                9,
                owner.address,
                "1000000000000"
            )
            const rewardToken2 = await MockERC20.deploy(

                "Reward Token 2",
                "RT2",
                9,
                owner.address,
                "1000000000000"
            )

            await fakeWmxLocker.epochCount.returns("100")
            await fakeWmxLocker.totalSupplyAtEpoch.returns("10000000")
                        
            await expect(extraRewardDistributor.addReward(rewardToken2.address, 10000))
                .to.be.revertedWith("!auth")
            
            await extraRewardDistributor.modifyWhitelist(owner.address, true);

            await expect(extraRewardDistributor.addReward(rewardToken2.address, 0))
                .to.be.revertedWith("!amount")

                await expect(extraRewardDistributor.addReward(rewardToken2.address, 10000))
                .to.be.revertedWith("ERC20: transfer amount exceeds allowance")

            await rewardToken2.approve(extraRewardDistributor.address, 100000);

            await expect(extraRewardDistributor.addReward(rewardToken2.address, 10000))
                .to.emit(extraRewardDistributor, "RewardAdded")
                .withArgs(rewardToken2.address, 99, 10000);
            
        });

    });

    describe("addRewardToEpoch()", async () => {

        it("adds reward to epoch", async () => {
            
            fakeWmxLocker.epochCount.returns(10000)
            fakeWmxLocker.totalSupplyAtEpoch.returns("100000000000000")
            let token = await smock.fake({interface: IERC20})
            token.safeTransfer.returns(true);
            token.transfer.returns(true);
            token.approve.returns(true);
            token.safeApprove.returns(true);
            token.transferFrom.returns(true);
            token.safeTransferFrom.returns(true)

            await extraRewardDistributor.modifyWhitelist(owner.address, true)
            await extraRewardDistributor.addRewardToEpoch(token.address, 100, "100");

            const epochCOunt = await extraRewardDistributor.rewardEpochsCount(token.address)
            console.log(epochCOunt)
    });

    it("addRewardToEpoch", async () => {

            fakeWmxLocker.epochCount.returns(10)
            fakeWmxLocker.totalSupplyAtEpoch.returns("100000000000000")
            let token = await smock.fake({interface: IERC20})
            token.safeTransfer.returns(true);
            token.transfer.returns(true);
            token.approve.returns(true);
            token.safeApprove.returns(true);
            token.transferFrom.returns(true);
            token.safeTransferFrom.returns(true)

            await extraRewardDistributor.modifyWhitelist(owner.address, true)
            await expect(
                extraRewardDistributor.addRewardToEpoch(token.address, 100, "100")
            ).to.be.revertedWith("Cannot assign to the future")

    });

    it("addRewardToEpoch", async () => {

        let MockExtraRewardDistributor = await smock.mock("MockExtraRewardsDistributor");
        let extraRewardDistributor = await MockExtraRewardDistributor.deploy(fakeWmxLocker.address)
        

        fakeWmxLocker.epochCount.returns(1000)
        fakeWmxLocker.totalSupplyAtEpoch.returns("100000000000000")
        let token = await smock.fake({interface: IERC20})
        token.safeTransfer.returns(true);
        token.transfer.returns(true);
        token.approve.returns(true);
        token.safeApprove.returns(true);
        token.transferFrom.returns(true);
        token.safeTransferFrom.returns(true)

        await extraRewardDistributor.mockUpdateRewardEpochs(token.address, 100)
        await extraRewardDistributor.mockUpdateRewardEpochs(token.address, 100)
        await extraRewardDistributor.mockUpdateRewardEpochs(token.address, 100)

        await extraRewardDistributor.modifyWhitelist(owner.address, true)
        await expect(
            extraRewardDistributor.addRewardToEpoch(token.address, 100, "100")
        ).to.be.revertedWith("Cannot backdate to this epoch")


});

    it("addRewardToEpoch", async () => {
            
        fakeWmxLocker.epochCount.returns(100)
        fakeWmxLocker.totalSupplyAtEpoch.returns("100000000000000")
        let token = await smock.fake({interface: IERC20})
        token.safeTransfer.returns(true);
        token.transfer.returns(true);
        token.approve.returns(true);
        token.safeApprove.returns(true);
        token.transferFrom.returns(true);
        token.safeTransferFrom.returns(true)

        await extraRewardDistributor.modifyWhitelist(owner.address, true)
        await extraRewardDistributor.addRewardToEpoch(token.address, 100, "99");

        const epochCOunt = await extraRewardDistributor.rewardEpochsCount(token.address)
        console.log(epochCOunt)
});

    describe("claimableRewardsAtEpoch()", async () => {

        it("claimableRewardsAtEpoch", async () => {
            
            fakeWmxLocker.epochCount.returns(10000)
            fakeWmxLocker.totalSupplyAtEpoch.returns("100000000000000")
            let token = await smock.fake({interface: IERC20})
            token.safeTransfer.returns(true);
            token.transfer.returns(true);
            token.approve.returns(true);
            token.safeApprove.returns(true);
            token.transferFrom.returns(true);
            token.safeTransferFrom.returns(true)

            await extraRewardDistributor.modifyWhitelist(owner.address, true)
            await extraRewardDistributor.addRewardToEpoch(token.address, 100, "100");
            await extraRewardDistributor.claimableRewardsAtEpoch(owner.address, token.address, 1000)
        })
    });

    describe("claimableRewards()", async () => {

        it("claimableRewards", async () => {

            fakeWmxLocker.epochCount.returns(10000)
            fakeWmxLocker.totalSupplyAtEpoch.returns("100000000000000")
            let token = await smock.fake({interface: IERC20})
            token.safeTransfer.returns(true);
            token.transfer.returns(true);
            token.approve.returns(true);
            token.safeApprove.returns(true);
            token.transferFrom.returns(true);
            token.safeTransferFrom.returns(true)

            await extraRewardDistributor.modifyWhitelist(owner.address, true)
            await extraRewardDistributor.addRewardToEpoch(token.address, 100, "100");
            await extraRewardDistributor.claimableRewards(owner.address, token.address)
        })
    });

    describe("forfeitRewards()", async () => {

        it("forfeitRewards", async () => {
            
            let MockExtraRewardDistributor = await smock.mock("MockExtraRewardsDistributor");
            let extraRewardDistributor = await MockExtraRewardDistributor.deploy(fakeWmxLocker.address)
              
            fakeWmxLocker.epochCount.returns(10000)
            fakeWmxLocker.totalSupplyAtEpoch.returns("100000000000000")
            let token = await smock.fake({interface: IERC20})
            token.safeTransfer.returns(true);
            token.transfer.returns(true);
            token.approve.returns(true);
            token.safeApprove.returns(true);
            token.transferFrom.returns(true);
            token.safeTransferFrom.returns(true)

            let token2 = await smock.fake({interface: IERC20})
            token2.safeTransfer.returns(true);
            token2.transfer.returns(true);
            token2.approve.returns(true);
            token2.safeApprove.returns(true);
            token2.transferFrom.returns(true);
            token2.safeTransferFrom.returns(true)

            let token3 = await smock.fake({interface: IERC20})
            token3.safeTransfer.returns(true);
            token3.transfer.returns(true);
            token3.approve.returns(true);
            token3.safeApprove.returns(true);
            token3.transferFrom.returns(true);
            token3.safeTransferFrom.returns(true)

            await extraRewardDistributor.modifyWhitelist(owner.address, true)
            await extraRewardDistributor.mockUpdateUserClaims(token.address, owner.address,100)
            await extraRewardDistributor.mockUpdateRewardEpochs(token.address, 100)
            await extraRewardDistributor.mockUpdateRewardEpochs(token.address, 100)
            await extraRewardDistributor.mockUpdateRewardEpochs(token.address, 100)
            await expect(extraRewardDistributor.forfeitRewards(token.address, 1)).to.revertedWith("already claimed")
            await extraRewardDistributor.mockUpdateUserClaims(token.address, owner.address,0)
            await extraRewardDistributor.forfeitRewards(token.address, 1)
        })


        it("forfeitRewards past", async () => {

            fakeWmxLocker.epochCount.returns(10000)
            fakeWmxLocker.totalSupplyAtEpoch.returns("100000000000000")
            let token = await smock.fake({interface: IERC20})
            token.safeTransfer.returns(true);
            token.transfer.returns(true);
            token.approve.returns(true);
            token.safeApprove.returns(true);
            token.transferFrom.returns(true);
            token.safeTransferFrom.returns(true)

            let token2 = await smock.fake({interface: IERC20})
            token2.safeTransfer.returns(true);
            token2.transfer.returns(true);
            token2.approve.returns(true);
            token2.safeApprove.returns(true);
            token2.transferFrom.returns(true);
            token2.safeTransferFrom.returns(true)

            let token3 = await smock.fake({interface: IERC20})
            token3.safeTransfer.returns(true);
            token3.transfer.returns(true);
            token3.approve.returns(true);
            token3.safeApprove.returns(true);
            token3.transferFrom.returns(true);
            token3.safeTransferFrom.returns(true)

            await extraRewardDistributor.modifyWhitelist(owner.address, true)
            await extraRewardDistributor.addRewardToEpoch(token.address, 100, "100");
            await extraRewardDistributor.addRewardToEpoch(token2.address, 100, "100");
            await extraRewardDistributor.addRewardToEpoch(token3.address, 100, "100");
            await expect(extraRewardDistributor.forfeitRewards(token.address, 1)).to.be.revertedWith("!past")
        })
    });

    describe("getReward()", async () => {

        it("getReward", async () => {

            fakeWmxLocker.epochCount.returns(10000)
            fakeWmxLocker.totalSupplyAtEpoch.returns("100000000000000")
            let token = await smock.fake({interface: IERC20})
            token.safeTransfer.returns(true);
            token.transfer.returns(true);
            token.approve.returns(true);
            token.safeApprove.returns(true);
            token.transferFrom.returns(true);
            token.safeTransferFrom.returns(true)

            await extraRewardDistributor.modifyWhitelist(owner.address, true)
            await extraRewardDistributor.addRewardToEpoch(token.address, 100, "100");
            await extraRewardDistributor.connect(owner)['getReward(address,address)'](owner.address, token.address);

        })
    });

    describe("getReward()", async () => {

        it("getReward", async () => {

            let MockExtraRewardDistributor = await smock.mock("MockExtraRewardsDistributor");
            let extraRewardDistributor = await MockExtraRewardDistributor.deploy(fakeWmxLocker.address)

            fakeWmxLocker.epochCount.returns(10000)
            fakeWmxLocker.totalSupplyAtEpoch.returns("1000000000000")

            let token = await smock.fake({interface: IERC20})
            token.safeTransfer.returns(true);
            token.transfer.returns(true);
            token.approve.returns(true);
            token.safeApprove.returns(true);
            token.transferFrom.returns(true);
            token.safeTransferFrom.returns(true)

            await extraRewardDistributor.modifyWhitelist(owner.address, true)
            await extraRewardDistributor.mockUpdateRewardEpochs(token.address, 100);
            await extraRewardDistributor.mockUpdateRewardEpochs(token.address, 100);
            await extraRewardDistributor.mockUpdateRewardEpochs(token.address, 100);
            await extraRewardDistributor.mockUpdateUserClaims(token.address, owner.address,1)

            await extraRewardDistributor.connect(owner)['getReward(address,uint256)'](token.address, 1);
        });

        it("getReward claimable", async () => {
            
            let MockExtraRewardDistributor = await smock.mock("MockExtraRewardsDistributor");
            let extraRewardDistributor = await MockExtraRewardDistributor.deploy(fakeWmxLocker.address)
              
            fakeWmxLocker.epochCount.returns(10000)
            fakeWmxLocker.totalSupplyAtEpoch.returns("100000000000000")
            let token = await smock.fake({interface: IERC20})
            token.safeTransfer.returns(true);
            token.transfer.returns(true);
            token.approve.returns(true);
            token.safeApprove.returns(true);
            token.transferFrom.returns(true);
            token.safeTransferFrom.returns(true)

            let token2 = await smock.fake({interface: IERC20})
            token2.safeTransfer.returns(true);
            token2.transfer.returns(true);
            token2.approve.returns(true);
            token2.safeApprove.returns(true);
            token2.transferFrom.returns(true);
            token2.safeTransferFrom.returns(true)

            let token3 = await smock.fake({interface: IERC20})
            token3.safeTransfer.returns(true);
            token3.transfer.returns(true);
            token3.approve.returns(true);
            token3.safeApprove.returns(true);
            token3.transferFrom.returns(true);
            token3.safeTransferFrom.returns(true)

            await extraRewardDistributor.modifyWhitelist(owner.address, true)
            await extraRewardDistributor.mockUpdateRewardEpochs(token.address, 100)
            await extraRewardDistributor.mockUpdateRewardEpochs(token.address, 100)
            await extraRewardDistributor.mockUpdateRewardEpochs(token.address, 100)
            await extraRewardDistributor.mockUpdateUserClaims(token.address, owner.address,100)

            await extraRewardDistributor.connect(owner)['getReward(address,uint256)'](owner.address, 1);
            
        })
    });

})
});