// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// HermesToken with Governance.
contract HermesToken is ERC20("HermesToken", "HERMES"), Ownable {
    /// @notice Total number of tokens
    uint256 public maxSupply = 30_000_000e18; // 30 million Hermes
    mapping(address => bool) private minters;
    address[] public minteresList;
    event SetMinter(address _addr, bool _status);
    modifier onlyMinters() {
        require(minters[msg.sender], "minter: caller is not a minter");
        _;
    }
    constructor() public {
        minters[_msgSender()] = true;
    }
    function mint(address _to, uint256 _amount) public onlyMinters {
        if(totalSupply().add(_amount) <= maxSupply){
            _mint(_to, _amount);
        }
    }
    function setMinter(address _minter, bool _status) external onlyOwner {
        require(_minter != address(0), "Zero Address");
        minters[_minter] = _status;
        minteresList.push(_minter);
        emit SetMinter(_minter, _status);
    }
}
