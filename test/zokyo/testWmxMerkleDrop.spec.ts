import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import chai, { expect } from "chai";
import {
    deployTestFirstStage,
    getMockDistro,
    getMockMultisigs
} from "../../scripts/deployMocks";
import {SystemDeployed, deploy, DistroList} from "../../scripts/deploySystem";
import { BN, simpleToExactAmount } from "../../test-utils/math";
import { Wmx, WmxLocker, WmxMerkleDrop, WmxMerkleDrop__factory, WmxMinter } from "../../types/generated";
import { getTimestamp, increaseTime, increaseTimeTo } from "../../test-utils/time";
import { DEAD_ADDRESS, MAX_UINT256, ONE_WEEK, ONE_YEAR, ZERO_ADDRESS } from "../../test-utils/constants";
import { assertBNClose, createTreeWithAccounts, getAccountBalanceProof, impersonateAccount } from "../../test-utils";
import MerkleTree from "merkletreejs";
import { MockContract, smock } from "@defi-wonderland/smock";
import chaiAsPromised from "chai-as-promised";

chai.should();
chai.use(smock.matchers);
chai.use(chaiAsPromised);

describe("WmxRewardPool", () => {
    let accounts: Signer[];

    let contracts: SystemDeployed;
    let wmx: Wmx;
    let wmxLocker: WmxLocker;
    let merkleDrop: MockContract<WmxMerkleDrop>;
    let drops: WmxMerkleDrop[];

    let deployTime: BN;

    let deployer: Signer;
    let deployerAddress: string;

    let admin: Signer;
    let adminAddress: string;

    let alice: Signer;
    let aliceAddress: string;

    let bob: Signer;
    let bobAddress: string;

    let distro: DistroList;

    let tree: MerkleTree;
    let dropAmount: BN;

    before(async () => {
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        const mocks = await deployTestFirstStage(hre, deployer);
        const multisigs = await getMockMultisigs(accounts[0], accounts[0], accounts[0]);
        distro = getMockDistro();
        contracts = await deploy(hre, deployer, accounts[0], mocks, distro, multisigs, mocks.namingConfig, mocks);

        deployerAddress = await deployer.getAddress();

        admin = accounts[1];
        adminAddress = await admin.getAddress();

        alice = accounts[2];
        aliceAddress = await alice.getAddress();

        bob = accounts[3];
        bobAddress = await bob.getAddress();

        wmx = contracts.cvx;
        wmxLocker = contracts.cvxLocker;
        drops = contracts.drops;

        const operatorAccount = await impersonateAccount(contracts.booster.address);
        await contracts.cvx
            .connect(operatorAccount.signer)
            .mint(operatorAccount.address, simpleToExactAmount(100000, 18));
        await contracts.cvx.connect(operatorAccount.signer).transfer(deployerAddress, simpleToExactAmount(1000));

        deployTime = await getTimestamp();
    }); 
    
    describe ( "Operation without exceptions: " , async function () {
        before(async() => {
            dropAmount = simpleToExactAmount(200);
            const amount = simpleToExactAmount(100);
            tree = createTreeWithAccounts({
                [aliceAddress]: amount,
                [bobAddress]: amount,
            });
            const merkleDropFactory = await smock.mock<WmxMerkleDrop__factory>("WmxMerkleDrop");

            merkleDrop = await merkleDropFactory.deploy(
                adminAddress,
                tree.getHexRoot(),
                wmx.address,
                wmxLocker.address,
                ONE_WEEK,
                ONE_WEEK.mul(16),
            );
            await wmx.transfer(merkleDrop.address, dropAmount);
        });
        it("#constructor - initial configuration is correct", async () => {
            expect(await merkleDrop.wmx()).eq(wmx.address);
            expect(await merkleDrop.dao(), "dao").to.eq(adminAddress);
            expect(await merkleDrop.merkleRoot(), "merkleRoot").to.eq(tree.getHexRoot());
            expect(await merkleDrop.wmx(), "wmx").to.eq(wmx.address);
            expect(await merkleDrop.wmxLocker(), "auraLocker").to.eq(wmxLocker.address);
            assertBNClose(await merkleDrop.startTime(), deployTime.add(ONE_WEEK), 5);
            assertBNClose(await merkleDrop.expiryTime(), deployTime.add(ONE_WEEK.mul(17)), 5);
            expect(await wmx.balanceOf(merkleDrop.address), "wmx balance").to.eq(dropAmount);
        });
        it("#claim - allows claiming and locking ", async () => {
            await increaseTime(ONE_WEEK);
            const amount = simpleToExactAmount(100);
            const aliceAuraBalanceBefore = await wmx.balanceOf(aliceAddress);
            const aliceBalanceBefore = await wmxLocker.balances(aliceAddress);
            expect(await merkleDrop.hasClaimed(aliceAddress), "user  has not claimed").to.eq(false);
            const tx = merkleDrop
                .connect(alice)
                .claim(getAccountBalanceProof(tree, aliceAddress, amount), amount);
            await expect(tx).to.emit(merkleDrop, "Claimed").withArgs(aliceAddress, amount);
            expect(await wmx.balanceOf(aliceAddress), "alice wmx balance").to.eq(aliceAuraBalanceBefore);
            expect((await wmxLocker.balances(aliceAddress)).locked, "alice wmx locked balance").to.eq(
                aliceBalanceBefore.locked.add(amount),
            );
            expect(await merkleDrop.hasClaimed(aliceAddress), "user claimed").to.eq(true);
        });
        it("#setDao - sets a new dao ", async () => {
            const tx = await merkleDrop.connect(admin).setDao(bobAddress);
            // expect to emit event DaoSet
            await expect(tx).to.emit(merkleDrop, "DaoSet").withArgs(bobAddress);
            expect(await merkleDrop.dao()).to.eq(bobAddress);

            // revert to original admin dao
            await merkleDrop.connect(bob).setDao(adminAddress);
        });
        it("#setRoot - sets a new root if it was not previously set ", async () => {
            const merkleDropFactory = await smock.mock<WmxMerkleDrop__factory>("WmxMerkleDrop");
            merkleDrop = await merkleDropFactory.deploy(
                adminAddress,
                ethers.constants.HashZero,
                wmx.address,
                wmxLocker.address,
                ONE_WEEK,
                ONE_WEEK.mul(16),
            );
            
            const newRoot = tree.getHexRoot();
            const tx = await merkleDrop.connect(admin).setRoot(newRoot);
            // expect to emit event RootSet
            await expect(tx).to.emit(merkleDrop, "RootSet").withArgs(newRoot);
            expect(await merkleDrop.merkleRoot()).to.eq(newRoot);
        });
        it("#rescueReward - rescue rewards", async () => {
            const tx = await merkleDrop.connect(admin).rescueReward();
            await expect(tx).to.emit(merkleDrop, "Rescued");
        });
        it("#startEarly - starts early the drop ", async () => {
            const timestamp = await getTimestamp();
            const tx = await merkleDrop.connect(admin).startEarly();
            // expect to emit event StartEarly
            await expect(tx).to.emit(merkleDrop, "StartedEarly");
            assertBNClose(await merkleDrop.startTime(), timestamp, 5);
        });
        it("#withdrawExpired - withdraw expired", async () => {
            //fails to withdraw expired if the expire time has not been reached
            await expect(merkleDrop.connect(admin).withdrawExpired()).to.be.revertedWith("!expired");

            // move forward to expiry time
            await increaseTime(ONE_WEEK.mul(17));
            // get wmx balance before withdraw
            const dropBalance = await wmx.balanceOf(merkleDrop.address);
            const daoBalance = await wmx.balanceOf(adminAddress);
            const tx = await merkleDrop.connect(admin).withdrawExpired();
            await expect(tx).to.emit(merkleDrop, "ExpiredWithdrawn").withArgs(dropBalance);
            expect(await wmx.balanceOf(merkleDrop.address)).to.eq(0);
            expect(await wmx.balanceOf(adminAddress)).to.eq(daoBalance.add(dropBalance));
        });
        it("#setLocker - set a new locker", async () => {
            const tx = await merkleDrop.connect(admin).setLocker(bobAddress);
            await expect(tx).to.emit(merkleDrop, "LockerSet").withArgs(bobAddress);
            expect(await merkleDrop.wmxLocker()).to.eq(bobAddress);
        });
    })
    describe ( "Exceptions: ", async() => {
        beforeEach(async () => {
            dropAmount = simpleToExactAmount(200);
            const amount = simpleToExactAmount(100);
            tree = createTreeWithAccounts({
                [aliceAddress]: amount,
                [bobAddress]: amount,
            });

            const merkleDropFactory = await smock.mock<WmxMerkleDrop__factory>("WmxMerkleDrop");

            merkleDrop = await merkleDropFactory.deploy(
                adminAddress,
                tree.getHexRoot(),
                wmx.address,
                wmxLocker.address,
                ONE_WEEK,
                ONE_WEEK.mul(16),
            );
            await wmx.transfer(merkleDrop.address, dropAmount);
        });
        it("#setDao - abuse of the admin power(admin can set wrong address to new dao)", async () => {
            const merkleDropFactory = await smock.mock<WmxMerkleDrop__factory>("WmxMerkleDrop");
            merkleDrop = await merkleDropFactory.deploy(
                adminAddress,
                ethers.constants.HashZero,
                wmx.address,
                wmxLocker.address,
                ONE_WEEK,
                ONE_WEEK.mul(16),
            );

            const tx = await merkleDrop.connect(admin).setDao(DEAD_ADDRESS);
            // expect to emit event DaoSet
            await expect(tx).to.emit(merkleDrop, "DaoSet").withArgs(DEAD_ADDRESS);
            expect(await merkleDrop.dao()).to.eq(DEAD_ADDRESS);
            
            const newRoot = tree.getHexRoot();
            await expect(merkleDrop.connect(admin).setRoot(newRoot)).to.be.revertedWith("!auth");
        });

        it("#setRoot - abuse of the admin power(admin can set wrong root to new root)", async () => {
            const newRoot = "0x626c756500000000000000000000000000000000000000000000000000000000";
            const merkleDropFactory = await smock.mock<WmxMerkleDrop__factory>("WmxMerkleDrop");
            merkleDrop = await merkleDropFactory.deploy(
                adminAddress,
                ethers.constants.HashZero,
                wmx.address,
                wmxLocker.address,
                ONE_WEEK,
                ONE_WEEK.mul(16),
            );
            const tx1 = await merkleDrop.connect(admin).setRoot(newRoot);
            // expect to emit event RootSet
            await expect(tx1).to.emit(merkleDrop, "RootSet").withArgs(newRoot);
            expect(await merkleDrop.merkleRoot()).to.eq(newRoot);

            await increaseTime(ONE_WEEK);
            const amount = simpleToExactAmount(100);
            expect(await merkleDrop.hasClaimed(aliceAddress), "user  has not claimed").to.eq(false);
            
            const tx2 = merkleDrop
                .connect(alice)
                .claim(getAccountBalanceProof(tree, aliceAddress, amount), amount);
            
            await expect(tx2).to.be.revertedWith("invalid proof");
        });

        it("#setLocker - abuse of admin power(admin can set wrong address to new locker)", async () => {
            await increaseTime(ONE_WEEK);
            const amount = simpleToExactAmount(100);
            expect(await merkleDrop.hasClaimed(aliceAddress), "user  has not claimed").to.eq(false);

            const tx1 = await merkleDrop.connect(admin).setLocker(DEAD_ADDRESS);
            await expect(tx1).to.emit(merkleDrop, "LockerSet").withArgs(DEAD_ADDRESS);
            expect(await merkleDrop.wmxLocker()).to.eq(DEAD_ADDRESS);

            const tx2 = merkleDrop
                .connect(alice)
                .claim(getAccountBalanceProof(tree, aliceAddress, amount), amount);
            await expect(tx2).to.be.revertedWith("non-contract account");
        });

        it("#withdrawExpired - abuse of the admin power(admin can set maximum expired time so that can't invoke)", async () => {
            const merkleDropFactory = await smock.mock<WmxMerkleDrop__factory>("WmxMerkleDrop");
            let deployTime = await getTimestamp();
            merkleDrop = await merkleDropFactory.deploy(
                adminAddress,
                tree.getHexRoot(),
                wmx.address,
                wmxLocker.address,
                ONE_WEEK,
                MAX_UINT256.sub(ONE_WEEK.mul(2)).sub(deployTime),
            );

            //for invoke `withdrawExpired` time, must increase time but
            await expect(increaseTimeTo(MAX_UINT256.sub(ONE_WEEK))).to.be.eventually.rejectedWith("overflow");
        });

        it("#claim - WmxLocker is not checked", async () => {
            await increaseTime(ONE_WEEK);
            const amount = simpleToExactAmount(100);
            expect(await merkleDrop.hasClaimed(aliceAddress), "user  has not claimed").to.eq(false);

            const tx1 = await merkleDrop.connect(admin).setLocker(DEAD_ADDRESS);
            await expect(tx1).to.emit(merkleDrop, "LockerSet").withArgs(DEAD_ADDRESS);
            expect(await merkleDrop.wmxLocker()).to.eq(DEAD_ADDRESS);

            const tx2 = merkleDrop
                .connect(alice)
                .claim(getAccountBalanceProof(tree, aliceAddress, amount), amount);
            await expect(tx2).to.be.revertedWith("non-contract account");
        });
    })
})
