// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;
import "../Interfaces.sol";
import { IERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";

// import "@openzeppelin/contracts-0.6/token/ERC20/SafeERC20.sol";

contract ZokyoStaker2 is IStaker {
    address wom;

    //  using SafeERC20 for IERC20;

    constructor(address _wom) {
        wom = _wom;
    }

    function operator() external view override returns (address) {}

    function deposit(address, address) external override returns (bool) {}

    function withdraw(address) external override returns (uint256) {}

    function withdrawLp(
        address,
        address,
        uint256
    ) external override returns (bool) {}

    function withdrawAllLp(address, address) external override returns (bool) {}

    function lock(uint256 _lockDays) external override {}

    function releaseLock(uint256 _slot) external override returns (bool) {
        uint256 amount = IERC20(wom).balanceOf(address(this));
        IERC20(wom).transfer(msg.sender, amount);
        return true;
    }

    function claimCrv(
        address,
        uint256
    )
        external
        override
        returns (address[] memory tokens, uint256[] memory balances)
    {}

    function balanceOfPool(
        address,
        address
    ) external view override returns (uint256) {}

    function execute(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external override returns (bool, bytes memory) {}

    function setVote(bytes32 hash, bool valid) external override {}

    function depositor() external view override returns (address) {}
}
