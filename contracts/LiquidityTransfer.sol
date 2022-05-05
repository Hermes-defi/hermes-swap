// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

// import "hardhat/console.sol";
import "./hermesswap/interfaces/IHermesERC20.sol";
import "./hermesswap/interfaces/IHermesPair.sol";
import "./hermesswap/interfaces/IHermesRouter02.sol";
import "./hermesswap/interfaces/IHermesFactory.sol";

import './libraries/Babylonian.sol';
import './libraries/FullMath.sol';
import './libraries/SafeMath.sol';
import './hermesswap/libraries/HermesLibrary.sol';

contract LiquidityTransferService {
    using SafeMath for uint256;
    IHermesRouter02 public routerSrc;
    IHermesRouter02 public routerDst;
    address public srcPair;
    address public dstPair;
    address public tokenA;
    address public tokenB;
    uint public slippageBps = 50; // 0.5%
    address public admin;
    constructor(
        address _routerSrc, address _routerDst,
        address _tokenA, address _tokenB
    ) public {
        admin = msg.sender;
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
    event onSlippageBps(uint oldPoints, uint newPoints);
    function setSlippageBps(uint points) external{
        require(msg.sender == admin, "error, no admin");
        emit onSlippageBps(slippageBps, points);
        slippageBps = points;
    }

    function run() external {

        IHermesPair srcPairCtx = IHermesPair(srcPair);
        uint256 liquidity = srcPairCtx.balanceOf(msg.sender);

        require(liquidity > 0, "err no src liquidity");
        require(srcPairCtx.allowance(msg.sender, address(this)) >= liquidity, "err allowance");

        srcPairCtx.transferFrom(msg.sender, address(this), liquidity);

        liquidity = srcPairCtx.balanceOf(address(this));

        (uint256 tokenAAmount, uint256 tokenBAmount) = getLiquidityValue(srcPairCtx,liquidity);

        srcPairCtx.approve(address(routerSrc), liquidity);
        (uint amountA, uint amountB) = routerSrc.removeLiquidity(
                tokenA,
                tokenB,
                liquidity,
                tokenAAmount * (10000 - slippageBps) / 10000,
                tokenBAmount * (10000 - slippageBps) / 10000,
                address(this), block.timestamp + 60);

        /*
        console.log('amountA=%s amountB=%s', amountA, amountB);
        console.log('tokenAAmount=%s tokenBAmount=%s', tokenAAmount, tokenBAmount);
        console.log('tokenAAmount=%s tokenBAmount=%s',
            tokenAAmount * (10000 - slippageBps) / 10000,
            tokenBAmount * (10000 - slippageBps) / 10000);
        */

        emit OnRemoveLiquidity(msg.sender, srcPair, amountA, amountB, liquidity);

        IHermesERC20 tokenACtx = IHermesERC20(tokenA);
        IHermesERC20 tokenBCtx = IHermesERC20(tokenB);

        amountA = tokenACtx.balanceOf(address(this));
        amountB = tokenBCtx.balanceOf(address(this));

        tokenACtx.approve(address(routerDst), amountA);
        tokenBCtx.approve(address(routerDst), amountB);

        (uint _amountA, uint _amountB, uint _liquidity) =
        routerDst.addLiquidity(tokenA, tokenB,
            amountA,
            amountB,
            amountA * (10000 - slippageBps) / 10000,
            amountB * (10000 - slippageBps) / 10000,
            msg.sender, block.timestamp + 60);

        // by audit recomendation, we should send any dust to user

        uint balanceA = tokenACtx.balanceOf(address(this));
        if( balanceA > 0 ){
            tokenACtx.transfer(msg.sender, balanceA);
        }

        uint balanceB = tokenBCtx.balanceOf(address(this));
        if( balanceB > 0 ){
            tokenBCtx.transfer(msg.sender, balanceB);
        }

        emit OnAddLiquidity(msg.sender, srcPair, _amountA, _amountB, _liquidity);

    }

    function getLiquidityValue(
        IHermesPair pair,
        uint256 liquidityAmount
    ) internal view returns (uint256 tokenAAmount, uint256 tokenBAmount) {
        (uint256 reservesA, uint256 reservesB) = HermesLibrary.getReserves(routerSrc.factory(), pair.token0(), pair.token1());
        bool feeOn = IHermesFactory(routerSrc.factory()).feeTo() != address(0);
        uint kLast = feeOn ? pair.kLast() : 0;
        uint totalSupply = pair.totalSupply();
        return computeLiquidityValue(reservesA, reservesB, totalSupply, liquidityAmount, feeOn, kLast);
    }

    // computes liquidity value given all the parameters of the pair
    function computeLiquidityValue(
        uint256 reservesA,
        uint256 reservesB,
        uint256 totalSupply,
        uint256 liquidityAmount,
        bool feeOn,
        uint kLast
    ) internal pure returns (uint256 tokenAAmount, uint256 tokenBAmount) {
        if (feeOn && kLast > 0) {
            uint rootK = Babylonian.sqrt(reservesA.mul(reservesB));
            uint rootKLast = Babylonian.sqrt(kLast);
            if (rootK > rootKLast) {
                uint numerator1 = totalSupply;
                uint numerator2 = rootK.sub(rootKLast);
                uint denominator = rootK.mul(5).add(rootKLast);
                uint feeLiquidity = FullMath.mulDiv(numerator1, numerator2, denominator);
                totalSupply = totalSupply.add(feeLiquidity);
            }
        }
        return (reservesA.mul(liquidityAmount) / totalSupply, reservesB.mul(liquidityAmount) / totalSupply);
    }
}
