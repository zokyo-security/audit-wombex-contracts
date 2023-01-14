const { ethers } = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const { expect } = require('chai')
const  chai  = require('chai')
const { BigNumber, constants } = require('ethers');

const TokenArtifact = require("../../artifacts/@openzeppelin/contracts-0.6/token/ERC20/ERC20.sol/ERC20.json");

chai.should();
chai.use(smock.matchers);

const ITokenFactory = new ethers.utils.Interface([
    "function CreateDepositToken(address) external returns(address)"
])

const IvoterProxy = new ethers.utils.Interface([
"function deposit(address, address) external returns (bool)",
"function withdraw(address) external returns (uint256)",
"function withdrawLp(address, address, uint256) external returns (bool)",
"function withdrawAllLp(address, address) external returns (bool)",
"function lock(uint256 _lockDays) external",
"function releaseLock(uint256 _slot) external returns(bool)",
"function claimCrv(address, uint256) external returns (address[] memory tokens, uint256[] memory balances)",
"function balanceOfPool(address, address) external view returns (uint256)",
"function operator() external view returns (address)"
])

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

const IExtraRewardsDistributor = new ethers.utils.Interface([
    "function addReward(address _token, uint256 _amount) external"
]);

 let IReward = new ethers.utils.Interface([
"function stake(address, uint256) external",
"function stakeFor(address, uint256) external",
"function withdraw(address, uint256) external",
"function exit(address) external",
"function getReward(address) external",
"function queueNewRewards(address, uint256) external",
"function notifyRewardAmount(uint256) external",
"function addExtraReward(address) external",
"function extraRewardsLength() external view returns (uint256)",
"function stakingToken() external view returns (address)",
"function rewardToken() external view returns(address)",
"function earned(address account) external view returns (uint256)",
]);

describe("Booster", async () => {

let owner, tester1, tester2, tester3;
let booster, cvx, crv, voterProxy, mockedBooster;

    beforeEach(async () => {

        const signers = await hre.ethers.getSigners();
        owner = signers[0];
        tester1 = signers[1];
        tester2 = signers[2];
        tester3 = signers[3];

        const MockERC20 = await hre.ethers.getContractFactory("MockERC20");

        voterProxy = await smock.fake("VoterProxy");


        cvx = await MockERC20.deploy("CVX Token", "CVXT", 9, owner.address, 10000000000);
        crv = await MockERC20.deploy("CVX Token", "CVXT", 9, owner.address, 10000000000);
        const _minMintRatio = 10;
        const _maxMintRatio = "1000000000000000000000";

        const BoosterFactory = await hre.ethers.getContractFactory("Booster");
        booster = await BoosterFactory.deploy(
            voterProxy.address,
            cvx.address,
            crv.address,
            _minMintRatio,
            _maxMintRatio
        );

        const MockBoosterFactory = await smock.mock("Booster");
        mockedBooster = await MockBoosterFactory.deploy(
            voterProxy.address,
            cvx.address,
            crv.address,
            _minMintRatio,
            _maxMintRatio
        );
        
    });

    describe("setOwner", async () => {
        it("setOwner", async () => {
            
            await expect(booster.connect(tester2).setOwner(tester1.address)).to.be.revertedWith("!auth");
            
            await expect(booster.setOwner(tester1.address)).to.emit(booster,"OwnerUpdated")
                .withArgs(tester1.address)
        });
    });

    describe("setFeeManager", async () => {
        it("setFeeManager", async () => {

            await expect(booster.connect(tester2).setFeeManager(tester1.address)).to.be.revertedWith("!auth");

            await expect(booster.setFeeManager(tester1.address)).to.emit(booster,"FeeManagerUpdated")
                .withArgs(tester1.address)
        })
    });

    describe("setPoolManager", async () => {
        it("setPoolManager", async () => {

            await expect(booster.connect(tester2).setPoolManager(tester1.address)).to.be.revertedWith("!auth");
            await expect(booster.setPoolManager(tester1.address)).to.emit(booster,"PoolManagerUpdated")
                .withArgs(tester1.address)

        })
    });

    describe("setFactories", async () => {

        it("setFactories", async () => {

            let rewardFactory = await smock.fake("RewardFactory");
            let tokenFactory = await smock.fake("TokenFactory");

            await expect(booster.connect(tester2).setFactories(rewardFactory.address, tokenFactory.address)).to.be.revertedWith("!auth");

            await expect(booster.setFactories(rewardFactory.address, tokenFactory.address)).to.emit(booster,"FactoriesUpdated")
                .withArgs(rewardFactory.address, tokenFactory.address)

            await expect(booster.setFactories(rewardFactory.address, tokenFactory.address)).to.emit(booster,"FactoriesUpdated")
            .withArgs(constants.AddressZero, constants.AddressZero)

        })
    });

    describe("setExtraRewardsDistributor", async () => {

        it("setExtraRewardsDistributor", async () => {
            
            let extraRewardDistributor = await smock.fake("ExtraRewardsDistributor");

            await cvx.approve(extraRewardDistributor.address, 1000);
            await cvx.approve(booster.address, 1000);

            await expect(booster.connect(tester2).setExtraRewardsDistributor(extraRewardDistributor.address)).to.be.revertedWith("!auth");
            await booster.setExtraRewardsDistributor(extraRewardDistributor.address)
            
        })
    });

    describe("setRewardClaimedPenalty", async () => {

        it("setRewardClaimedPenalty", async () => {
            
            await expect(booster.connect(tester2).setRewardClaimedPenalty(10)).to.be.revertedWith("!auth");
            await expect(booster.setRewardClaimedPenalty(constants.MaxUint256)).to.be.revertedWith(">max");
            
            await expect(
                booster.setRewardClaimedPenalty(10)
            ).to.emit(booster,"PenaltyShareUpdated").withArgs(10);
        
        })
    });

    describe("setVoteDelegate", async () => {

        it("setVoteDelegate", async () => {
            
            await expect(booster.connect(tester2).setVoteDelegate(tester1.address)).to.be.revertedWith("!auth");

            await expect(
                booster.setVoteDelegate(tester1.address)
            ).to.emit(booster,"VoteDelegateUpdated").withArgs(tester1.address);

        });
    });

    describe("setVotingValid", async () => {

        it("setVotingValid", async () => {
            
            await expect(booster.connect(tester2).setVotingValid(voterProxy.address, true)).to.be.revertedWith("!auth");

            await expect(
                booster.setVotingValid(voterProxy.address, true)
            ).to.emit(booster,"VotingMapUpdated").withArgs(voterProxy.address, true);

        })
    });

    describe("setLockRewardContracts", async () => {

        it("setLockRewardContracts", async () => {
            const crvLockRewards = await smock.fake("MockWmxLocker");
            const cvxlocker = await smock.fake("MockWmxLocker")
            
            await expect(mockedBooster.connect(tester2).setLockRewardContracts(crvLockRewards.address, cvxlocker.address)).to.be.revertedWith("!auth");
            await expect(
               await mockedBooster.setLockRewardContracts(crvLockRewards.address, cvxlocker.address)
            ).to.emit(mockedBooster,"LockRewardContractsUpdated").withArgs(crvLockRewards.address, cvxlocker.address);
            
            await mockedBooster.setLockRewardContracts(crvLockRewards.address, cvxlocker.address);
        })
    });

    describe("setMintRatio", async () => {

        it("setMintRatio", async () => {
            
            await expect(booster.connect(tester2).setMintRatio(10))
            .to.be.revertedWith("!auth");

            await expect(
                booster.setMintRatio(10)
            ).to.emit(booster,"MintRatioUpdated").withArgs(10);
            
        })
    });

    describe("updateDistributionByTokens", async () => {

        it("updateDistributionByTokens", async () => {

            const crvLockRewards = await smock.fake("MockWmxLocker");
            const cvxlocker = await smock.fake("MockWmxLocker")

            await expect(booster.updateDistributionByTokens(
                crv.address,
                [crvLockRewards.address, cvxlocker.address],
                [2000, 400],
                [true, false]
            )).to.emit(booster, "DistributionUpdate")
            .withArgs(crv.address, 2, 2, 2, 2400);

        })
    });

    describe("setEarmarkIncentive", async () => {

        it("setEarmarkIncentive", async () => {
            
            const MAX_EARMARK_INCENTIVE = 100;

            await expect(booster.connect(tester2).setEarmarkIncentive(50)).to.be.revertedWith("!auth");
            
            await expect(booster.setEarmarkIncentive(101)).to.be.revertedWith(">max");

            await expect(
                booster.setEarmarkIncentive(50)
            ).to.emit(booster,"SetEarmarkIncentive").withArgs(50);
            
        })
    });

    describe("addPool()", async () => {

        it("addPool", async () => {
            
            let MockERC20 = await hre.ethers.getContractFactory("MockERC20");

            const lpToken = await MockERC20.deploy("LP Token", "LPT", 9, owner.address, "100000000000000");
            testToken = await MockERC20.deploy("CVX Token", "CVXT", 9, owner.address, "100000000000000");

            let Gauge = await hre.ethers.getContractFactory("MasterWombatV2");

            let gaugeSmock = await smock.fake("MasterWombatV2") 
            
            let Wmx = await hre.ethers.getContractFactory("Wmx");
            let wmx = await Wmx.deploy(voterProxy.address, "Test Token", "TST");
            
            let VeWom = await hre.ethers.getContractFactory("VeWom");
            let veWom = await VeWom.deploy(wmx.address, gaugeSmock.address)

            let guage = await Gauge.deploy(
                wmx.address,
                veWom.address,
                1000,
                500,
                "782068310"
            )

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: lpToken.address,
                    rewards: lpToken.address,
                    active: true
                }
            })
            
            await expect(mockedBooster.connect(tester2).addPool(lpToken.address, guage.address))
            .to.be.revertedWith("!add");

            await expect(mockedBooster.addPool(constants.AddressZero, guage.address))
            .to.be.revertedWith("!param");

            await expect(mockedBooster.addPool(lpToken.address, constants.AddressZero))
            .to.be.revertedWith("!param");

            await expect(mockedBooster.addPool(lpToken.address, guage.address))
            .to.be.revertedWith("!gauge");

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: constants.AddressZero,
                    rewards: lpToken.address,
                    active: true
                }
            })

            let TokenFactory = await hre.ethers.getContractFactory("TokenFactory");

            let RewardFactory = await hre.ethers.getContractFactory("MockRewardFactory");
            let rewardFactory = await RewardFactory.deploy(
                owner.address,
                testToken.address
            );

            await rewardFactory.setOPerator(mockedBooster.address);

            let tokenFactory = await  TokenFactory.deploy(mockedBooster.address, "TEST", "TST");

            await mockedBooster.setFactories(rewardFactory.address, tokenFactory.address);

            // const token = await tokenFactory.callStatic.CreateDepositToken(lpToken.address)
            // const newRewardToken = await rewardFactory.callStatic.CreateCrvRewards(0,token,lptoken.address);
            
            await expect(
                mockedBooster.addPool(lpToken.address, guage.address)
            )
            .to.emit(mockedBooster,"PoolAdded")
            //.withArgs(lpToken.address, guage.address, tester1.address, newRewardToken, 0)

        })
    });

    describe("deposit()", async () => {
        it("Deposits amount to  gauge and mints deposit tokens", async () => {
        
            let MockERC20 = await hre.ethers.getContractFactory("MockERC20");

            const lpToken = await MockERC20.deploy("LP Token", "LPT", 9, owner.address, "100000000000000");
            testToken = await MockERC20.deploy("CVX Token", "CVXT", 9, owner.address, "100000000000000");

            let Gauge = await hre.ethers.getContractFactory("MasterWombatV2");

            let gaugeSmock = await smock.fake("MasterWombatV2") 
            
            let Wmx = await hre.ethers.getContractFactory("Wmx");
            let wmx = await Wmx.deploy(voterProxy.address, "Test Token", "TST");
            
            let VeWom = await hre.ethers.getContractFactory("VeWom");
            let veWom = await VeWom.deploy(wmx.address, gaugeSmock.address)

            let guage = await Gauge.deploy(
                wmx.address,
                veWom.address,
                1000,
                500,
                "782068310"
            )

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: constants.AddressZero,
                    rewards: lpToken.address,
                    active: true
                }
            })

            let TokenFactory = await hre.ethers.getContractFactory("TokenFactory");

            let RewardFactory = await hre.ethers.getContractFactory("MockRewardFactory");
            let rewardFactory = await RewardFactory.deploy(
                owner.address,
                testToken.address
            );

            await rewardFactory.setOPerator(mockedBooster.address);

            let tokenFactory = await  TokenFactory.deploy(mockedBooster.address, "TEST", "TST");

            await mockedBooster.setFactories(rewardFactory.address, tokenFactory.address)

            await mockedBooster.addPool(testToken.address, guage.address)

            await testToken.approve(mockedBooster.address, 100000)

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: guage.address,
                    rewards: testToken.address,
                    active: true
                }
            })

            const newPool = await mockedBooster.poolInfo(0)

            await testToken.approve(mockedBooster.address, 10000)

            let token = newPool["token"]

            await mockedBooster.setVariable("isShutdown", true)

            await expect(mockedBooster.deposit(0, 1000, true)).to.be.revertedWith("shutdown")

            await mockedBooster.setVariable("isShutdown", false)
            await expect(
                mockedBooster.deposit(0, 1000, true)
            ).to.emit(mockedBooster,"Deposited" ).withArgs(owner.address, 0,1000);

            await expect(
                mockedBooster.deposit(0, 100, false)
            ).to.emit(mockedBooster,"Deposited" ).withArgs(owner.address, 0,100);

        })


        it("earmarkRewards", async () => {

            let MockERC20 = await hre.ethers.getContractFactory("MockERC20");

            const lpToken = await MockERC20.deploy("LP Token", "LPT", 9, owner.address, "100000000000000");
            testToken = await MockERC20.deploy("CVX Token", "CVXT", 9, owner.address, "100000000000000");

            let Gauge = await hre.ethers.getContractFactory("MasterWombatV2");

            let gaugeSmock = await smock.fake("MasterWombatV2") 
            
            let Wmx = await hre.ethers.getContractFactory("Wmx");
            let wmx = await Wmx.deploy(voterProxy.address, "Test Token", "TST");
            
            let VeWom = await hre.ethers.getContractFactory("VeWom");
            let veWom = await VeWom.deploy(wmx.address, gaugeSmock.address)

            let guage = await Gauge.deploy(
                wmx.address,
                veWom.address,
                1000,
                500,
                "782068310"
            )

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: constants.AddressZero,
                    rewards: lpToken.address,
                    active: true
                }
            })

            let TokenFactory = await hre.ethers.getContractFactory("TokenFactory");

            let RewardFactory = await hre.ethers.getContractFactory("MockRewardFactory");
            let rewardFactory = await RewardFactory.deploy(
                owner.address,
                testToken.address
            );

            await rewardFactory.setOPerator(mockedBooster.address);

            let tokenFactory = await  TokenFactory.deploy(mockedBooster.address, "TEST", "TST");

            await mockedBooster.setFactories(rewardFactory.address, tokenFactory.address)

            await mockedBooster.addPool(testToken.address, guage.address)

            await testToken.approve(mockedBooster.address, 100000)

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: guage.address,
                    rewards: testToken.address,
                    active: true
                }
            })

            const newPool = await mockedBooster.poolInfo(0)

            await testToken.approve(mockedBooster.address, 10000)

            let token = newPool["token"]

            await mockedBooster.deposit(0, 1000, true);

            await mockedBooster.earmarkRewards(0)

        });

        it("earmarkRewards", async () => {

             
            let voterProxy = await smock.fake({interface: IvoterProxy});
            let cvx = await smock.fake({interface: IERC20});
            cvx.safeTransfer.returns(true);
            cvx.transfer.returns(true);
            cvx.approve.returns(true);
            cvx.safeApprove.returns(true);
            cvx.transferFrom.returns(true);
            cvx.safeTransferFrom.returns(true)

            let crv = await smock.fake({interface: IERC20});
            crv.transfer.returns(true);
            crv.approve.returns(true);
            crv.transferFrom.returns(true);
            crv.safeTransferFrom.returns(true)
            crv.safeApprove.returns(true);
            crv.safeTransfer.returns(true);

            let lpToken = await smock.fake({interface: IERC20});
            lpToken.transfer.returns(true);
            lpToken.approve.returns(true);
            lpToken.transferFrom.returns(true);
            lpToken.safeTransferFrom.returns(true)
            lpToken.safeApprove.returns(true);
            lpToken.safeTransfer.returns(true);

            let testToken = await smock.fake({interface: IERC20});
            testToken.transfer.returns(true);
            testToken.approve.returns(true);
            testToken.transferFrom.returns(true);
            testToken.safeTransferFrom.returns(true)
            testToken.safeApprove.returns(true);
            testToken.safeTransfer.returns(true);

            let Gauge = await smock.mock("MasterWombatV2");
            let gaugeSmock = await smock.fake("MasterWombatV2") 

            const minMintRatio = 10;
            const maxMintRatio = "1000000000000000000000";

            const MockBoosterFactory = await smock.mock("Booster");
            let mockedBooster = await MockBoosterFactory.deploy(
                voterProxy.address,
                cvx.address,
                crv.address,
                minMintRatio,
                maxMintRatio
            );
            
            let Wmx = await smock.mock("Wmx");
            let wmx = await Wmx.deploy(voterProxy.address, "Test Token", "TST");
            let VeWom = await smock.mock("VeWom");
            let veWom = await VeWom.deploy(wmx.address, gaugeSmock.address)

            let guage = await Gauge.deploy(
                wmx.address,
                veWom.address,
                1000,
                500,
                "782068310"
            )

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: constants.AddressZero,
                    rewards: lpToken.address,
                    active: true
                }
            })

            let tokenFactory = await smock.fake({interface: ITokenFactory});

            let RewardFactory = await smock.mock("MockRewardFactory");
            let rewardFactory = await RewardFactory.deploy(
                owner.address,
                testToken.address
            );

            let rewardPool = smock.fake("BaseRewardPool4626");
            rewardFactory.CreateCrvRewards.returns(rewardPool.address);
            await rewardFactory.setOPerator(mockedBooster.address);

            tokenFactory.CreateDepositToken.returns(testToken.address);

            await mockedBooster.setFactories(rewardFactory.address, tokenFactory.address)
            await mockedBooster.addPool(testToken.address, guage.address)
            await testToken.connect(owner).approve(mockedBooster.address, 100000)

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: guage.address,
                    rewards: testToken.address,
                    active: true
                }
            })

            let newToken1 = await smock.fake({interface: IERC20});

            newToken1.transfer.returns(true);
            newToken1.approve.returns(true);
            newToken1.transferFrom.returns(true);
            newToken1.safeTransferFrom.returns(true)
            newToken1.safeApprove.returns(true);

            let newToken2 = await smock.fake({interface: IERC20});

            newToken2.transfer.returns(true);
            newToken2.approve.returns(true);
            newToken2.transferFrom.returns(true);
            newToken2.safeTransferFrom.returns(true)
            newToken2.safeApprove.returns(true);

            voterProxy.claimCrv.returns([[newToken1.address], [100]]);
            await mockedBooster.deposit(0, 1000, true);

            await expect(mockedBooster.earmarkRewards(0)).to.be.revertedWith('!dLen')

            let distro = await smock.fake({interface: IReward})
            distro.queueNewRewards.returns();

            mockedBooster.setVariable("distributionByTokens", {
                [newToken1.address]: [
                    {
                        distro: distro.address,
                        share: 1,
                        callQueue: true
                    }
                ]
            })

            await mockedBooster.earmarkRewards(0)

        });


        it("earmarkRewards ", async () => {
 
            let voterProxy = await smock.fake({interface: IvoterProxy});
            let cvx = await smock.fake({interface: IERC20});
            cvx.safeTransfer.returns(true);
            cvx.transfer.returns(true);
            cvx.approve.returns(true);
            cvx.safeApprove.returns(true);
            cvx.transferFrom.returns(true);
            cvx.safeTransferFrom.returns(true);

            let crv = await smock.fake({interface: IERC20});
            crv.transfer.returns(true);
            crv.approve.returns(true);
            crv.transferFrom.returns(true);
            crv.safeTransferFrom.returns(true)
            crv.safeApprove.returns(true);
            crv.safeTransfer.returns(true);

            let lpToken = await smock.fake({interface: IERC20});
            lpToken.transfer.returns(true);
            lpToken.approve.returns(true);
            lpToken.transferFrom.returns(true);
            lpToken.safeTransferFrom.returns(true)
            lpToken.safeApprove.returns(true);
            lpToken.safeTransfer.returns(true);

            let testToken = await smock.fake({interface: IERC20});
            testToken.transfer.returns(true);
            testToken.approve.returns(true);
            testToken.transferFrom.returns(true);
            testToken.safeTransferFrom.returns(true)
            testToken.safeApprove.returns(true);
            testToken.safeTransfer.returns(true);

            let Gauge = await smock.mock("MasterWombatV2");
            let gaugeSmock = await smock.fake("MasterWombatV2") 

            const minMintRatio = 10;
            const maxMintRatio = "1000000000000000000000";

            const MockBoosterFactory = await smock.mock("Booster");
            let mockedBooster = await MockBoosterFactory.deploy(
                voterProxy.address,
                cvx.address,
                crv.address,
                minMintRatio,
                maxMintRatio
            );
            
            let Wmx = await smock.mock("Wmx");
            let wmx = await Wmx.deploy(voterProxy.address, "Test Token", "TST");
            let VeWom = await smock.mock("VeWom");
            let veWom = await VeWom.deploy(wmx.address, gaugeSmock.address)

            let guage = await Gauge.deploy(
                wmx.address,
                veWom.address,
                1000,
                500,
                "782068310"
            )

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: constants.AddressZero,
                    rewards: lpToken.address,
                    active: true
                }
            })

            let tokenFactory = await smock.fake({interface: ITokenFactory});

            let RewardFactory = await smock.mock("MockRewardFactory");
            let rewardFactory = await RewardFactory.deploy(
                owner.address,
                testToken.address
            );

            let rewardPool = smock.fake("BaseRewardPool4626");
            rewardFactory.CreateCrvRewards.returns(rewardPool.address);
            await rewardFactory.setOPerator(mockedBooster.address);

            tokenFactory.CreateDepositToken.returns(testToken.address);

            await mockedBooster.setFactories(rewardFactory.address, tokenFactory.address)
            await mockedBooster.addPool(testToken.address, guage.address)
            await testToken.connect(owner).approve(mockedBooster.address, 100000)

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: guage.address,
                    rewards: testToken.address,
                    active: true
                }
            })

            let newToken1 = await smock.fake({interface: IERC20});

            newToken1.transfer.returns(true);
            newToken1.approve.returns(true);
            newToken1.transferFrom.returns(true);
            newToken1.safeTransferFrom.returns(true)
            newToken1.safeApprove.returns(true);

            let newToken2 = await smock.fake({interface: IERC20});

            newToken2.transfer.returns(true);
            newToken2.approve.returns(true);
            newToken2.transferFrom.returns(true);
            newToken2.safeTransferFrom.returns(true)
            newToken2.safeApprove.returns(true);

            voterProxy.claimCrv.returns([[newToken1.address], [100]]);
            await mockedBooster.deposit(0, 1000, true);

            await expect(mockedBooster.earmarkRewards(0)).to.be.revertedWith('!dLen')

            let distro = await smock.fake({interface: IReward})
            distro.queueNewRewards.returns();

            mockedBooster.setVariable("distributionByTokens", {
                [newToken1.address]: [
                    {
                        distro: distro.address,
                        share: 1,
                        callQueue: false
                    }
                ]
            })

            await mockedBooster.earmarkRewards(0);
        })


        it("withdrawAll()", async () => {

            let MockERC20 = await hre.ethers.getContractFactory("MockERC20");

            const lpToken = await MockERC20.deploy("LP Token", "LPT", 9, owner.address, "100000000000000");
            testToken = await MockERC20.deploy("CVX Token", "CVXT", 9, owner.address, "100000000000000");

            let Gauge = await hre.ethers.getContractFactory("MasterWombatV2");

            let gaugeSmock = await smock.fake("MasterWombatV2") 
            
            let Wmx = await hre.ethers.getContractFactory("Wmx");
            let wmx = await Wmx.deploy(voterProxy.address, "Test Token", "TST");
            
            let VeWom = await hre.ethers.getContractFactory("VeWom");
            let veWom = await VeWom.deploy(wmx.address, gaugeSmock.address)

            let guage = await Gauge.deploy(
                wmx.address,
                veWom.address,
                1000,
                500,
                "782068310"
            )

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: constants.AddressZero,
                    rewards: lpToken.address,
                    active: true
                }
            })

            let TokenFactory = await hre.ethers.getContractFactory("TokenFactory");

            let RewardFactory = await hre.ethers.getContractFactory("MockRewardFactory");
            let rewardFactory = await RewardFactory.deploy(
                owner.address,
                testToken.address
            );

            await rewardFactory.setOPerator(mockedBooster.address);

            let tokenFactory = await  TokenFactory.deploy(mockedBooster.address, "TEST", "TST");

            await mockedBooster.setFactories(rewardFactory.address, tokenFactory.address)

            await mockedBooster.addPool(testToken.address, guage.address)
            await mockedBooster.addPool(testToken.address, guage.address)

            await testToken.approve(mockedBooster.address, 100000)

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: guage.address,
                    rewards: testToken.address,
                    active: true
                }
            })

            const newPool = await mockedBooster.poolInfo(0)

            await testToken.approve(mockedBooster.address, 10000)

            let token = newPool["token"]

            await mockedBooster.deposit(0, 1000, true);

            await mockedBooster.withdrawAll(0)
        })

        })

        it("withdrawTo()", async () => {

            let MockERC20 = await hre.ethers.getContractFactory("MockERC20");

            const lpToken = await MockERC20.deploy("LP Token", "LPT", 9, owner.address, "100000000000000");
            testToken = await MockERC20.deploy("CVX Token", "CVXT", 9, owner.address, "100000000000000");

            let Gauge = await hre.ethers.getContractFactory("MasterWombatV2");

            let gaugeSmock = await smock.fake("MasterWombatV2") 
            
            let Wmx = await hre.ethers.getContractFactory("Wmx");
            let wmx = await Wmx.deploy(voterProxy.address, "Test Token", "TST");
            
            let VeWom = await hre.ethers.getContractFactory("VeWom");
            let veWom = await VeWom.deploy(wmx.address, gaugeSmock.address)

            let guage = await Gauge.deploy(
                wmx.address,
                veWom.address,
                1000,
                500,
                "782068310"
            )

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: constants.AddressZero,
                    rewards: lpToken.address,
                    active: true
                }
            })

            let TokenFactory = await hre.ethers.getContractFactory("TokenFactory");

            let RewardFactory = await hre.ethers.getContractFactory("MockRewardFactory");
            let rewardFactory = await RewardFactory.deploy(
                owner.address,
                testToken.address
            );

            await rewardFactory.setOPerator(mockedBooster.address);

            let tokenFactory = await  TokenFactory.deploy(mockedBooster.address, "TEST", "TST");

            await mockedBooster.setFactories(rewardFactory.address, tokenFactory.address)

            await mockedBooster.addPool(testToken.address, guage.address)
            await mockedBooster.addPool(testToken.address, guage.address)

            await testToken.approve(mockedBooster.address, 100000)

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: guage.address,
                    rewards: testToken.address,
                    active: true
                }
            })

            const newPool = await mockedBooster.poolInfo(0)

            await testToken.approve(mockedBooster.address, 10000)

            let token = newPool["token"]

            await mockedBooster.deposit(0, 1000, true);

            let newRewardPool = smock.fake("BaseRewardPool4626", {address: "0x8aCd85898458400f7Db866d53FCFF6f0D49741FF"})

            await expect(mockedBooster.connect(owner).withdrawTo(0, 100, tester1.address)).to.be.revertedWith("!auth")
        })

    describe("shutdownPool()", async () => {

        it("shutdownPool", async () => {

            let MockERC20 = await hre.ethers.getContractFactory("MockERC20");

            const lpToken = await MockERC20.deploy("LP Token", "LPT", 9, owner.address, "100000000000000");
            testToken = await MockERC20.deploy("CVX Token", "CVXT", 9, owner.address, "100000000000000");

            let Gauge = await hre.ethers.getContractFactory("MasterWombatV2");

            let gaugeSmock = await smock.fake("MasterWombatV2") 
            
            let Wmx = await hre.ethers.getContractFactory("Wmx");
            let wmx = await Wmx.deploy(voterProxy.address, "Test Token", "TST");
            
            let VeWom = await hre.ethers.getContractFactory("VeWom");
            let veWom = await VeWom.deploy(wmx.address, gaugeSmock.address)

            let guage = await Gauge.deploy(
                wmx.address,
                veWom.address,
                1000,
                500,
                "782068310"
            )

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: lpToken.address,
                    rewards: lpToken.address,
                    active: true
                }
            })
            
            await expect(mockedBooster.connect(tester2).addPool(lpToken.address, guage.address))
            .to.be.revertedWith("!add");

            await expect(mockedBooster.addPool(constants.AddressZero, guage.address))
            .to.be.revertedWith("!param");

            await expect(mockedBooster.addPool(lpToken.address, constants.AddressZero))
            .to.be.revertedWith("!param");

            await expect(mockedBooster.addPool(lpToken.address, guage.address))
            .to.be.revertedWith("!gauge");

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: constants.AddressZero,
                    rewards: lpToken.address,
                    active: true
                }
            })

            let TokenFactory = await hre.ethers.getContractFactory("TokenFactory");

            let RewardFactory = await hre.ethers.getContractFactory("MockRewardFactory");
            
            let rewardFactory = await RewardFactory.deploy(
                owner.address,
                testToken.address
            );

            await rewardFactory.setOPerator(mockedBooster.address);

            let tokenFactory = await  TokenFactory.deploy(mockedBooster.address, "TEST", "TST");

            await mockedBooster.setFactories(rewardFactory.address, tokenFactory.address)

            await mockedBooster.addPool(lpToken.address, guage.address)

            await expect(mockedBooster.connect(tester1).shutdownPool(0)).to.be.revertedWith("!auth");

            await expect(mockedBooster.shutdownPool(0)).to.emit(mockedBooster, "PoolShutdown")
                    .withArgs(0)
              
        })
    });

    describe("shutdownSystem()", async () => {

        it("shutdownSystem", async () => {
            

            let MockERC20 = await hre.ethers.getContractFactory("MockERC20");

            const lpToken = await MockERC20.deploy("LP Token", "LPT", 9, owner.address, "100000000000000");
            testToken = await MockERC20.deploy("CVX Token", "CVXT", 9, owner.address, "100000000000000");

            let Gauge = await hre.ethers.getContractFactory("MasterWombatV2");

            let gaugeSmock = await smock.fake("MasterWombatV2") 
            
            let Wmx = await hre.ethers.getContractFactory("Wmx");
            let wmx = await Wmx.deploy(voterProxy.address, "Test Token", "TST");
            
            let VeWom = await hre.ethers.getContractFactory("VeWom");
            let veWom = await VeWom.deploy(wmx.address, gaugeSmock.address)

            let guage = await Gauge.deploy(
                wmx.address,
                veWom.address,
                1000,
                500,
                "782068310"
            )

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: constants.AddressZero,
                    rewards: lpToken.address,
                    active: true
                }
            })

            let TokenFactory = await hre.ethers.getContractFactory("TokenFactory");

            let RewardFactory = await hre.ethers.getContractFactory("MockRewardFactory");
            let rewardFactory = await RewardFactory.deploy(
                owner.address,
                testToken.address
            );

            await rewardFactory.setOPerator(mockedBooster.address);

            let tokenFactory = await  TokenFactory.deploy(mockedBooster.address, "TEST", "TST");

            await mockedBooster.setFactories(rewardFactory.address, tokenFactory.address)

            await mockedBooster.addPool(testToken.address, guage.address)
            await mockedBooster.addPool(testToken.address, guage.address)

            await expect(mockedBooster.connect(tester1).shutdownSystem()).to.be.revertedWith("!auth");

            await mockedBooster.shutdownSystem();
            const isShutdown =  await mockedBooster.isShutdown();
            expect(isShutdown).to.eq(true);
        })
    });

    describe("depositAll()", async () => {

        it("depositALl", async () => {

            let MockERC20 = await hre.ethers.getContractFactory("MockERC20");

            const lpToken = await MockERC20.deploy("LP Token", "LPT", 9, owner.address, "100000000000000");
            testToken = await MockERC20.deploy("CVX Token", "CVXT", 9, owner.address, "100000000000000");

            let Gauge = await hre.ethers.getContractFactory("MasterWombatV2");

            let gaugeSmock = await smock.fake("MasterWombatV2") 
            
            let Wmx = await hre.ethers.getContractFactory("Wmx");
            let wmx = await Wmx.deploy(voterProxy.address, "Test Token", "TST");
            
            let VeWom = await hre.ethers.getContractFactory("VeWom");
            let veWom = await VeWom.deploy(wmx.address, gaugeSmock.address)

            let guage = await Gauge.deploy(
                wmx.address,
                veWom.address,
                1000,
                500,
                "782068310"
            )

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: constants.AddressZero,
                    rewards: testToken.address,
                    active: true
                }
            })

            let TokenFactory = await hre.ethers.getContractFactory("TokenFactory");

            let RewardFactory = await hre.ethers.getContractFactory("MockRewardFactory");
            let rewardFactory = await RewardFactory.deploy(
                owner.address,
                testToken.address
            );

            await rewardFactory.setOPerator(mockedBooster.address);

            let tokenFactory = await  TokenFactory.deploy(mockedBooster.address, "TEST", "TST");

            await mockedBooster.setFactories(rewardFactory.address, tokenFactory.address)

            await mockedBooster.addPool(testToken.address, guage.address)

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: guage.address,
                    rewards: testToken.address,
                    active: true
                }
            })

            const newPool = await mockedBooster.poolInfo(0);
            console.log("test token: " + await testToken.balanceOf(owner.address));
            await testToken.approve(mockedBooster.address, 
                "100000000000000000000000"
            )

            await mockedBooster.depositAll(0, true)

        })
    });

    describe("updateDistributionByTokens", async () => {

        it("updateDistributionByTokens", async () => {
        

            const crvLockRewards = await smock.fake("MockWmxLocker");
            const cvxlocker = await smock.fake("MockWmxLocker")

            const crvLockRewards2 = await smock.fake("MockWmxLocker");
            const cvxlocker2 = await smock.fake("MockWmxLocker")

            await booster.updateDistributionByTokens(
                crv.address,
                [crvLockRewards.address, cvxlocker.address],
                [2000, 400],
                [true, false]
            );

            await booster.updateDistributionByTokens(
                crv.address,
                [crvLockRewards2.address, cvxlocker2.address],
                [2000, 400],
                [true, false]
            );

            const poolLen = await mockedBooster.poolLength();
            const distributionByTokenLength = await mockedBooster.distributionByTokenLength(crv.address)
            const distributionTokenList = await mockedBooster.distributionTokenList()

        });


        it("updateDistributionByTokens", async () => {
        
            const crvLockRewards = await smock.fake("MockWmxLocker");
            const cvxlocker = await smock.fake("MockWmxLocker")

            const crvLockRewards2 = await smock.fake("MockWmxLocker");
            const cvxlocker2 = await smock.fake("MockWmxLocker")

            await expect(booster.connect(tester1).updateDistributionByTokens(
                crv.address,
                [crvLockRewards.address, cvxlocker.address],
                [2000, 400],
                [true, false]
            )).to.be.revertedWith("!auth");

            await expect(booster.updateDistributionByTokens(
                crv.address,
                [crvLockRewards.address],
                [2000, 400],
                [true, false]
            )).to.be.revertedWith("!length");



            await booster.updateDistributionByTokens(
                crv.address,
                [crvLockRewards.address, cvxlocker.address],
                [2000, 400],
                [true, false]
            );

            await booster.updateDistributionByTokens(
                crv.address,
                [crvLockRewards2.address, cvxlocker2.address],
                [2000, 400],
                [true, false]
            );
        })
    });

    describe("rewardClaimed()", async () => {
        it("rewardClaimed", async () => {
    
            let voterProxy = await smock.fake({interface: IvoterProxy});
            let cvx = await smock.fake({interface: IERC20});
            const crvLockRewards = await smock.fake({interface: IERC20})

            await owner.sendTransaction({
                to: crvLockRewards.address,
                value: ethers.utils.parseEther("5.0")
            });
            cvx.safeTransfer.returns();
            cvx.transfer.returns();
            cvx.approve.returns();
            cvx.transferFrom.returns();
            cvx.safeTransferFrom.returns()
            cvx.mint.returns();


            let crv = await smock.fake({interface: IERC20});
            crv.transfer.returns();
            crv.approve.returns();
            crv.transferFrom.returns();
            crv.safeTransferFrom.returns()
            crv.mint.returns();

            let lpToken = await smock.fake({interface: IERC20});
            lpToken.transfer.returns();
            lpToken.approve.returns();
            lpToken.transferFrom.returns();
            lpToken.safeTransferFrom.returns()

            let testToken = await smock.fake({interface: IERC20});
            testToken.transfer.returns(true);
            testToken.approve.returns(true);
            testToken.transferFrom.returns(true);
            testToken.safeTransferFrom.returns(true)

            let Gauge = await smock.mock("MasterWombatV2");
            let gaugeSmock = await smock.fake("MasterWombatV2") 

            const minMintRatio = 10;
            const maxMintRatio = "1000000000000000000000";

            const MockBoosterFactory = await smock.mock("Booster");
            let mockedBooster = await MockBoosterFactory.deploy(
                voterProxy.address,
                cvx.address,
                crv.address,
                minMintRatio,
                maxMintRatio
            );

            let Wmx = await smock.mock("Wmx");
            let wmx = await Wmx.deploy(voterProxy.address, "Test Token", "TST");
            
            let VeWom = await smock.mock("VeWom");
            let veWom = await VeWom.deploy(wmx.address, gaugeSmock.address)

            let guage = await Gauge.deploy(
                wmx.address,
                veWom.address,
                1000,
                500,
                "782068310"
            )

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: constants.AddressZero,
                    rewards: lpToken.address,
                    active: true
                }
            })

            let tokenFactory = await smock.fake({interface: ITokenFactory});

            let RewardFactory = await smock.mock("MockRewardFactory");
            let rewardFactory = await RewardFactory.deploy(
                owner.address,
                testToken.address
            );

            let rewardPool = smock.fake("BaseRewardPool4626");
            rewardFactory.CreateCrvRewards.returns(rewardPool.address);

            await rewardFactory.setOPerator(mockedBooster.address);
            tokenFactory.CreateDepositToken.returns(testToken.address);

            await mockedBooster.setFactories(rewardFactory.address, tokenFactory.address)
            await mockedBooster.addPool(testToken.address, guage.address)
            await testToken.connect(owner).approve(mockedBooster.address, 100000)

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: guage.address,
                    rewards: testToken.address,
                    active: true
                }
            })

            await mockedBooster.deposit(0, 1000, true);
            
            await mockedBooster.setVariable("crvLockRewards", crvLockRewards.address)
            await mockedBooster.setVariable("mintRatio", 10)
            
            await expect(mockedBooster.rewardClaimed(0, tester1.address, 100, false)).to.be.revertedWith("!auth")

            await mockedBooster.connect(crvLockRewards.wallet).rewardClaimed(0, tester1.address, 100, false)

        });


        it("reclaimed locked", async () => {

            let voterProxy = await smock.fake({interface: IvoterProxy});
            let cvx = await smock.fake({interface: IERC20});
            const crvLockRewards = await smock.fake({interface: IERC20})
            const cvxLocker = await smock.fake({interface: IERC20})

            await owner.sendTransaction({
                to: crvLockRewards.address,
                value: ethers.utils.parseEther("5.0")
            });
            cvx.safeTransfer.returns();
            cvx.transfer.returns();
            cvx.approve.returns();
            cvx.transferFrom.returns();
            cvx.safeTransferFrom.returns()
            cvx.mint.returns();


            let crv = await smock.fake({interface: IERC20});
            crv.transfer.returns();
            crv.approve.returns();
            crv.transferFrom.returns();
            crv.safeTransferFrom.returns()
            crv.mint.returns();

            let lpToken = await smock.fake({interface: IERC20});
            lpToken.transfer.returns();
            lpToken.approve.returns();
            lpToken.transferFrom.returns();
            lpToken.safeTransferFrom.returns()

            let testToken = await smock.fake({interface: IERC20});
            testToken.transfer.returns(true);
            testToken.approve.returns(true);
            testToken.transferFrom.returns(true);
            testToken.safeTransferFrom.returns(true)

            let Gauge = await smock.mock("MasterWombatV2");
            let gaugeSmock = await smock.fake("MasterWombatV2") 

            const minMintRatio = 10;
            const maxMintRatio = "1000000000000000000000";

            const MockBoosterFactory = await smock.mock("Booster");
            let mockedBooster = await MockBoosterFactory.deploy(
                voterProxy.address,
                cvx.address,
                crv.address,
                minMintRatio,
                maxMintRatio
            );

            let Wmx = await smock.mock("Wmx");
            let wmx = await Wmx.deploy(voterProxy.address, "Test Token", "TST");
            
            let VeWom = await smock.mock("VeWom");
            let veWom = await VeWom.deploy(wmx.address, gaugeSmock.address)

            let guage = await Gauge.deploy(
                wmx.address,
                veWom.address,
                1000,
                500,
                "782068310"
            )

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: constants.AddressZero,
                    rewards: lpToken.address,
                    active: true
                }
            })

            let tokenFactory = await smock.fake({interface: ITokenFactory});

            let RewardFactory = await smock.mock("MockRewardFactory");
            let rewardFactory = await RewardFactory.deploy(
                owner.address,
                testToken.address
            );

            let rewardPool = smock.fake("BaseRewardPool4626");
            rewardFactory.CreateCrvRewards.returns(rewardPool.address);

            await rewardFactory.setOPerator(mockedBooster.address);
            tokenFactory.CreateDepositToken.returns(testToken.address);

            await mockedBooster.setFactories(rewardFactory.address, tokenFactory.address)
            await mockedBooster.addPool(testToken.address, guage.address)
            await testToken.connect(owner).approve(mockedBooster.address, 100000)

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: guage.address,
                    rewards: testToken.address,
                    active: true
                }
            })

            await mockedBooster.deposit(0, 1000, true);
            
            await mockedBooster.setVariable("crvLockRewards", crvLockRewards.address)
            await mockedBooster.setVariable("cvxLocker", cvxLocker.address)
            await mockedBooster.connect(crvLockRewards.wallet).rewardClaimed(0, tester1.address, 100, true)

            
        })


        it("reclaimed penalty", async () => {

            let extraRewardDistributor = await smock.fake({interface: IExtraRewardsDistributor})
            let voterProxy = await smock.fake({interface: IvoterProxy});
            let cvx = await smock.fake({interface: IERC20});
            const crvLockRewards = await smock.fake({interface: IERC20})
            const cvxLocker = await smock.fake({interface: IERC20})

            await owner.sendTransaction({
                to: crvLockRewards.address,
                value: ethers.utils.parseEther("5.0")
            });
            cvx.safeTransfer.returns();
            cvx.transfer.returns();
            cvx.approve.returns();
            cvx.transferFrom.returns();
            cvx.safeTransferFrom.returns()
            cvx.mint.returns();


            let crv = await smock.fake({interface: IERC20});
            crv.transfer.returns();
            crv.approve.returns();
            crv.transferFrom.returns();
            crv.safeTransferFrom.returns()
            crv.mint.returns();

            let lpToken = await smock.fake({interface: IERC20});
            lpToken.transfer.returns();
            lpToken.approve.returns();
            lpToken.transferFrom.returns();
            lpToken.safeTransferFrom.returns()

            let testToken = await smock.fake({interface: IERC20});
            testToken.transfer.returns(true);
            testToken.approve.returns(true);
            testToken.transferFrom.returns(true);
            testToken.safeTransferFrom.returns(true)

            let Gauge = await smock.mock("MasterWombatV2");
            let gaugeSmock = await smock.fake("MasterWombatV2") 

            const minMintRatio = 10;
            const maxMintRatio = "1000000000000000000000";

            const MockBoosterFactory = await smock.mock("Booster");
            let mockedBooster = await MockBoosterFactory.deploy(
                voterProxy.address,
                cvx.address,
                crv.address,
                minMintRatio,
                maxMintRatio
            );

            let Wmx = await smock.mock("Wmx");
            let wmx = await Wmx.deploy(voterProxy.address, "Test Token", "TST");
            
            let VeWom = await smock.mock("VeWom");
            let veWom = await VeWom.deploy(wmx.address, gaugeSmock.address)

            let guage = await Gauge.deploy(
                wmx.address,
                veWom.address,
                1000,
                500,
                "782068310"
            )

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: constants.AddressZero,
                    rewards: lpToken.address,
                    active: true
                }
            })

            let tokenFactory = await smock.fake({interface: ITokenFactory});

            let RewardFactory = await smock.mock("MockRewardFactory");
            let rewardFactory = await RewardFactory.deploy(
                owner.address,
                testToken.address
            );

            let rewardPool = smock.fake("BaseRewardPool4626");
            rewardFactory.CreateCrvRewards.returns(rewardPool.address);

            await rewardFactory.setOPerator(mockedBooster.address);
            tokenFactory.CreateDepositToken.returns(testToken.address);

            await mockedBooster.setFactories(rewardFactory.address, tokenFactory.address)
            await mockedBooster.addPool(testToken.address, guage.address)
            await testToken.connect(owner).approve(mockedBooster.address, 100000)

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: guage.address,
                    rewards: testToken.address,
                    active: true
                }
            })

            await mockedBooster.deposit(0, 1000, true);
            
            
            await mockedBooster.setVariable("crvLockRewards", crvLockRewards.address)
            await mockedBooster.setVariable("cvxLocker", cvxLocker.address)
            await mockedBooster.setVariable("penaltyShare", 10)
            await mockedBooster.setVariable("extraRewardsDist", extraRewardDistributor.address)
            
            await mockedBooster.connect(crvLockRewards.wallet).rewardClaimed(0, tester1.address, 1000, false)

            
        })
    });

    describe("distributionByTokenLength()", async () => {

        it("distributionByTokenLength", async () => {

            let MockERC20 = await hre.ethers.getContractFactory("MockERC20");

            const lpToken = await MockERC20.deploy("LP Token", "LPT", 9, owner.address, "100000000000000");
            testToken = await MockERC20.deploy("CVX Token", "CVXT", 9, owner.address, "100000000000000");

            let Gauge = await hre.ethers.getContractFactory("MasterWombatV2");
            let gaugeSmock = await smock.fake("MasterWombatV2") 
            
            let Wmx = await hre.ethers.getContractFactory("Wmx");
            let wmx = await Wmx.deploy(voterProxy.address, "Test Token", "TST");
            
            let VeWom = await hre.ethers.getContractFactory("VeWom");
            let veWom = await VeWom.deploy(wmx.address, gaugeSmock.address)

            let guage = await Gauge.deploy(
                wmx.address,
                veWom.address,
                1000,
                500,
                "782068310"
            )

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: guage.address,
                    rewards: lpToken.address,
                    active: true
                }
            })

            let TokenFactory = await hre.ethers.getContractFactory("TokenFactory");

            let RewardFactory = await hre.ethers.getContractFactory("MockRewardFactory");

            let rewardFactory = await RewardFactory.deploy(
                owner.address,
                testToken.address
            );

            await mockedBooster.setVariable("feeTokens", {
                [guage.address]: {
                    distro: constants.AddressZero,
                    rewards: lpToken.address,
                    active: true
                }
            })

            await lpToken.approve(mockedBooster.address, 1000000)

            await rewardFactory.setOPerator(mockedBooster.address);

            let tokenFactory = await  TokenFactory.deploy(mockedBooster.address, "TEST", "TST");

            await mockedBooster.setFactories(rewardFactory.address, tokenFactory.address)

            await mockedBooster.addPool(lpToken.address, guage.address)

            let len = await mockedBooster.poolLength();
            // console.log(len)
            await mockedBooster.distributionByTokenLength(lpToken.address)
        })
    });

    describe("setVote()", async () => {

        it("sets vote", async () => {
            let messageHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("STAKE"));

            await mockedBooster.setVote(messageHash, true)
        })
    });

    describe("voteExecute()", async () => {

        it("Should execute vote", async () => {
            
            const ifaceToken = new ethers.utils.Interface(TokenArtifact.abi);
            const calldata_transfer = ifaceToken.encodeFunctionData("balanceOf", [owner.address]);

            await expect(
                mockedBooster.connect(tester2).voteExecute(owner.address, 10, calldata_transfer, {value: 10})
            ).to.be.revertedWith("!auth")

            await expect(
                mockedBooster.voteExecute(owner.address, 10, calldata_transfer, {value: 10})
            ).to.be.revertedWith("!voting")

            await mockedBooster.setVariable("votingMap", {
                [owner.address] : true
            })
            await mockedBooster.voteExecute(owner.address, 10, calldata_transfer, {value: 10})
        })
    });

    });
