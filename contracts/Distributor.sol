//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./hermesswap/interfaces/IHermesRouter02.sol";
import "./hermesswap/interfaces/IHermesFactory.sol";
import "./hermesswap/interfaces/IHermesPair.sol";
import "./hermesswap/interfaces/IERC20.sol";

contract Distributor {
    mapping(address => bool) public tokenHashPath;
    mapping(address => address[]) public tokensWithPathForXHRMS;
    mapping(address => address[]) public tokensWithPathForSHRMS;
    address[] tokens;
    address public treasury;
    address public immutable router;
    address public immutable xHRMSAddress;
    address public immutable sHRMSAddress;
    IHermesRouter02 public routerCtx;
    IHermesFactory public factoryCtx;

    constructor(address _router, address _treasury, address _xHRMSAddress, address _sHRMSAddress) {
        router = _router;
        treasury = _treasury;
        xHRMSAddress = _xHRMSAddress;
        sHRMSAddress = _sHRMSAddress;

        routerCtx = IHermesRouter02(_router);
        factoryCtx = IHermesFactory(routerCtx.factory());
        factoryCtx.allPairsLength();
    }

    function addNewToken(address _token, address[] memory _xHRMSPath, address[] memory _sHRMSPath) external {
        for (uint i = 0; i < tokens.length; i ++) {
            require(tokens[i] != _token, "Token is already registered");
        }
        tokenHashPath[_token] = true;
        tokensWithPathForXHRMS[_token] = _xHRMSPath;
        tokensWithPathForSHRMS[_token] = _sHRMSPath;
        tokens.push(_token);
    }
    function breakLp() external {
        uint length = factoryCtx.allPairsLength();
        for (uint i = 0; i < length; i ++) {
            IHermesPair pair = IHermesPair(factoryCtx.allPairs(i));
            uint balanceOfLp = pair.balanceOf( address(this) );
            if( balanceOfLp == 0 ) continue;
            console.log('pair', balanceOfLp, address(pair));
            IERC20Hermes token0 = IERC20Hermes(pair.token0());
            IERC20Hermes token1 = IERC20Hermes(pair.token1());
            pair.approve(address(routerCtx), balanceOfLp);
            routerCtx.removeLiquidity(pair.token1(), pair.token0(), balanceOfLp,
                0, 0, address(this), block.timestamp+60);
            uint balance0 = token0.balanceOf(address(this));
            uint balance1 = token1.balanceOf(address(this));
            (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast) = pair.getReserves();
            console.log(' token0', address(token0), balance0);
            console.log('  reserve0', reserve0);
            console.log(' token1', address(token1), balance1);
            console.log('  reserve1', reserve1);
            convert(token0);
            convert(token1);
        }
    }

    function convert(IERC20Hermes token) public {
        address tokenAddress = address(token);
        if( ! tokenHashPath[ tokenAddress ] ){
            // token has not path
            return;
        }

        uint balanceOfToken = token.balanceOf(address(this));
        if (balanceOfToken < 1 * 10**(token.decimals())){
            // insufficient balance
            return;
        }


        // transfer 50% to treasury
        uint treasuryAmount = balanceOfToken / 2;
        token.transfer(treasury, treasuryAmount);
        // swap 25% to xHRMS
        uint xHRMSAmount = (balanceOfToken - treasuryAmount) / 2;
        routerCtx.swapExactTokensForTokens(
            xHRMSAmount,
            0,
            tokensWithPathForXHRMS[tokenAddress],
            xHRMSAddress,
            block.timestamp + 10000
        );

        // swap 25% of sHRMS
        uint sHRMSAmount = balanceOfToken - treasuryAmount - xHRMSAmount;
        routerCtx.swapExactTokensForTokens(
            sHRMSAmount,
            0,
            tokensWithPathForXHRMS[tokenAddress],
            sHRMSAddress,
            block.timestamp + 10000
        );


    }

}
