// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

// HermesBar is the coolest bar in town. You come in with some Hermes, and leave with more! The longer you stay, the more Hermes you get.
//
// This contract handles swapping to and from xHermes, HermesSwap's staking token.
contract HermesBar is ERC20("HermesBar", "xHERMES") {
    using SafeMath for uint256;
    IERC20 public hermes;

    // Define the Hermes token contract
    constructor(IERC20 _hermes) public {
        hermes = _hermes;
    }

    // Enter the bar. Pay some HERMESs. Earn some shares.
    // Locks Hermes and mints xHermes
    function enter(uint256 _amount) public {
        // Gets the amount of Hermes locked in the contract
        uint256 totalHermes = hermes.balanceOf(address(this));
        // Gets the amount of xHermes in existence
        uint256 totalShares = totalSupply();
        // If no xHermes exists, mint it 1:1 to the amount put in
        if (totalShares == 0 || totalHermes == 0) {
            _mint(msg.sender, _amount);
        }
        // Calculate and mint the amount of xHermes the Hermes is worth. The ratio will change overtime, as xHermes is burned/minted and Hermes deposited + gained from fees / withdrawn.
        else {
            uint256 what = _amount.mul(totalShares).div(totalHermes);
            _mint(msg.sender, what);
        }
        // Lock the Hermes in the contract
        hermes.transferFrom(msg.sender, address(this), _amount);
    }

    // Leave the bar. Claim back your HERMESs.
    // Unlocks the staked + gained Hermes and burns xHermes
    function leave(uint256 _share) public {
        // Gets the amount of xHermes in existence
        uint256 totalShares = totalSupply();
        // Calculates the amount of Hermes the xHermes is worth
        uint256 what = _share.mul(hermes.balanceOf(address(this))).div(totalShares);
        _burn(msg.sender, _share);
        hermes.transfer(msg.sender, what);
    }
}
