const { ethers, network } = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const { expect } = require('chai')
const  chai  = require('chai')
const { BigNumber, constants } = require('ethers');

chai.should();
chai.use(smock.matchers);

describe("BasePoolReward", async () => {

    async function fastForward(seconds) {
        await network.provider.send("evm_increaseTime", [seconds]);
        await network.provider.send("evm_mine");
    }

    
    let owner, tester1, tester2;
    let baseRewardPool, fakestakingToken, boosterRewardToken, booster, rewardFactory;

    beforeEach(async () => {

        const signers = await hre.ethers.getSigners();
        owner = signers[0];
        tester1 = signers[0];
        tester2 = signers[0];

        booster = await smock.fake("Booster");
        rewardFactory = await smock.fake("RewardFactory");

        const MockERC20 = await hre.ethers.getContractFactory("MockERC20");

        fakestakingToken = await MockERC20.deploy(
                "Reward Token 1",
                "RT1",
                9,
                owner.address,
                "1000000000000"
        )

        boosterRewardToken = await MockERC20.deploy(
            "Reward Token 2",
            "RT2",
            9,
            owner.address,
            "1000000000000"
        )
        
        const BaseRewardPoolFactory = await smock.mock("BaseRewardPool");
        baseRewardPool = await BaseRewardPoolFactory.deploy(
            0,
            fakestakingToken.address,
            boosterRewardToken.address,
            booster.address,
            rewardFactory.address
        );
    });

    describe("stake()", async () => {
        it("stakes tokens for caller", async () => {
            
            await expect(baseRewardPool.stake(1000)).to.be.revertedWith("ERC20: transfer amount exceeds allowance");

            await fakestakingToken.approve(baseRewardPool.address, 1000);
            await expect(baseRewardPool.stake(1000)).to.emit(baseRewardPool, "Staked")
            .withArgs(owner.address, 1000);
        
        });
    });

    describe("stakeAll()", async () => {
        it("stake all tokens balance of the transaction sender", async () => {

            let balance = await fakestakingToken.balanceOf(owner.address)
    
            await expect(baseRewardPool.stakeAll()).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
            
            await fakestakingToken.approve(baseRewardPool.address, balance);

            await expect(baseRewardPool.stakeAll()).to.emit(baseRewardPool, "Staked")
                .withArgs(owner.address,balance);
        });
    });

    describe("stakeFor()", async () => {
        it("stakes token for other address", async () => {
            let balance = await fakestakingToken.balanceOf(owner.address)
            await expect(baseRewardPool.stakeFor(tester1.address, 2000)).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
    
            await fakestakingToken.approve(baseRewardPool.address, 2000);
            
            await expect(baseRewardPool.stakeFor(tester1.address, 2000)).to.emit(baseRewardPool, "Staked")
                .withArgs(owner.address,2000);

        });
    });
    
    describe("withdraw()", async () => {
        it("withdraws tokens staked", async () => {
            
            let balance = await fakestakingToken.balanceOf(owner.address)
            
            await fakestakingToken.approve(baseRewardPool.address, balance);
            await baseRewardPool.stakeFor(tester1.address, 2000);
            await baseRewardPool.stakeFor(tester2.address, 2000);

            await baseRewardPool.stakeFor(tester1.address, 2000);
            await baseRewardPool.stakeFor(tester2.address, 2000);

            await expect(baseRewardPool.withdraw(2000, false)).to.emit(baseRewardPool, "Withdrawn")
                .withArgs(owner.address, 2000);

        })

        it("withdraws token staked on callers behalf", async () => {
            
            let balance = await fakestakingToken.balanceOf(owner.address)
            
            await fakestakingToken.approve(baseRewardPool.address, balance);
            await baseRewardPool.stakeFor(tester1.address, 2000);
            await baseRewardPool.stakeFor(tester2.address, 2000);

            await baseRewardPool.stakeFor(tester1.address, 2000);
            await baseRewardPool.stakeFor(tester2.address, 2000);

            await expect(baseRewardPool.withdraw(2000, true)).to.emit(baseRewardPool, "Withdrawn")
                .withArgs(owner.address, 2000);

        })
    });

    describe("withdrawAll()", async () => {
        it("withdraw all tokens staked", async () => {
            
            let balance = await fakestakingToken.balanceOf(owner.address)
            
            await expect(baseRewardPool.stakeAll()).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
            
            await fakestakingToken.approve(baseRewardPool.address, balance);

            await expect(baseRewardPool.stakeAll()).to.emit(baseRewardPool, "Staked")
                .withArgs(owner.address,balance);

            await expect(baseRewardPool.withdrawAll(true)).to.emit(baseRewardPool, "Withdrawn")
            .withArgs(owner.address, balance);
        })
    });


    describe("withdrawAndUnwrap()", async () => {

        it("withdraw and Unwraps specified token amount", async () => {
            let balance = await fakestakingToken.balanceOf(owner.address)
            await fakestakingToken.approve(baseRewardPool.address, balance);

            await expect(baseRewardPool.stakeAll()).to.emit(baseRewardPool, "Staked")
                .withArgs(owner.address,balance);
            
            await baseRewardPool.withdrawAndUnwrap(balance, true)
            
        })
    });

    describe("withdrawAllAndUnwrap()", async () => {
        it("withdrawAllAndUnwrap()", async () => {

            let balance = await fakestakingToken.balanceOf(owner.address)
            await fakestakingToken.approve(baseRewardPool.address, balance);

            await expect(baseRewardPool.stakeAll()).to.emit(baseRewardPool, "Staked")
                .withArgs(owner.address,balance);

            await expect(
                baseRewardPool.withdrawAllAndUnwrap(true)
            ).to.emit(baseRewardPool, "Withdrawn").withArgs(owner.address, balance)

        })
    });

    describe("queueNewRewards()", async () => {

        it("queues rewards successfully when called by booster", async () => {

            let balance = await fakestakingToken.balanceOf(owner.address)
            await fakestakingToken.approve(baseRewardPool.address, balance);

            await baseRewardPool.stakeAll()

            await fastForward(10000000)
            
            await baseRewardPool.connect(owner)['getReward()']();

            await owner.sendTransaction({
                to: booster.address,
                value: ethers.utils.parseEther("5.0")
            });

            const MockERC20 = await hre.ethers.getContractFactory("MockERC20");

            const anotherToken = await MockERC20.deploy(
                    "Another Token 1",
                    "ANOTHER",
                    9,
                    owner.address,
                    "1000000000000"
            )

            const differentToken = await MockERC20.deploy(
                "Different Token 1",
                "Diff",
                9,
                owner.address,
                "1000000000000"
            )

            balance = await boosterRewardToken.balanceOf(owner.address)

            await boosterRewardToken.transfer(booster.address, balance)
            await anotherToken.transfer(booster.address, balance)
            
            await boosterRewardToken.connect(booster.wallet).approve(baseRewardPool.address, balance);
            await anotherToken.connect(booster.wallet).approve(baseRewardPool.address, balance);

            let blockNumber = await ethers.provider.getBlockNumber();
            let block = await ethers.provider.getBlock(blockNumber);
            let timestamp = block.timestamp;
            let periodFinish = timestamp + 150000;

            await baseRewardPool.setVariable("tokenRewards", {
                [anotherToken.address]: {
                    token:anotherToken.address,
                    periodFinish:periodFinish,
                    rewardRate:1,
                    lastUpdateTime:1683010,
                    rewardPerTokenStored:10,
                    queuedRewards:10,
                    currentRewards:100,
                    historicalRewards:100
                }
            })

            fastForward(100000)

            await baseRewardPool.connect(booster.wallet).queueNewRewards(anotherToken.address, balance);
            // await baseRewardPool.connect(booster.wallet).queueNewRewards(boosterRewardToken.address, balance);
            
            // await fastForward(10000000)

            // await baseRewardPool.connect(booster.wallet)['getReward(address,bool)'](owner.address,false);
               
        })
    });


    describe("queueNewRewards()", async () => {

        it("queueNewRewards", async () => {

            let balance = await fakestakingToken.balanceOf(owner.address)
            await fakestakingToken.approve(baseRewardPool.address, balance);

            
            await baseRewardPool.stakeAll()

            await fastForward(10000000)
            
            await baseRewardPool.connect(owner)['getReward()']();

            await owner.sendTransaction({
                to: booster.address,
                value: ethers.utils.parseEther("5.0")
            });

            const MockERC20 = await hre.ethers.getContractFactory("MockERC20");

            const anotherToken = await MockERC20.deploy(
                    "Another Token 1",
                    "ANOTHER",
                    9,
                    owner.address,
                    "1000000000000"
            )

            const differentToken = await MockERC20.deploy(
                "Different Token 1",
                "Diff",
                9,
                owner.address,
                "1000000000000"
        )

            balance = await boosterRewardToken.balanceOf(owner.address)

            await boosterRewardToken.transfer(booster.address, balance)
            await anotherToken.transfer(booster.address, balance)
            
            await boosterRewardToken.connect(booster.wallet).approve(baseRewardPool.address, balance);
            await anotherToken.connect(booster.wallet).approve(baseRewardPool.address, balance);

            await baseRewardPool.connect(booster.wallet).queueNewRewards(anotherToken.address, balance);
            await baseRewardPool.connect(booster.wallet).queueNewRewards(boosterRewardToken.address, balance);
            
            await fastForward(10000000)

            await baseRewardPool.connect(booster.wallet)['getReward(address,bool)'](owner.address,false);
               
        })
    });

    describe("donate()", async () => {

        it("Donate rewards to contract", async () => {
            
            let balance = await boosterRewardToken.balanceOf(owner.address)
            await boosterRewardToken.approve(baseRewardPool.address, balance);

            await baseRewardPool.donate(boosterRewardToken.address, balance)
            let balanceAfter = await boosterRewardToken.balanceOf(owner.address)
            let contractBal = await boosterRewardToken.balanceOf(baseRewardPool.address)
            expect(balanceAfter).to.eq(0);
            expect(balance).to.eq(contractBal)
        })
    });

    describe("processIdleRewards()", async () => {

        it("Processes queued rewards", async () => {

            await owner.sendTransaction({
                to: booster.address,
                value: ethers.utils.parseEther("5.0")
            });

            const MockERC20 = await hre.ethers.getContractFactory("MockERC20");

            const anotherToken = await MockERC20.deploy(
                    "Another Token 1",
                    "ANOTHER",
                    9,
                    owner.address,
                    "1000000000000"
            )

            const differentToken = await MockERC20.deploy(
                "Different Token 1",
                "Diff",
                9,
                owner.address,
                "1000000000000"
        )

            balance = await boosterRewardToken.balanceOf(owner.address)

            await boosterRewardToken.transfer(booster.address, balance)
            await anotherToken.transfer(booster.address, balance)
            
            await boosterRewardToken.connect(booster.wallet).approve(baseRewardPool.address, 100);
            await anotherToken.connect(booster.wallet).approve(baseRewardPool.address, 100);

            await baseRewardPool.connect(booster.wallet).queueNewRewards(anotherToken.address, 100);
            await baseRewardPool.connect(booster.wallet).queueNewRewards(boosterRewardToken.address, 100);
            await fastForward(10000000)
            await baseRewardPool.processIdleRewards()
            await fastForward(100000);
            await baseRewardPool.processIdleRewards();
        });
    });

    describe("queueNewRewards()", async () => {

        it("queueNewRewards", async () => {

            await owner.sendTransaction({
                to: booster.address,
                value: ethers.utils.parseEther("5.0")
            });

            const MockERC20 = await hre.ethers.getContractFactory("MockERC20");

            const anotherToken = await MockERC20.deploy(
                    "Another Token 1",
                    "ANOTHER",
                    9,
                    owner.address,
                    "1000000000000"
            )

            const differentToken = await MockERC20.deploy(
                "Different Token 1",
                "Diff",
                9,
                owner.address,
                "1000000000000"
        )

            let balance = await boosterRewardToken.balanceOf(owner.address)

            await boosterRewardToken.transfer(booster.address, balance)
            await anotherToken.transfer(booster.address, balance)
            
            await boosterRewardToken.connect(booster.wallet).approve(baseRewardPool.address, balance);
            await anotherToken.connect(booster.wallet).approve(baseRewardPool.address, balance);

            await baseRewardPool.connect(booster.wallet).queueNewRewards(anotherToken.address, balance);
            await baseRewardPool.connect(booster.wallet).queueNewRewards(boosterRewardToken.address, balance);
            
        })
    });

    describe("lastTimeRewardApplicable()", async () => {
        it("returns last Time Reward Applicable", async () => {
            const lastTime = await baseRewardPool.lastTimeRewardApplicable(boosterRewardToken.address);
            expect(lastTime).to.eq(0);
        })
    });

    describe("rewardPerToken()", async () => {
        it("gets reward Per Token for a token", async () => {

            const rewardPerToken = await baseRewardPool.rewardPerToken(boosterRewardToken.address);
            expect(rewardPerToken).to.eq(0);

        })
    });

    describe("earned()", async () => {
        it("returns earned rewards by user", async () => {
            const earned = await baseRewardPool.earned(boosterRewardToken.address, owner.address);
            expect(earned).to.eq(0);
        })
    });

});

