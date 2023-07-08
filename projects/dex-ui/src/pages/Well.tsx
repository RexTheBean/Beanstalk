import React, { ReactNode, useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useWell } from "src/wells/useWell";
import { getPrice } from "src/utils/price/usePrice";
import useSdk from "src/utils/sdk/useSdk";
import { TokenValue } from "@beanstalk/sdk";
import { BodyL, BodyS, BodyXS, TextNudge } from "src/components/Typography";
import styled from "styled-components";
import { Title } from "src/components/PageComponents/Title";
import { Page } from "src/components/Page";
import { TokenLogo } from "src/components/TokenLogo";
import { Reserves } from "src/components/Well/Reserves";
import { LiquidityBox } from "src/components/Well/LiquidityBox";
import { Spinner2 } from "src/components/Spinner2";
import { Button } from "src/components/Swap/Button";
import { LearnYield } from "src/components/Well/LearnYield";
import { Item, Row } from "src/components/Layout";
import { LearnWellFunction } from "src/components/Well/LearnWellFunction";
import { LearnPump } from "src/components/Well/LearnPump";
import { ChartSection } from "src/components/Well/Chart/ChartSection";
import { TabButton } from "src/components/TabButton";
import { OtherSection } from "src/components/Well/OtherSection";
import { WellHistory } from "src/components/Well/Activity/WellHistory";
import { ChevronDown } from "src/components/Icons";
import { ImageButton } from "src/components/ImageButton";

export const Well = () => {
  const sdk = useSdk();
  const navigate = useNavigate();
  const { address: wellAddress } = useParams<"address">();
  const { well, loading, error } = useWell(wellAddress!);
  const [prices, setPrices] = useState<(TokenValue | null)[]>([]);
  const [wellFunctionName, setWellFunctionName] = useState<string | undefined>("-");
  
  const [tab, setTab] = useState(0);
  const showTab = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>, i: number) => {
    (e.target as HTMLElement).blur();
    setTab(i);
  }, []);

  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => {
      setOpen(!open);
    },
    [open]
  );

  useEffect(() => {
    const run = async () => {
      if (!well?.tokens) return;

      if (well.tokens) {
        const prices = await Promise.all(well.tokens.map((t) => getPrice(t, sdk)));
        setPrices(prices);
      }

      if (well.wellFunction) {
        const _wellName = await well.wellFunction.contract.name();
        setWellFunctionName(_wellName);
      }
    };

    run();
  }, [sdk, well]);

  const title = (well?.tokens ?? []).map((t) => t.symbol).join("/");
  const logos: ReactNode[] = (well?.tokens || []).map((token) => <TokenLogo token={token} size={48} mobileSize={24} key={token.symbol} />);

  const reserves = (well?.reserves ?? []).map((amount, i) => {
    const token = well!.tokens![i];
    const price = prices[i];

    return {
      token,
      amount,
      dollarAmount: price ? amount.mul(price) : null,
      percentage: TokenValue.ZERO
    };
  });
  const totalUSD = reserves.reduce((total, r) => total.add(r.dollarAmount ?? TokenValue.ZERO), TokenValue.ZERO);

  reserves.forEach((reserve) => {
    reserve.percentage = reserve.dollarAmount && totalUSD.gt(TokenValue.ZERO) ? reserve.dollarAmount.div(totalUSD) : TokenValue.ZERO;
  });

  const goLiquidity = () => navigate(`./liquidity`);

  const goSwap = () =>
    well && well.tokens ? navigate(`../swap?fromToken=${well.tokens[0].symbol}&toToken=${well.tokens[1].symbol}`) : null;

  if (loading)
    return (
      <Page>
        <Spinner2 size={72} />
      </Page>
    );

  // TODO: ERROR
  if (error)
    return (
      <Page>
        <div>ERROR: {error?.message}</div>
      </Page>
    );

  return (
    <Page>
      <Title title={title} parent={{ title: "Liquidity", path: "/wells" }} center />
      <ContentWrapper>
        <MainContent>
          <StyledRow>
            <Item>
              <Header>
                <TokenLogos>{logos}</TokenLogos>
                <TextNudge amount={10} mobileAmount={-2}>{title}</TextNudge>
              </Header>
            </Item>
            <StyledItem column stretch>
              <FunctionName>{wellFunctionName}</FunctionName>
              <Fee>0.00% Trading Fee</Fee>
            </StyledItem>
          </StyledRow>
          <Reserves reserves={reserves} />
          <ChartSection well={well!} />
          <Row gap={24}>
            <Item stretch>
              <TabButton onClick={(e) => showTab(e, 0)} active={tab === 0} stretch justify bold hover>
                Activity
              </TabButton>
            </Item>
            <Item stretch>
              <TabButton onClick={(e) => showTab(e, 1)} active={tab === 1} stretch justify bold hover>
                Other Details
              </TabButton>
            </Item>
          </Row>
          <BottomContainer>
            {tab === 0 && <WellHistory well={well!} tokenPrices={prices} />}
            {tab === 1 && <OtherSection well={well!} />}
          </BottomContainer>
        </MainContent>
        <SideBar id="sidebar">
          <Row gap={24}>
            <Item stretch>
              <Button secondary label="Add/Rm Liquidity" onClick={goLiquidity} />
            </Item>
            <Item stretch>
              <Button label="Swap" onClick={goSwap} />
            </Item>
          </Row>
          <LiquidityBoxContainer>
            <LiquidityBox lpToken={well?.lpToken!} />
          </LiquidityBoxContainer>
          <LearnMoreContainer>
            <LearnMoreLabel onClick={toggle}>
              <LearnMoreLine />
              <LearnMoreText>
                <TextNudge amount={2}>
                  Learn more about this Well
                </TextNudge> 
                <ImageButton
                  component={ChevronDown}
                  size={10}
                  rotate={open ? "180" : "0"}
                  onClick={toggle}
                  padding="0px"
                  alt="Click to expand and learn how to earn yield"
                  color={"#46B955"}
                />
              </LearnMoreText>
              <LearnMoreLine />
            </LearnMoreLabel>
            <LearnMoreButtons open={open}>
              <LearnYield />
              <LearnWellFunction name={wellFunctionName || "A Well Function"} />
              <LearnPump />
            </LearnMoreButtons>
          </LearnMoreContainer>
        </SideBar>
      </ContentWrapper>
    </Page>
  );
};

const Header = styled.div`
  display: flex;
  font-weight: 600;
  font-size: 32px;
  line-height: 32px;
  gap: 24px;

  @media (max-width: 475px) {
    font-size: 24px;
    gap: 8px;
  }
`;

const TokenLogos = styled.div`
  display: flex;
  div:not(:first-child) {
    margin-left: -8px;
  }
`;

const ContentWrapper = styled.div`
  // outline: 1px solid red;
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 48px;

  @media (max-width: 475px) {
    flex-direction: column;
  }
`;

const MainContent = styled.div`
  // outline: 1px solid green;
  display: flex;
  flex-direction: column;
  @media (min-width: 475px) {
    width: calc(37 * 24px);
    min-width: calc(37 * 24px);
    gap: 24px;
  }
  gap: 12px;
`;

const StyledRow = styled(Row)`
  @media (max-width: 475px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
`
const StyledItem = styled(Item)`
  @media (min-width: 475px) {
    align-items: end;
  }
`
const BottomContainer = styled.div`
  display: flex;
  flex-direction: column;

  gap: 24px;
`;

const SideBar = styled.div`
  // outline: 1px solid green;
  display: flex;
  flex-direction: column;
  @media (min-width: 475px) {
    width: calc(17 * 24px);
    min-width: calc(17 * 24px);
  }
  gap: 24px;
`;

const FunctionName = styled.div`
  ${BodyL}
  @media (max-width: 475px) {
    ${BodyS}
  }
`;
const Fee = styled.div`
  ${BodyS}
  color: #4B5563;
  @media (max-width: 475px) {
    ${BodyXS}
  }
`;

const LiquidityBoxContainer = styled.div`
  @media (max-width: 475px) {
    display: none;
  }
`

const LearnMoreContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  @media (max-width: 475px) {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
`
const LearnMoreLabel = styled.div`
  display: none;
  @media (max-width: 475px) {
    display: flex;
    flex-direction: row;
  }
`

const LearnMoreLine = styled.div`
  align-self: center;
  flex-grow: 1;
  border-top: 1px solid #9CA3AF;
  flex-basis: 1fr;
`

const LearnMoreText = styled.div`
  display: flex;
  flex-direction: row;
  gap: 8px;
  align-items: center;
  width: 195px;
  color: #46B955;
  padding-right: 8px;
  padding-left: 8px;
  ${BodyXS}
  font-weight: 600;
`

const LearnMoreButtons = styled.div<{open: boolean}>`
  display: flex;
  flex-direction: column;
  gap: 24px;
  @media (max-width: 475px) {
    ${(props) => props.open ? "display: flex" : "display: none"};
    flex-direction: column;
    gap: 16px;
  }
`
