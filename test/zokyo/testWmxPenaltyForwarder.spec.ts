import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import chai, { expect } from "chai";
import {
    deployTestFirstStage,
    getMockDistro,
    getMockMultisigs
} from "../../scripts/deployMocks";
import {SystemDeployed, deploy} from "../../scripts/deploySystem";
import { BN, simpleToExactAmount } from "../../test-utils/math";
import { WmxPenaltyForwarder, ExtraRewardsDistributor, Wmx } from "../../types/generated";
import { getTimestamp, increaseTime } from "../../test-utils/time";
import { ONE_WEEK, ZERO_ADDRESS } from "../../test-utils/constants";
import { impersonateAccount } from "../../test-utils/index";

chai.should();
describe("WmxRewardPool", () => {
    let accounts: Signer[];

    let contracts: SystemDeployed;
    let deployer: Signer;
    let wmx: Wmx;
    let penaltyForwarder: WmxPenaltyForwarder;
    let distributor: ExtraRewardsDistributor;

    let alice: Signer;
    let aliceAddress: string;
    let aliceInitialBalance: BN;

    const reset = async() => {
        const mocks = await deployTestFirstStage(hre, deployer);
        const multisigs = await getMockMultisigs(accounts[0], accounts[0], accounts[0]);
        const distro = getMockDistro();
        contracts = await deploy(hre, deployer, accounts[0], mocks, distro, multisigs, mocks.namingConfig, mocks);
        
        alice = accounts[1];
        aliceAddress = await alice.getAddress();
        penaltyForwarder = contracts.penaltyForwarder;
        wmx = contracts.cvx;
        distributor = contracts.extraRewardsDistributor.connect(alice);
    
        const operatorAccount = await impersonateAccount(contracts.booster.address);
        await wmx.connect(operatorAccount.signer).mint(operatorAccount.address, simpleToExactAmount(100000, 18));
        await wmx.connect(operatorAccount.signer).transfer(aliceAddress, simpleToExactAmount(200));
        aliceInitialBalance = await wmx.balanceOf(aliceAddress);
    }

    before(async () => {
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        await reset();
    });   
    
    describe ( "Operation without exceptions: " , async function () {
        it("#constructor - initial configuration is correct", async () => {
            const currentTime = await getTimestamp();
            expect(await penaltyForwarder.distributor(), "distributor").to.eq(distributor.address);
            expect(await penaltyForwarder.token(), "token").to.eq(wmx.address);
            expect(await penaltyForwarder.distributionDelay(), "distributionDelay").to.eq(ONE_WEEK.mul(7).div(2));
            expect(await penaltyForwarder.lastDistribution(), "lastDistribution").to.lte(currentTime);
            expect(await penaltyForwarder.owner(), "owner").to.eq(await deployer.getAddress());
            
            //forwarder cvx allowance is correct
            expect(await wmx.allowance(penaltyForwarder.address, distributor.address), "allowance").to.eq(0);
        })
        it("#forward - should forward all wmx balance to the distributor", async () => {
            const cvxAmount = aliceInitialBalance.div(2);
            // Locks some WMX in locker to avoid:
            // Error: VM Exception while processing transaction: reverted with panic code 0x12 (Division or modulo division by zero)
            // ExtraRewardsDistributor._addReward (contracts/ExtraRewardsDistributor.sol:97
            await wmx.connect(alice).approve(contracts.cvxLocker.address, cvxAmount);
            await contracts.cvxLocker.connect(alice).lock(aliceAddress, cvxAmount);

            // Sends some wmx to the forwarder
            await wmx.connect(alice).approve(penaltyForwarder.address, cvxAmount);
            await wmx.connect(alice).transfer(penaltyForwarder.address, cvxAmount);
            const distributorBalanceBefore = await wmx.balanceOf(distributor.address);
            const penaltyForwarderBalanceBefore = await wmx.balanceOf(penaltyForwarder.address);

            // Increase time to avoid dividing by zero at ExtraRewardsDistributor._addReward , auraLocker.totalSupplyAtEpoch
            await increaseTime(await penaltyForwarder.distributionDelay());
            await increaseTime(ONE_WEEK);

            expect(penaltyForwarderBalanceBefore, "penalty forwarder balance").to.gt(0);
            // Test
            const tx = await penaltyForwarder.forward();
            // Verify events, storage change, balance, etc.
            await expect(tx).to.emit(penaltyForwarder, "Forwarded").withArgs(cvxAmount);
            const distributorBalanceAfter = await wmx.balanceOf(distributor.address);
            const penaltyForwarderBalanceAfter = await wmx.balanceOf(penaltyForwarder.address);
            expect(penaltyForwarderBalanceAfter, "penalty forwarder balance").to.eq(0);
            expect(distributorBalanceAfter, "distributor balance").to.eq(distributorBalanceBefore.add(cvxAmount));
        });

        it("#setDistributor - sets the new distributor", async () => {
            const distributorOld = await penaltyForwarder.distributor();

            let tx = await penaltyForwarder.setDistributor(ZERO_ADDRESS);
            await expect(tx).to.emit(penaltyForwarder, "DistributorChanged").withArgs(ZERO_ADDRESS);

            expect(await penaltyForwarder.distributor(), "distributor").to.eq(ZERO_ADDRESS);

            // Returns original value

            tx = await penaltyForwarder.setDistributor(distributorOld);
            await expect(tx).to.emit(penaltyForwarder, "DistributorChanged").withArgs(distributorOld);

            expect(await penaltyForwarder.distributor(), "distributor").to.eq(distributor.address);
        });
    })
    describe ( "Exceptions: ", async() => {
        before(async() => {
            await reset();
        })
        it("#setDistributor - abouse of the admin power", async () => {
            const cvxAmount = aliceInitialBalance.div(2);
            // Locks some WMX in locker to avoid:
            // Error: VM Exception while processing transaction: reverted with panic code 0x12 (Division or modulo division by zero)
            // ExtraRewardsDistributor._addReward (contracts/ExtraRewardsDistributor.sol:97
            await wmx.connect(alice).approve(contracts.cvxLocker.address, cvxAmount);
            await contracts.cvxLocker.connect(alice).lock(aliceAddress, cvxAmount);

            // Sends some wmx to the forwarder
            await wmx.connect(alice).approve(penaltyForwarder.address, cvxAmount);
            await wmx.connect(alice).transfer(penaltyForwarder.address, cvxAmount);

            const penaltyForwarderBalanceBefore = await wmx.balanceOf(penaltyForwarder.address);

            // Increase time to avoid dividing by zero at ExtraRewardsDistributor._addReward , auraLocker.totalSupplyAtEpoch
            await increaseTime(await penaltyForwarder.distributionDelay());
            await increaseTime(ONE_WEEK);

            expect(penaltyForwarderBalanceBefore, "penalty forwarder balance").to.gt(0);

            //set zero address to the distributor
            let tx = await penaltyForwarder.setDistributor(ZERO_ADDRESS);
            await expect(tx).to.emit(penaltyForwarder, "DistributorChanged").withArgs(ZERO_ADDRESS);
            
            expect(await penaltyForwarder.distributor(), "distributor").to.eq(ZERO_ADDRESS);

            //transaction will be reverted because malicious admin set the zero address to the distributor
            await expect(penaltyForwarder.forward()).to.be.revertedWith("ERC20: approve to the zero address");
        });
    })
})
