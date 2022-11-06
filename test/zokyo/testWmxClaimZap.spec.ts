import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import chai, { expect } from "chai";
import {
    deployTestFirstStage,
    getMockDistro,
    getMockMultisigs
} from "../../scripts/deployMocks";
import {SystemDeployed, deploy, updateDistributionByTokens} from "../../scripts/deploySystem";
import { increaseTime } from "../../test-utils/time";
import { ONE_WEEK, ZERO_ADDRESS, DEAD_ADDRESS, MAX_UINT256 } from "../../test-utils/constants";
import { simpleToExactAmount } from "../../test-utils/math";
import { BaseRewardPool__factory, WmxClaimZap, WmxClaimZap__factory } from "../../types/generated";
import {impersonateAccount} from "../../test-utils";
import { MockContract, smock } from "@defi-wonderland/smock/src";

chai.should();
chai.use(smock.matchers);

describe("WmxClaimZap", () => {
    let accounts: Signer[];
    let mocks;
    let deployer: Signer;
    let contracts: SystemDeployed;
    let alice: Signer;
    let aliceAddress: string;
    let claimZap: MockContract<WmxClaimZap>;

    async function reset() {
        mocks = await deployTestFirstStage(hre, deployer);
        const multisigs = await getMockMultisigs(accounts[0], accounts[0], accounts[0]);
        const distro = getMockDistro();
        contracts = await deploy(hre, deployer, accounts[0], mocks, distro, multisigs, mocks.namingConfig, mocks);
        
        alice = accounts[1];
        aliceAddress = await alice.getAddress();

        await updateDistributionByTokens(accounts[0], contracts);

        await mocks.crv.transfer(aliceAddress, simpleToExactAmount(1));

        const amount = ethers.utils.parseEther("1000");
        let tx = await mocks.lptoken.transfer(aliceAddress, amount);
        await tx.wait();
        tx = await mocks.lptoken.connect(alice).approve(contracts.booster.address, amount);
        await tx.wait();
        tx = await contracts.booster.connect(alice).deposit(0, amount, true);
        await tx.wait();
        const operatorAccount = await impersonateAccount(contracts.booster.address);
        tx = await contracts.cvx
            .connect(operatorAccount.signer)
            .mint(aliceAddress, amount);
        await tx.wait();
        tx = await contracts.cvx.connect(alice).approve(contracts.cvxLocker.address, amount);
        await tx.wait();
        tx = await contracts.cvxLocker.connect(alice).lock(aliceAddress, amount);
        await tx.wait();
    }

    before(async () => {
        await hre.network.provider.send("hardhat_reset");
        accounts = await ethers.getSigners();
        deployer = accounts[0];      
        await reset();
    });

    describe ( "Operation without exceptions: " , async function () {
        it("#getName - initial configuration is correct", async () => {
            expect(await contracts.claimZap.getName()).to.be.eq("ClaimZap V2.0");
        });
    
        it("#setApprovals - set approval for deposits", async () => {
            await contracts.claimZap.setApprovals();
            expect(await mocks.crv.allowance(contracts.claimZap.address, contracts.crvDepositor.address)).gte(
                ethers.constants.MaxUint256,
            );
            expect(await contracts.cvxCrv.allowance(contracts.claimZap.address, contracts.cvxCrvRewards.address)).gte(
                ethers.constants.MaxUint256,
            );
            expect(await contracts.cvx.allowance(contracts.claimZap.address, contracts.cvxLocker.address)).gte(
                ethers.constants.MaxUint256,
            );
        });
    
        it("#claimRewards - claim rewards from cvxCrvStaking", async () => {
            const stakeAddress = contracts.cvxCrvRewards.address;
            const balance = await mocks.crv.balanceOf(aliceAddress);
            console.log('balance', balance);
    
            const balanceBeforeReward = await contracts.cvxCrvRewards.balanceOf(aliceAddress);
    
            await mocks.crv.connect(alice).approve(contracts.crvDepositor.address, balance);
            await contracts.crvDepositor.connect(alice)["deposit(uint256,bool,address)"](balance, true, stakeAddress);
    
            const rewardBalance = await contracts.cvxCrvRewards.balanceOf(aliceAddress);
            expect(rewardBalance).gt(balanceBeforeReward);
    
            await increaseTime(ONE_WEEK.mul("4"));
    
            await contracts.booster.earmarkRewards(0);
    
            await increaseTime(ONE_WEEK.mul("4"));
    
            const expectedRewards = await contracts.cvxCrvRewards.earned(mocks.crv.address, aliceAddress);
            console.log('expectedRewards', expectedRewards);
    
            await mocks.crv.connect(alice).approve(contracts.claimZap.address, ethers.constants.MaxUint256);
            const option = 1 + 16 + 8;
            await contracts.claimZap
                .connect(alice)
                .claimRewards([], [], [], [], expectedRewards, 0, 0, option);
    
            const newRewardBalance = await contracts.cvxCrvRewards.balanceOf(aliceAddress);
            expect(newRewardBalance).gt(rewardBalance);
        });
    
        it("#claimRewards - claim from lp staking pool", async () => {
            const stake = true;
            const amount = ethers.utils.parseEther("10");
            await mocks.lptoken.transfer(aliceAddress, amount);
            await mocks.lptoken.connect(alice).approve(contracts.booster.address, amount);
            await contracts.booster.connect(alice).deposit(0, amount, stake);
    
            await contracts.booster.earmarkRewards(0);
            const pool = await contracts.booster.poolInfo(0);
            const crvRewards = BaseRewardPool__factory.connect(pool.crvRewards, deployer);
            await increaseTime(ONE_WEEK.mul("2"));
    
            const balanceBefore = await mocks.crv.balanceOf(aliceAddress);
            const expectedRewards = await crvRewards.earned(mocks.crv.address, aliceAddress);
            const cvxBalanceBefore = await contracts.cvx.balanceOf(aliceAddress);
    
            const options = 32;
            await contracts.claimZap.connect(alice).claimRewards([pool.crvRewards], [], [], [], 0, 0, 0, options);
    
            const balanceAfter = await mocks.crv.balanceOf(aliceAddress);
            expect(balanceAfter.sub(balanceBefore)).eq(expectedRewards);
    
            expect(await contracts.cvx.balanceOf(aliceAddress)).gt(cvxBalanceBefore);
        });
    
        it("#claimRewards - claim from lp staking pool and cvxCrvStaking, lock wmx", async () => {
            const stake = true;
            const amount = ethers.utils.parseEther("10");
            await mocks.lptoken.transfer(aliceAddress, amount);
            await mocks.lptoken.connect(alice).approve(contracts.booster.address, amount);
            await contracts.booster.connect(alice).deposit(0, amount, stake);
    
            await contracts.booster.earmarkRewards(0);
            const pool = await contracts.booster.poolInfo(0);
            const crvRewards = BaseRewardPool__factory.connect(pool.crvRewards, deployer);
            await increaseTime(ONE_WEEK.mul("2"));
    
            await contracts.cvx.connect(alice).transfer(DEAD_ADDRESS, await contracts.cvx.balanceOf(aliceAddress));
    
            const balanceBefore = await mocks.crv.balanceOf(aliceAddress);
            const expectedRewards = await crvRewards.earned(mocks.crv.address, aliceAddress);
            const cvxBalanceBefore = await contracts.cvx.balanceOf(aliceAddress);
    
            const options = 1 + 16 + 8 + 32 + 64;
            await contracts.cvx.connect(alice).approve(contracts.claimZap.address, MAX_UINT256);
            const tx = await contracts.claimZap.connect(alice).claimRewards([pool.crvRewards], [], [], [], 0, 0, MAX_UINT256, options);
            const {events} = await tx.wait(1);
            const rewardClaimedEvents = events
                .filter(e => e.address.toLowerCase() === contracts.booster.address.toLowerCase())
                .map(e => contracts.booster.interface.decodeEventLog('RewardClaimed', e.data, e.topics));
    
            expect(rewardClaimedEvents.length).eq(2);
            rewardClaimedEvents.forEach(e => {
                expect(e.lock).eq(true);
            })
    
            const balanceAfter = await mocks.crv.balanceOf(aliceAddress);
            expect(balanceAfter.sub(balanceBefore)).gt(expectedRewards);
    
            expect(await contracts.cvx.balanceOf(aliceAddress)).eq(cvxBalanceBefore);
        });
    })    
    describe ( "Exceptions: " , async function () {
        before(async () => {
            await reset();
        });
        it("#constructor - The address of the womdepositor is immutable. If the provided address does not implement IWomDepositorWrapper interface, the contract will be deployed but cannot be initialized", async () => {
            const claimZapFactory = await smock.mock<WmxClaimZap__factory>("WmxClaimZap");
            claimZap = await claimZapFactory.deploy(
                await contracts.claimZap.wom(),
                await contracts.claimZap.wmx(),
                await contracts.claimZap.womWmx(),
                DEAD_ADDRESS,
                await contracts.claimZap.wmxWomRewards(),
                await contracts.claimZap.locker(),
            )

            await claimZap.setApprovals();

            const stakeAddress = contracts.cvxCrvRewards.address;
            const balance = await mocks.crv.balanceOf(aliceAddress);
            console.log('balance', balance);
    
            const balanceBeforeReward = await contracts.cvxCrvRewards.balanceOf(aliceAddress);
    
            await mocks.crv.connect(alice).approve(contracts.crvDepositor.address, balance);
            await contracts.crvDepositor.connect(alice)["deposit(uint256,bool,address)"](balance, true, stakeAddress);
    
            const rewardBalance = await contracts.cvxCrvRewards.balanceOf(aliceAddress);
            expect(rewardBalance).gt(balanceBeforeReward);
    
            await increaseTime(ONE_WEEK.mul("4"));
    
            await contracts.booster.earmarkRewards(0);
    
            await increaseTime(ONE_WEEK.mul("4"));
    
            const expectedRewards = await contracts.cvxCrvRewards.earned(mocks.crv.address, aliceAddress);
            console.log('expectedRewards', expectedRewards);
    
            await mocks.crv.connect(alice).approve(claimZap.address, ethers.constants.MaxUint256);
            const option = 1 + 16 + 8;

            const tx = claimZap
                .connect(alice)
                .claimRewards([], [], [], [], expectedRewards, 0, 0, option);
            await expect(tx).to.be.revertedWith("non-contract account")
           
        });

        it("#constructor - The address of the wmxWomRewards is immutable. If the provided address does not implement IBasicRewards interface, the contract will be deployed but cannot be initialized", async () => {
            const claimZapFactory = await smock.mock<WmxClaimZap__factory>("WmxClaimZap");
            claimZap = await claimZapFactory.deploy(
                await contracts.claimZap.wom(),
                await contracts.claimZap.wmx(),
                await contracts.claimZap.womWmx(),
                await contracts.claimZap.womDepositor(),
                DEAD_ADDRESS,
                await contracts.claimZap.locker(),
            )

            await claimZap.setApprovals();

            const stake = true;
            const amount = ethers.utils.parseEther("10");
            await mocks.lptoken.transfer(aliceAddress, amount);
            await mocks.lptoken.connect(alice).approve(contracts.booster.address, amount);
            await contracts.booster.connect(alice).deposit(0, amount, stake);
    
            await contracts.booster.earmarkRewards(0);
            const pool = await contracts.booster.poolInfo(0);
            await increaseTime(ONE_WEEK.mul("2"));
            const options = 1;

            const tx = claimZap
                .connect(alice)
                .claimRewards([pool.crvRewards], [], [], [], 0, 0, 0, options);

            await expect(tx).to.be.revertedWith("non-contract account")
        });

        it("#constructor - The address of the locker is immutable. If the provided address does not implement IWmxLocker interface, the contract will be deployed but cannot be initialized", async () => {
            const claimZapFactory = await smock.mock<WmxClaimZap__factory>("WmxClaimZap");
            claimZap = await claimZapFactory.deploy(
                await contracts.claimZap.wom(),
                await contracts.claimZap.wmx(),
                await contracts.claimZap.womWmx(),
                await contracts.claimZap.womDepositor(),
                await contracts.claimZap.wmxWomRewards(),
                DEAD_ADDRESS,
            )

            await claimZap.setApprovals();

            const stake = true;
            const amount = ethers.utils.parseEther("10");
            await mocks.lptoken.transfer(aliceAddress, amount);
            await mocks.lptoken.connect(alice).approve(contracts.booster.address, amount);
            await contracts.booster.connect(alice).deposit(0, amount, stake);
    
            await contracts.booster.earmarkRewards(0);
            const pool = await contracts.booster.poolInfo(0);
            await increaseTime(ONE_WEEK.mul("2"));
            const options = 2;

            const tx = claimZap
                .connect(alice)
                .claimRewards([pool.crvRewards], [], [], [], 0, 0, 0, options);

            await expect(tx).to.be.revertedWith("non-contract account")
        });
        it("#claimRewards - throw run out of gas error due to too much length of arrays", async () => {
            const stake = true;
            const amount = ethers.utils.parseEther("10");
            await mocks.lptoken.transfer(aliceAddress, amount);
            await mocks.lptoken.connect(alice).approve(contracts.booster.address, amount);
            await contracts.booster.connect(alice).deposit(0, amount, stake);
    
            await contracts.booster.earmarkRewards(0);
            const pool = await contracts.booster.poolInfo(0);
            let rewardContracts = [];
            new Array(10000).fill(null).forEach(() => {
                rewardContracts.push(pool.crvRewards);
            })
            await increaseTime(ONE_WEEK.mul("2"));
            const options = 32;
            await expect(contracts.claimZap.connect(alice).claimRewards(rewardContracts, [], [], [], 0, 0, 0, options)).to.be.revertedWith("run out of gas");
        });
    })
});
