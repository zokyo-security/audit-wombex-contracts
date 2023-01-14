const { ethers } = require("hardhat");
const { FakeContract, smock } = require('@defi-wonderland/smock');
const { expect } = require('chai')
const  chai  = require('chai')
const { BigNumber, constants } = require('ethers');

const TokenArtifact = require("../../artifacts/@openzeppelin/contracts-0.6/token/ERC20/ERC20.sol/ERC20.json");
const { hashMessage } = require("@ethersproject/hash");


chai.should();
chai.use(smock.matchers);

describe("VoterProxy", async () => {

let owner, tester1, tester2, tester3;
let voterProxy, wom, veWom, gaugeSmock, guage, mockedBooster;

    beforeEach(async () => {

        const signers = await hre.ethers.getSigners();

        owner = signers[0];
        tester1 = signers[1];
        tester2 = signers[2];
        tester3 = signers[3];

        let gaugeSmock = await smock.fake("MasterWombatV2")

        let weth = await smock.fake("MockERC20");
        guage = await smock.fake("MasterWombatV2")

        wom = await smock.fake("Wmx");
        wom.approve.returns(true)


        veWom = await smock.fake("VeWom")

        const VoterProxyFactory = await smock.mock("MockVoterProxy");

        voterProxy = await VoterProxyFactory.deploy(
            wom.address,
            veWom.address,
            weth.address
        );

        let Wom = await hre.ethers.getContractFactory("Wmx");
        wom = await Wom.deploy(voterProxy.address, "Test Token", "TST");

        let VeWom = await hre.ethers.getContractFactory("VeWom");
        veWom = await VeWom.deploy(wom.address, gaugeSmock.address)

        await voterProxy.setWom(wom.address);
        await voterProxy.setVeWom(veWom.address);
        
    });


    describe("setDepositor", async () => {
        it("setDepositor", async () => {
            await expect(voterProxy.connect(tester2).setDepositor(tester1.address)).to.be.revertedWith("!auth");
            await voterProxy.setDepositor(tester1.address);
        });
    });

    describe("setRewardDeposit", async () => {
        it("setRewardDeposit", async () => {
            await expect(voterProxy.connect(tester2).setRewardDeposit(tester1.address, tester2.address)).to.be.revertedWith("!auth");
            await voterProxy.setRewardDeposit(tester3.address, tester2.address)
        });
    });

    describe("setOperator", async () => {
        it("setOperator", async () => {

            await expect(voterProxy.connect(tester2).setOperator(tester2.address)).to.be.revertedWith("!auth"); 
            await expect(voterProxy.setOperator(constants.AddressZero)) //.to.be.revertedWith("needs shutdown"); 

        });
    });

    describe("Initialization", async () => {
        it("Initialization", async () => {

            // function setVote(bytes32 _hash, bool _valid) external {
            //     require(msg.sender == operator, "!auth");
            //     votes[_hash] = _valid;
            //     emit VoteSet(_hash, _valid);
            // }

            // const hash = await voterProxy;

            // await expect(voterProxy.connect(tester2).setVote(hash, true)).to.be.revertedWith("!auth"); 
            // await expect(voterProxy.connect(tester2).setVote(hash, true)).to.emit(voterProxy, "VoteSet")
            //    .withArgs(hash, true); 

        });
    });


    describe("lock", async () => {
        it("lock", async () => {

            // function lock(uint256 _lockDays) external returns(bool){
            //     require(msg.sender == depositor, "!auth");
        
            //     uint256 balance = IERC20(wom).balanceOf(address(this));
            //     IVeWom(veWom).mint(balance, _lockDays);
        
            //     emit Lock(balance, _lockDays);
            //     return true;
            // }

            // function init(address _to, address _minter) external {
            //     require(msg.sender == operator, "Only operator");
            //     require(totalSupply() == 0, "Only once");
            //     require(_minter != address(0), "Invalid minter");
        
            //     _mint(_to, INIT_MINT_AMOUNT);
            //     updateOperator();
            //     minter = _minter;
            //     minterMinted = 0;
        
            //     emit Initialised();
            // }

            // await wom.init(owner.address, owner.address)

            // await voterProxy.setDepositor(owner.address);

            // await wom.mint(owner.address, 1000000)

            // await wom.transfer(voterProxy.address)

            // // TO DO: CHECK FOR CONTRACTS WOM BAL
            // await expect(voterProxy.connect(tester2).lock(365)).to.be.revertedWith("!auth"); 

            // await expect(voterProxy.lock(365)).to.emit(voterProxy, "Lock")
                //.withArgs(hash, true); 
        });
    });

    describe("setLpTokensPid", async () => {
        it("setLpTokensPid", async () => {

            let gaugeSmock = await smock.fake("MockMasterWombatV2")

            await voterProxy.setOperator(owner.address)
            await gaugeSmock.deposit.whenCalledWith(0, 0).returns();

            await gaugeSmock.poolLength.returns(5);
            
            let multiRewarderPerSec = await smock.fake("MultiRewarderPerSec")

            await gaugeSmock.poolInfo.whenCalledWith(0).returns(

                {
                    lpToken : "0x276C216D241856199A83bf27b2286659e5b877D3",
                    allocPoint : 10,
                    lastRewardTimestamp : 1609459200,
                    accWomPerShare : 0,
                    rewarder : multiRewarderPerSec.address,
                    sumOfFactors : 0,
                    accWomPerFactorShare : 0
                }
            )

            await expect(voterProxy.connect(tester3).setLpTokensPid(gaugeSmock.address)).to.be.revertedWith("!auth")
            
            await voterProxy.setLpTokensPid(gaugeSmock.address)


        });
    });

    describe("getName", async () => {
        it("getName", async () => {
            
            await voterProxy.getName();
            await voterProxy.setOwner(tester1.address)

            await expect(voterProxy.connect(owner).setOwner(tester2.address)).to.be.revertedWith("!auth")
        });

    });

    describe("setVote", async () => {
        it("setVote", async () => {
            
           
            let messageHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("STAKE"));

            await voterProxy.setOperator(owner.address)

            await expect(voterProxy.connect(tester2).setVote(messageHash, true)).to.be.revertedWith("!auth")
            await voterProxy.connect(owner).setVote(messageHash, true);
            await voterProxy.isValidSignature(messageHash, messageHash)

            let messageHash2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("STAKkkkkE"))

            isvalid = await voterProxy.isValidSignature(messageHash2, messageHash)
            // console.log(isvalid)
        });
    });

    describe("execute", async () => {
        it("execute", async () => {
            
            let testToken = await smock.fake("MockERC20");

            const ifaceToken = new ethers.utils.Interface(TokenArtifact.abi);
            const calldata_transfer = ifaceToken.encodeFunctionData("balanceOf", [owner.address]);
            const protected_calldata_transfer = ifaceToken.encodeFunctionData("balanceOf", [wom.address]);

            await voterProxy.setOperator(owner.address)

            await voterProxy.setVariable("protectedTokens", {
                [testToken.address]: true
            })
            await expect(voterProxy.connect(tester3).execute(testToken.address, 0, calldata_transfer)).to.be.revertedWith("!auth")
            await expect(voterProxy.execute(testToken.address, 0, protected_calldata_transfer)).to.be.revertedWith("protected")

            await voterProxy.setVariable("protectedTokens", {
                [testToken.address]: false
            })
            await voterProxy.execute(testToken.address, 0, calldata_transfer)
        });
    });

    describe("withdrawLp", async () => {
        it("withdrawLp", async () => {
            
            let MockERC20 = await hre.ethers.getContractFactory("MockERC20");
            
            let lpToken = await MockERC20.deploy("CVX Token", "CVXT", 9, owner.address, 10000000000);

            let gaugeSmock = await smock.fake("MasterWombatV2")

            await voterProxy.setOperator(owner.address)

            // console.log(await lpToken.functions)
            await voterProxy.setVariable("lpTokenPidSet", {
                [gaugeSmock.address] : {
                    [lpToken.address] : true
                }
            } )

            await voterProxy.withdrawLp(lpToken.address, gaugeSmock.address, 100)
         
        });
    });

    describe("deposit", async () => {
        it("deposit", async () => {

            let testToken = await smock.fake("MockERC20");
            let lp = await smock.fake("MockSafeERC20");
            await lp.connect(owner).setToken(testToken.address)

            let gaugeSmock = await smock.fake("MasterWombatV2")
            let veWom = await smock.fake("VeWom")
            
            await voterProxy.setVeWom(veWom.address);
            await voterProxy.setWom(lp.address);

            await voterProxy.setDepositor(owner.address)

            await voterProxy.lock(365);

            await lp.balanceOf.whenCalledWith(voterProxy.address).returns(500)

            await lp.safeApprove.whenCalledWith(gaugeSmock.address, 0).returns();

            await lp.safeApprove.whenCalledWith(gaugeSmock.address, 500).returns();
            
            await lp.allowance.whenCalledWith(lp.address,gaugeSmock.address).returns(true);

            await voterProxy.setVeWom(veWom.address);
            await voterProxy.setWom(wom.address);

            await voterProxy.setDepositor(owner.address);

            await voterProxy.setRewardDeposit(owner.address, lp.address)

            await voterProxy.setVariable("lpTokenPidSet", {
                [gaugeSmock.address] : {
                    [lp.address] : true
                }
            } )

            await gaugeSmock.deposit.whenCalledWith(0, 500).returns();


            await voterProxy.setVariable("lpTokenToPid", {
                [gaugeSmock.address] : {
                    [lp.address] : 0
                }
            } )

            await voterProxy.setOperator(owner.address)
            await voterProxy.deposit(lp.address, gaugeSmock.address)

            await voterProxy.setVariable("withdrawer", owner.address)
            await voterProxy.setVariable("protectedTokens", {
                [lp.address]: false
            })

            await voterProxy.withdrawAllLp(lp.address, gaugeSmock.address)
            await voterProxy.withdraw(lp.address)
        });



        it("deposit/withdraw", async () => {

            let testToken = await smock.fake("MockERC20");
            let lp = await smock.fake("MockSafeERC20");
            await lp.connect(owner).setToken(testToken.address)

            let gaugeSmock = await smock.fake("MasterWombatV2")
            let veWom = await smock.fake("VeWom")
            
            await voterProxy.setVeWom(veWom.address);
            await voterProxy.setWom(lp.address);

            await voterProxy.setDepositor(owner.address)

            await voterProxy.lock(365);

            await lp.balanceOf.whenCalledWith(voterProxy.address).returns(500)

            await lp.safeApprove.whenCalledWith(gaugeSmock.address, 0).returns();

            await lp.safeApprove.whenCalledWith(gaugeSmock.address, 500).returns();
            
            await lp.allowance.whenCalledWith(lp.address,gaugeSmock.address).returns(true);

            await voterProxy.setVeWom(veWom.address);
            await voterProxy.setWom(wom.address);

            await voterProxy.setDepositor(owner.address);

            await voterProxy.setRewardDeposit(owner.address, lp.address)

            await voterProxy.setVariable("lpTokenPidSet", {
                [gaugeSmock.address] : {
                    [lp.address] : true
                }
            } )

            await gaugeSmock.deposit.whenCalledWith(0, 500).returns();


            await voterProxy.setVariable("lpTokenToPid", {
                [gaugeSmock.address] : {
                    [lp.address] : 0
                }
            } )

            await voterProxy.setOperator(owner.address)
            await voterProxy.deposit(lp.address, gaugeSmock.address)

            await voterProxy.setVariable("withdrawer", owner.address)
            await voterProxy.setVariable("protectedTokens", {
                [lp.address]: true
            })

            // await voterProxy.withdrawAllLp(lp.address, gaugeSmock.address)
            await expect(voterProxy.withdraw(lp.address)).to.be.revertedWith("protected")

            await voterProxy.setVariable("protectedTokens", {
                [lp.address]: false
            })
            await expect(voterProxy.connect(tester1).withdraw(lp.address)).to.be.revertedWith("!auth")
            await voterProxy.withdraw(lp.address)
        });


        it("deposit/withdrawALl", async () => {

            let testToken = await smock.fake("MockERC20");
            let lp = await smock.fake("MockSafeERC20");
            await lp.connect(owner).setToken(testToken.address)

            let gaugeSmock = await smock.fake("MasterWombatV2")
            let veWom = await smock.fake("VeWom")
            
            await voterProxy.setVeWom(veWom.address);
            await voterProxy.setWom(lp.address);

            await voterProxy.setDepositor(owner.address)

            await voterProxy.lock(365);

            await lp.balanceOf.whenCalledWith(voterProxy.address).returns(500)

            await lp.safeApprove.whenCalledWith(gaugeSmock.address, 0).returns();

            await lp.safeApprove.whenCalledWith(gaugeSmock.address, 500).returns();
            
            await lp.allowance.whenCalledWith(lp.address,gaugeSmock.address).returns(true);

            await voterProxy.setVeWom(veWom.address);
            await voterProxy.setWom(wom.address);

            await voterProxy.setDepositor(owner.address);

            await voterProxy.setRewardDeposit(owner.address, lp.address)

            await voterProxy.setVariable("lpTokenPidSet", {
                [gaugeSmock.address] : {
                    [lp.address] : true
                }
            } )

            await gaugeSmock.deposit.whenCalledWith(0, 500).returns();


            await voterProxy.setVariable("lpTokenToPid", {
                [gaugeSmock.address] : {
                    [lp.address] : 0
                }
            } )

            await voterProxy.setOperator(owner.address)
            await voterProxy.deposit(lp.address, gaugeSmock.address)

            await voterProxy.setVariable("withdrawer", owner.address)
            await voterProxy.setVariable("protectedTokens", {
                [lp.address]: true
            })

            // await voterProxy.withdrawAllLp(lp.address, gaugeSmock.address)
            await expect(voterProxy.withdraw(lp.address)).to.be.revertedWith("protected")

            await voterProxy.setVariable("protectedTokens", {
                [lp.address]: false
            })

            await voterProxy.setVariable("lpTokenPidSet", {
                [gaugeSmock.address] : {
                    [lp.address] : true
                }
            } )

            await expect(voterProxy.connect(tester1).withdrawAllLp(lp.address, gaugeSmock.address)).to.be.revertedWith("!auth")
            
            await voterProxy.setVariable("lpTokenPidSet", {
                [gaugeSmock.address] : {
                    [lp.address] : false
                }
            } )

            await expect(voterProxy.withdrawAllLp(lp.address, gaugeSmock.address)).to.be.revertedWith("!lp_token_set")
            
            await voterProxy.setVariable("lpTokenPidSet", {
                [gaugeSmock.address] : {
                    [lp.address] : true
                }
            } )
            await voterProxy.withdrawAllLp(lp.address, gaugeSmock.address)
        });

        it("deposit/withdrawLp", async () => {

            let testToken = await smock.fake("MockERC20");
            let lp = await smock.fake("MockSafeERC20");
            await lp.connect(owner).setToken(testToken.address)

            let gaugeSmock = await smock.fake("MasterWombatV2")
            let veWom = await smock.fake("VeWom")
            
            await voterProxy.setVeWom(veWom.address);
            await voterProxy.setWom(lp.address);

            await voterProxy.setDepositor(owner.address)

            await voterProxy.lock(365);

            await lp.balanceOf.whenCalledWith(voterProxy.address).returns(500)

            await lp.safeApprove.whenCalledWith(gaugeSmock.address, 0).returns();

            await lp.safeApprove.whenCalledWith(gaugeSmock.address, 500).returns();
            
            await lp.allowance.whenCalledWith(lp.address,gaugeSmock.address).returns(true);

            await voterProxy.setVeWom(veWom.address);
            await voterProxy.setWom(wom.address);

            await voterProxy.setDepositor(owner.address);

            await voterProxy.setRewardDeposit(owner.address, lp.address)

            await voterProxy.setVariable("lpTokenPidSet", {
                [gaugeSmock.address] : {
                    [lp.address] : true
                }
            } )

            await gaugeSmock.deposit.whenCalledWith(0, 500).returns();


            await voterProxy.setVariable("lpTokenToPid", {
                [gaugeSmock.address] : {
                    [lp.address] : 0
                }
            } )

            await voterProxy.setOperator(owner.address)
            await voterProxy.deposit(lp.address, gaugeSmock.address)

            await voterProxy.setVariable("withdrawer", owner.address)
            await voterProxy.setVariable("protectedTokens", {
                [lp.address]: true
            })

            // await voterProxy.withdrawAllLp(lp.address, gaugeSmock.address)
            await expect(voterProxy.withdraw(lp.address)).to.be.revertedWith("protected")

            await voterProxy.setVariable("protectedTokens", {
                [lp.address]: false
            })

            await voterProxy.setVariable("lpTokenPidSet", {
                [gaugeSmock.address] : {
                    [lp.address] : true
                }
            } )

            await expect(voterProxy.connect(tester1).withdrawLp(lp.address, gaugeSmock.address, 100)).to.be.revertedWith("!auth")
            
            await voterProxy.setVariable("lpTokenPidSet", {
                [gaugeSmock.address] : {
                    [lp.address] : false
                }
            } )

            await expect(voterProxy.withdrawLp(lp.address, gaugeSmock.address, 100)).to.be.revertedWith("!lp_token_set")
            
            await voterProxy.setVariable("lpTokenPidSet", {
                [gaugeSmock.address] : {
                    [lp.address] : true
                }
            } )
            await voterProxy.withdrawLp(lp.address, gaugeSmock.address, 100)
        });

        it("deposit", async () => {

            let testToken = await smock.fake("MockERC20");
            let lp = await smock.fake("MockSafeERC20");
            await lp.connect(owner).setToken(testToken.address)

            let gaugeSmock = await smock.fake("MasterWombatV2")
            let veWom = await smock.fake("VeWom")
            
            await voterProxy.setVeWom(veWom.address);
            await voterProxy.setWom(lp.address);

            await voterProxy.setDepositor(owner.address)

            await voterProxy.lock(365);

            await lp.balanceOf.whenCalledWith(voterProxy.address).returns(500)

            await lp.safeApprove.whenCalledWith(gaugeSmock.address, 0).returns();

            await lp.safeApprove.whenCalledWith(gaugeSmock.address, 500).returns();
            
            await lp.allowance.whenCalledWith(lp.address,gaugeSmock.address).returns(true);

            await voterProxy.setVeWom(veWom.address);
            await voterProxy.setWom(wom.address);

            await voterProxy.setDepositor(owner.address);

            await voterProxy.setRewardDeposit(owner.address, lp.address)

            await voterProxy.setVariable("lpTokenPidSet", {
                [gaugeSmock.address] : {
                    [lp.address] : false
                }
            } )

            await gaugeSmock.deposit.whenCalledWith(0, 500).returns();


            await voterProxy.setVariable("lpTokenToPid", {
                [gaugeSmock.address] : {
                    [lp.address] : 0
                }
            } )

            await voterProxy.setOperator(owner.address)
            await expect(voterProxy.deposit(lp.address, gaugeSmock.address)).to.be.revertedWith('!lp_token_set')

            await voterProxy.setVariable("lpTokenPidSet", {
                [gaugeSmock.address] : {
                    [lp.address] : true
                }
            } )
            await expect(voterProxy.connect(tester1).deposit(lp.address, gaugeSmock.address)).to.be.revertedWith('!auth')

            voterProxy.deposit(lp.address, gaugeSmock.address)
            
        });
    });

    describe("lock", async () => {
        it("lock", async () => {
            
            let testToken = await smock.fake("MockERC20");
            let wom = await smock.fake("MockSafeERC20");
            await wom.connect(owner).setToken(testToken.address)

            let veWom = await smock.fake("VeWom")
            
            await voterProxy.setVeWom(veWom.address);
            await voterProxy.setWom(wom.address);

            await expect(voterProxy.connect(tester1).lock(365)).to.be.revertedWith("!auth")

            await voterProxy.setDepositor(owner.address)

            await voterProxy.lock(365);

            await wom.safeTransfer.whenCalledWith(owner.address, 1000).returns();

            await wom.safeTransfer.whenCalledWith(voterProxy.address, 1000).returns();
            
            await voterProxy.setVeWom(veWom.address);
            await voterProxy.setWom(wom.address);

            await veWom.burn.whenCalledWith(500).returns();

            await voterProxy.setDepositor(owner.address);

            await expect(voterProxy.connect(tester1).releaseLock(500)).to.be.revertedWith("!auth")
            await voterProxy.releaseLock(500)

        });
    });

    describe("claimCRV", async () => {
        it("CLAIMcrv", async () => {
            
            let gaugeSmock = await smock.fake("MockMasterWombatV2")

            await voterProxy.setOperator(owner.address)
            await gaugeSmock.deposit.whenCalledWith(0, 0).returns();
            
            let multiRewarderPerSec = await smock.fake("MultiRewarderPerSec")

            let testToken = await smock.fake("MockERC20");
            testToken.transfer.returns(true);

            let testToken2 = await smock.fake("MockERC20");
            testToken2.transfer.returns(true)

            await multiRewarderPerSec.rewardTokens.returns([testToken.address, testToken2.address])

            await gaugeSmock.poolInfo.whenCalledWith(0).returns(

                {
                    lpToken : "0x276C216D241856199A83bf27b2286659e5b877D3",
                    allocPoint : 10,
                    lastRewardTimestamp : 1609459200,
                    accWomPerShare : 0,
                    rewarder : multiRewarderPerSec.address,
                    sumOfFactors : 0,
                    accWomPerFactorShare : 0
                }
            )

           await expect(voterProxy.connect(tester3).claimCrv(gaugeSmock.address, 0)).to.be.revertedWith("!auth")

            await voterProxy.claimCrv(gaugeSmock.address, 0);
        });
    });

    describe("setRewardDeposit", async () => {
        it("setRewardDeposit", async () => {
            
            let wom = await smock.fake("Wmx");
            await voterProxy.setRewardDeposit(tester1.address, wom.address)
        });
    });
})