// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./VeHermesToken.sol";

/// @title Vote Escrow Hermes Staking
/// @author Trader Hermes
/// @notice Stake HERMES to earn veHERMES, which you can use to earn higher farm yields and gain
/// voting power. Note that unstaking any amount of HERMES will burn all of your existing veHERMES.
contract VeHermesStaking is Initializable, OwnableUpgradeable {
    using SafeMathUpgradeable for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /// @notice Info for each user
    /// `balance`: Amount of HERMES currently staked by user
    /// `lastRewardTimestamp`: Latest timestamp that user performed one of the following actions:
    ///     1. Claimed pending veHERMES
    ///     2. Staked HERMES with zero balance
    ///     3. Staked HERMES with non-zero balance and is at their max veHERMES cap after claim
    ///     4. Unstaked HERMES
    /// `boostEndTimestamp`: Timestamp of when user stops receiving boost benefits. Note that
    /// this will be reset to 0 after the end of a boost
    struct UserInfo {
        uint256 balance;
        uint256 lastRewardTimestamp;
        uint256 boostEndTimestamp;
    }

    IERC20Upgradeable public hermes;
    VeHermesToken public veHermes;

    /// @notice The maximum ratio of veHERMES to staked HERMES
    /// For example, if user has `n` HERMES staked, they can own a maximum of `n * maxCap` veHERMES.
    uint256 public maxCap;

    /// @notice The upper limit of `maxCap`
    uint256 public upperLimitMaxCap;

    /// @notice Rate of veHERMES generated per sec per HERMES staked, in parts per 1e18
    uint256 public baseGenerationRate;

    /// @notice Boosted rate of veHERMES generated per sec per HERMES staked, in parts per 1e18
    uint256 public boostedGenerationRate;

    /// @notice Precision of `baseGenerationRate` and `boostedGenerationRate`
    uint256 public PRECISION;

    /// @notice Percentage of user's current staked HERMES user has to deposit in order to start
    /// receiving boosted benefits, in parts per 100.
    /// @dev Specifically, user has to deposit at least `boostedThreshold/100 * userStakedHermes` HERMES.
    /// The only exception is the user will also receive boosted benefits if it's their first
    /// time staking.
    uint256 public boostedThreshold;

    /// @notice The length of time a user receives boosted benefits
    uint256 public boostedDuration;

    /// @notice The upper limit of `boostedDuration`
    uint256 public upperLimitBoostedDuration;

    mapping(address => UserInfo) public userInfos;

    event Claim(address indexed user, uint256 amount);
    event Deposit(address indexed user, uint256 amount);
    event UpdateBaseGenerationRate(address indexed user, uint256 baseGenerationRate);
    event UpdateBoostedDuration(address indexed user, uint256 boostedDuration);
    event UpdateBoostedGenerationRate(address indexed user, uint256 boostedGenerationRate);
    event UpdateBoostedThreshold(address indexed user, uint256 boostedThreshold);
    event UpdateMaxCap(address indexed user, uint256 maxCap);
    event Withdraw(address indexed user, uint256 amount);

    /// @notice Initialize with needed parameters
    /// @param _hermes Address of the HERMES token contract
    /// @param _veHermes Address of the veHERMES token contract
    /// @param _baseGenerationRate Rate of veHERMES generated per sec per HERMES staked
    /// @param _boostedGenerationRate Boosted rate of veHERMES generated per sec per HERMES staked
    /// @param _boostedThreshold Percentage of total staked HERMES user has to deposit to be boosted
    /// @param _boostedDuration Length of time a user receives boosted benefits
    function initialize(
        IERC20Upgradeable _hermes,
        VeHermesToken _veHermes,
        uint256 _baseGenerationRate,
        uint256 _boostedGenerationRate,
        uint256 _boostedThreshold,
        uint256 _boostedDuration,
        uint256 _maxCap
    ) public initializer {
        require(address(_hermes) != address(0), "VeHermesStaking: unexpected zero address for _hermes");
        require(address(_veHermes) != address(0), "VeHermesStaking: unexpected zero address for _veHermes");
        require(
            _boostedGenerationRate > _baseGenerationRate,
            "VeHermesStaking: expected _boostedGenerationRate to be greater than _baseGenerationRate"
        );
        require(
            _boostedThreshold != 0 && _boostedThreshold <= 100,
            "VeHermesStaking: expected _boostedThreshold to be > 0 and <= 100"
        );

        upperLimitBoostedDuration = 365 days;
        require(
            _boostedDuration <= upperLimitBoostedDuration,
            "VeHermesStaking: expected _boostedDuration to be <= 365 days"
        );

        upperLimitMaxCap = 100000;
        require(
            _maxCap != 0 && _maxCap <= upperLimitMaxCap,
            "VeHermesStaking: expected new _maxCap to be non-zero and <= 100000"
        );

        __Ownable_init();

        maxCap = _maxCap;
        hermes = _hermes;
        veHermes = _veHermes;
        baseGenerationRate = _baseGenerationRate;
        boostedGenerationRate = _boostedGenerationRate;
        boostedThreshold = _boostedThreshold;
        boostedDuration = _boostedDuration;
        PRECISION = 1e18;
    }

    /// @notice Set maxCap
    /// @param _maxCap The new maxCap
    function setMaxCap(uint256 _maxCap) external onlyOwner {
        require(_maxCap > maxCap, "VeHermesStaking: expected new _maxCap to be greater than existing maxCap");
        require(
            _maxCap != 0 && _maxCap <= upperLimitMaxCap,
            "VeHermesStaking: expected new _maxCap to be non-zero and <= 100000"
        );
        maxCap = _maxCap;
        emit UpdateMaxCap(msg.sender, _maxCap);
    }

    /// @notice Set baseGenerationRate
    /// @param _baseGenerationRate The new baseGenerationRate
    function setBaseGenerationRate(uint256 _baseGenerationRate) external onlyOwner {
        require(
            _baseGenerationRate < boostedGenerationRate,
            "VeHermesStaking: expected new _baseGenerationRate to be less than boostedGenerationRate"
        );
        baseGenerationRate = _baseGenerationRate;
        emit UpdateBaseGenerationRate(msg.sender, _baseGenerationRate);
    }

    /// @notice Set boostedGenerationRate
    /// @param _boostedGenerationRate The new boostedGenerationRate
    function setBoostedGenerationRate(uint256 _boostedGenerationRate) external onlyOwner {
        require(
            _boostedGenerationRate > baseGenerationRate,
            "VeHermesStaking: expected new _boostedGenerationRate to be greater than baseGenerationRate"
        );
        boostedGenerationRate = _boostedGenerationRate;
        emit UpdateBoostedGenerationRate(msg.sender, _boostedGenerationRate);
    }

    /// @notice Set boostedThreshold
    /// @param _boostedThreshold The new boostedThreshold
    function setBoostedThreshold(uint256 _boostedThreshold) external onlyOwner {
        require(
            _boostedThreshold != 0 && _boostedThreshold <= 100,
            "VeHermesStaking: expected _boostedThreshold to be > 0 and <= 100"
        );
        boostedThreshold = _boostedThreshold;
        emit UpdateBoostedThreshold(msg.sender, _boostedThreshold);
    }

    /// @notice Set boostedDuration
    /// @param _boostedDuration The new boostedDuration
    function setBoostedDuration(uint256 _boostedDuration) external onlyOwner {
        require(
            _boostedDuration <= upperLimitBoostedDuration,
            "VeHermesStaking: expected _boostedDuration to be <= 365 days"
        );
        boostedDuration = _boostedDuration;
        emit UpdateBoostedDuration(msg.sender, _boostedDuration);
    }

    /// @notice Deposits HERMES to start staking for veHERMES. Note that any pending veHERMES
    /// will also be claimed in the process.
    /// @param _amount The amount of HERMES to deposit
    function deposit(uint256 _amount) external {
        require(_amount > 0, "VeHermesStaking: expected deposit amount to be greater than zero");

        UserInfo storage userInfo = userInfos[msg.sender];

        if (_getUserHasNonZeroBalance(msg.sender)) {
            // If user already has staked HERMES, we first send them any pending veHERMES
            _claim();

            uint256 userStakedHermes = userInfo.balance;

            uint256 userVeHermesBalance = veHermes.balanceOf(msg.sender);
            uint256 userMaxVeHermesCap = userStakedHermes.mul(maxCap);

            // If the user is currently at their max veHERMES cap, we need to update
            // their `lastRewardTimestamp` to now to prevent passive veHERMES accrual
            // after user hit their max cap.
            if (userVeHermesBalance == userMaxVeHermesCap) {
                userInfo.lastRewardTimestamp = block.timestamp;
            }

            userInfo.balance = userStakedHermes.add(_amount);

            // User is eligible for boosted benefits if `_amount` is at least
            // `boostedThreshold / 100 * userStakedHermes`
            if (_amount.mul(100) >= boostedThreshold.mul(userStakedHermes)) {
                userInfo.boostEndTimestamp = block.timestamp.add(boostedDuration);
            }
        } else {
            // If the user's `lastRewardTimestamp` is 0, i.e. if this is the user's first time staking,
            // then they will receive boosted benefits.
            // Note that it is important we perform this check **before** we update the user's `lastRewardTimestamp`
            // down below.
            if (userInfo.lastRewardTimestamp == 0) {
                userInfo.boostEndTimestamp = block.timestamp.add(boostedDuration);
            }
            userInfo.balance = _amount;
            userInfo.lastRewardTimestamp = block.timestamp;
        }

        hermes.safeTransferFrom(msg.sender, address(this), _amount);

        emit Deposit(msg.sender, _amount);
    }

    /// @notice Withdraw staked HERMES. Note that unstaking any amount of HERMES means you will
    /// lose all of your current veHERMES.
    /// @param _amount The amount of HERMES to unstake
    function withdraw(uint256 _amount) external {
        require(_amount > 0, "VeHermesStaking: expected withdraw amount to be greater than zero");

        UserInfo storage userInfo = userInfos[msg.sender];

        require(
            userInfo.balance >= _amount,
            "VeHermesStaking: cannot withdraw greater amount of HERMES than currently staked"
        );

        userInfo.balance = userInfo.balance.sub(_amount);
        userInfo.lastRewardTimestamp = block.timestamp;
        userInfo.boostEndTimestamp = 0;

        // Burn the user's current veHERMES balance
        uint256 userVeHermesBalance = veHermes.balanceOf(msg.sender);
        veHermes.burnFrom(msg.sender, userVeHermesBalance);

        // Send user their requested amount of staked HERMES
        hermes.safeTransfer(msg.sender, _amount);

        emit Withdraw(msg.sender, _amount);
    }

    /// @notice Claim any pending veHERMES
    function claim() external {
        require(_getUserHasNonZeroBalance(msg.sender), "VeHermesStaking: cannot claim veHERMES when no HERMES is staked");
        _claim();
    }

    /// @notice Get the pending amount of veHERMES for a given user
    /// @param _user The user to lookup
    /// @return The number of pending veHERMES tokens for `_user`
    function getPendingVeHermes(address _user) public view returns (uint256) {
        if (!_getUserHasNonZeroBalance(_user)) {
            return 0;
        }

        UserInfo memory user = userInfos[_user];

        uint256 secondsElapsed = block.timestamp.sub(user.lastRewardTimestamp);
        if (secondsElapsed == 0) {
            return 0;
        }

        // Calculate amount of pending veHERMES based on:
        // 1. Seconds elapsed since last reward timestamp
        // 2. Generation rate that the user is receiving
        // 3. Current amount of user's staked HERMES
        uint256 pendingVeHermes;

        if (block.timestamp <= user.boostEndTimestamp) {
            // If the current timestamp is less than or equal to the user's `boostEndTimestamp`,
            // that means the user is currently receiving boosted benefits so they should receive
            // `boostedGenerationRate`.
            uint256 accVeHermesPerHermes = secondsElapsed.mul(boostedGenerationRate);
            pendingVeHermes = accVeHermesPerHermes.mul(user.balance).div(PRECISION);
        } else {
            if (user.boostEndTimestamp != 0) {
                // If `user.boostEndTimestamp != 0` then, we know for certain that
                // `user.boostEndTimestamp >= user.lastRewardTimestamp`.
                // Proof by contradiction:
                // 1. Assume that `user.boostEndTimestamp != 0` and
                //    `user.boostEndTimestamp < user.lastRewardTimestamp`.
                // 2. There are 4 cases when a user's `lastRewardTimestamp` is updated:
                //    a. User claimed pending veHERMES: We know that anytime a user claims some veHERMES,
                //       if the current timestamp is greater than or equal to `user.boostEndTimestamp`,
                //       we will update `user.boostEndTimestamp` to be `0` (see `_claim` method). This
                //       means that `user.boostEndTimestamp` should be `0` but that contradicts our
                //       assumption that `user.boostEndTimestamp != 0`.
                //    b. User staked HERMES with zero balance: If a user is staking HERMES with zero balance, it
                //       either means 1) this is their first time staking or 2) their last action was performing
                //       unstaking HERMES.
                //       For first time stakers, we set `user.lastRewardTimestamp` to `block.timestamp`
                //       and `user.boostEndTimestamp` to `block.timestamp + boostedDuration`. This contradicts
                //       our assumption that `user.boostEndTimestamp < user.lastRewardTimestamp`.
                //       If the user's previous action was withdraw, that means that their `user.boostEndTimestamp`
                //       was reset to `0`. This contradicts our assumption that `user.boostEndTimestamp != 0`.
                //    c. User staked HERMES with non-zero balance and is at their max veHERMES cap after claim: Anytime
                //       we perform a claim, if `user.boostEndTimestamp` is leq than the current timestamp, we
                //       reset it to `0`. This contradicts our assumption that `user.boostEndTimestamp != 0`.
                //    d. User unstaked HERMES: Whenever a user unstakes HERMES, we reset `user.boostEndTimestamp`
                //       to be 0. This contradicts our assumption that `user.boostEndTimestamp != 0`.
                // QED.

                // Now we know that `0 < user.lastRewardTimestamp <= user.boostEndTimestamp < block.timestamp`.
                // In this case, we need to properly provide them the boosted generation rate for
                // those `boostEndTimestamp - lastRewardTimestamp` seconds.
                uint256 boostedTimeElapsed = user.boostEndTimestamp.sub(user.lastRewardTimestamp);
                uint256 boostedAccVeHermesPerHermes = boostedTimeElapsed.mul(boostedGenerationRate);
                uint256 boostedPendingVeHermes = boostedAccVeHermesPerHermes.mul(user.balance);

                uint256 baseTimeElapsed = block.timestamp.sub(user.boostEndTimestamp);
                uint256 baseAccVeHermesPerVeHermes = baseTimeElapsed.mul(baseGenerationRate);
                uint256 basePendingVeHermes = baseAccVeHermesPerVeHermes.mul(user.balance);

                pendingVeHermes = boostedPendingVeHermes.add(basePendingVeHermes).div(PRECISION);
            } else {
                // In this case, the user is simply generating veHERMES at `baseGenerationRate` for
                // the duration of `secondsElapsed`.
                uint256 accVeHermesPerHermes = secondsElapsed.mul(baseGenerationRate);
                pendingVeHermes = accVeHermesPerHermes.mul(user.balance).div(PRECISION);
            }
        }

        // Get the user's current veHERMES balance and maximum veHERMES they can hold
        uint256 userVeHermesBalance = veHermes.balanceOf(_user);
        uint256 userMaxVeHermesCap = user.balance.mul(maxCap);

        if (userVeHermesBalance < userMaxVeHermesCap) {
            if (userVeHermesBalance.add(pendingVeHermes) > userMaxVeHermesCap) {
                return userMaxVeHermesCap.sub(userVeHermesBalance);
            } else {
                return pendingVeHermes;
            }
        } else {
            // User already holds maximum amount of veHERMES so there is no pending veHERMES
            return 0;
        }
    }

    /// @notice Checks to see if a given user currently has staked HERMES
    /// @param _user The user address to check
    /// @return Whether `_user` currently has staked HERMES
    function _getUserHasNonZeroBalance(address _user) private view returns (bool) {
        return userInfos[_user].balance > 0;
    }

    /// @dev Helper to claim any pending veHERMES
    function _claim() private {
        uint256 veHermesToClaim = getPendingVeHermes(msg.sender);

        UserInfo storage userInfo = userInfos[msg.sender];

        // If user's boost period has ended, reset `boostEndTimestamp` to 0
        if (userInfo.boostEndTimestamp != 0 && block.timestamp >= userInfo.boostEndTimestamp) {
            userInfo.boostEndTimestamp = 0;
        }

        if (veHermesToClaim > 0) {
            // Update user's last reward timestamp
            userInfo.lastRewardTimestamp = block.timestamp;

            veHermes.mint(msg.sender, veHermesToClaim);
            emit Claim(msg.sender, veHermesToClaim);
        }
    }
}
