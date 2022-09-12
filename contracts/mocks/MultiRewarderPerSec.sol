// SPDX-License-Identifier: GPL-3.0
import "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";

pragma solidity ^0.8.5;

interface IMasterWombat {
    function deposit(uint256 _pid, uint256 _amount) external;

    function balanceOf(address) external view returns (uint256);

    function userInfo(uint256, address) external view returns (uint256 amount, uint256 rewardDebt, uint256 factor);

    function withdraw(uint256 _pid, uint256 _amount) external;

    function claim_rewards() external;

    function reward_tokens(uint256) external view returns (address);//v2

    function rewarded_token() external view returns (address);//v1

    function lp_token() external view returns (address);

    function updateFactor(address _account, uint256 _newBalance) external;
}

/**
 * This is a sample contract to be used in the MasterWombat contract for partners to reward
 * stakers with their native token alongside WOM.
 *
 * It assumes no minting rights, so requires a set amount of reward tokens to be transferred to this contract prior.
 * E.g. say you've allocated 100,000 XYZ to the WOM-XYZ farm over 30 days. Then you would need to transfer
 * 100,000 XYZ and set the block reward accordingly so it's fully distributed after 30 days.
 *
 * - This contract has no knowledge on the LP amount and MasterWombat is
 *   responsible to pass the amount into this contract
 * - Supports multiple reward tokens
 */
contract MultiRewarderPerSec {
    uint256 private constant ACC_TOKEN_PRECISION = 1e12;
    IERC20 public immutable lpToken;
    IMasterWombat public immutable masterWombat;

    struct UserInfo {
        uint128 amount;
        uint128 rewardDebt; // 20.18 fixed point. distributed reward per weight
        uint256 unpaidRewards; // 20.18 fixed point. unpaid rewards
    }

    /// @notice Info of each masterWombat rewardInfo.
    struct RewardInfo {
        IERC20 rewardToken; // if rewardToken is 0, native token is used as reward token
        uint96 tokenPerSec; // 10.18 fixed point
        uint128 accTokenPerShare; // 26.12 fixed point. Amount of reward token each LP token is worth.
    }

    /// @notice address of the operator
    /// @dev operator is able to set emission rate
    address public operator;

    uint256 public lastRewardTimestamp;

    /// @notice Info of the rewardInfo.
    RewardInfo[] public rewardInfo;
    /// @notice tokenId => userId => UserInfo
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;

    event OnReward(address indexed rewardToken, address indexed user, uint256 amount);
    event RewardRateUpdated(address indexed rewardToken, uint256 oldRate, uint256 newRate);

    modifier onlyMW() {
        require(msg.sender == address(masterWombat), 'onlyMW: only MasterWombat can call this function');
        _;
    }

    constructor(
        IMasterWombat _MP,
        IERC20 _lpToken,
        uint256 _startTimestamp,
        IERC20 _rewardToken,
        uint96 _tokenPerSec
    ) {
        require(_startTimestamp >= block.timestamp);

        masterWombat = _MP;
        lpToken = _lpToken;

        lastRewardTimestamp = _startTimestamp;

        RewardInfo memory reward = RewardInfo({
            rewardToken: _rewardToken,
            tokenPerSec: _tokenPerSec,
            accTokenPerShare: 0
        });
        rewardInfo.push(reward);
        emit RewardRateUpdated(address(_rewardToken), 0, _tokenPerSec);
    }

    /// @notice Set operator address
    function setOperator(address _operator) external {
        operator = _operator;
    }

    function addRewardToken(IERC20 _rewardToken, uint96 _tokenPerSec) external {
        RewardInfo memory reward = RewardInfo({
        rewardToken: _rewardToken,
        tokenPerSec: _tokenPerSec,
        accTokenPerShare: 0
        });
        rewardInfo.push(reward);
        emit RewardRateUpdated(address(_rewardToken), 0, _tokenPerSec);
    }

    /// @dev This function should be called before lpSupply and sumOfFactors update
    function _updateReward() internal {
        uint256 length = rewardInfo.length;
        uint256 lpSupply = lpToken.balanceOf(address(masterWombat));

        if (block.timestamp > lastRewardTimestamp && lpSupply > 0) {
            for (uint256 i; i < length; ++i) {
                RewardInfo storage reward = rewardInfo[i];
                uint256 timeElapsed = block.timestamp - lastRewardTimestamp;
                uint256 tokenReward = timeElapsed * reward.tokenPerSec;
                reward.accTokenPerShare += toUint128((tokenReward * ACC_TOKEN_PRECISION) / lpSupply);
            }

            lastRewardTimestamp = block.timestamp;
        }
    }

    /// @notice Sets the distribution reward rate. This will also update the rewardInfo.
    /// @param _tokenPerSec The number of tokens to distribute per second
    function setRewardRate(uint256 _tokenId, uint96 _tokenPerSec) external {
        require(_tokenPerSec <= 10000e18, 'reward rate too high'); // in case of accTokenPerShare overflow
        _updateReward();

        uint256 oldRate = _tokenPerSec;
        rewardInfo[_tokenId].tokenPerSec = _tokenPerSec;

        emit RewardRateUpdated(address(rewardInfo[_tokenId].rewardToken), oldRate, _tokenPerSec);
    }

    /// @notice Function called by MasterWombat whenever staker claims WOM harvest.
    /// @notice Allows staker to also receive a 2nd reward token.
    /// @dev Assume lpSupply and sumOfFactors isn't updated yet when this function is called
    /// @param _user Address of user
    /// @param _lpAmount The new amount of LP
    function onReward(address _user, uint256 _lpAmount)
    external
    returns (uint256[] memory rewards)
    {
        _updateReward();

        uint256 length = rewardInfo.length;
        rewards = new uint256[](length);
        for (uint256 i; i < length; ++i) {
            RewardInfo storage reward = rewardInfo[i];
            UserInfo storage user = userInfo[i][_user];
            IERC20 rewardToken = reward.rewardToken;

            if (user.amount > 0) {
                uint256 pending = ((user.amount * uint256(reward.accTokenPerShare)) / ACC_TOKEN_PRECISION) +
                user.unpaidRewards -
                user.rewardDebt;

                if (address(rewardToken) == address(0)) {
                    // is native token
                    uint256 tokenBalance = address(this).balance;
                    if (pending > tokenBalance) {
                        (bool success, ) = _user.call{value: tokenBalance}('');
                        require(success, 'Transfer failed');
                        rewards[i] = tokenBalance;
                        user.unpaidRewards = pending - tokenBalance;
                    } else {
                        (bool success, ) = _user.call{value: pending}('');
                        require(success, 'Transfer failed');
                        rewards[i] = pending;
                        user.unpaidRewards = 0;
                    }
                } else {
                    // ERC20 token
                    uint256 tokenBalance = rewardToken.balanceOf(address(this));
                    if (pending > tokenBalance) {
                        rewardToken.transfer(_user, tokenBalance);
                        rewards[i] = tokenBalance;
                        user.unpaidRewards = pending - tokenBalance;
                    } else {
                        rewardToken.transfer(_user, pending);
                        rewards[i] = pending;
                        user.unpaidRewards = 0;
                    }
                }
            }

            user.amount = toUint128(_lpAmount);
            user.rewardDebt = toUint128((_lpAmount * reward.accTokenPerShare) / ACC_TOKEN_PRECISION);
            emit OnReward(address(rewardToken), _user, rewards[i]);
        }
    }

    /// @notice returns reward length
    function rewardLength() external view returns (uint256) {
        return rewardInfo.length;
    }

    /// @notice View function to see pending tokens
    /// @param _user Address of user.
    /// @return rewards reward for a given user.
    function pendingTokens(address _user) external view returns (uint256[] memory rewards) {
        uint256 length = rewardInfo.length;
        rewards = new uint256[](length);

        for (uint256 i; i < length; ++i) {
            RewardInfo memory pool = rewardInfo[i];
            UserInfo storage user = userInfo[i][_user];

            uint256 accTokenPerShare = pool.accTokenPerShare;
            uint256 lpSupply = lpToken.balanceOf(address(masterWombat));

            if (block.timestamp > lastRewardTimestamp && lpSupply > 0) {
                uint256 timeElapsed = block.timestamp - lastRewardTimestamp;
                uint256 tokenReward = timeElapsed * pool.tokenPerSec;
                accTokenPerShare += (tokenReward * ACC_TOKEN_PRECISION) / lpSupply;
            }

            rewards[i] =
            ((user.amount * uint256(accTokenPerShare)) / ACC_TOKEN_PRECISION) -
            user.rewardDebt +
            user.unpaidRewards;
        }
    }

    /// @notice return an array of reward tokens
    function rewardTokens() external view returns (IERC20[] memory tokens) {
        uint256 length = rewardInfo.length;
        tokens = new IERC20[](length);
        for (uint256 i; i < length; ++i) {
            RewardInfo memory pool = rewardInfo[i];
            tokens[i] = pool.rewardToken;
        }
    }

    /// @notice In case rewarder is stopped before emissions finished, this function allows
    /// withdrawal of remaining tokens.
    function emergencyWithdraw() external {
        uint256 length = rewardInfo.length;

        for (uint256 i; i < length; ++i) {
            RewardInfo storage pool = rewardInfo[i];
            if (address(pool.rewardToken) == address(0)) {
                // is native token
                (bool success, ) = msg.sender.call{value: address(this).balance}('');
                require(success, 'Transfer failed');
            } else {
                pool.rewardToken.transfer(address(msg.sender), pool.rewardToken.balanceOf(address(this)));
            }
        }
    }

    /// @notice avoids loosing funds in case there is any tokens sent to this contract
    /// @dev only to be called by owner
    function emergencyTokenWithdraw(address token) external {
        // send that balance back to owner
        IERC20(token).transfer(msg.sender, IERC20(token).balanceOf(address(this)));
    }

    /// @notice View function to see balances of reward token.
    function balances() external view returns (uint256[] memory balances_) {
        uint256 length = rewardInfo.length;
        balances_ = new uint256[](length);

        for (uint256 i; i < length; ++i) {
            RewardInfo storage pool = rewardInfo[i];
            if (address(pool.rewardToken) == address(0)) {
                // is native token
                balances_[i] = address(this).balance;
            } else {
                balances_[i] = pool.rewardToken.balanceOf(address(this));
            }
        }
    }

    /// @notice payable function needed to receive BNB
    receive() external payable {}

    function toUint128(uint256 val) internal pure returns (uint128) {
        if (val > type(uint128).max) revert('uint128 overflow');
        return uint128(val);
    }
}
