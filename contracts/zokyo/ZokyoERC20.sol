// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;
import { ERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts-0.8/access/Ownable.sol";

contract ZokyoERC20 is ERC20, Ownable {
    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {}

    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }
}
