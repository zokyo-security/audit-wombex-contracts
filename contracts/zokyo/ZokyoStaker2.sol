// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;
import "../Interfaces.sol";

contract ZokyoStaker2 is IStaker {
    constructor() {}

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

    function releaseLock(uint256 _slot) external override returns (bool) {}

    function claimCrv(address, uint256)
        external
        override
        returns (address[] memory tokens, uint256[] memory balances)
    {}

    function balanceOfPool(address, address) external view override returns (uint256) {}

    function execute(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external override returns (bool, bytes memory) {}

    function setVote(bytes32 hash, bool valid) external override {}
}
