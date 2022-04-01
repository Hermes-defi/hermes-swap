//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./hermesswap/interfaces/IHermesRouter02.sol";
import "./hermesswap/interfaces/IERC20.sol";

contract Distributor {
    mapping(address => address[]) public tokensWithPathForXHRMS;
    mapping(address => address[]) public tokensWithPathForSHRMS;
    address[] tokens;
    address public treasury;
    address public immutable router;
    address public immutable xHRMSAddress;
    address public immutable sHRMSAddress;

    constructor(address _router, address _treasury, address _xHRMSAddress, address _sHRMSAddress) {
        router = _router;
        treasury = _treasury;
        xHRMSAddress = _xHRMSAddress;
        sHRMSAddress = _sHRMSAddress;
    }

    function addNewToken(address _token, address[] memory _xHRMSPath, address[] memory _sHRMSPath) external {
        for (uint i = 0; i < tokens.length; i ++) {
            require(tokens[i] != _token, "Token is already registered");
        }
        tokensWithPathForXHRMS[_token] = _xHRMSPath;
        tokensWithPathForSHRMS[_token] = _sHRMSPath;
        tokens.push(_token);
    }

    function convert() external {
        for (uint i = 0; i < tokens.length; i ++) {
            uint balanceOfToken = IERC20Hermes(tokens[i]).balanceOf(address(this));
            if (balanceOfToken > 100 * 10**(IERC20Hermes(tokens[i]).decimals())) {
                // transfer 50% to treasury
                uint treasuryAmount = balanceOfToken / 2;
                IERC20Hermes(tokens[i]).transfer(treasury, treasuryAmount);
                // swap 25% to xHRMS
                uint xHRMSAmount = (balanceOfToken - treasuryAmount) / 2;
                IHermesRouter02(router).swapExactTokensForTokens(
                    xHRMSAmount,
                    0,
                    tokensWithPathForXHRMS[tokens[i]],
                    xHRMSAddress,
                    block.timestamp + 10000
                );

                // swap 25% of sHRMS
                uint sHRMSAmount = balanceOfToken - treasuryAmount - xHRMSAmount;
                IHermesRouter02(router).swapExactTokensForTokens(
                    sHRMSAmount,
                    0,
                    tokensWithPathForXHRMS[tokens[i]],
                    sHRMSAddress,
                    block.timestamp + 10000
                );

            }
        }
    }
}
