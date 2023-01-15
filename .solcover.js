const testMnemonic = "spoon modify person desk media screen recycle large robot battle drill actual various hire smile quiz undo island zoo dwarf choice across junior act";
module.exports = {
    providerOptions: {
        mnemonic: process.env.MNEMONIC || testMnemonic,
    },
    skipFiles: [
        "mocks", "test", "contracts/vendor/interfaces",
        "Interfaces.sol",
        "vendor/interfaces/BoringMath.sol",
        "vendor/interfaces/IERC20Metadata.sol",
        "vendor/interfaces/IERC4626.sol",
        "vendor/interfaces/IGaugeController.sol",
        "vendor/interfaces/Interfaces.sol",
        "vendor/interfaces/IProxyFactory.sol",
        "vendor/interfaces/IRewarder.sol",
        "vendor/interfaces/IRewardHook.sol",
        "vendor/interfaces/MathUtil.sol",
        "zokyo/ZokyoStaker.sol",
        "zokyo/ZokyoERC20.sol",
        "zokyo/ZokyoRewards.sol",
        "zokyo/ZokyoStaker2.sol",
        "zokyo/ZokyoTokenMinter.sol",
        "zokyo/ZokyoMmxMath.sol",
        "mocks/MasterWombat.sol",
        "mocks/MockERC20.sol",
        "mocks/MockVoteStorage.sol",
        "mocks/MockVoting.sol",
        "mocks/MockWalletChecker.sol",
        "mocks/MockWmxLocker.sol",
        "mocks/MockWmxMath.sol",
        "mocks/MultiRewarderPerSec.sol",
        "mocks/VeWom.sol",
        "mocks/WETH.sol",
        "WmxRewardPool.sol",
        "PoolDepositor.sol",
        "WmxVestedEscrowLockOnly.sol",
        "vendor/mocks/"
        
    ],
    configureYulOptimizer: true,
    mocha: {
        enableTimeouts: false
      }
};
