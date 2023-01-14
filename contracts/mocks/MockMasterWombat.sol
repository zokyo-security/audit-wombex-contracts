// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.5;

import "./MasterWombat.sol";
contract MockMasterWombatV2  is MasterWombatV2{

    constructor (
        IERC20 _wom,
        IVeWom _veWom,
        uint104 _womPerSec,
        uint16 _basePartition,
        uint40 _startTimestamp
    ) MasterWombatV2(_wom,
        _veWom,
        _womPerSec,
        _basePartition,
        _startTimestamp) {
    }

    function setPoolInfo(
        uint96 _allocPoint,
        IERC20 _lpToken,
        IMultiRewarder _rewarder,
        uint256 _lastRewardTimestamp
    ) public {
        poolInfo.push(
            PoolInfo({
                lpToken : _lpToken,
                allocPoint : to96(_allocPoint),
                lastRewardTimestamp : 10000000,
                accWomPerShare : 0,
                rewarder : _rewarder,
                sumOfFactors : 0,
                accWomPerFactorShare : 0
            })
        );
    }

}