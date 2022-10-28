// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;
import "../Interfaces.sol";
import { SafeERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";

contract ZokyoRewards is IRewards {
    using SafeERC20 for IERC20;

    address public immutable stakingTokenAddress;

    constructor(address _stakingToken) {
        stakingTokenAddress = _stakingToken;
    }

    function stake(address, uint256) external override {}

    function stakeFor(address _account, uint256 _amount) external override {
        IERC20(stakingTokenAddress).safeTransferFrom(msg.sender, address(this), _amount);
    }

    function withdraw(address, uint256) external override {}

    function exit(address) external override {}

    function getReward(address) external override {}

    function queueNewRewards(address, uint256) external override {}

    function notifyRewardAmount(uint256) external override {}

    function addExtraReward(address) external override {}

    function extraRewardsLength() external view override returns (uint256) {}

    function stakingToken() external view override returns (address) {}

    function rewardToken() external view override returns (address) {}

    function earned(address account) external view override returns (uint256) {}
}

contract ZokyoRewards2 is IRewards {
    using SafeERC20 for IERC20;

    address public immutable stakingTokenAddress;

    constructor(address _stakingToken) {
        stakingTokenAddress = _stakingToken;
    }

    function stake(address, uint256) external override {}

    function stakeFor(address _account, uint256 _amount) external override {
        //  IERC20(stakingTokenAddress).safeTransferFrom(msg.sender, address(this), _amount);
    }

    function withdraw(address, uint256) external override {}

    function exit(address) external override {}

    function getReward(address) external override {}

    function queueNewRewards(address, uint256) external override {}

    function notifyRewardAmount(uint256) external override {}

    function addExtraReward(address) external override {}

    function extraRewardsLength() external view override returns (uint256) {}

    function stakingToken() external view override returns (address) {}

    function rewardToken() external view override returns (address) {}

    function earned(address account) external view override returns (uint256) {}
}
