/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../farm/facets/ClaimFacet.sol";
import "../../libraries/LibMarket.sol";

/**
 * @author Publius
 * @title Mock Claim Facet
**/
contract MockClaimFacet is ClaimFacet {

    function claimWithAllocationE(
        LibClaim.Claim calldata c,
        uint256 beansAllocated
    ) 
        public
        payable
    {
        LibClaim.claim(c, true);
        LibMarket.transferAllocatedBeans(beansAllocated);
    }

}
