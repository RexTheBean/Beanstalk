import { BigInt, log } from "@graphprotocol/graph-ts";
import { Sunrise } from "../generated/Beanstalk/Beanstalk";
import { getBeanTokenAddress, loadBean, updateBeanSeason, updateBeanValues } from "./utils/Bean";
import { BEAN_3CRV, BEAN_ERC20_V1, BEAN_ERC20_V2, CURVE_PRICE } from "./utils/Constants";
import { updatePoolPrice, updatePoolSeason } from "./utils/Pool";
import { CurvePrice } from "../generated/Bean3CRV/CurvePrice";
import { ZERO_BD, ZERO_BI, toDecimal } from "./utils/Decimals";

export function handleSunrise(event: Sunrise): void {
  // Update the season for hourly and daily liquidity metrics

  let beanToken = getBeanTokenAddress(event.block.number);

  updateBeanSeason(beanToken, event.block.timestamp, event.params.season.toI32());

  let bean = loadBean(beanToken);
  for (let i = 0; i < bean.pools.length; i++) {
    updatePoolSeason(bean.pools[i], event.block.timestamp, event.block.number, event.params.season.toI32());
  }

  // Fetch price from price contract to capture any 3CRV movements against peg.
  if (event.params.season > BigInt.fromI32(6074)) {
    let curvePrice = CurvePrice.bind(CURVE_PRICE);
    let curve = curvePrice.try_getCurve();

    if (curve.reverted) {
      return;
    }
    updateBeanValues(BEAN_ERC20_V2.toHexString(), event.block.timestamp, toDecimal(curve.value.price), ZERO_BI, ZERO_BI, ZERO_BD, ZERO_BD);
    updatePoolPrice(BEAN_3CRV.toHexString(), event.block.timestamp, event.block.number, toDecimal(curve.value.price));
  }
}
