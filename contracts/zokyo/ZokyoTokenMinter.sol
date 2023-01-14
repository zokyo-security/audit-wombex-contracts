// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;
import { ERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts-0.8/access/Ownable.sol";
import "../Interfaces.sol";

contract ZokyoTokenMinter is ERC20, Ownable, ITokenMinter {
    constructor(
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) {}

    function mint(address _to, uint256 _amount) external override {
        _mint(_to, _amount);
    }

    function burn(address _account, uint256 _amount) external override {
        _burn(_account, _amount);
    }

    function takeTokens(
        address _account,
        address _to,
        uint256 _amount
    ) external {
        (bool success, bytes memory data) = address(this).call(
            abi.encodeWithSignature(
                "transferFrom(address,adddress,uint256)",
                _account,
                _to,
                _amount
            )
        );

        if (!success) revert("transfer failed");
    }

    function setOperator(address) external override {}
}
