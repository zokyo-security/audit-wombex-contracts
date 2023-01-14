const { ethers } = require("hardhat");
const { FakeContract, smock } = require('@defi-wonderland/smock');
const { expect } = require('chai')
const  chai  = require('chai')
const { BigNumber, constants } = require('ethers');

chai.should();
chai.use(smock.matchers);

describe("RewardFactory", async () => {

let owner, tester1, tester2, tester3;
let booster, cvx, crv, factory, operator;

    beforeEach(async () => {

        const signers = await hre.ethers.getSigners();
        owner = signers[0];
        tester1 = signers[1];
        tester2 = signers[2];
        tester3 = signers[3];

        operator = await smock.fake("Booster")
        crv = await smock.fake("MockERC20");

        let RewardFactory = await hre.ethers.getContractFactory("RewardFactory");
        factory = await  RewardFactory.deploy(operator.address, crv.address);

    })

    describe("CreateCrvRewards()", async () => {

        it("CreateCrvRewards", async () => {

            await owner.sendTransaction({
                to: operator.address,
                value: ethers.utils.parseEther("5.0")
            });

            const depositToken = await smock.fake("MockERC20");
            const lpToken = await smock.fake("MockERC20");


            FakeRewardToken = await smock.fake("MockERC20")
            fakeRewardToken = await smock.fake("MockSafeERC20");
            await fakeRewardToken.connect(owner).setToken(FakeRewardToken.address);

            FakeRewardToken2 = await smock.fake("MockERC20")
            fakeRewardToken2 = await smock.fake("MockSafeERC20");
            await fakeRewardToken.connect(owner).setToken(FakeRewardToken2.address);

            await expect(factory.connect(owner).CreateCrvRewards(0, fakeRewardToken.address, fakeRewardToken2.address))
                .to.be.revertedWith("!auth")

            await expect(
                factory.connect(operator.wallet).CreateCrvRewards(0, fakeRewardToken.address, fakeRewardToken2.address)
            ).to.emit(factory, "RewardPoolCreated")
        })
    })
    
})

