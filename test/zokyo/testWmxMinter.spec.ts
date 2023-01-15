import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import chai, { expect } from "chai";
import {
    deployTestFirstStage,
    getMockDistro,
    getMockMultisigs
} from "../../scripts/deployMocks";
import {SystemDeployed, deploy} from "../../scripts/deploySystem";
import { simpleToExactAmount } from "../../test-utils/math";
import { Wmx, WmxMinter } from "../../types/generated";
import { getTimestamp, increaseTime } from "../../test-utils/time";
import { DEAD_ADDRESS, ONE_WEEK } from "../../test-utils/constants";

chai.should();

describe("WmxRewardPool", () => {
    let accounts: Signer[];

    let contracts: SystemDeployed;
    let deployer: Signer;
    let wmx: Wmx;
    let minter: WmxMinter;

    let alice: Signer;
    let aliceAddress: string;

    const reset = async() => {
        const mocks = await deployTestFirstStage(hre, deployer);
        const multisigs = await getMockMultisigs(accounts[0], accounts[0], accounts[0]);
        const distro = getMockDistro();
        contracts = await deploy(hre, deployer, accounts[0], mocks, distro, multisigs, mocks.namingConfig, mocks);
        
        alice = accounts[1];
        aliceAddress = await alice.getAddress();
        wmx = contracts.cvx;
        minter = contracts.minter;
    }

    before(async () => {
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        await reset();
    });   
    
    describe ( "Operation without exceptions: " , async function () {
        it("#constructor - initial configuration is correct", async () => {
            expect(await minter.wmx()).to.equal(wmx.address);
            const currentTime = await getTimestamp();
            expect(await minter.inflationProtectionTime()).to.gt(currentTime.add(ONE_WEEK.mul(155)).toNumber());
            expect(await minter.inflationProtectionTime()).to.lt(currentTime.add(ONE_WEEK.mul(157)).toNumber());
            expect(await minter.owner()).to.equal(await deployer.getAddress());
        })
        it("#mint - mints tokens", async () => {
            await increaseTime(ONE_WEEK.mul(155));
            await expect(minter.connect(deployer).mint(aliceAddress, simpleToExactAmount(1))).to.revertedWith(
                "Inflation protected for now",
            );
            await increaseTime(ONE_WEEK.mul(2));
            const beforeBalance = await wmx.balanceOf(aliceAddress);
            const beforeTotalSupply = await wmx.totalSupply();
            await minter.mint(aliceAddress, 1000);
            const afterBalance = await wmx.balanceOf(aliceAddress);
            const afterTotalSupply = await wmx.totalSupply();
            expect(beforeBalance, "balance increases").to.lt(afterBalance);
            expect(beforeTotalSupply, "total supply increases").to.lt(afterTotalSupply);
        });
    })
    describe ( "Exceptions: ", async() => {
        before(async() => {
            await reset();
        })
        it("#mint - Admin power abuse.", async () => {
            await increaseTime(ONE_WEEK.mul(155));
            await expect(minter.connect(deployer).mint(aliceAddress, simpleToExactAmount(1))).to.revertedWith(
                "Inflation protected for now",
            );
            await increaseTime(ONE_WEEK.mul(2));

            //transfer ownership to dead address
            minter.transferOwnership(DEAD_ADDRESS);
            await expect(minter.mint(aliceAddress, 1000)).to.be.revertedWith("caller is not the owner");
        })
    })
})
