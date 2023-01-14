// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;
import "../Wmx.sol";

contract ZokyoStaker is IStaker {
    address private _operator;

    constructor(address initialOperator) {
        _operator = initialOperator;
    }

    function operator() external view override returns (address) {
        return _operator;
    }

    function setOperator(address newOperator) public {
        _operator = newOperator;
    }
}
