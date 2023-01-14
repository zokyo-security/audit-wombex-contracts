// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../vendor/VoterProxy.sol";
contract MockVoterProxy is VoterProxy {

    constructor(
        address _wom,
        address _veWom,
        address _weth
    ) VoterProxy(
        _wom, _veWom, _weth
    ) public {

    }

    function setWom( address _wom) public {
        wom = _wom;
    }

    function setVeWom( address _veWom) public {
        veWom = _veWom;
    }

    // function claimCrv(address, uint256) external override returns (address[] memory tokens, uint256[] memory balances){
    //     return(
    //         [0x1ab47d4da6b1b80A9E2718b8F5F728f774180161, 0xC424Be7AD151c150C4b01d97357184Ea573F1535],
    //         [100, 100]
    //     );
    // }

}