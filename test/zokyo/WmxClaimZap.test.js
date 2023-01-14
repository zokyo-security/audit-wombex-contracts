const { ethers } = require("hardhat");
const { FakeContract, smock } = require('@defi-wonderland/smock');
const { expect } = require('chai')
const  chai  = require('chai')
const { BigNumber, constants } = require('ethers');

chai.should();
chai.use(smock.matchers);

let IERC20 = new ethers.utils.Interface([
    "function safeTransfer(address token, address to, uint256 value) external returns(bool)",
    "function safeTransferFrom(address, address from, address to, uint256 value) external returns(bool)",
    "function safeApprove(address, address spender, uint256 value) external returns(bool)",
    "function safeIncreaseAllowance(address, address spender, uint256 value) external returns(bool)",
    "function safeDecreaseAllowance(address, address spender, uint256 value) external returns(bool)",
    "function totalSupply() external view returns (uint256)",
    "function balanceOf(address) external view returns (uint256)",
    "function transfer(address recipient, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)",
]);


let IBasicRewards = new ethers.utils.Interface([
        "function getReward(address _account, bool _lockWmx) external",
        "function getReward(address _account) external",
        "function depositFor(uint256 _pid,uint256 _amount,address _user) external",
        "function stakeFor(address, uint256) external"
])

describe("WmxClaimZap", async () => {

let owner, tester1, tester2, tester3;
let voterProxy, wom, veWom, gaugeSmock, guage, mockedBooster;
let wmx, wmxWom,womDepositor,wmxWomRewards,locker;

    beforeEach(async () => {
        const signers = await hre.ethers.getSigners();
        owner = signers[0];
        tester1 = signers[1];
        tester2 = signers[2];
        tester3 = signers[3];

        womDepositor = await smock.fake("WomDepositor");
        locker = await smock.fake("WmxLocker");
        wmx = await smock.fake({interface:IERC20});
        wmxWom = await smock.fake({interface: IERC20});
        wmxWomRewards = await smock.fake({interface: IBasicRewards}); 
        wom = await smock.fake({interface: IERC20});

        wom.transfer.returns(true);
        wom.approve.returns(true);
        wom.transferFrom.returns(true);
        wom.safeTransferFrom.returns(true)
        wom.safeApprove.returns(true);
        wom.safeTransfer.returns(true);
        wom.balanceOf.returns(100000000000);

        wmx.transfer.returns(true);
        wmx.approve.returns(true);
        wmx.transferFrom.returns(true);
        wmx.safeTransferFrom.returns(true)
        wmx.safeApprove.returns(true);
        wmx.safeTransfer.returns(true);
        wmx.balanceOf.returns(10000000000);
        

        wmxWom.transfer.returns(true);
        wmxWom.approve.returns(true);
        wmxWom.transferFrom.returns(true);
        wmxWom.safeTransferFrom.returns(true)
        wmxWom.safeApprove.returns(true);
        wmxWom.safeTransfer.returns(true);
        wmxWom.balanceOf.returns(10000000000);

        const ClaimZap = await smock.mock("WmxClaimZap");
        claimZap = await ClaimZap.deploy(
            wom.address, 
            wmx.address, 
            wmxWom.address, 
            womDepositor.address,
            wmxWomRewards.address,
            locker.address
        )

    })


    describe("getName()", async () => {
        it("gets name", async () => {
            await claimZap.getName()
        });
    });

    describe("setApprovals()", async () => {
        it("sets approvals for wom, wmx, womWmx tokens", async () => {

            await expect(claimZap.connect(tester2).setApprovals()).to.be.revertedWith("!auth")
            await claimZap.setApprovals()
        });
    });

    describe("claimRewards()", async () => {
        it("Claims all the rewards", async () => {
            
            let IBasicRewards1 = new ethers.utils.Interface([
                "function getReward(address _account, bool _lockWmx) external"
            ]);

            let IBasicRewards2 = new ethers.utils.Interface([
                "function getReward(address _account) external",
            ]);

            let IBasicRewards3 = new ethers.utils.Interface([
                "function depositFor(uint256 _pid,uint256 _amount,address _user) external",
            ]);

            const newRewardContract =  await smock.fake({interface: IBasicRewards1}); 
            const extraRewardContract =  await smock.fake({interface: IBasicRewards2});
            newRewardContract.getReward.returns();
            extraRewardContract.getReward.returns();

            const tokenRewardContract =  await smock.fake({interface: IBasicRewards3});
            tokenRewardContract.depositFor.returns();

            await expect(
                claimZap.claimRewards(
                    [newRewardContract.address], 
                    [extraRewardContract.address],
                    [tokenRewardContract.address],
                    [],
                    1000,
                    100,
                    10000,
                    1
                )
            ).to.be.revertedWith("!parity")

            await claimZap.claimRewards(
                [newRewardContract.address], 
                [extraRewardContract.address],
                [tokenRewardContract.address],
                [0],
                1000,
                100,
                10000,
                1
            )

            await claimZap.claimRewards(
                [newRewardContract.address], 
                [extraRewardContract.address],
                [tokenRewardContract.address],
                [0],
                1000,
                100,
                10000,
                2
            )
            await claimZap.claimRewards(
                [newRewardContract.address], 
                [extraRewardContract.address],
                [tokenRewardContract.address],
                [0],
                1000,
                100,
                10000,
                4
            )
            await claimZap.claimRewards(
                [newRewardContract.address], 
                [extraRewardContract.address],
                [tokenRewardContract.address],
                [0],
                1000,
                100,
                10000,
                8
            )
            await claimZap.claimRewards(
                [newRewardContract.address], 
                [extraRewardContract.address],
                [tokenRewardContract.address],
                [0],
                1000,
                100,
                10000,
                16
            )

            await claimZap.claimRewards(
                [newRewardContract.address], 
                [extraRewardContract.address],
                [tokenRewardContract.address],
                [0],
                1000,
                100,
                10000,
                32
            )

            await claimZap.claimRewards(
                [newRewardContract.address], 
                [extraRewardContract.address],
                [tokenRewardContract.address],
                [0],
                1000,
                100,
                10000,
                64
            )

        });
    });

    // describe("", async () => {
    //     it("", async () => {
            
    //     });
    // });

    // describe("", async () => {
    //     it("", async () => {
            
    //     });
    // });

    // describe("", async () => {
    //     it("", async () => {
            
    //     });
    // });

    // describe("", async () => {
    //     it("", async () => {
            
    //     });
    // });

    // describe("", async () => {
    //     it("", async () => {
            
    //     });
    // });
})