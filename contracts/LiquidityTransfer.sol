// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "hardhat/console.sol";
import "./hermesswap/interfaces/IHermesERC20.sol";
import "./hermesswap/interfaces/IHermesPair.sol";
import "./hermesswap/interfaces/IHermesRouter02.sol";
import "./hermesswap/interfaces/IHermesFactory.sol";

contract LiquidityTransferService {
    IHermesRouter02 public routerSrc;
    IHermesRouter02 public routerDst;
    address public srcPair;
    address public dstPair;
    address public tokenA;
    address public tokenB;
    constructor(
        address _routerSrc, address _routerDst,
        address _tokenA, address _tokenB
    ) public {

        routerSrc = IHermesRouter02(_routerSrc);
        routerDst = IHermesRouter02(_routerDst);

        tokenA = _tokenA;
        tokenB = _tokenB;

        srcPair = IHermesFactory(routerSrc.factory()).getPair(_tokenA, _tokenB);
        if (srcPair == address(0x0)) {
            srcPair = IHermesFactory(routerSrc.factory()).createPair(_tokenA, _tokenB);
        }

        dstPair = IHermesFactory(routerDst.factory()).getPair(_tokenA, _tokenB);
        if (dstPair == address(0x0)) {
            dstPair = IHermesFactory(routerDst.factory()).createPair(_tokenA, _tokenB);
        }
    }

    event OnRemoveLiquidity(address user, address pair, uint amountA, uint amountB, uint liquidity);

    event OnAddLiquidity(address user, address pair, uint amountA, uint amountB, uint liquidity);

    function run() external {

        IHermesPair srcPairCtx = IHermesPair(srcPair);
        uint256 liquidity = srcPairCtx.balanceOf(msg.sender);

        require(liquidity > 0, "err no src liquidity");
        require(srcPairCtx.allowance(msg.sender, address(this)) >= liquidity, "err allowance");

        srcPairCtx.transferFrom(msg.sender, address(this), liquidity);

        liquidity = srcPairCtx.balanceOf(address(this));
        srcPairCtx.approve(address(routerSrc), liquidity);
        (uint amountA, uint amountB) = routerSrc.removeLiquidity(
            tokenA, tokenB, liquidity,
            9990, 9990, address(this), block.timestamp + 60);

        emit OnRemoveLiquidity(msg.sender, srcPair, amountA, amountB, liquidity);

        IHermesERC20 tokenACtx = IHermesERC20(tokenA);
        IHermesERC20 tokenBCtx = IHermesERC20(tokenB);

        amountA = tokenACtx.balanceOf(address(this));
        amountB = tokenBCtx.balanceOf(address(this));

        tokenACtx.approve(address(routerDst), amountA);
        tokenBCtx.approve(address(routerDst), amountB);

        (uint _amountA, uint _amountB, uint _liquidity) =
        routerDst.addLiquidity(tokenA, tokenB, amountA, amountB, 0, 0, msg.sender, block.timestamp + 60);

        emit OnAddLiquidity(msg.sender, srcPair, _amountA, _amountB, _liquidity);

    }

}
