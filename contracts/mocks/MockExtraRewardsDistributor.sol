// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "../ExtraRewardsDistributor.sol";
contract MockExtraRewardsDistributor is ExtraRewardsDistributor {

    constructor(address _wmxLocker) ExtraRewardsDistributor(_wmxLocker) {}

    function mockUpdateRewardEpochs(address _token, uint256 _val ) public {

        rewardEpochs[_token].push(_val);
    }

    function mockUpdateUserClaims(address _token, address _account, uint256 value ) public {

        userClaims[_token][_account] = value;
    }

    // function mock_getReward( address _account,
    //     address _token,
    //     uint256 _startIndex ) public {

    //     _getReward(_account, _token, _startIndex);
    // }

}