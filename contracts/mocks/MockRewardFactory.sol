// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../vendor/RewardFactory.sol";
contract MockRewardFactory is RewardFactory {

    constructor(address _operator, address _crv) RewardFactory(_operator, _crv) public {}

    function setOPerator(address _operator) external {

        operator = _operator;
    }

}