import React, { Children, useCallback, useState, MouseEvent as ReactMouseEvent } from "react";
import { FC } from "src/types";
import styled from "styled-components";
import { BodyCaps, BodyS } from "./Typography";
import { ImageButton } from "./ImageButton";
import { ChevronDown } from "./Icons";

interface Composition {
  Header: typeof Header;
  Body: typeof Body;
  Footer: typeof Footer;
  Row: typeof Row;
  Key: typeof Key;
  Value: typeof Value;
}

type Props = {
  width?: number;
};
export const ExpandBox: FC<Props> & Composition = ({ width = 432, children }) => {
  const [open, setOpen] = useState(false);
  const [header, body] = Children.toArray(children);
  if (!header || !body) throw new Error("ExpandBox must have two children, Header and Boxy");

  const toggle = useCallback(
    (e: ReactMouseEvent) => {
      (e.target as HTMLElement).blur();
      setOpen(!open);
    },
    [open]
  );

  return (
    <Container width={width} data-trace="true">
      <Header id="header">
        {header}
        <ImageButton component={ChevronDown} padding="12px" onClick={toggle} alt="Click to epand this box and learn how to earn yield" />
      </Header>

      {open && body}
    </Container>
  );
};

const Container = styled.div<Props>`
  display: flex;
  flex-direction: column;
  outline: 0.5px solid #9ca3af;
  outline-offset: -0.5px;
  width: ${(p) => p.width}px;
  min-width: ${(p) => p.width}px;
`;
const Header = styled.div`
  background-color: #f9f8f6;
  border-bottom: 0.5px solid #9ca3af;
  display: flex;
  flex-direction: row;
  padding: 12px 16px;
  justify-content: space-between;
  align-items: center;
`;
const Body = styled.div`
  display: flex;
  flex-direction: column;
  background-color: #fff;
  flex: 2;
  padding: 20px 16px;
  gap: 8px;
`;
const Footer = styled.div`
  display: flex;
  flex-direction: row;
  padding: 12px 16px;
  background-color: #fff;
  border-top: 0.5px solid #9ca3af;
`;

const Row = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  ${BodyS}
`;
const Key = styled.div`
  color: #4b5563;
`;
const Value = styled.div`
  display: flex;
  flex: 2;
  justify-content: flex-end;
`;

const UserHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  ${BodyCaps}
`;

ExpandBox.Header = UserHeader;
ExpandBox.Body = Body;
ExpandBox.Footer = Footer;
ExpandBox.Row = Row;
ExpandBox.Key = Key;
ExpandBox.Value = Value;
