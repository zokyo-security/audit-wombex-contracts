import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import {
    deployTestFirstStage,
    getMockDistro,
    getMockMultisigs
} from "../../scripts/deployMocks";
import {SystemDeployed, deploy} from "../../scripts/deploySystem";
import { BN, simpleToExactAmount } from "../../test-utils/math";
import { WmxLocker, WmxVestedEscrow, WmxVestedEscrow__factory, ERC20 } from "../../types/generated";
import { impersonateAccount } from "../../test-utils/fork";
import { getTimestamp, increaseTime } from "../../test-utils/time";
import { DEAD_ADDRESS, ONE_WEEK } from "../../test-utils/constants";
import { MockContract, smock } from '@defi-wonderland/smock';

chai.should();
chai.use(smock.matchers);
chai.use(chaiAsPromised);

describe("WmxVestedEscrow", () => {
    let accounts;

    let contracts;
    let deployer;
    let wmx;
    let wmxLocker;
    let deployTime;
    let deployerAddress: string;
    let vestedEscrow;

    let fundAdmin;
    let fundAdminAddress: string;

    let alice;
    let aliceAddress: string;

    let bob;
    let bobAddress: string;

    const reset = async() => {
        const mocks = await deployTestFirstStage(hre, deployer);
        const multisigs = await getMockMultisigs(accounts[0], accounts[0], accounts[0]);
        const distro = getMockDistro();
        contracts = await deploy(hre, deployer, accounts[0], mocks, distro, multisigs, mocks.namingConfig, mocks);

        deployerAddress = await deployer.getAddress();

        fundAdmin = accounts[1];
        fundAdminAddress = await fundAdmin.getAddress();

        alice = accounts[2];
        aliceAddress = await alice.getAddress();

        bob = accounts[3];
        bobAddress = await bob.getAddress();

        const operatorAccount = await impersonateAccount(contracts.booster.address);
        await contracts.cvx
            .connect(operatorAccount.signer)
            .mint(operatorAccount.address, simpleToExactAmount(100000, 18));
        await contracts.cvx.connect(operatorAccount.signer).transfer(deployerAddress, simpleToExactAmount(1000));
        wmx = contracts.cvx.connect(deployer) as ERC20;
        wmxLocker = contracts.cvxLocker.connect(deployer);
        deployTime = await getTimestamp();
        // console.log("wmx", wmx.address);
        // console.log("wmx", wmxLocker.address);
        const vestedEscrowFactory = await smock.mock("WmxVestedEscrow");
        vestedEscrow = await vestedEscrowFactory.deploy(
            wmx.address,
            fundAdminAddress,
            wmxLocker.address,
            deployTime.add(ONE_WEEK),
            deployTime.add(ONE_WEEK.mul(53)),
        )
    }

    before(async () => {
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        await reset();
    });   
    
    describe ( "Operation without exceptions: " , async function () {
        it("#constructor - initial configuration is correct", async () => {
            expect(await vestedEscrow.rewardToken()).eq(wmx.address);
            expect(await vestedEscrow.admin()).eq(fundAdminAddress);
            expect(await vestedEscrow.wmxLocker()).eq(wmxLocker.address);
            expect(await vestedEscrow.startTime()).eq(deployTime.add(ONE_WEEK));
            expect(await vestedEscrow.endTime()).eq(deployTime.add(ONE_WEEK.mul(53)));
            expect(await vestedEscrow.totalTime()).eq(ONE_WEEK.mul(52));
            expect(await vestedEscrow.initialised()).eq(false);
        });        
        it("#fund - fund recipients with rewardTokens", async () => {
            const balBefore = await wmx.balanceOf(vestedEscrow.address);
            await wmx.approve(vestedEscrow.address, simpleToExactAmount(300));
            await vestedEscrow.fund([aliceAddress, bobAddress], [simpleToExactAmount(200), simpleToExactAmount(100)]);
            
            
            const balAfter = await wmx.balanceOf(vestedEscrow.address);
            expect(balAfter).eq(balBefore.add(simpleToExactAmount(300)));
            expect(await vestedEscrow.totalLocked(aliceAddress)).eq(simpleToExactAmount(200));
            expect(await vestedEscrow.available(aliceAddress)).lt(simpleToExactAmount(0.01));
            expect(await vestedEscrow.remaining(aliceAddress)).gt(simpleToExactAmount(199.99));
            expect(await vestedEscrow.totalLocked(bobAddress)).eq(simpleToExactAmount(100));
            expect(await vestedEscrow.available(bobAddress)).lt(simpleToExactAmount(0.01));
            expect(await vestedEscrow.remaining(bobAddress)).gt(simpleToExactAmount(99.99));
        });
        it("#available - get available amount to claim", async () => {
            await increaseTime(ONE_WEEK.mul(30));
            // Bob has ~55 tokens available at this stage as 30 weeks have elapsed
            
            const bobClaimable = await vestedEscrow.available(bobAddress);
            expect(bobClaimable).gt(simpleToExactAmount(55));
            expect(bobClaimable).lt(simpleToExactAmount(56));
        });
        it("#remaining - get remaining vested amount", async () => {
            // Bob has ~55 tokens available at this stage as 30 weeks have elapsed
            
            const bobVestedAmount = await vestedEscrow.remaining(bobAddress);
            expect(bobVestedAmount).gt(simpleToExactAmount(44));
            expect(bobVestedAmount).lt(simpleToExactAmount(45));
        });
        it("#claim - claim reward token", async () => {
            // Bob has ~55 tokens available at this stage as 30 weeks have elapsed
            const bobBefore = await wmx.balanceOf(bobAddress);

            await vestedEscrow.connect(bob).claim(false);
            
            const bobAfter = await wmx.balanceOf(bobAddress);
            expect(bobAfter.sub(bobBefore)).gt(simpleToExactAmount(55));
            expect(bobAfter.sub(bobBefore)).lt(simpleToExactAmount(56));
            expect(await vestedEscrow.available(bobAddress)).equal(simpleToExactAmount(0));
            expect(await vestedEscrow.remaining(bobAddress)).gt(simpleToExactAmount(44));
            expect(await vestedEscrow.remaining(bobAddress)).lt(simpleToExactAmount(45));
        })
        it("#cancel - cancel recipients vesting rewardTokens", async () => {
            await increaseTime(ONE_WEEK.mul(5));
            
            const fundAdminBefore = await wmx.balanceOf(fundAdminAddress);
            const bobBefore = await wmx.balanceOf(bobAddress);

            // Bob has ~9 tokens available at this stage as 5 weeks have elapsed
            const tx = await vestedEscrow.connect(fundAdmin).cancel(bobAddress);
            await expect(tx).to.emit(vestedEscrow, "Cancelled").withArgs(bobAddress);
            
            const bobAfter = await wmx.balanceOf(bobAddress);
            expect(bobAfter.sub(bobBefore)).gt(simpleToExactAmount(9));
            expect(bobAfter.sub(bobBefore)).lt(simpleToExactAmount(10));

            const fundAdminAfter = await wmx.balanceOf(fundAdminAddress);
            expect(fundAdminAfter.sub(fundAdminBefore)).gt(simpleToExactAmount(34));
            expect(fundAdminAfter.sub(fundAdminBefore)).lt(simpleToExactAmount(35));

            // await expect(vestedEscrow.connect(bob).claim(false)).to.be.revertedWith("Arithmetic operation underflowed");
            // await expect(vestedEscrow.connect(bob).available(bobAddress)).to.be.revertedWith(
            //     "Arithmetic operation underflowed",
            // );
            
            // expect(await vestedEscrow.connect(bob).remaining(bobAddress)).eq(0);
        })
        
        it("#setAdmin - change the contract admin", async () => {
            await vestedEscrow.connect(fundAdmin).setAdmin(aliceAddress);
            expect(await vestedEscrow.admin()).eq(aliceAddress);
        });
        it("#setLocker - change the locker contract address", async () => {
            await vestedEscrow.connect(alice).setLocker(aliceAddress);
            expect(await vestedEscrow.wmxLocker()).eq(aliceAddress);
        });
    })

    describe ( "Exceptions: " , async function () {
        beforeEach(async() => {
            await reset();
        })
        it("#setAdmin - Abuse of the admin power.", async () => {
            await vestedEscrow.connect(fundAdmin).setAdmin(DEAD_ADDRESS);
            await expect(vestedEscrow.connect(fundAdmin).setLocker(bobAddress)).to.be.revertedWith("!auth");
        });

        it("#setLocker, #claim - Abuse of the admin power(transaction reverted due to admin change the locker address)", async () => {
            await vestedEscrow.connect(fundAdmin).setLocker(DEAD_ADDRESS);

            await wmx.approve(vestedEscrow.address, simpleToExactAmount(100));
            await vestedEscrow.fund([aliceAddress], [simpleToExactAmount(100)]);
            await increaseTime(ONE_WEEK.mul(5));
            
            // Alice has ~9 tokens available at this stage as 5 weeks have elapsed
            const tx =  vestedEscrow.connect(alice).claim(true);
            await expect(tx).to.be.revertedWith("non-contract account");
        });

        it("#cancel - Abuse of the admin power", async () => {
            await wmx.approve(vestedEscrow.address, simpleToExactAmount(100));
            await vestedEscrow.fund([aliceAddress], [simpleToExactAmount(100)]);
            await increaseTime(ONE_WEEK.mul(5));
            // Alice has ~9 tokens available at this stage as 5 weeks have elapsed
            
            await vestedEscrow.connect(fundAdmin).setAdmin(DEAD_ADDRESS);
            
            const tx =  vestedEscrow.connect(fundAdmin).cancel(aliceAddress);
            await expect(tx).to.be.revertedWith("!auth");
        });
        
    })

    describe("setAdmin", async () => {
        it("setAdmin", async () => {
            await expect(vestedEscrow.connect(bob).setAdmin(bobAddress)).to.be.revertedWith('!auth')
        })
    })

    describe("cancel", async () => {
        it("cancel", async () => {
            await vestedEscrow.setVariable("admin", fundAdmin.address);
            await expect(vestedEscrow.connect(fundAdmin).cancel(bobAddress)).to.be.revertedWith("!funding")
        });

    })

    describe("fund", async () => {
        it("fund", async () => {
            await expect(
                vestedEscrow.fund([], [100])
            ).to.be.revertedWith("!arr");
        });

        it("fund", async () => {
            await vestedEscrow.setVariable("initialised", false);
            await expect(
                vestedEscrow.connect(bob).fund([aliceAddress], [100])
            ).to.be.revertedWith("!funder");
        })

        it("fund", async () => {
            await vestedEscrow.setVariable("initialised", true);
            await expect(
                vestedEscrow.fund([aliceAddress], [100])
            ).to.be.revertedWith("initialised already");
        });
    })

    describe("", async () => {
        it("", async () => {
    
                let fakeWmx = await smock.fake("Wmx")
                let fakeWmxLocker = await smock.fake("WmxLocker")
                let newDeployTime = await getTimestamp();

                const VestedEscrowFactory = await smock.mock("WmxVestedEscrow");

                await expect(VestedEscrowFactory.deploy(
                    fakeWmx.address,
                    fundAdminAddress,
                    fakeWmxLocker.address,
                    newDeployTime.sub(ONE_WEEK),
                    newDeployTime.add(ONE_WEEK.mul(53)),
                )
            ).to.be.revertedWith("start must be future");

            await expect(VestedEscrowFactory.deploy(
                fakeWmx.address,
                fundAdminAddress,
                fakeWmxLocker.address,
                newDeployTime.add(ONE_WEEK),
                newDeployTime.add(ONE_WEEK),
            )
        ).to.be.revertedWith("end must be greater");

        await expect(
                VestedEscrowFactory.deploy(
                fakeWmx.address,
                fundAdminAddress,
                fakeWmxLocker.address,
                newDeployTime.add(ONE_WEEK),
                newDeployTime.add(ONE_WEEK.mul(2)),
            )
        ).to.be.revertedWith("!short");
        })
    })
});