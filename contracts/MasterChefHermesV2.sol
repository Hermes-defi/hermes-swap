// SPDX-License-Identifier: MIT
// import "hardhat/console.sol";
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./libraries/BoringERC20.sol";
import "./libraries/ReentrancyGuard.sol";

interface IRewarder {
    using SafeERC20 for IERC20;
    function onHermesReward(address user, uint256 newLpAmount) external;
    function pendingTokens(address user)  external view returns (uint256 pending);
    function rewardToken() external view returns (address);
    function isEmissionValid() external view returns(bool);
}

interface IHermesToken {
    // balanceOf
    function balanceOf(address account) external view returns (uint256);

    //mint
    function mint(address _account, uint256 _amount) external;

    //transfer
    function transfer(address to, uint256 amount) external returns (bool);

    // get status if we can mint
    function maxCapReached() external view returns (bool);

}

// MasterChefHermes is a boss. He says "go f your blocks lego boy, I'm gonna use timestamp instead".
// And to top it off, it takes no risks. Because the biggest risk is operator error.
// So we make it virtually impossible for the operator of this contract to cause a bug with people's harvests.
//
// Note that it's ownable and the owner wields tremendous power. The ownership
// will be transferred to a governance smart contract once HERMES is sufficiently
// distributed and the community can show to govern itself.
//
// With thanks to the Lydia Finance team.
//
// Godspeed and may the 10x be with you.
contract MasterChefHermesV2 is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using BoringERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    // Info of each user.
    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        uint256 lastWithdrawBlock; // the last block a user withdrew at.
        uint256 firstDepositBlock; // the last block a user deposited at.
        uint256 blockdelta; //time passed since withdrawals
        uint256 lastDepositBlock;
        //
        // We do some fancy math here. Basically, any point in time, the amount of GovernanceTokens
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accGovTokenPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accGovTokenPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken; // Address of LP token contract.
        uint256 allocPoint; // How many allocation points assigned to this pool. HERMESs to distribute per second.
        uint256 lastRewardTimestamp; // Last timestamp that HERMESs distribution occurs.
        uint256 accHermesPerShare; // Accumulated HERMESs per share, times 1e12. See below.
        IRewarder rewarder;
    }

    // The HERMES TOKEN!
    IHermesToken public hermes;
    // Dev address.
    address public devAddr;
    // Treasury address.
    address public treasuryAddr;
    // Investor address
    address public investorAddr;
    // HERMES tokens created per second.
    uint256 public hermesPerSec;
    // Percentage of pool rewards that goto the devs.
    uint256 public devPercent;
    // Percentage of pool rewards that goes to the treasury.
    uint256 public treasuryPercent;
    // Percentage of pool rewards that goes to the investor.
    uint256 public investorPercent;

    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Set of all LP tokens that have been added as pools
    EnumerableSet.AddressSet private lpTokens;
    // Info of each user that stakes LP tokens.
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    // Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint;
    // The timestamp when HERMES mining starts.
    uint256 public startTimestamp;

    uint256[] public blockDeltaStartStage = [604800, 1209600];
    uint256[] public blockDeltaEndStage = [1209600];
    uint256[] public userFeeStage = [99, 998, 9995];
    uint256[] public devFeeStage = [1, 2, 5];

    event Add(
        uint256 indexed pid,
        uint256 allocPoint,
        IERC20 indexed lpToken,
        IRewarder indexed rewarder
    );
    event Set(
        uint256 indexed pid,
        uint256 allocPoint,
        IRewarder indexed rewarder,
        bool overwrite
    );
    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event UpdatePool(
        uint256 indexed pid,
        uint256 lastRewardTimestamp,
        uint256 lpSupply,
        uint256 accHermesPerShare
    );
    event Harvest(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(
        address indexed user,
        uint256 indexed pid,
        uint256 amount
    );
    event SetDevAddress(address indexed oldAddress, address indexed newAddress);
    event UpdateEmissionRate(address indexed user, uint256 _hermesPerSec);

    constructor(
        IHermesToken _hermes,
        address _devAddr,
        address _treasuryAddr,
        address _investorAddr,
        uint256 _hermesPerSec,
        uint256 _startTimestamp,
        uint256 _devPercent,
        uint256 _treasuryPercent,
        uint256 _investorPercent
    ) public {
        require(
            0 <= _devPercent && _devPercent <= 1000,
            "constructor: invalid dev percent value"
        );
        require(
            0 <= _treasuryPercent && _treasuryPercent <= 1000,
            "constructor: invalid treasury percent value"
        );
        require(
            0 <= _investorPercent && _investorPercent <= 1000,
            "constructor: invalid investor percent value"
        );
        require(
            _devPercent + _treasuryPercent + _investorPercent <= 1000,
            "constructor: total percent over max"
        );
        hermes = _hermes;
        devAddr = _devAddr;
        treasuryAddr = _treasuryAddr;
        investorAddr = _investorAddr;
        hermesPerSec = _hermesPerSec;
        startTimestamp = _startTimestamp;
        devPercent = _devPercent;
        treasuryPercent = _treasuryPercent;
        investorPercent = _investorPercent;
        totalAllocPoint = 0;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    modifier validatePoolByPid(uint256 _pid) {
        require (_pid < poolInfo.length , "Pool does not exist") ;
        _;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    // XXX DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    function add(
        uint256 _allocPoint,
        IERC20 _lpToken,
        IRewarder _rewarder
    ) public onlyOwner  {
        require(
            Address.isContract(address(_lpToken)),
            "add: LP token must be a valid contract"
        );
        require(
            Address.isContract(address(_rewarder)) ||
                address(_rewarder) == address(0),
            "add: rewarder must be contract or zero"
        );

        // prevent adding a non erc20 contract
        _lpToken.balanceOf(address(this));

        require(!lpTokens.contains(address(_lpToken)), "add: LP already added");
        massUpdatePools();
        uint256 lastRewardTimestamp = block.timestamp > startTimestamp
            ? block.timestamp
            : startTimestamp;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(
            PoolInfo({
                lpToken: _lpToken,
                allocPoint: _allocPoint,
                lastRewardTimestamp: lastRewardTimestamp,
                accHermesPerShare: 0,
                rewarder: _rewarder
            })
        );
        lpTokens.add(address(_lpToken));
        emit Add(poolInfo.length.sub(1), _allocPoint, _lpToken, _rewarder);
    }

    // Update the given pool's HERMES allocation point. Can only be called by the owner.
    function set(
        uint256 _pid,
        uint256 _allocPoint,
        IRewarder _rewarder,
        bool overwrite
    ) public onlyOwner validatePoolByPid(_pid) {
        require(
            Address.isContract(address(_rewarder)) ||
                address(_rewarder) == address(0),
            "set: rewarder must be contract or zero"
        );
        massUpdatePools();
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(
            _allocPoint
        );
        poolInfo[_pid].allocPoint = _allocPoint;
        if (overwrite) {
            poolInfo[_pid].rewarder = _rewarder;
        }
        emit Set(
            _pid,
            _allocPoint,
            overwrite ? _rewarder : poolInfo[_pid].rewarder,
            overwrite
        );
    }

    // View function to see pending HERMESs on frontend.
    function pendingTokens(uint256 _pid, address _user)
        external
        view
        returns (
            uint256 pendingHermes,
            address bonusTokenAddress,
            string memory bonusTokenSymbol,
            uint256 pendingBonusToken
        )
    {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accHermesPerShare = pool.accHermesPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.timestamp > pool.lastRewardTimestamp && lpSupply != 0 && hermes.maxCapReached() == false ) {
            uint256 multiplier = block.timestamp.sub(pool.lastRewardTimestamp);
            uint256 lpPercent = 1000 -
                devPercent -
                treasuryPercent -
                investorPercent;
            uint256 hermesReward = multiplier
                .mul(hermesPerSec)
                .mul(pool.allocPoint)
                .div(totalAllocPoint)
                .mul(lpPercent)
                .div(1000);
            accHermesPerShare = accHermesPerShare.add(
                hermesReward.mul(1e12).div(lpSupply)
            );
        }
        pendingHermes = user.amount.mul(accHermesPerShare).div(1e12).sub(
            user.rewardDebt
        );

        // If it's a double reward farm, we return info about the bonus token
        if (address(pool.rewarder) != address(0)) {
            (bonusTokenAddress, bonusTokenSymbol) = rewarderBonusTokenInfo(
                _pid
            );
            pendingBonusToken = pool.rewarder.pendingTokens(_user);
        }
    }

    // Get bonus token info from the rewarder contract for a given pool, if it is a double reward farm
    function rewarderBonusTokenInfo(uint256 _pid)
        public
        view
        returns (address bonusTokenAddress, string memory bonusTokenSymbol)
    {
        PoolInfo storage pool = poolInfo[_pid];
        if (address(pool.rewarder) != address(0)) {
            bonusTokenAddress = address(pool.rewarder.rewardToken());
            bonusTokenSymbol = IERC20(pool.rewarder.rewardToken()).safeSymbol();
        }
    }

    // Update reward variables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.timestamp <= pool.lastRewardTimestamp) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardTimestamp = block.timestamp;
            return;
        }
        if( hermes.maxCapReached() ){
            // console.log('stop minting if we reached max cap');
            // stop minting if we reached max cap
            pool.lastRewardTimestamp = block.timestamp;
            return;
        }
        uint256 multiplier = block.timestamp.sub(pool.lastRewardTimestamp);
        uint256 hermesReward = multiplier
            .mul(hermesPerSec)
            .mul(pool.allocPoint)
            .div(totalAllocPoint);
        uint256 lpPercent = 1000 -
            devPercent -
            treasuryPercent -
            investorPercent;
        hermes.mint(devAddr, hermesReward.mul(devPercent).div(1000));
        hermes.mint(treasuryAddr, hermesReward.mul(treasuryPercent).div(1000));
        hermes.mint(investorAddr, hermesReward.mul(investorPercent).div(1000));
        hermes.mint(address(this), hermesReward.mul(lpPercent).div(1000));
        pool.accHermesPerShare = pool.accHermesPerShare.add(
            hermesReward.mul(1e12).div(lpSupply).mul(lpPercent).div(1000)
        );
        pool.lastRewardTimestamp = block.timestamp;
        emit UpdatePool(
            _pid,
            pool.lastRewardTimestamp,
            lpSupply,
            pool.accHermesPerShare
        );
    }

    // Deposit LP tokens to MasterChef for HERMES allocation.
    function deposit(uint256 _pid, uint256 _amount) external nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (user.amount > 0) {
            // Harvest HERMES
            uint256 pending = user
                .amount
                .mul(pool.accHermesPerShare)
                .div(1e12)
                .sub(user.rewardDebt);
            // console.log('pending %s', pending);
            _safeHermesTransfer(msg.sender, pending);
            emit Harvest(msg.sender, _pid, pending);
        }

        user.amount = user.amount.add(_amount);
        user.rewardDebt = user.amount.mul(pool.accHermesPerShare).div(1e12);

        IRewarder rewarder = poolInfo[_pid].rewarder;
        if (address(rewarder) != address(0)) {
            //console.log('rewarder.isEmissionValid()', rewarder.isEmissionValid());
            if( rewarder.isEmissionValid() ){
                rewarder.onHermesReward(msg.sender, user.amount);
            }else{
                //console.log('pool.allocPoint=%d', pool.allocPoint);
                if(pool.allocPoint > 0 ){
                    pool.allocPoint = 0;
                    updatePool(_pid);
                }
            }
        }
        if (user.firstDepositBlock > 0) {} else {
            user.firstDepositBlock = block.timestamp;
        }

        // prevent deflationary attack
        uint balanceBefore = pool.lpToken.balanceOf(address(this));
        pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
        uint balanceAfter = pool.lpToken.balanceOf(address(this));
        uint totalDeposited = balanceAfter.sub(balanceBefore);
        require( totalDeposited == _amount, "invalid amount transferred");

        emit Deposit(msg.sender, _pid, _amount);
        user.lastDepositBlock = block.number;
    }

    // Withdraw LP tokens from MasterChef.
    function withdraw(uint256 _pid, uint256 _amount) external nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");

        updatePool(_pid);

        // Harvest HERMES
        uint256 pending = user.amount.mul(pool.accHermesPerShare).div(1e12).sub(
            user.rewardDebt
        );
        _safeHermesTransfer(msg.sender, pending);
        emit Harvest(msg.sender, _pid, pending);

        user.amount = user.amount.sub(_amount);
        user.rewardDebt = user.amount.mul(pool.accHermesPerShare).div(1e12);

        IRewarder rewarder = poolInfo[_pid].rewarder;
        if (address(rewarder) != address(0)) {
            rewarder.onHermesReward(msg.sender, user.amount);
        }

        _withdraw(_pid, _amount);
        // pool.lpToken.safeTransfer(address(msg.sender), _amount);

        emit Withdraw(msg.sender, _pid, _amount);
    }

    function userDelta(uint256 _pid, address _user)
        public
        view
        returns (uint256)
    {
        UserInfo storage user = userInfo[_pid][_user];
        if (user.lastWithdrawBlock > 0) {
            uint256 estDelta = block.timestamp - user.lastWithdrawBlock;
            return estDelta;
        } else {
            uint256 estDelta = block.timestamp - user.firstDepositBlock;
            return estDelta;
        }
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY. This has the same 1% fee as same block withdrawals to prevent abuse of this function.
    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        //reordered from Sushi function to prevent risk of reentrancy
        uint256 amountToSend = user.amount.mul(99).div(100);
        uint256 devToSend = user.amount.mul(1).div(100);
        user.amount = 0;
        user.rewardDebt = 0;
        pool.lpToken.safeTransfer(address(msg.sender), amountToSend);
        pool.lpToken.safeTransfer(address(treasuryAddr), devToSend);
        emit EmergencyWithdraw(msg.sender, _pid, amountToSend);
    }

    // Update dev address by the previous dev.
    function dev(address _devAddr) public {
        require(msg.sender == devAddr, "dev: wut?");
        devAddr = _devAddr;
        emit SetDevAddress(msg.sender, _devAddr);
    }

    function setDevPercent(uint256 _newDevPercent) public onlyOwner {
        require(
            0 <= _newDevPercent && _newDevPercent <= 1000,
            "setDevPercent: invalid percent value"
        );
        require(
            treasuryPercent + _newDevPercent + investorPercent <= 1000,
            "setDevPercent: total percent over max"
        );
        devPercent = _newDevPercent;
    }

    // Update treasury address by the previous treasury.
    function setTreasuryAddr(address _treasuryAddr) public {
        require(msg.sender == treasuryAddr, "setTreasuryAddr: wut?");
        treasuryAddr = _treasuryAddr;
    }

    function setTreasuryPercent(uint256 _newTreasuryPercent) public onlyOwner {
        require(
            0 <= _newTreasuryPercent && _newTreasuryPercent <= 1000,
            "setTreasuryPercent: invalid percent value"
        );
        require(
            devPercent + _newTreasuryPercent + investorPercent <= 1000,
            "setTreasuryPercent: total percent over max"
        );
        treasuryPercent = _newTreasuryPercent;
    }

    // Update the investor address by the previous investor.
    function setInvestorAddr(address _investorAddr) public {
        require(msg.sender == investorAddr, "setInvestorAddr: wut?");
        investorAddr = _investorAddr;
    }

    function setInvestorPercent(uint256 _newInvestorPercent) public onlyOwner {
        require(
            0 <= _newInvestorPercent && _newInvestorPercent <= 1000,
            "setInvestorPercent: invalid percent value"
        );
        require(
            devPercent + _newInvestorPercent + treasuryPercent <= 1000,
            "setInvestorPercent: total percent over max"
        );
        investorPercent = _newInvestorPercent;
    }

    /// @notice simple and transparent to emission update.
    function updateEmissionRate(uint256 _hermesPerSec) public onlyOwner {
        massUpdatePools();
        hermesPerSec = _hermesPerSec;
        emit UpdateEmissionRate(msg.sender, _hermesPerSec);
    }

    function setStageStarts(uint256[] memory _blockStarts) public onlyOwner {
        blockDeltaStartStage = _blockStarts;
    }

    function setStageEnds(uint256[] memory _blockEnds) public onlyOwner {
        blockDeltaEndStage = _blockEnds;
    }

    function setUserFeeStage(uint256[] memory _userFees) public onlyOwner {
        userFeeStage = _userFees;
        checkFees();
    }

    function setDevFeeStage(uint256[] memory _devFees) public onlyOwner {
        devFeeStage = _devFees;
        checkFees();
    }

    function checkFees() internal{
        for( uint i = 0 ; i < userFeeStage.length; i++ ){
            uint v1 = userFeeStage[i];
            uint v2 = devFeeStage[i];
            require( v1+v2 == 100, "fees values not 100%" );
            require( v2 <= 5, "dev fee should not be more than 5%" );
        }
    }

    /// @dev This function execute withdraw fee logic, the rule for withdraw is:
    /// before 1 day = 1% withdraw fee
    /// before 1 week = 0.2% withdraw fee
    /// before 2 weeks = 0.05% withdraw fee

    function _withdraw(uint256 _pid, uint256 _amount) internal {
        if (_amount == 0) return;
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        // get detail, ie how many blocks before last withdraw
        if (user.lastWithdrawBlock > 0) {
            user.blockdelta = block.timestamp - user.lastWithdrawBlock;
        } else {
            user.blockdelta = block.timestamp - user.firstDepositBlock;
        }

        if (user.blockdelta <= 604800) {
            // 1% <= 1 week
            pool.lpToken.safeTransfer(
                address(msg.sender),
                _amount.mul(userFeeStage[0]).div(100)
            );
            pool.lpToken.safeTransfer(
                address(treasuryAddr),
                _amount.sub(_amount.mul(userFeeStage[0]).div(100))
            );
        } else if (
            // 0.2% >= 1 week
            user.blockdelta >= 604800 && user.blockdelta <= 1209600
        ) {
            pool.lpToken.safeTransfer(
                address(msg.sender),
                _amount.mul(userFeeStage[1]).div(1000)
            );
            pool.lpToken.safeTransfer(
                address(treasuryAddr),
                _amount.mul(devFeeStage[1]).div(1000)
            );
        } else {
            pool.lpToken.safeTransfer(
                address(msg.sender),
                _amount.mul(userFeeStage[2]).div(10000)
            );
            pool.lpToken.safeTransfer(
                address(treasuryAddr),
                _amount.mul(devFeeStage[2]).div(10000)
            );
        }
        user.lastWithdrawBlock = block.timestamp;
    }

    event hermesTransfer(address to, uint request, uint sent);
    // Safe hermes transfer function, just in case if rounding error causes pool to not have enough HERMES.
    function _safeHermesTransfer(address _to, uint256 _amount) internal {
        uint256 hermesBal = hermes.balanceOf(address(this));
        // console.log('HRMS transfer %s %s %s', _to, _amount/1e18, hermesBal/1e18);
        if (_amount > hermesBal) {
            emit hermesTransfer(_to, _amount, hermesBal);
            hermes.transfer(_to, hermesBal);
        } else {
            hermes.transfer(_to, _amount);
        }
    }
}
