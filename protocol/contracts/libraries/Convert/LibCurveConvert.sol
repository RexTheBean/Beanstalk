/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "../LibAppStorage.sol";
import "../LibConvertUserData.sol";
import "../LibMetaCurve.sol";
import "hardhat/console.sol";

/**
 * @author Publius
 * @title Lib Curve Convert
**/
library LibCurveConvert {

    using SafeMath for uint256;
    using LibConvertUserData for bytes;

    function beansToPeg() internal view returns (uint256 beans) {
        uint256[2] memory balances = LibMetaCurve.balances();
        return _beansToPeg(balances);
    }

    function _beansToPeg(uint256[2] memory balances) private view returns (uint256 beans) {
        uint256 D = LibMetaCurve.getDFromBalances(balances);
        uint256 pegBalance = D / 2e12;
        if (pegBalance < balances[0]) return 0;
        beans = pegBalance.sub(balances[0]);
    }

    function lpToPeg() internal view returns (uint256 lp) {
        uint256[2] memory balances = LibMetaCurve.balances();
        balances = LibMetaCurve.getXP(balances);
        uint256 beans = balances[0].sub(balances[1]);
    }

    /// @notice Takes in encoded bytes for adding Curve LP in beans, extracts the input data, and then calls the
    /// @param userData Contains convert input parameters for a Curve AddLPInBeans convert
    function convertLPToBeans(bytes memory userData) internal returns (address outToken, address inToken, uint256 outAmount, uint256 inAmount, uint256 bdv) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        (uint256 lp, uint256 minBeans) = userData.addBeansInLP();
        (outAmount, inAmount) = _curveRemoveLPAndBuyToPeg(lp, minBeans);
        outToken = C.uniswapV2PairAddress();
        inToken = C.beanAddress();
        bdv = outAmount;
    }

    /// @notice Takes in encoded bytes for adding beans in Curve LP, extracts the input data, and then calls the
    /// @param userData Contains convert input parameters for a Curve AddBeansInLP convert
    function convertBeansToLP(bytes memory userData) internal returns (address outToken, address inToken, uint256 outAmount, uint256 inAmount, uint256 bdv) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        
        (uint256 beans, uint256 minLP) = userData.addLPInBeans();
        (outAmount, inAmount) = _curveSellToPegAndAddLiquidity(beans, minLP);
        console.log("Out: %s, In: %s", outAmount, inAmount);
        outToken = C.uniswapV2PairAddress();
        inToken = C.beanAddress();
        bdv = inAmount;
    }

    /// @notice Takes in parameters to convert beans into LP using Curve
    /// @param beans - amount of beans to convert to Curve LP
    /// @param minLP - min amount of Curve LP to receive
    function _curveSellToPegAndAddLiquidity(uint256 beans, uint256 minLP) private returns (uint256 lp, uint256 beansConverted) {
        uint256[2] memory balances = LibMetaCurve.balances();
        uint256 beans = _beansToPeg(balances);
        uint256 outLP = beans.mul(LibMetaCurve.totalSupply()).div(balances[0]);
        require(outLP > minLP, "Convert: Insufficient output amount");
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = beans;
        lp = LibMetaCurve.addLiquidity(amounts, minLP);
        beansConverted = beans;
    }

    /// @notice Takes in parameters to remove LP into beans by removing LP in curve through removing beans 
    /// @param lp - the amount of Curve lp to be removed
    /// @param minBeans - min amount of beans to receive   
    function _curveRemoveLPAndBuyToPeg(uint256 lp, uint256 minBeans) private returns (uint256 beans, uint256 lpConverted) {
        uint256[2] memory balances = LibMetaCurve.balances();
        balances = LibMetaCurve.getXP(balances);
        uint256 beans = balances[0].sub(balances[1]); 
        require(beans > minBeans, "Convert: Insufficient output amount");
        beans = LibMetaCurve.removeLiquidityOneCoin(lp, 0, minBeans);
        lpConverted = lp;
    }
    

    // // Multi-Pool Buy To Peg/Sell To Peg Functions
    // function _convertUniswapBuyToPegAndCurveSellToPeg(bytes memory userData)
    //     private
    //     returns (address outToken, address inToken, uint256 outAmount, uint256 inAmount, uint256 bdv) 
    // {
    //     AppStorage storage s = LibAppStorage.diamondStorage();

    //     (uint256 uniswapLP, uint256 minBeans, uint256 beans, uint256 minCurveLP) = userData.uniswapBuyToPegAndCurveSellToPeg();
    //     (, uint256 inAmount) = _uniswapRemoveLPAndBuyToPeg(uniswapLP, minBeans);
    //     (uint256 outAmount, uint256 bdv) = _curveSellToPegAndAddLiquidity(beans, minCurveLP);
    //     address outToken = C.curveMetapoolAddress();
    //     address inToken = C.uniswapV2PairAddress();
    // }

    // function _convertCurveBuyToPegAndUniswapSellToPeg(bytes memory userData)
    //     private
    //     returns (address outToken, address inToken, uint256 outAmount, uint256 inAmount, uint256 bdv)
    // {
    //     AppStorage storage s = LibAppStorage.diamondStorage();

    //     (uint256 curveLP, uint256 minBeans, uint256 beans, uint256 minUniswapLP) = userData.curveBuyToPegAndUniswapSellToPeg();
    //     (, uint256 inAmount) = _curveRemoveLPAndBuyToPeg(curveLP, minBeans);
    //     (uint256 outAmount, uint256 bdv) = _uniswapSellToPegAndAddLiquidity(beans, minUniswapLP);
    //     address outToken = C.uniswapV2PairAddress();
    //     address inToken = C.curveMetapoolAddress();
    // }
}
