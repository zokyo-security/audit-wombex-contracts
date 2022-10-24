const chai = require("chai");
const { solidity } = require("ethereum-waffle");
const { ethers } = require("hardhat");
const hre = require("hardhat");
const { smock } = require("@defi-wonderland/smock");
const { BigNumber } = require("ethers");

const { expect } = chai;
chai.use(solidity);
chai.use(smock.matchers);

describe("Test Wmx", () => {
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    let owner, user1, user2, user3, user4;
    let wmxERC20, zokyoStaker;

    before(async () => {
        [owner, user1, user2, user3, user4] = await ethers.getSigners();
    });

    beforeEach(async () => {
        let zokyoStakerFactory = await hre.ethers.getContractFactory("ZokyoStaker");
        zokyoStaker = await zokyoStakerFactory.deploy(user2.address);

        let ERC20ContractFactory = await hre.ethers.getContractFactory("Wmx");
        wmxERC20 = await ERC20ContractFactory.deploy(zokyoStaker.address, "wmx token", "wmx");
    });

    describe("Should test init for Wmx.sol", async () => {
        it("Call init", async () => {
            await expect(wmxERC20.updateOperator()).to.be.revertedWith("!init");
            await expect(wmxERC20.connect(user4).init(user2.address, user3.address)).to.be.revertedWith(
                "Only operator",
            );

            expect(await wmxERC20.init(user2.address, user3.address))
                .to.emit(wmxERC20, "Initialised")
                .withArgs();

            await expect(wmxERC20.init(user2.address, user3.address)).to.be.revertedWith("Only operator");

            await expect(wmxERC20.connect(user2).init(user2.address, user3.address)).to.be.revertedWith("Only once");
            expect(await wmxERC20.callStatic.totalSupply()).to.be.equal(BigNumber.from("50000000000000000000000000"));
        });

        it("Call init with zero address at minter", async () => {
            await expect(wmxERC20.init(user2.address, ZERO_ADDRESS)).to.be.revertedWith("Invalid minter");
        });

        it("Update operator", async () => {
            expect(await wmxERC20.init(user2.address, user3.address))
                .to.emit(wmxERC20, "Initialised")
                .withArgs();

            await expect(wmxERC20.updateOperator()).to.be.revertedWith("!operator");
        });
    });

    describe("Should test mint for Wmx.sol", async () => {
        beforeEach(async () => {
            let zokyoStakerFactory = await hre.ethers.getContractFactory("ZokyoStaker");
            zokyoStaker = await zokyoStakerFactory.deploy(user2.address);

            let ERC20ContractFactory = await hre.ethers.getContractFactory("Wmx");
            wmxERC20 = await ERC20ContractFactory.deploy(zokyoStaker.address, "wmx token", "wmx");
            await wmxERC20.init(user2.address, user3.address);
        });

        it("Only minter can mint", async () => {
            await expect(
                wmxERC20.connect(user1).minterMint(user4.address, "1000000000000000000000000"),
            ).to.be.revertedWith("Only minter");
        });

        it("Call minter mint", async () => {
            expect(await wmxERC20.connect(user3).minterMint(user4.address, "1000000000000000000000000"));
            expect(await wmxERC20.callStatic.totalSupply()).to.be.equal(BigNumber.from("51000000000000000000000000"));
        });

        it("Non-operator mints", async () => {
            expect(await wmxERC20.connect(owner).mint(owner.address, "1000000000000000000000000"));
            expect(await wmxERC20.callStatic.totalSupply()).to.be.equal(BigNumber.from("50000000000000000000000000"));
        });

        it("Operator mints", async () => {
            expect(await wmxERC20.connect(user2).mint(user1.address, "1000000000000000000000000"));
            expect(await wmxERC20.callStatic.totalSupply()).to.be.equal(BigNumber.from("52504000000000000000000000"));
        });

        it("Operator tries to mint without Wmx.sol intitialized", async () => {
            let zokyoStakerFactory = await hre.ethers.getContractFactory("ZokyoStaker");
            zokyoStaker = await zokyoStakerFactory.deploy(user2.address);

            let ERC20ContractFactory = await hre.ethers.getContractFactory("Wmx");
            let wmxERC20Temp = await ERC20ContractFactory.deploy(zokyoStaker.address, "wmx token", "wmx");

            await expect(
                wmxERC20Temp.connect(user2).mint(user1.address, "1000000000000000000000000"),
            ).to.be.revertedWith("Not initialised");
        });
    });

    describe("Test mints", async () => {
        beforeEach(async () => {
            let zokyoStakerFactory = await hre.ethers.getContractFactory("ZokyoStaker");
            zokyoStaker = await zokyoStakerFactory.deploy(user2.address);

            let ERC20ContractFactory = await hre.ethers.getContractFactory("Wmx");
            wmxERC20 = await ERC20ContractFactory.deploy(zokyoStaker.address, "wmx token", "wmx");
            await wmxERC20.init(user2.address, user3.address);
        });

        it("Minter mints max2", async () => {
            // 1m 1000000000000000000000000
            // 500m 500000000000000000000000000
            // 50m 50000000000000000000000000
            expect(await wmxERC20.callStatic.totalSupply()).to.be.equal(BigNumber.from("50000000000000000000000000"));

            expect(await wmxERC20.connect(user2).mint(user1.address, "500000000000000000000000000"));

            expect(await wmxERC20.callStatic.totalSupply()).to.be.equal(BigNumber.from("100000000000000000000000000"));
            expect(await wmxERC20.connect(user2).mint(user1.address, "1"));

            expect(await wmxERC20.callStatic.totalSupply()).to.be.equal(BigNumber.from("100000000000000000000000000"));
            expect(
                await wmxERC20
                    .connect(user2)
                    .mint(
                        user1.address,
                        "115792089237316195423570985008687907853269984665640564039457584007913129639935",
                    ),
            );

            expect(await wmxERC20.callStatic.totalSupply()).to.be.equal(BigNumber.from("100000000000000000000000000"));
        });

        it("Operator mints max3", async () => {
            // 1m 1000000000000000000000000
            // 500m 500000000000000000000000000
            // 50m 50000000000000000000000000
            expect(await wmxERC20.callStatic.totalSupply()).to.be.equal(BigNumber.from("50000000000000000000000000"));

            expect(await wmxERC20.connect(user2).mint(user1.address, "500000000000000000000000000"));

            expect(await wmxERC20.callStatic.totalSupply()).to.be.equal(BigNumber.from("100000000000000000000000000"));
            expect(await wmxERC20.connect(user2).mint(user1.address, "1"));

            expect(await wmxERC20.callStatic.totalSupply()).to.be.equal(BigNumber.from("100000000000000000000000000"));
            expect(
                await wmxERC20
                    .connect(user2)
                    .mint(
                        user1.address,
                        "115792089237316195423570985008687907853269984665640564039457584007913129639935",
                    ),
            );

            expect(await wmxERC20.connect(user3).minterMint(user4.address, "50000000000000000000000000"));

            expect(await wmxERC20.callStatic.totalSupply()).to.be.equal(BigNumber.from("150000000000000000000000000"));
            expect(await wmxERC20.connect(user2).mint(user1.address, "1"));
            expect(await wmxERC20.callStatic.totalSupply()).to.be.equal(BigNumber.from("150000000000000000000000000"));
        });

        it("Operator mints 0", async () => {
            // 1m 1000000000000000000000000
            // 500m 500000000000000000000000000
            // 50m 50000000000000000000000000
            expect(await wmxERC20.callStatic.totalSupply()).to.be.equal(BigNumber.from("50000000000000000000000000"));

            expect(await wmxERC20.connect(user2).mint(user1.address, "0"));

            expect(await wmxERC20.callStatic.totalSupply()).to.be.equal(BigNumber.from("50000000000000000000000000"));
            expect(await wmxERC20.connect(user2).mint(user1.address, "0"));

            expect(await wmxERC20.callStatic.totalSupply()).to.be.equal(BigNumber.from("50000000000000000000000000"));
            expect(await wmxERC20.connect(user2).mint(user1.address, "0"));

            expect(await wmxERC20.callStatic.totalSupply()).to.be.equal(BigNumber.from("50000000000000000000000000"));
        });

        it("Minter mints max", async () => {
            // 1m 1000000000000000000000000
            // 500m 500000000000000000000000000
            // 50m 50000000000000000000000000
            expect(await wmxERC20.callStatic.totalSupply()).to.be.equal(BigNumber.from("50000000000000000000000000"));

            expect(await wmxERC20.connect(user2).mint(user1.address, "0"));

            expect(await wmxERC20.callStatic.totalSupply()).to.be.equal(BigNumber.from("50000000000000000000000000"));
            expect(await wmxERC20.connect(user2).mint(user1.address, "0"));

            expect(await wmxERC20.callStatic.totalSupply()).to.be.equal(BigNumber.from("50000000000000000000000000"));
            await expect(
                wmxERC20
                    .connect(user3)
                    .minterMint(
                        user4.address,
                        "115792089237316195423570985008687907853269984665640564039457584007913129639900",
                    ),
            ).to.be.reverted;

            expect(await wmxERC20.callStatic.totalSupply()).to.be.equal(BigNumber.from("50000000000000000000000000"));
        });
    });
});
