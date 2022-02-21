// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.6.2;

import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";

contract HermesHatToken is ERC20Burnable {
    /**
     * @dev Mints `initialSupply` amount of token and transfers them to `owner`.
     *
     * See {ERC20-constructor}.
     */
    constructor(address owner) public ERC20("Hermes Hat Token", "HAT") {
        uint256 initialSupply = 150e18;
        _mint(owner, initialSupply);
    }
}
