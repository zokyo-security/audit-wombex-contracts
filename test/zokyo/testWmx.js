const chai = require("chai");
const { solidity } = require("ethereum-waffle");
const { ethers } = require("hardhat");
const hre = require("hardhat");
const { smock } = require("@defi-wonderland/smock");

const { expect } = chai;
chai.use(solidity);
chai.use(smock.matchers);

describe("Test Wmx", () => {
    let owner, user1, user2, user3, user4;
    let wmxERC20, zokyoStaker;

    before(async () => {
        [owner, user1, user2, user3, user4] = await ethers.getSigners();

        // weth = await smock.fake("ERC20");
        // await weth.symbol.returns("weth");
        // await weth.decimals.returns(8);

        // CHAINLINK_ETH_USD = DUMMY_ADDRESS;

        // proxyFake.operator.returns(user4.address);
    });

    beforeEach(async () => {
        let zokyoStakerFactory = await hre.ethers.getContractFactory("ZokyoStaker");
        zokyoStaker = await zokyoStakerFactory.deploy(user2.address);

        let ERC20ContractFactory = await hre.ethers.getContractFactory("Wmx");
        wmxERC20 = await ERC20ContractFactory.deploy(zokyoStaker.address, "wmx token", "wmx");
    });

    it("Should test of minter can mint more tokens", async () => {
        await expect(wmxERC20.updateOperator()).to.be.revertedWith("!init");
        expect(await wmxERC20.init(user2.address, user3.address));
    });
});
