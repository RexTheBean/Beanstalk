/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../AppStorage.sol";
import "../../libraries/LibCheck.sol";
import "../../libraries/LibInternal.sol";
import "../../libraries/LibClaim.sol";
import "../../libraries/LibUserBalance.sol";

/**
 * @author Publius
 * @title Claim handles claiming Bean and LP withdrawals, harvesting plots and claiming Ether.
**/
contract ClaimFacet {

    event BeanClaim(address indexed account, uint32[] withdrawals, uint256 beans);
    event LPClaim(address indexed account, uint32[] withdrawals, uint256 lp);
    event EtherClaim(address indexed account, uint256 ethereum);
    event Harvest(address indexed account, uint256[] plots, uint256 beans);
    event BeanAllocation(address indexed account, uint256 beans);

    using SafeMath for uint256;

    AppStorage internal s;

    function claim(LibClaim.Claim calldata c) public payable returns (uint256 beansClaimed) {
        beansClaimed = LibClaim.claim(c);

        LibCheck.balanceCheck();
    }

    function claimAndUnwrapBeans(LibClaim.Claim calldata c, uint256 amount) public payable returns (uint256 beansClaimed) {
        beansClaimed = LibClaim.claim(c);
        beansClaimed = beansClaimed.add(unwrapBeans(amount));
        LibCheck.balanceCheck();
    }

    function claimBeans(uint32[] calldata withdrawals) public {
        uint256 beansClaimed = LibClaim.claimBeans(withdrawals);
        IBean(s.c.bean).transfer(msg.sender, beansClaimed);
        LibCheck.beanBalanceCheck();
    }

    function claimLP(uint32[] calldata withdrawals) public {
        LibClaim.claimLP(withdrawals);
        LibCheck.lpBalanceCheck();
    }

    function removeAndClaimLP(
        uint32[] calldata withdrawals,
        uint256 minBeanAmount,
        uint256 minEthAmount
    )
        public
    {
        LibClaim.removeAndClaimLP(withdrawals, minBeanAmount, minEthAmount);
        LibCheck.balanceCheck();
    }

    function harvest(uint256[] calldata plots) public {
        uint256 beansHarvested = LibClaim.harvest(plots);
        IBean(s.c.bean).transfer(msg.sender, beansHarvested);
        LibCheck.beanBalanceCheck();
    }

    function claimEth() public {
        LibClaim.claimEth();
    }

    function unwrapBeans(uint amount) public returns (uint256 beansToWallet) {
        if (amount == 0) return beansToWallet;
	AppStorage storage s = LibAppStorage.diamondStorage();
        uint wrappedBeans = s.internalTokenBalance[msg.sender][IBean(s.c.bean)];

        if (amount > wrappedBeans) {
            IBean(s.c.bean).transfer(msg.sender, wrappedBeans);
            beansToWallet = s.internalTokenBalance[msg.sender][IBean(s.c.bean)];
            s.internalTokenBalance[msg.sender][IBean(s.c.bean)] = 0;
        } else {
            IBean(s.c.bean).transfer(msg.sender, amount);
            s.internalTokenBalance[msg.sender][IBean(s.c.bean)] = wrappedBeans.sub(amount);
            beansToWallet = amount;
        }
    }

    function wrapBeans(uint amount) public {
        IBean(s.c.bean).transferFrom(msg.sender, address(this), amount);
        LibUserBalance._increaseInternalBalance(msg.sender, IBean(s.c.bean), amount);
    }

    function wrappedBeans(address user) public view returns (uint256) {
        return s.internalTokenBalance[user][IBean(s.c.bean)];
    }
}
