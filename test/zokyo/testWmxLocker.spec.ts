import { MockContract, smock } from "@defi-wonderland/smock";
import { constants } from "buffer";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ContractTransaction, Signer } from "ethers";
import hre, { ethers } from "hardhat";
import {Account, WomStakingProxy} from "types";
import {
    deployTestFirstStage,
    getMockDistro,
    getMockMultisigs
} from "../../scripts/deployMocks";
import {
    deploy,
    updateDistributionByTokens
} from "../../scripts/deploySystem";
import { deployContract } from "../../tasks/utils";
import {
    BN,
    DEAD_ADDRESS,
    getTimestamp,
    increaseTime,
    ONE_DAY,
    ONE_WEEK,
    ONE_YEAR,
    simpleToExactAmount,
    ZERO,
    ZERO_ADDRESS,
} from "../../test-utils";
import { impersonateAccount } from "../../test-utils/fork";
import {
    WmxLocker,
    Wmx,
    BaseRewardPool,
    Booster,
    WomDepositor,
    CvxCrvToken,
    MockWmxLocker,
    MockWmxLocker__factory,
    MockERC20,
    MockERC20__factory,
    WmxLocker__factory,
} from "../../types/generated";
interface UserLock {
    amount: BN;
    unlockTime: number;
}
interface SnapshotData {
    account: {
        auraLockerBalance: BN;
        balances: { locked: BN; nextUnlockIndex: number };
        cvxBalance: BN;
        claimableRewards: Array<{ token: string; amount: BN }>;
        delegatee: string;
        locks: UserLock[];
        votes: BN;
    };
    delegatee: {
        checkpointedVotes: Array<{ votes: BN; epochStart: number }>;
        unlocks: BN[];
        votes: BN;
    };
    cvxBalance: BN;
    lockedSupply: BN;
    totalSupply: BN;
    epochs: Array<{ supply: BN; date: number }>;
}


chai.should();
chai.use(smock.matchers);
chai.use(chaiAsPromised);


const IERC20 = new ethers.utils.Interface([
    "function safeTransfer(address token, address to, uint256 value) external returns(bool)",
    "function safeTransferFrom(address, address from, address to, uint256 value) external returns(bool)",
    "function safeApprove(address, address spender, uint256 value) external returns(bool)",
    "function safeIncreaseAllowance(address, address spender, uint256 value) external returns(bool)",
    "function safeDecreaseAllowance(address, address spender, uint256 value) external returns(bool)",
    "function totalSupply() external view returns (uint256)",
    "function transfer(address recipient, uint256 amount) external returns (bool)",
    "function mint(address recipient, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function lock(address recipient, uint256 amount) external returns (bool)",
    "function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)",
]);

describe("WmxLocker", () => {
    let accounts: Signer[];
    let wmxLocker: WmxLocker;
    let wmxLockerMock: MockContract<WmxLocker>;
    let cvxStakingProxy: WomStakingProxy;
    let cvxCrvRewards: BaseRewardPool;
    let booster: Booster;
    let wmx: Wmx;
    let wmxWom: CvxCrvToken;
    let crvDepositor: WomDepositor;
    let mocks;

    let deployer: Signer;

    let alice: Signer;
    let aliceInitialBalance: BN;
    let aliceAddress: string;
    let bob: Signer;
    let bobAddress: string;

    const boosterPoolId = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const logSnapShot = (data: SnapshotData, phase: string): SnapshotData => data;
    const getSnapShot = async (accountAddress: string, phase: string = "before"): Promise<SnapshotData> => {
        const delegateeAddress = await wmxLocker.delegates(accountAddress);
        const locks = await getUserLocks(accountAddress, delegateeAddress);
        const checkpointedVotes = await getCheckpointedVotes(delegateeAddress);
        return logSnapShot(
            {
                account: {
                    balances: await wmxLocker.balances(accountAddress),
                    auraLockerBalance: await wmxLocker.balanceOf(accountAddress),
                    cvxBalance: await wmx.balanceOf(accountAddress),
                    delegatee: delegateeAddress,
                    // rewardData,
                    claimableRewards: await wmxLocker.claimableRewards(accountAddress),
                    votes: await wmxLocker.getVotes(accountAddress),
                    locks: locks.userLocks,
                },
                delegatee: {
                    unlocks: locks.delegateeUnlocks,
                    votes: await wmxLocker.getVotes(delegateeAddress),
                    checkpointedVotes,
                },
                lockedSupply: await wmxLocker.lockedSupply(),
                totalSupply: await wmxLocker.totalSupply(),
                cvxBalance: await wmx.balanceOf(wmxLocker.address),
                epochs: await getEpochs(),
            },
            phase,
        );
    };
    const getEpochs = async (): Promise<Array<{ supply: BN; date: number }>> => {
        const epochs = [];
        try {
            for (let i = 0; i < 128; i++) epochs.push(await wmxLocker.epochs(i));
        } catch (error) {
            // do nothing
        }
        return epochs;
    };
    const getUserLocks = async (
        userAddress: string,
        delegateeAddress: string,
    ): Promise<{ userLocks: Array<UserLock>; delegateeUnlocks: Array<BN> }> => {
        const userLocks: Array<UserLock> = [];
        const delegateeUnlocks: Array<BN> = [];
        try {
            for (let i = 0; i < 128; i++) {
                const lock = await wmxLocker.userLocks(userAddress, i);
                userLocks.push(lock);
                if (delegateeAddress !== ZERO_ADDRESS) {
                    delegateeUnlocks.push(await wmxLocker.delegateeUnlocks(delegateeAddress, lock.unlockTime));
                }
            }
        } catch (error) {
            // do nothing
        }
        return { userLocks, delegateeUnlocks };
    };
    const getCheckpointedVotes = async (
        delegateeAddress: string,
    ): Promise<Array<{ votes: BN; epochStart: number }>> => {
        const checkpointedVotes: Array<{ votes: BN; epochStart: number }> = [];
        try {
            const len = await wmxLocker.numCheckpoints(delegateeAddress);
            for (let i = 0; i < len; i++) checkpointedVotes.push(await wmxLocker.checkpoints(delegateeAddress, i));
        } catch (error) {
            // do nothing
        }
        return checkpointedVotes;
    };
    const getCurrentEpoch = async (timeStamp?: BN) => {
        if (!timeStamp) {
            timeStamp = await getTimestamp();
        }
        const rewardsDuration = await wmxLocker.rewardsDuration();
        return timeStamp.div(rewardsDuration).mul(rewardsDuration);
    };
    // ============================================================
    const verifyCheckpointDelegate = async (
        tx: ContractTransaction,
        dataBefore: SnapshotData,
        dataAfter: SnapshotData,
    ) => {
        await expect(tx).emit(wmxLocker, "DelegateCheckpointed").withArgs(dataAfter.account.delegatee);
    };

    const verifyLock = async (
        tx: ContractTransaction,
        cvxAmount: BN,
        dataBefore: SnapshotData,
        dataAfter: SnapshotData,
    ) => {
        await expect(tx)
            .emit(wmxLocker, "Staked")
            .withArgs(aliceAddress, simpleToExactAmount(10), simpleToExactAmount(10));
        expect(dataAfter.cvxBalance, "Staked CVX").to.equal(dataBefore.cvxBalance.add(cvxAmount));
        expect(dataAfter.lockedSupply, "Staked lockedSupply ").to.equal(dataBefore.lockedSupply.add(cvxAmount));
        expect(dataAfter.account.cvxBalance, "wmx balance").to.equal(dataBefore.account.cvxBalance.sub(cvxAmount));
        expect(dataAfter.account.balances.locked, "user wmx balances locked").to.equal(
            dataBefore.account.balances.locked.add(cvxAmount),
        );
        expect(dataAfter.account.balances.nextUnlockIndex, "user balances nextUnlockIndex").to.equal(
            dataBefore.account.balances.nextUnlockIndex,
        );

        const currentEpoch = await getCurrentEpoch();
        const lock = dataAfter.account.locks[dataAfter.account.locks.length - 1];
        const lockDuration = await wmxLocker.lockDuration();
        const unlockTime = lockDuration.add(currentEpoch);
        expect(lock.amount, "user locked amount").to.equal(cvxAmount);
        expect(lock.unlockTime, "user unlockTime").to.equal(unlockTime);

        expect(dataAfter.account.delegatee, "user delegatee does not change").to.equal(dataBefore.account.delegatee);
        if (dataAfter.account.delegatee !== ZERO_ADDRESS) {
            const delegateeUnlocks = await wmxLocker.delegateeUnlocks(dataAfter.account.delegatee, unlockTime);
            expect(delegateeUnlocks, "user unlockTime").to.equal(cvxAmount);
        }
    };

    const setup = async (addMultiRewarder = true) => {
        mocks = await deployTestFirstStage(hre, deployer, addMultiRewarder);
        const multisigs = await getMockMultisigs(accounts[5], accounts[6], accounts[7]);
        const distro = getMockDistro();

        const contracts = await deploy(hre, deployer, accounts[7], mocks, distro, multisigs, mocks.namingConfig, mocks);
        await updateDistributionByTokens(accounts[7], contracts);

        alice = accounts[1];
        aliceAddress = await alice.getAddress();
        bob = accounts[2];
        bobAddress = await bob.getAddress();

        booster = contracts.booster;
        wmxLocker = contracts.cvxLocker;
        cvxStakingProxy = contracts.cvxStakingProxy;
        cvxCrvRewards = contracts.cvxCrvRewards;
        wmx = contracts.cvx;
        wmxWom = contracts.cvxCrv;
        crvDepositor = contracts.crvDepositor;

        const operatorAccount = await impersonateAccount(booster.address);
        let tx = await wmx
            .connect(operatorAccount.signer)
            .mint(operatorAccount.address, simpleToExactAmount(100000, 18));
        await tx.wait();

        tx = await wmx.connect(operatorAccount.signer).transfer(aliceAddress, simpleToExactAmount(200));
        await tx.wait();
        aliceInitialBalance = simpleToExactAmount(200);

        tx = await wmx.connect(operatorAccount.signer).transfer(bobAddress, simpleToExactAmount(100));
        await tx.wait();
    };
    async function distributeRewardsFromBooster(): Promise<BN> {
        const tx = await (await booster.earmarkRewards(boosterPoolId)).wait(1);
        await increaseTime(ONE_DAY);
        const log = tx.events.find(e => e.address.toLowerCase() === cvxStakingProxy.address.toLowerCase());
        const args = cvxStakingProxy.interface.decodeEventLog('RewardsDistributed', log.data, log.topics);
        return args[1];
    }
    before(async () => {
        await hre.network.provider.send("hardhat_reset");
        accounts = await ethers.getSigners();
        deployer = accounts[0];

        await setup();
    });

    describe("Operation without exceptions: ", async () => {
        it("#constructor - checks all initial config", async () => {
            expect(await wmxLocker.name(), "WmxLocker name").to.equal(mocks.namingConfig.vlCvxName);
            expect(await wmxLocker.symbol(), "WmxLocker symbol").to.equal(mocks.namingConfig.vlCvxSymbol);
            // hardcoded on smart contract.
            expect(await wmxLocker.decimals(), "WmxLocker decimals").to.equal(18);
            expect(await wmxLocker.stakingToken(), "WmxLocker staking token").to.equal(wmx.address);
            expect(await wmxLocker.wmxWom(), "WmxLocker wmxWom").to.equal(wmxWom.address);
            expect(await wmxLocker.wmxWomStaking(), "WmxLocker cvxCrvStaking").to.equal(cvxCrvRewards.address);
            expect(await wmxLocker.epochCount(), "WmxLocker epoch counts").to.equal(1);
            expect(await wmxLocker.queuedRewards(wmxWom.address), "WmxLocker lockDuration").to.equal(0);
            expect(await wmxLocker.rewardPerToken(wmxWom.address), "WmxLocker rewardPerToken").to.equal(0);
            expect(await wmxLocker.lastTimeRewardApplicable(wmxWom.address), "wmxWom lastTimeRewardApplicable").to.gt(0);
            // expect(await wmxLocker.rewardTokens(0),"WmxLocker lockDuration").to.equal( 86400 * 7 * 17);
            // constants
            expect(await wmxLocker.newRewardRatio(), "WmxLocker newRewardRatio").to.equal(830);
            expect(await wmxLocker.rewardsDuration(), "WmxLocker rewardsDuration").to.equal(86400 * 7);
            expect(await wmxLocker.lockDuration(), "WmxLocker lockDuration").to.equal(86400 * 7 * 17);
        });
        it("#lock, #userLocks, #lockDuration, #delegateeUnlocks - lock CVX", async () => {
            const count = await wmxLocker.rewardTokensLen();
            console.log("count: ", count);
            const cvxAmount = simpleToExactAmount(100);
            let tx = await wmx.connect(alice).approve(wmxLocker.address, cvxAmount);
            await tx.wait();
            const dataBefore = await getSnapShot(aliceAddress);
            tx = await wmxLocker.connect(alice).lock(aliceAddress, cvxAmount);

            await expect(tx).emit(wmxLocker, "Staked").withArgs(aliceAddress, cvxAmount, cvxAmount);
            const dataAfter = await getSnapShot(aliceAddress);

            const lockResp = await tx.wait();
            const lockBlock = await ethers.provider.getBlock(lockResp.blockNumber);
            const lockTimestamp = ethers.BigNumber.from(lockBlock.timestamp);

            expect(dataAfter.cvxBalance, "Staked CVX").to.equal(dataBefore.cvxBalance.add(cvxAmount));
            expect(dataAfter.lockedSupply, "Staked lockedSupply ").to.equal(dataBefore.lockedSupply.add(cvxAmount));
            expect(dataAfter.account.cvxBalance, "wmx balance").to.equal(dataBefore.account.cvxBalance.sub(cvxAmount));

            expect(dataAfter.account.balances.locked, "user wmx balances locked").to.equal(
                dataBefore.account.balances.locked.add(cvxAmount),
            );
            expect(dataAfter.account.balances.nextUnlockIndex, "user balances nextUnlockIndex").to.equal(
                dataBefore.account.balances.nextUnlockIndex,
            );

            const currentEpoch = await getCurrentEpoch(lockTimestamp);
            const lock = await wmxLocker.userLocks(aliceAddress, 0);
            const lockDuration = await wmxLocker.lockDuration();

            const unlockTime = lockDuration.add(currentEpoch);
            expect(lock.amount, "user locked amount").to.equal(cvxAmount);
            expect(lock.unlockTime, "user unlockTime").to.equal(unlockTime);

            expect(dataAfter.account.delegatee, "user delegatee does not change").to.equal(
                dataBefore.account.delegatee,
            );
            if (dataAfter.account.delegatee !== ZERO_ADDRESS) {
                const delegateeUnlocks = await wmxLocker.delegateeUnlocks(dataAfter.account.delegatee, unlockTime);
                expect(delegateeUnlocks, "user unlockTime").to.equal(cvxAmount);
            }
            // If the last epoch date is before the current epoch, the epoch index should not be updated.
            const lenA = dataAfter.epochs.length;
            const lenB = dataBefore.epochs.length;
            expect(dataAfter.epochs[lenA - 1].supply, "epoch date does not change").to.equal(
                dataBefore.epochs[lenB - 1].supply.add(cvxAmount),
            );
            expect(dataAfter.epochs[lenA - 1].date, "epoch date does not change").to.equal(
                dataBefore.epochs[lenB - 1].date,
            );

        });
        it("#delegate - supports delegation", async () => {
            const dataBefore = await getSnapShot(aliceAddress);

            const tx = await wmxLocker.connect(alice).delegate(bobAddress);
            await expect(tx).emit(wmxLocker, "DelegateChanged").withArgs(aliceAddress, ZERO_ADDRESS, bobAddress);

            const dataAfter = await getSnapShot(aliceAddress);

            expect(dataBefore.account.delegatee).eq(ZERO_ADDRESS);
            expect(dataBefore.account.auraLockerBalance).eq(dataAfter.account.auraLockerBalance);
            expect(dataBefore.account.votes).eq(0);
            expect(dataBefore.delegatee.votes).eq(0);
            expect(dataBefore.delegatee.unlocks.length, "delegatee unlocks").eq(0);

            expect(dataAfter.account.delegatee).eq(bobAddress);
            expect(dataAfter.account.votes).eq(0);
            expect(dataAfter.delegatee.votes).eq(0);

            await verifyCheckpointDelegate(tx, dataBefore, dataAfter);
        });
        it("#checkpointEpoch, #balanceAtEpochOf - checkpoint CVX locker epoch", async () => {
            const amount = ethers.utils.parseEther("1000");
            let tx = await mocks.lptoken.transfer(bobAddress, amount);
            await tx.wait();
            tx = await mocks.lptoken.connect(bob).approve(booster.address, amount);
            await tx.wait();

            tx = await booster.connect(bob).deposit(0, amount, true);
            await tx.wait();

            await increaseTime(ONE_DAY.mul(14));

            await booster.earmarkRewards(boosterPoolId);

            await wmxLocker.checkpointEpoch();

            await increaseTime(ONE_DAY.mul(14));

            const dataBefore = await getSnapShot(aliceAddress);
            tx = await wmxLocker.checkpointEpoch();
            await tx.wait();
            const dataAfter = await getSnapShot(aliceAddress);

            expect(dataAfter.epochs.length, "new epochs added").to.equal(dataBefore.epochs.length + 2);

            const vlCVXBalance = await wmxLocker.balanceAtEpochOf(0, aliceAddress);
            expect(vlCVXBalance, "vlCVXBalance at epoch is correct").to.equal(0);
            expect(
                await wmxLocker.balanceAtEpochOf(dataAfter.epochs.length - 1, aliceAddress),
                "vlCVXBalance at epoch is correct",
            ).to.equal(simpleToExactAmount(100));
        });
        it("#addReward, #approveRewardDistributor, #queueNewRewards - notify rewards ", async () => {
            let count = await wmxLocker.rewardTokensLen();
            console.log("count: ", count);
            const amount = simpleToExactAmount(100);
            const mockToken = await deployContract<MockERC20>(
                hre,
                new MockERC20__factory(deployer),
                "mockToken",
                ["mockToken", "mockToken", 18, await deployer.getAddress(), simpleToExactAmount(1000000)],
                {},
                false,
            );
            const distributor = accounts[3];
            const distributorAddress = await distributor.getAddress();

            await mockToken.connect(deployer).approve(distributorAddress, amount);
            await mockToken.connect(deployer).transfer(distributorAddress, amount);
            await mockToken.connect(distributor).approve(wmxLocker.address, amount);

            await wmxLocker.connect(accounts[7]).addReward(mockToken.address, distributorAddress);
            await wmxLocker.connect(accounts[7]).approveRewardDistributor(mockToken.address, distributorAddress, true);
            count = await wmxLocker.rewardTokensLen();
            console.log("count: ", count);
            const tx = await wmxLocker.connect(distributor).queueNewRewards(mockToken.address, amount);
            await expect(tx).to.emit(wmxLocker, "RewardAdded").withArgs(mockToken.address, amount);
            expect(await mockToken.balanceOf(wmxLocker.address)).to.equal(amount);
            
        });
        it("#rewardPerToken, #rewardTokensLen, #getReward, #rewardTokens - get rewards from CVX locker", async () => {
            await increaseTime(ONE_DAY.mul(105));
            const cvxCrvBefore = await wmxWom.balanceOf(aliceAddress);
            const dataBefore = await getSnapShot(aliceAddress);

            const count = await wmxLocker.rewardTokensLen();
            console.log("count: ", count);
            console.log('await wmxLocker.rewardData(wmxWom.address)', await wmxLocker.rewardData(wmxWom.address));
            console.log('dataBefore.account.claimableRewards[0].amount', dataBefore.account.claimableRewards[0].amount);
            expect(await wmxLocker.rewardPerToken(wmxWom.address), "rewardPerToken").to.equal(
                dataBefore.account.claimableRewards[0].amount.div(100),
            );
            expect(await wmxLocker.rewardTokensLen(), "rewardPerToken").to.equal(3);

            const tx = await wmxLocker["getReward(address,bool[])"](aliceAddress, [false, false, false]);
            const dataAfter = await getSnapShot(aliceAddress);

            await tx.wait();
            const cvxCrvAfter = await wmxWom.balanceOf(aliceAddress);
            const cvxCrvBalance = cvxCrvAfter.sub(cvxCrvBefore);
            expect(cvxCrvBalance.gt("0")).to.equal(true);
            expect(cvxCrvBalance).to.equal(dataBefore.account.claimableRewards[0].amount);
            expect(dataAfter.account.claimableRewards[0].amount).to.equal(0);
            await expect(tx)
                .emit(wmxLocker, "RewardPaid")
                .withArgs(aliceAddress, await wmxLocker.rewardTokens(0), cvxCrvBalance);
        });
        it("#processExpiredLocks - process expired locks", async () => {
            const relock = false;
            const dataBefore = await getSnapShot(aliceAddress);
            const tx = await wmxLocker.connect(alice).processExpiredLocks(relock);
            await tx.wait();
            const dataAfter = await getSnapShot(aliceAddress);
            const balance = await wmx.balanceOf(aliceAddress);

            expect(dataAfter.account.balances.locked, "user wmx balances locked decreases").to.equal(0);
            expect(dataAfter.lockedSupply, "lockedSupply decreases").to.equal(
                dataBefore.lockedSupply.sub(dataBefore.account.balances.locked),
            );
            expect(balance).to.equal(aliceInitialBalance);
            await verifyCheckpointDelegate(tx, dataBefore, dataAfter);
            await expect(tx)
                .emit(wmxLocker, "Withdrawn")
                .withArgs(aliceAddress, dataBefore.account.balances.locked, relock);
        });
        it("#setKickIncentive - set Kick Incentive", async () => {
            await expect(wmxLocker.connect(accounts[7]).setKickIncentive(100, 3))
                .emit(wmxLocker, "KickIncentiveSet")
                .withArgs(100, 3);
            expect(await wmxLocker.kickRewardPerEpoch()).to.eq(100);
            expect(await wmxLocker.kickRewardEpochDelay()).to.eq(3);
        });
        it("#recoverERC20 - recover ERC20", async () => {
            const mockToken = await deployContract<MockERC20>(
                hre,
                new MockERC20__factory(deployer),
                "mockToken",
                ["mockToken", "mockToken", 18, await deployer.getAddress(), 10000000],
                {},
                false,
            );

            await mockToken.connect(deployer).approve(wmxLocker.address, simpleToExactAmount(100));
            await mockToken.connect(deployer).transfer(wmxLocker.address, simpleToExactAmount(10));

            const mockDeployerBalanceBefore = await mockToken.balanceOf(await accounts[7].getAddress());
            const mockLockerBalanceBefore = await mockToken.balanceOf(wmxLocker.address);
            expect(mockLockerBalanceBefore, "locker external lp reward").to.eq(simpleToExactAmount(10));
            const tx = wmxLocker.connect(accounts[7]).recoverERC20(mockToken.address, simpleToExactAmount(10));
            await expect(tx).emit(wmxLocker, "Recovered").withArgs(mockToken.address, simpleToExactAmount(10));

            const mockDeployerBalanceAfter = await mockToken.balanceOf(await accounts[7].getAddress());
            const mockLockerBalanceAfter = await mockToken.balanceOf(wmxLocker.address);

            expect(mockLockerBalanceAfter, "locker external lp reward").to.eq(0);
            expect(mockDeployerBalanceAfter, "owner external lp reward").to.eq(
                mockDeployerBalanceBefore.add(simpleToExactAmount(10)),
            );
        });
        context("#modifyBlacklist", () => {
            let locker: MockWmxLocker;
            before(async () => {
                locker = await deployContract<MockWmxLocker>(
                    hre,
                    new MockWmxLocker__factory(deployer),
                    "Lockor",
                    [wmx.address, wmxLocker.address],
                    {},
                    false,
                );

                await wmx.connect(alice).approve(locker.address, simpleToExactAmount(1000));
                await wmx.connect(alice).approve(wmxLocker.address, simpleToExactAmount(1000));
            });
            it("allows blacklisting of contracts", async () => {
                //allows blacklisting of contracts
                const tx = await wmxLocker.connect(accounts[7]).modifyBlacklist(locker.address, true);
                await expect(tx).to.emit(wmxLocker, "BlacklistModified").withArgs(locker.address, true);
                expect(await wmxLocker.blacklist(locker.address)).eq(true);
            });
            it("doesn't allow blacklisting of EOA's", async () => {
                await expect(wmxLocker.connect(accounts[7]).modifyBlacklist(aliceAddress, true)).to.be.revertedWith(
                    "Must be contract",
                );
                expect(await wmxLocker.blacklist(aliceAddress)).eq(false);
            });
        });
        context("queueing new rewards", () => {
            async function mockDepositCVRToStakeContract(amount: number) {
                const crvDepositorAccount = await impersonateAccount(crvDepositor.address);
                const cvxCrvConnected = await wmxWom.connect(crvDepositorAccount.signer);
                await cvxCrvConnected.mint(cvxStakingProxyAccount.address, simpleToExactAmount(amount));
                await cvxCrvConnected.approve(cvxStakingProxyAccount.address, simpleToExactAmount(amount));
            }
            // let dataBefore: SnapshotData;
            let cvxStakingProxyAccount: Account;
            // t = 0.5, Lock, delegate to self, wait 15 weeks (1.5 weeks before lockup)
            beforeEach(async () => {
                await setup(false);
                cvxStakingProxyAccount = await impersonateAccount(cvxStakingProxy.address);
                // Given that cvxStakingProxyAccount holds wmxWom (fake balance on staking proxy)
                await mockDepositCVRToStakeContract(1000);
    
                await wmx.connect(alice).approve(wmxLocker.address, simpleToExactAmount(1000));
    
                const amount = ethers.utils.parseEther("1000");
                let tx = await mocks.lptoken.transfer(bobAddress, amount);
                await tx.wait();
                tx = await mocks.lptoken.connect(bob).approve(booster.address, amount);
                await tx.wait();
    
                tx = await booster.connect(bob).deposit(0, amount, true);
                await tx.wait();
            });
            it("distribute rewards from the booster", async () => {
                await wmxLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(100));
                expect(await wmxLocker.epochCount(), "epochCount").to.eq(1);
                await distributeRewardsFromBooster();
                expect(await wmxLocker.epochCount(), "epochCount").to.eq(1);
            });
            it("queues rewards when wmxWom period is finished", async () => {
                await wmxLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(100));
                expect(await wmxLocker.epochCount(), "epochCount").to.eq(1);
                // AuraStakingProxy["distribute()"](), faked by impersonating account
                let rewards = simpleToExactAmount(100);
                const rewardDistribution = await wmxLocker.rewardsDuration();
                const cvxCrvLockerBalance0 = await wmxWom.balanceOf(wmxLocker.address);
                const queuedCvxCrvRewards0 = await wmxLocker.queuedRewards(wmxWom.address);
                const rewardData0 = await wmxLocker.rewardData(wmxWom.address);
                const timeStamp = await getTimestamp();
    
                expect(timeStamp, "reward period finish").to.gte(rewardData0.periodFinish);
                expect(await wmxWom.balanceOf(cvxStakingProxyAccount.address)).to.gt(rewards);
    
                //  test queuing rewards
                // await wmxLocker.connect(cvxStakingProxyAccount.signer).queueNewRewards(rewards);
                rewards = await distributeRewardsFromBooster();
                // Validate
                const rewardData1 = await wmxLocker.rewardData(wmxWom.address);
                expect(await wmxWom.balanceOf(wmxLocker.address), "wmxWom is transfer to locker").to.eq(
                    cvxCrvLockerBalance0.add(rewards),
                );
                expect(await wmxLocker.queuedRewards(wmxWom.address), "queued wmxWom rewards").to.eq(0);
    
                // Verify reward data is updated, reward rate, lastUpdateTime, periodFinish; when the lastUpdateTime is lt than now.
                expect(rewardData1.lastUpdateTime, "wmxWom reward last update time").to.gt(rewardData0.lastUpdateTime);
                expect(rewardData1.periodFinish, "wmxWom reward period finish").to.gt(rewardData0.periodFinish);
                expect(rewardData1.rewardPerTokenStored, "wmxWom reward per token stored").to.eq(
                    rewardData0.rewardPerTokenStored,
                );
                expect(rewardData1.rewardRate, "wmxWom rewards rate").to.eq(
                    queuedCvxCrvRewards0.add(rewards).div(rewardDistribution),
                );
            });
    
            it("only starts distributing the rewards when the queued amount is over 83% of the remaining", async () => {
                await wmxLocker.connect(alice).lock(aliceAddress, simpleToExactAmount(100));
                const cvxCrvLockerBalance0 = await wmxWom.balanceOf(wmxLocker.address);
                const rewardData0 = await wmxLocker.rewardData(wmxWom.address);
                const timeStamp = await getTimestamp();
    
                expect(timeStamp, "reward period finish").to.gte(rewardData0.periodFinish);
                expect(await wmxWom.balanceOf(cvxStakingProxyAccount.address)).to.gt(0);
    
                // cvxStakingProxy["distribute()"]();=>wmxLocker.queueNewRewards()
                // First distribution to update the reward finish period.
                let rewards = await distributeRewardsFromBooster();
                // Validate
                const cvxCrvLockerBalance1 = await wmxWom.balanceOf(wmxLocker.address);
                const queuedCvxCrvRewards1 = await wmxLocker.queuedRewards(wmxWom.address);
                const rewardData1 = await wmxLocker.rewardData(wmxWom.address);
    
                // Verify reward data is updated, reward rate, lastUpdateTime, periodFinish; when the lastUpdateTime is lt than now.
                expect(rewardData1.lastUpdateTime, "wmxWom reward last update time").to.gt(rewardData0.lastUpdateTime);
                expect(rewardData1.periodFinish, "wmxWom reward period finish").to.gt(rewardData0.periodFinish);
                expect(rewardData1.rewardPerTokenStored, "wmxWom reward per token stored").to.eq(
                    rewardData0.rewardPerTokenStored,
                );
                expect(rewardData1.rewardRate, "wmxWom rewards rate").to.gt(rewardData0.rewardRate);
                expect(cvxCrvLockerBalance1, "wmxWom is transfer to locker").to.eq(cvxCrvLockerBalance0.add(rewards));
                expect(queuedCvxCrvRewards1, "queued wmxWom rewards").to.eq(0);
    
                // Second distribution , without notification as the ratio is not reached.
                await increaseTime(ONE_DAY);
                console.log("\n\nwmxWom.address", wmxWom.address);
                rewards = await distributeRewardsFromBooster();
    
                const cvxCrvLockerBalance2 = await wmxWom.balanceOf(wmxLocker.address);
                const queuedCvxCrvRewards2 = await wmxLocker.queuedRewards(wmxWom.address);
                const rewardData2 = await wmxLocker.rewardData(wmxWom.address);
    
                // Verify reward data is not updated, as ratio is not reached.
                expect(rewardData2.lastUpdateTime, "wmxWom reward last update time").to.eq(rewardData1.lastUpdateTime);
                expect(rewardData2.periodFinish, "wmxWom reward period finish").to.eq(rewardData1.periodFinish);
                expect(rewardData2.rewardPerTokenStored, "wmxWom reward per token stored").to.eq(
                    rewardData1.rewardPerTokenStored,
                );
                expect(rewardData2.rewardRate, "wmxWom rewards rate").to.eq(rewardData1.rewardRate);
                expect(cvxCrvLockerBalance2, "wmxWom is transfer to locker").to.eq(cvxCrvLockerBalance1.add(rewards));
                expect(queuedCvxCrvRewards2, "queued wmxWom rewards").to.eq(queuedCvxCrvRewards1.add(rewards));
    
                // Third distribution the ratio is reached, the reward is distributed.
                await mockDepositCVRToStakeContract(1000);
                rewards = await distributeRewardsFromBooster();
    
                const cvxCrvLockerBalance3 = await wmxWom.balanceOf(wmxLocker.address);
                const queuedCvxCrvRewards3 = await wmxLocker.queuedRewards(wmxWom.address);
                const rewardData3 = await wmxLocker.rewardData(wmxWom.address);
    
                // Verify reward data is updated, reward rate, lastUpdateTime, periodFinish; when the lastUpdateTime is lt than now.
                expect(rewardData3.lastUpdateTime, "wmxWom reward last update time").to.gt(rewardData2.lastUpdateTime);
                expect(rewardData3.periodFinish, "wmxWom reward period finish").to.gt(rewardData2.periodFinish);
                expect(rewardData3.rewardPerTokenStored, "wmxWom reward per token stored").to.gt(
                    rewardData2.rewardPerTokenStored,
                );
                expect(rewardData3.rewardRate, "wmxWom rewards rate").to.gt(rewardData2.rewardRate);
                expect(cvxCrvLockerBalance3, "wmxWom is transfer to locker").to.eq(cvxCrvLockerBalance2.add(rewards));
                expect(queuedCvxCrvRewards3, "queued wmxWom rewards").to.eq(0);
    
                // Process expired locks and claim rewards for user.
                await increaseTime(ONE_WEEK.mul(17));
    
                await wmxLocker.connect(alice).processExpiredLocks(false);
                const userCvxCrvData = await wmxLocker.userData(aliceAddress, wmxWom.address);
                const cvxCrvAliceBalance3 = await wmxWom.balanceOf(aliceAddress);
    
                const tx = await wmxLocker["getReward(address)"](aliceAddress);
                await expect(tx)
                    .to.emit(wmxLocker, "RewardPaid")
                    .withArgs(aliceAddress, wmxWom.address, userCvxCrvData.rewards);
                const cvxCrvAliceBalance4 = await wmxWom.balanceOf(aliceAddress);
                const cvxCrvLockerBalance4 = await wmxWom.balanceOf(wmxLocker.address);
                expect(cvxCrvAliceBalance4, "wmxWom claimed").to.eq(cvxCrvAliceBalance3.add(userCvxCrvData.rewards));
                expect(cvxCrvLockerBalance4, "wmxWom sent").to.eq(cvxCrvLockerBalance3.sub(userCvxCrvData.rewards));
            });
        });
        it("#emergencyWithdraw - when user has locks", async () => {
            const cvxAmount = simpleToExactAmount(100);
            const relock = false;
            await wmx.connect(alice).approve(wmxLocker.address, cvxAmount);
            let tx = await wmxLocker.connect(alice).lock(aliceAddress, cvxAmount);
            // Given that the aura locker is shutdown
            await wmxLocker.connect(accounts[7]).shutdown();
            expect(await wmxLocker.isShutdown()).to.eq(true);
            // Then it should be able to withdraw in an emergency
            const dataBefore = await getSnapShot(aliceAddress);
            tx = await wmxLocker.connect(alice).emergencyWithdraw();
            expect(await wmxLocker.balanceOf(aliceAddress)).eq(0);
            const balance = await wmx.balanceOf(aliceAddress);

            expect(await wmxLocker.lockedSupply(), "lockedSupply decreases").to.equal(
                dataBefore.lockedSupply.sub(dataBefore.account.balances.locked),
            );
            expect(balance, "balance").to.equal(aliceInitialBalance);
            await expect(tx)
                .emit(wmxLocker, "Withdrawn")
                .withArgs(aliceAddress, dataBefore.account.balances.locked, relock);
        });
        it("#shotdown - shutdown the contract. unstake all tokens. release all locks", async () => {
            // Given that the wmx locker is shutdown
            await wmxLocker.connect(accounts[7]).shutdown();
            expect(await wmxLocker.isShutdown()).to.eq(true);
            // Then it should fail to lock
            const cvxAmount = simpleToExactAmount(100);
            await wmx.connect(alice).approve(wmxLocker.address, cvxAmount);
            const tx = wmxLocker.connect(alice).lock(aliceAddress, cvxAmount);
            await expect(tx).revertedWith("shutdown");
        });        
    });    
    describe("Exceptions: ", async () => {
        let locker: MockWmxLocker;
        beforeEach(async () => {
            await setup();
            locker = await deployContract<MockWmxLocker>(
                hre,
                new MockWmxLocker__factory(deployer),
                "Lockor",
                [wmx.address, wmxLocker.address],
                {},
                false,
            );

            await wmx.connect(alice).approve(locker.address, simpleToExactAmount(1000));
            await wmx.connect(alice).approve(wmxLocker.address, simpleToExactAmount(1000));
        });

        it("#modifyBlacklist - Owner can transfer the ownership", async () => {
            //The owner transfers the ownership.
            await wmxLocker.connect(accounts[7]).transferOwnership(DEAD_ADDRESS);
            //Then it should fail to modify blacklist
            const tx = wmxLocker.connect(accounts[7]).modifyBlacklist(locker.address, true);
            await expect(tx).to.be.revertedWith("Ownable: caller is not the owner");
        }); 
        
        it("#addReward - Owner can transfer the ownership", async () => {
            //The owner transfers the ownership.
            await wmxLocker.connect(accounts[7]).transferOwnership(DEAD_ADDRESS);
            //Then it should fail to add reward
            const tx = wmxLocker.connect(accounts[7]).addReward(locker.address, ZERO_ADDRESS);
            await expect(tx).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("#approveRewardDistributor - Owner can transfer the ownership", async () => {
            const mockToken = await deployContract<MockERC20>(
                hre,
                new MockERC20__factory(deployer),
                "mockToken",
                ["mockToken", "mockToken", 18, await deployer.getAddress(), simpleToExactAmount(1000000)],
                {},
                false,
            );
            const distributor = accounts[3];
            const distributorAddress = await distributor.getAddress();
            await wmxLocker.connect(accounts[7]).addReward(mockToken.address, distributorAddress);
            //The owner transfers the ownership.
            await wmxLocker.connect(accounts[7]).transferOwnership(DEAD_ADDRESS);
            //Then it should fail to approve `rewardDistributor`
            const tx = wmxLocker.connect(accounts[7]).approveRewardDistributor(mockToken.address, distributorAddress, true);
            await expect(tx).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("#setKickIncentive - Owner can transfer the ownership", async () => {
            //The owner transfers the ownership.
            await wmxLocker.connect(accounts[7]).transferOwnership(DEAD_ADDRESS);
            //Then it should fail to set kick incentive
            const tx = wmxLocker.connect(accounts[7]).setKickIncentive(100, 2);
            await expect(tx).to.be.revertedWith("Ownable: caller is not the owner");
        }); 
        it("#shutdown - Owner can transfer the ownership", async () => {
            //The owner transfers the ownership.
            await wmxLocker.connect(accounts[7]).transferOwnership(DEAD_ADDRESS);
            //Then it should fail to set kick incentive
            const tx = wmxLocker.connect(accounts[7]).shutdown();
            await expect(tx).to.be.revertedWith("Ownable: caller is not the owner");
        }); 
        it("#recoverERC20 - Owner can transfer the ownership", async () => {
            const mockToken = await deployContract<MockERC20>(
                hre,
                new MockERC20__factory(deployer),
                "mockToken",
                ["mockToken", "mockToken", 18, await deployer.getAddress(), 10000000],
                {},
                false,
            );

            await mockToken.connect(deployer).approve(wmxLocker.address, simpleToExactAmount(100));
            await mockToken.connect(deployer).transfer(wmxLocker.address, simpleToExactAmount(10));

            const mockLockerBalanceBefore = await mockToken.balanceOf(wmxLocker.address);
            expect(mockLockerBalanceBefore, "locker external lp reward").to.eq(simpleToExactAmount(10));

            //The owner transfers the ownership.
            await wmxLocker.connect(accounts[7]).transferOwnership(DEAD_ADDRESS);
            //Then it should fail to set kick incentive
            const tx = wmxLocker.connect(accounts[7]).recoverERC20(mockToken.address, simpleToExactAmount(10));
            await expect(tx).to.be.revertedWith("Ownable: caller is not the owner");
        }); 
        it("#lock - A malicious contract owner can shutdown the contract so that users can’t lock tokens.", async () => {
            // Given that the wmx locker is shutdown
            await wmxLocker.connect(accounts[7]).shutdown();
            expect(await wmxLocker.isShutdown()).to.eq(true);
            // Then it should fail to lock
            const cvxAmount = simpleToExactAmount(100);
            await wmx.connect(alice).approve(wmxLocker.address, cvxAmount);
            const tx = wmxLocker.connect(alice).lock(aliceAddress, cvxAmount);
            await expect(tx).revertedWith("shutdown");
        }); 
    });


    describe("", async () => {

        let IRewardStaking = new ethers.utils.Interface([
            "function stakeFor(address, uint256) external"
        ])

        let stakingToken, womWmx, wmxWomStaking, mockedWmxLocker, accounts;

        beforeEach(async () => {

            accounts = await ethers.getSigners();

            stakingToken = await smock.fake({interface: IERC20});
            womWmx = await smock.fake({interface: IERC20});
            wmxWomStaking = await smock.fake({interface: IRewardStaking})

            const WmxLocker = await smock.mock("WmxLocker");
            mockedWmxLocker = await WmxLocker.deploy(
                "Test token",
                "TTT",
                stakingToken.address,
                womWmx.address,
                wmxWomStaking.address
            )
        })

        it("kickExpiredLocks()", async () => {

            stakingToken.safeTransfer.returns();
            womWmx.safeTransfer.returns();

            await mockedWmxLocker.setVariable("isShutdown", true)
            await mockedWmxLocker.setVariable("lockedSupply", "10000000000")

            const unlockTime = await (await getTimestamp()).sub(ONE_WEEK);

            await mockedWmxLocker.setVariable("userLocks", {
                [accounts[2].address]: [{amount: 1000, unlockTime: "100000"}]
            })

            await mockedWmxLocker.setVariable("balances", {
                [accounts[2].address]: {locked: 1000, nextUnlockIndex: 1}
            });

            await expect(mockedWmxLocker.kickExpiredLocks(accounts[2].address)).to.be.reverted;
        });

        it("kickExpiredLocks()", async () => {
            stakingToken.safeTransfer.returns();
            womWmx.safeTransfer.returns(true);

            
            const unlockTime = await (await getTimestamp()).add(ONE_DAY);

            await mockedWmxLocker.setVariable("userLocks", {
                [accounts[2].address]: [{amount: 1000, unlockTime: unlockTime}]
            })

            await mockedWmxLocker.setVariable("balances", {
                [accounts[2].address]: {locked: 1000, nextUnlockIndex: 0}
            })

            await expect(mockedWmxLocker.kickExpiredLocks(accounts[2].address)).to.be.revertedWith("no exp locks")
        });

        it("processExpiredLocks()", async () => {

            const unlockTime = await (await getTimestamp()).add(ONE_DAY);

            await mockedWmxLocker.setVariable("userLocks", {
                [accounts[2].address]: [{amount: 1000, unlockTime: unlockTime}]
            })

            await mockedWmxLocker.setVariable("lockedSupply", "10000000000")

            await mockedWmxLocker.setVariable("balances", {
                [accounts[2].address]: {locked: 1000, nextUnlockIndex: 0}
            })

            await expect(mockedWmxLocker.connect(accounts[2]).processExpiredLocks(false)).to.be.revertedWith("no exp locks")
        })


        it("processExpiredLocks()", async () => {
            stakingToken.safeTransfer.returns();
            womWmx.safeTransfer.returns(true);


            await mockedWmxLocker.setVariable("isShutdown", true)
            const unlockTime = await (await getTimestamp()).add(ONE_DAY);

            await mockedWmxLocker.setVariable("userLocks", {
                [accounts[2].address]: [{amount: 1000, unlockTime: unlockTime}]
            })

            await mockedWmxLocker.setVariable("lockedSupply", "10000000000")

            await mockedWmxLocker.setVariable("balances", {
                [accounts[2].address]: {locked: 1000, nextUnlockIndex: 0}
            })

            await expect(
                mockedWmxLocker.connect(accounts[2]).processExpiredLocks(false)).to.be.reverted;
            
        });


        // it("processExpiredLocks", async () => {
        //     // stakingToken.safeTransfer.returns();
        //     // womWmx.safeTransfer.returns(true);


        //     // await mockedWmxLocker.setVariable("isShutdown", false)
        //     const unlockTime = await (await getTimestamp()).add(ONE_YEAR);

        //     await mockedWmxLocker.setVariable("userLocks", {
        //         [accounts[2].address]: [{amount: 1000, unlockTime: unlockTime}]
        //     })

        //     await mockedWmxLocker.setVariable("lockedSupply", "10000000000")

        //     await mockedWmxLocker.setVariable("balances", {
        //         [accounts[2].address]: {locked: 1000, nextUnlockIndex: 0}
        //     })

        //     await mockedWmxLocker.connect(accounts[2]).kickExpiredLocks(accounts[2].address);
        // });

        it("processExpiredLocks()", async () => {

            stakingToken.safeTransfer.returns();
            womWmx.safeTransfer.returns(true);

            // await mockedWmxLocker.setVariable("isShutdown", true)
            const unlockTime = await (await getTimestamp()).add(ONE_DAY);

            await mockedWmxLocker.setVariable("userLocks", {
                [accounts[2].address]: [{amount: 1000, unlockTime: unlockTime}]
            })

            await mockedWmxLocker.setVariable("lockedSupply", "10000000000")

            await mockedWmxLocker.setVariable("balances", {
                [accounts[2].address]: {locked: 1000, nextUnlockIndex: 0}
            })

            await mockedWmxLocker.connect(accounts[2]).processExpiredLocks(true)
            
        });


        it("processExpiredLocks()", async () => {

            stakingToken.safeTransfer.returns();
            womWmx.safeTransfer.returns(true);

            // await mockedWmxLocker.setVariable("isShutdown", true)
            const unlockTime = await (await getTimestamp()).add(ONE_DAY);

            await mockedWmxLocker.setVariable("userLocks", {
                [accounts[2].address]: [{amount: 1000, unlockTime: unlockTime}]
            })

            await mockedWmxLocker.setVariable("lockedSupply", "10000000000")

            await mockedWmxLocker.setVariable("balances", {
                [accounts[2].address]: {locked: 1000, nextUnlockIndex: 0}
            })

            await expect(
                mockedWmxLocker.connect(accounts[2]).kickExpiredLocks(accounts[2].address)
            ).to.be.revertedWith('no exp locks')
        });
        

        describe("userLocksLen()", async () => {
            it("userLocksLen", async () => {
                
                const unlockTime = await (await getTimestamp()).add(ONE_DAY);
    
                await mockedWmxLocker.setVariable("userLocks", {
                    [accounts[2].address]: [{amount: 1000, unlockTime: unlockTime}]
                })
    
    
                let locksLen = await mockedWmxLocker.userLocksLen(accounts[2].address);

                console.log(locksLen);
            });

            it("rewardTokensList()", async () => {
                
                const unlockTime = await (await getTimestamp()).add(ONE_DAY);
    
                await mockedWmxLocker.setVariable("userLocks", {
                    [accounts[2].address]: [{amount: 1000, unlockTime: unlockTime}]
                })
    
    
                let rewardTokensList = await mockedWmxLocker.rewardTokensList();

                console.log(rewardTokensList);
            });

            it("getPastTotalSupply()", async () => {
                
                const unlockTime = await (await getTimestamp()).sub(ONE_DAY);
    
                await mockedWmxLocker.setVariable("userLocks", {
                    [accounts[2].address]: [{amount: 1000, unlockTime: unlockTime}]
                })
    
    
                let totalSupply = await mockedWmxLocker.getPastTotalSupply(unlockTime);

                console.log(totalSupply);
            });

            
        });

        describe("lockedBalances()", async () => {
            it("lockedBalances", async () => {
                
                const unlockTime = await (await getTimestamp()).add(ONE_DAY);
    
                await mockedWmxLocker.setVariable("userLocks", {
                    [accounts[2].address]: [{amount: 1000, unlockTime: unlockTime}]
                })
                
                const lockedBal = await mockedWmxLocker.lockedBalances(accounts[2].address);
                console.log(lockedBal)
            });
        })


        describe("delegate()", async () => {
            it("delegate", async () => {
                
                // let testToken = await smock.fake({interface: IERC20});
                await expect(mockedWmxLocker.delegate(accounts[3].address)).to.be.revertedWith("Nothing to delegate");

                const unlockTime = await (await getTimestamp()).add(ONE_DAY);

                await mockedWmxLocker.setVariable("userLocks", {
                    [accounts[2].address]: [{amount: 1000, unlockTime: unlockTime}]
                });

                await expect(
                    mockedWmxLocker.connect(accounts[2]).delegate(ethers.constants.AddressZero)
                ).to.be.revertedWith("Must delegate to someone");


                await mockedWmxLocker.setVariable("_delegates", {
                   [ accounts[2].address]: accounts[3].address
                } )
                await expect(
                    mockedWmxLocker.connect(accounts[2]).delegate(accounts[3].address)
                ).to.be.revertedWith("Must choose new delegatee");

            });
        })

        // describe("getPastVotes()", async () => {
        //     it.only("getPastVotes", async () => {
                
        //         const unlockTime = await (await getTimestamp()).sub(ONE_WEEK);

        //         await expect(
        //             mockedWmxLocker.getPastVotes(accounts[2].address, unlockTime)
        //         ).to.be.revertedWith("ERC20Votes: block not yet mined");
                
        //     });

        // });

        describe("getPastVotes()", async () => {
            it("getPastVotes", async () => {
                
                const unlockTime = await getTimestamp();
                let t = unlockTime.add(ONE_WEEK)

                await expect(
                    mockedWmxLocker.getPastVotes(accounts[1].address,t)
                ).to.be.revertedWith("ERC20Votes: block not yet mined");
                
            });
        });

        describe("addReward()", async () => {
            it("addReward", async () => {
                
                const rewardToken = await smock.fake({interface: IERC20});

                await mockedWmxLocker.setVariable("rewardData", {
                    [rewardToken.address]: {
                        periodFinish: 1000000,
                        lastUpdateTime:1000000 ,
                        rewardRate: 10,
                        rewardPerTokenStored: 10
                    }
                })

                await expect(
                     mockedWmxLocker.addReward(rewardToken.address, accounts[1].address)
                ).to.be.revertedWith("Reward already exists");

                // Erequire(_rewardsToken != address(stakingToken), "Cannot add StakingToken as reward");

                await mockedWmxLocker.setVariable("rewardData", {
                    [rewardToken.address]: {
                        periodFinish: 1000000,
                        lastUpdateTime:0 ,
                        rewardRate: 10,
                        rewardPerTokenStored: 10
                    }
                })

                await expect(
                    mockedWmxLocker.addReward(stakingToken.address, accounts[1].address)
               ).to.be.revertedWith("Cannot add StakingToken as reward");
                
            });
        });


        describe("queueNewRewards()", async () => {
            it("queueNewRewards", async () => {
                
                const rewardToken = await smock.fake({interface: IERC20});

                await expect(
                     mockedWmxLocker.queueNewRewards(rewardToken.address,1000)
                ).to.be.revertedWith("!authorized");

                await mockedWmxLocker.setVariable("rewardDistributors", {
                    [rewardToken.address]: {
                        [accounts[0].address]: true
                    }
                })

                await expect(
                    mockedWmxLocker.queueNewRewards(rewardToken.address,0)
               ).to.be.revertedWith("No reward");

            });
        });


        describe("emergencyWithdraw()", async () => {
            it("emergencyWithdraw", async () => {
                
                const rewardToken = await smock.fake({interface: IERC20});


                await expect(
                    mockedWmxLocker.emergencyWithdraw()
               ).to.be.revertedWith("Must be shutdown");

               await mockedWmxLocker.setVariable("isShutdown", true);

               await expect(
                mockedWmxLocker.emergencyWithdraw()
            ).to.be.revertedWith("Nothing locked");

            });
        });


        describe("setKickIncentive()", async () => {
            it("setKickIncentive", async () => {
                
                const rewardToken = await smock.fake({interface: IERC20});

                await expect(
                    mockedWmxLocker.setKickIncentive(600, 1000)
               ).to.be.revertedWith("over max rate");

               await mockedWmxLocker.setVariable("isShutdown", true);

               await expect(
                mockedWmxLocker.setKickIncentive(300, 1)
            ).to.be.revertedWith("min delay");

            });
        });

        describe("recoverERC20()", async () => {
            it("recoverERC20", async () => {
                
                const rewardToken = await smock.fake({interface: IERC20});

                await expect(
                    mockedWmxLocker.recoverERC20(stakingToken.address, 100)
               ).to.be.revertedWith("Cannot withdraw staking token");

               await mockedWmxLocker.setVariable("rewardData", {
                [rewardToken.address]: {
                    periodFinish: 1000000,
                    lastUpdateTime:1000000 ,
                    rewardRate: 10,
                    rewardPerTokenStored: 10
                }
            })

               await expect(
                mockedWmxLocker.recoverERC20(rewardToken.address, 100)
            ).to.be.revertedWith("Cannot withdraw reward token");

            });
        });

        describe("approveRewardDistributor()", async () => {
            it("approveRewardDistributor", async () => {
                
                const rewardToken = await smock.fake({interface: IERC20});

               await mockedWmxLocker.setVariable("rewardData", {
                [rewardToken.address]: {
                    periodFinish: 1000000,
                    lastUpdateTime:0 ,
                    rewardRate: 10,
                    rewardPerTokenStored: 10
                }
            })

               await expect(
                mockedWmxLocker.approveRewardDistributor(
                    rewardToken.address, accounts[1].address, true
                )
            ).to.be.revertedWith("Reward does not exist");

            });


            
        });


        // describe("blacklist", async () => {
        //     // it.only("getPastVotes", async () => {
                
        //     //     const unlockTime = await (await getTimestamp()).sub(ONE_WEEK);

        //     //     await expect(
        //     //         mockedWmxLocker.getPastTotalSupply(unlockTime)
        //     //     ).to.be.revertedWith("ERC20Votes: block not yet mined");
                

                
        //     // });


        //     it.only("blacklist", async () => {
                    
        //         stakingToken.safeApprove.returns(true);
        //         stakingToken.safeTransferFrom.returns(true);
        //        await mockedWmxLocker.setVariable("blacklist", {
        //         [accounts[0].address]: true
        //     })

        //        await expect(
        //         mockedWmxLocker.lock(
        //             accounts[0].address, 100
        //         )
        //     ).to.be.revertedWith("blacklisted");



        //     await mockedWmxLocker.setVariable("blacklist", {
        //         [accounts[1].address]: true
        //     });

        //     await mockedWmxLocker.setVariable("blacklist", {
        //         [accounts[0].address]: false
        //     });

        //     await expect(
        //         mockedWmxLocker.lock(
        //             accounts[1].address, 100
        //         )
        //     ).to.be.revertedWith("blacklisted");

        //     });
        // })


         describe("getPastTotalSupply()", async () => {
            it("getPastTotalSupply", async () => {
                
                const unlockTime = await getTimestamp()
                let t = unlockTime.sub(ONE_WEEK);

                await expect(
                    mockedWmxLocker.getPastTotalSupply(unlockTime)
                ).to.be.revertedWith("ERC20Votes: block not yet mined");
                
            });
                
        });


        describe("balanceAtEpochOf()", async () => {
            it("balanceAtEpochOf", async () => {
                
                const unlockTime = await getTimestamp()
                let t = unlockTime.add(ONE_DAY);

                await expect(
                    mockedWmxLocker.balanceAtEpochOf(t, accounts[0].address)
                ).to.be.revertedWith("Epoch is in the future");
                
            });
                
        });

        describe("getReward()", async () => {
            it("getReward", async () => {
                
                const unlockTime = await getTimestamp()
                let t = unlockTime.add(ONE_DAY);

                // await mockedWmxLocker["getReward(address,bool[])"](accounts[1].address, [false, false, false]);

                await expect(
                     mockedWmxLocker["getReward(address,bool[])"](accounts[1].address, [false, false, false])
                ).to.be.revertedWith("!arr");
                
            });
                
        });


        // const tx = await wmxLocker["getReward(address,bool[])"](aliceAddress, [false, false, false]);

    });

    
});
