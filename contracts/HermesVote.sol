// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./interfaces/IPair.sol";
import "./interfaces/IBar.sol";

interface IMasterChef {
    function userInfo(uint256 pid, address owner) external view returns (uint256, uint256);
}

contract HermesVote {
    using SafeMath for uint256;

    IPair pair; // HERMES-AVAX LP
    IBar bar;
    IERC20 hermes;
    IMasterChef chef;
    uint256 pid; // Pool ID of the HERMES-AVAX LP in MasterChefV2

    function name() public pure returns (string memory) {
        return "HermesVote";
    }

    function symbol() public pure returns (string memory) {
        return "HERMESVOTE";
    }

    function decimals() public pure returns (uint8) {
        return 18;
    }

    constructor(
        address _pair,
        address _bar,
        address _hermes,
        address _chef,
        uint256 _pid
    ) public {
        pair = IPair(_pair);
        bar = IBar(_bar);
        hermes = IERC20(_hermes);
        chef = IMasterChef(_chef);
        pid = _pid;
    }

    function totalSupply() public view returns (uint256) {
        (uint256 lp_totalHermes, , ) = pair.getReserves();
        uint256 xhermes_totalHermes = hermes.balanceOf(address(bar));

        return lp_totalHermes.mul(2).add(xhermes_totalHermes);
    }

    function balanceOf(address owner) public view returns (uint256) {
        //////////////////////////
        // Get balance from LPs //
        //////////////////////////
        uint256 lp_totalHermes = hermes.balanceOf(address(pair));
        uint256 lp_total = pair.totalSupply();
        uint256 lp_balance = pair.balanceOf(owner);

        // Add staked balance
        (uint256 lp_stakedBalance, ) = chef.userInfo(pid, owner);
        lp_balance = lp_balance.add(lp_stakedBalance);

        // LP voting power is 2x the users HERMES share in the pool.
        uint256 lp_powah = lp_totalHermes.mul(lp_balance).div(lp_total).mul(2);

        ///////////////////////////
        // Get balance from xHERMES //
        ///////////////////////////

        uint256 xhermes_balance = bar.balanceOf(owner);
        uint256 xhermes_total = bar.totalSupply();
        uint256 xhermes_totalHermes = hermes.balanceOf(address(bar));

        // xHERMES voting power is the users HERMES share in the bar
        uint256 xhermes_powah = xhermes_totalHermes.mul(xhermes_balance).div(xhermes_total);

        //////////////////////////
        // Get balance from HERMES //
        //////////////////////////

        uint256 hermes_balance = hermes.balanceOf(owner);

        return lp_powah.add(xhermes_powah).add(hermes_balance);
    }

    function allowance(address, address) public pure returns (uint256) {
        return 0;
    }

    function transfer(address, uint256) public pure returns (bool) {
        return false;
    }

    function approve(address, uint256) public pure returns (bool) {
        return false;
    }

    function transferFrom(
        address,
        address,
        uint256
    ) public pure returns (bool) {
        return false;
    }
}
