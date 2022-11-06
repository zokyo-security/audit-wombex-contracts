import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import chai, { expect } from "chai";
import {
    deployTestFirstStage,
    getMockDistro,
    getMockMultisigs
} from "../../scripts/deployMocks";
import {SystemDeployed, deploy, MultisigConfig} from "../../scripts/deploySystem";
import { BN, simpleToExactAmount } from "../../test-utils/math";
import { WmxLocker, WmxRewardPool, WmxRewardPool__factory, ERC20 } from "../../types/generated";
import { getTimestamp, increaseTime } from "../../test-utils/time";
import { ONE_DAY, ONE_WEEK, ZERO_ADDRESS } from "../../test-utils/constants";
import { MockContract, smock } from '@defi-wonderland/smock/src';
import { assertBNClose, assertBNClosePercent } from "../../test-utils/assertions";

chai.should();
chai.use(smock.matchers);

describe("WmxRewardPool", () => {
    let accounts: Signer[];

    let contracts: SystemDeployed;
    let deployer: Signer;
    let stakingToken: ERC20;
    let wmx: ERC20;
    let wmxLocker: WmxLocker;
    let multisigs: MultisigConfig;
    let rewardPool: WmxRewardPool;
    let rewardPoolMock: MockContract<WmxRewardPool>;

    let penaltyForwarderAddress: string;

    let alice: Signer;
    let aliceAddress: string;
    let bob: Signer;
    let bobAddress: string;
    let rob: Signer;
    let robAddress: string;

    let initialBal: BN;
    let rewardAmount: BN;
    let stakeAmount: BN;

    const reset = async() => {
        const mocks = await deployTestFirstStage(hre, deployer);
        multisigs = await getMockMultisigs(accounts[0], accounts[0], accounts[0]);
        const distro = getMockDistro();
        contracts = await deploy(hre, deployer, accounts[0], mocks, distro, multisigs, mocks.namingConfig, mocks);

        alice = accounts[1];
        aliceAddress = await alice.getAddress();

        bob = accounts[2];
        bobAddress = await bob.getAddress();

        rob = accounts[3];
        robAddress = await rob.getAddress();

        rewardPool = contracts.initialCvxCrvStaking.connect(alice);
        stakingToken = contracts.cvxCrv.connect(alice) as ERC20;
        wmx = contracts.cvx as ERC20;
        wmxLocker = contracts.cvxLocker;
        penaltyForwarderAddress = contracts.penaltyForwarder.address;

        initialBal = await mocks.crv.balanceOf(await deployer.getAddress());
        await mocks.crv.transfer(aliceAddress, initialBal);
        await mocks.crv.connect(alice).approve(contracts.crvDepositor.address, initialBal);
        await contracts.crvDepositor.connect(alice)["deposit(uint256,bool,address)"](initialBal, true, ZERO_ADDRESS);
        initialBal = initialBal.div(2);
        await stakingToken.transfer(bobAddress, initialBal);

        stakeAmount = initialBal.div(5);
    }

    async function verifyWithdraw(signer: Signer, accountAddress: string, amount: BN, claim = false, lock = false) {
        const totalSupplyBefore = await rewardPool.totalSupply();
        const stakedBalanceBefore = await rewardPool.balanceOf(accountAddress);
        const lockedBalanceBefore = await contracts.cvxLocker.balances(accountAddress);
        const stakedTknBalanceBefore = await stakingToken.balanceOf(accountAddress);
        const cvxBalanceBefore = await wmx.balanceOf(accountAddress);
        const pendingPenaltyBefore = await rewardPool.pendingPenalty();

        // Test withdraw(amount,claim, lock)
        const tx = await rewardPool.connect(signer).withdraw(amount, claim, lock);
        await expect(tx).to.emit(rewardPool, "Withdrawn").withArgs(accountAddress, amount);
        const pendingPenaltyAfter = await rewardPool.pendingPenalty();
        const lockedBalanceAfter = await contracts.cvxLocker.balances(accountAddress);

        // expect to update reward
        expect(await rewardPool.balanceOf(accountAddress)).eq(stakedBalanceBefore.sub(amount));
        expect(await rewardPool.totalSupply()).eq(totalSupplyBefore.sub(amount));
        expect(await stakingToken.balanceOf(accountAddress)).eq(stakedTknBalanceBefore.add(amount));
        if (claim) {
            expect(await rewardPool.rewards(accountAddress)).eq(0);
            //  rewards[account] is updated twice, at withdraw and at getReward so we can't check it directly.
            if (lock) {
                expect(lockedBalanceAfter.locked.gt(lockedBalanceBefore.locked), "locked balance should increase");
                expect(pendingPenaltyAfter, "no penalty").eq(pendingPenaltyBefore);
            } else {
                const cvxBalanceAfter = await wmx.balanceOf(accountAddress);
                const pendingPenalty = pendingPenaltyAfter.sub(pendingPenaltyBefore);
                // The amount CVX send to the user is 4 times the penalty, ie: rewards to user = earned 80%, penalty = earned 20%
                assertBNClosePercent(cvxBalanceAfter.sub(cvxBalanceBefore), pendingPenalty.mul(7).div(3), "0.001");
                assertBNClosePercent(await rewardPool.pendingPenalty(), pendingPenalty, "0.001");
            }
        }
    }

    before(async () => {
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        await reset();
    });   
    
    describe ( "Operation without exceptions: " , async function () {
        it("#constructor - initial configuration is correct", async () => {
            expect(await rewardPool.stakingToken()).eq(stakingToken.address);
            expect(await rewardPool.rewardToken()).eq(wmx.address);
            expect(await rewardPool.rewardManager()).eq(multisigs.treasuryMultisig);
            expect(await rewardPool.wmxLocker()).eq(wmxLocker.address);
            expect(await rewardPool.penaltyForwarder()).eq(penaltyForwarderAddress);
            const currentTime = await getTimestamp();
            expect(await rewardPool.startTime()).gt(currentTime.add(ONE_DAY.mul(6)));
            expect(await rewardPool.startTime()).lt(currentTime.add(ONE_DAY.mul(8)));
            rewardAmount = await wmx.balanceOf(rewardPool.address);
            expect(rewardAmount).gt(simpleToExactAmount(1000));
        })
        it("#stake - allows users to deposit before rewards are added (no rewards accrued)", async () => {
            await stakingToken.approve(rewardPool.address, stakeAmount);
            await rewardPool.stake(stakeAmount);
            expect(await rewardPool.rewardPerTokenStored()).eq(0);
        })
        it("#initialiseRewards - allows anyone to trigger rewards distribution after startTime", async () => {
            await expect(rewardPool.initialiseRewards()).to.be.revertedWith("!authorized");
            await increaseTime(ONE_WEEK.mul(2));
            const timeBefore = await getTimestamp();
            const balBefore = await wmx.balanceOf(rewardPool.address);
            await rewardPool.connect(accounts[0]).initialiseRewards();
            const rewardRate = await rewardPool.rewardRate();
            const periodFinish = await rewardPool.periodFinish();

            assertBNClosePercent(rewardRate, balBefore.div(ONE_WEEK.mul(2)), "0.01");
            assertBNClose(periodFinish, timeBefore.add(ONE_WEEK.mul(2)), 4);
        })
        it("#getReward - accrues rewards to existing depositors following startTime", async () => {
            await increaseTime(ONE_WEEK.div(5));
            const balBefore = await wmxLocker.balances(aliceAddress);
            await rewardPool.getReward(true); // no penalty
            const balAfter = await wmxLocker.balances(aliceAddress);
            assertBNClosePercent(balAfter.locked.sub(balBefore.locked), rewardAmount.div(10), "0.01");
        });
        it("#stake - allows subsequent deposits", async () => {
            await stakingToken.connect(bob).approve(rewardPool.address, stakeAmount);
            await rewardPool.connect(bob).stake(stakeAmount);
        });
        it("#stakeFor - allows users to stake For someone else", async () => {
            await stakingToken.connect(bob).approve(rewardPool.address, stakeAmount);
            const stakedBalanceBefore = await rewardPool.balanceOf(robAddress);
            const totalSupplyBefore = await rewardPool.totalSupply();
            await expect(rewardPool.connect(bob).stakeFor(robAddress, stakeAmount))
            .to.emit(rewardPool, "Staked")
            .withArgs(robAddress, stakeAmount);
            expect(await rewardPool.balanceOf(robAddress)).eq(stakedBalanceBefore.add(stakeAmount));
            expect(await rewardPool.totalSupply()).eq(totalSupplyBefore.add(stakeAmount));
        })
        it("#earned - penalises claimers who do not lock", async () => {
            await increaseTime(ONE_WEEK.div(5));
            const earned = await rewardPool.earned(bobAddress);
            assertBNClosePercent(earned, rewardAmount.div(30), "0.01");

            const balBefore = await wmx.balanceOf(bobAddress);
            await rewardPool.connect(bob).getReward(false);
            const balAfter = await wmx.balanceOf(bobAddress);

            assertBNClosePercent(balAfter.sub(balBefore), earned.mul(7).div(10), "0.001");
            assertBNClosePercent(await rewardPool.pendingPenalty(), earned.mul(3).div(10), "0.001");
        })
        it("#forwardPenalty - allows anyone to forward penalty on to the PenaltyForwarder", async () => {
            const penalty = await rewardPool.pendingPenalty();
            expect(penalty).gt(0);

            await rewardPool.forwardPenalty();
            expect(await wmx.balanceOf(penaltyForwarderAddress)).eq(penalty);
            expect(await rewardPool.pendingPenalty()).eq(0);
        });
        it("#forwardPenalty - only forwards penalties once", async () => {
            const balBefore = await wmx.balanceOf(rewardPool.address);
            await rewardPool.forwardPenalty();
            const balAfter = await wmx.balanceOf(rewardPool.address);
            expect(balAfter).eq(balBefore);
        });
        it("#stakeAll - allows users to stakeAll", async () => {
            const bobCvxCrvBalance = await stakingToken.balanceOf(bobAddress);

            await stakingToken.connect(bob).approve(rewardPool.address, bobCvxCrvBalance);
            const stakedBalanceBefore = await rewardPool.balanceOf(bobAddress);
            const totalSupplyBefore = await rewardPool.totalSupply();
            await expect(rewardPool.connect(bob).stakeAll())
                .to.emit(rewardPool, "Staked")
                .withArgs(bobAddress, bobCvxCrvBalance);
            expect(await rewardPool.balanceOf(bobAddress)).eq(stakedBalanceBefore.add(bobCvxCrvBalance));
            expect(await rewardPool.totalSupply()).eq(totalSupplyBefore.add(bobCvxCrvBalance));
        });
        /**
         * #withdraw
         *  - allows users to withdraw
         *  - allows users to withdraw and claim rewards
         *  - allows users to withdraw and stake rewards
         */
        it("#withdraw - allows users to withdraw", async () => {
            // no reward claim , no stake
            await verifyWithdraw(bob, bobAddress, stakeAmount, false, false);
        });
        it("#withdraw - allows users to withdraw and claim rewards", async () => {
            // Withdraw and claim rewards with penalty
            await verifyWithdraw(bob, bobAddress, stakeAmount, true, false);
        });
        it("#withdraw - allows users to withdraw and stake rewards", async () => {
            // Withdraw, claim rewards and stake them to avoid penalty
            await verifyWithdraw(bob, bobAddress, stakeAmount, true, true);
        });
        it("#rescueReward - rescues rewards before contract has started", async () => {
            await reset();
            const treasuryAddress = await deployer.getAddress();
            const contractBal = await wmx.balanceOf(rewardPool.address);
            expect(contractBal).gt(0);
            const treasuryBal = await wmx.balanceOf(treasuryAddress);
            await rewardPool.connect(deployer).rescueReward();
            const treasuryBalAfter = await wmx.balanceOf(treasuryAddress);
            expect(treasuryBalAfter).eq(treasuryBal.add(contractBal));
        });
    })
    describe ( "Exceptions: ", async() => {
        beforeEach(async () => {
            await reset();
        });

        /**
         * #initialiseRewards - Wrong check are implemented to limit access(reward manager) and check the calling time (used logical OR operator)
         *  - current time is earlier than startTime
         *  - The caller is not reward manager
         */
        it("#initialiseRewards - current time is earlier than startTime", async () => {
            // current time is earlier than startTime.
            // so initialiseRewards transaction has to be reverted but
            await rewardPool.connect(deployer).initialiseRewards();
        });
        it("#initialiseRewards - The caller is not reward manager", async () => {
            // The caller is not reward manager.
            // so initialiseRewards transaction has to be reverted but
            increaseTime(ONE_WEEK.mul(5));
            await rewardPool.connect(alice).initialiseRewards();
        });


        it("#withdraw - The malicious reward manager can change `wmxLocker`", async () => {
            await rewardPool.connect(deployer).initialiseRewards();
            await stakingToken.connect(bob).approve(rewardPool.address, stakeAmount);
            await rewardPool.connect(bob).stake(stakeAmount);

            await increaseTime(ONE_WEEK.div(5));
            
            //Set wrong address to the wmxLocker
            await rewardPool.connect(deployer).setLocker(bobAddress);
            expect(await rewardPool.wmxLocker()).eq(bobAddress);
            
            await expect(rewardPool.connect(bob).withdraw(stakeAmount, true, true)).to.be.revertedWith("non-contract account");
        })
        it("#getReward - The malicious reward manager can change `wmxLocker`", async () => {
            await rewardPool.connect(deployer).initialiseRewards();
            await stakingToken.connect(bob).approve(rewardPool.address, stakeAmount);
            await rewardPool.connect(bob).stake(stakeAmount);

            await increaseTime(ONE_WEEK.div(5));
            
            //Set wrong address to the wmxLocker
            await rewardPool.connect(deployer).setLocker(robAddress);
            expect(await rewardPool.wmxLocker()).eq(robAddress);

            await expect(rewardPool.connect(bob).getReward(true)).to.be.revertedWith("non-contract account");
        })
    })
})
