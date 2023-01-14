// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../vendor/BaseRewardPool.sol";

contract BaseRewardPoolMock is BaseRewardPool{

    constructor( 
        uint256 pid_,
        address stakingToken_,
        address boosterRewardToken_,
        address operator_,
        address rewardManager_

    ) BaseRewardPool(pid_, stakingToken_, boosterRewardToken_, operator_, rewardManager_) public {

    }
}