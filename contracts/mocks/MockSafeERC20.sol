// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.5;


import "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-0.8/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-0.8/token/ERC20/utils/SafeERC20.sol";



// import "./MockERC20.sol";

contract MockSafeERC20 {

    using SafeERC20 for IERC20;

    IERC20 public token;

    constructor(IERC20  _token) {

        token = IERC20(_token);
    }

    function setToken( address _token) public {

        token = IERC20(_token);
    }

    function safeTransfer(address recipient, uint amoumt) public returns(bool) {
        //IERC20(token).safeTransfer(recipient, amoumt);
        true;
    }

    function safeApprove(address recipient, uint amoumt) public returns(bool){
        return true;
    }

    function balanceOf(address spender) public view returns(uint256){
        return 10000;
        
    }


    function safeTransferFrom(IERC20 _token, address from, address to, uint256 value) public returns(bool) {

        return true;
    }


    function allowance(address _token ,address _spender) public returns(bool) {

        return true;
    }
}
