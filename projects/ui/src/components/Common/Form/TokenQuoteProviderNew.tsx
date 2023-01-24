import React, { useEffect, useMemo } from 'react';
import { CircularProgress, Typography } from '@mui/material';
import { useFormikContext } from 'formik';
import BigNumber from 'bignumber.js';
import { Token, ERC20Token, NativeToken } from '@beanstalk/sdk';
import TokenInputField, { TokenInputProps } from '~/components/Common/Form/TokenInputField';
import TokenAdornment, { TokenAdornmentProps } from '~/components/Common/Form/TokenAdornment';
import useQuoteAdvanced, { QuoteHandlerAdvanced } from '~/hooks/ledger/useQuoteAdvanced';
import { displayFullBN } from '~/util/Tokens';
import { FormState, FormTokenStateNew } from '.';
import Row from '~/components/Common/Row';

import { FC } from '~/types';
import useSdk from '~/hooks/sdk';
import { QuoteSettings } from '~/hooks/ledger/useQuote';

type TokenQuoteProviderCustomProps = {
  /** Field name */
  name: string;
  /** The current form state of this token */
  state: FormTokenStateNew;
  /** Token which we're quoting to. Required to display a proper `amountOut` below the input. */
  tokenOut: ERC20Token | NativeToken;
  /** Handler to show token select */
  showTokenSelect?: () => void;
  /** Disable the token selector button inside the input. */
  disableTokenSelect?: boolean;
  /** Text to show isnide the clickable TokenAdornment */
  tokenSelectLabel?: string | JSX.Element;
  /** */
  handleQuote: QuoteHandlerAdvanced;
  /** */
  displayQuote?: false | ((state: BigNumber | undefined, tokenOut: Token) => React.ReactElement | undefined)

  slippage: number;
  /** */
  quoteSettings?: Partial<QuoteSettings>
  /** */
  TokenAdornmentProps?: Partial<TokenAdornmentProps>
};

type TokenQuoteProviderProps = (
  TokenQuoteProviderCustomProps
  & Partial<TokenInputProps>
);

const DefaultQuoteDisplay = (amountOut: BigNumber | undefined, tokenOut: Token) => (
  amountOut ? (
    <Typography variant="body1">
      ≈ {displayFullBN(amountOut, tokenOut.displayDecimals)} {tokenOut.symbol}
    </Typography>
  ) : undefined
);

const TokenQuoteProviderNew : FC<TokenQuoteProviderProps> = ({
  /// Field
  name,
  state,
  balance,
  tokenOut,
  /// Token selection
  showTokenSelect,
  disableTokenSelect,
  tokenSelectLabel,
  /// Quoting
  handleQuote,
  displayQuote: _displayQuote,
  quoteSettings,
  slippage,
  /// Adornment
  // TokenAdornmentProps: _TokenAdornmentProps,
  /// Other props
  ...props
}) => {
  const sdk = useSdk();
  // Setup a price quote for this token
  const [result, quoting, getAmountOut] = useQuoteAdvanced(tokenOut, handleQuote, slippage, quoteSettings);
  const { isSubmitting, setFieldValue } = useFormikContext<FormState>();

  const displayQuote = _displayQuote === undefined ? DefaultQuoteDisplay : _displayQuote;

  // Run getAmountOut when selected token changes.
  // ------------------------------------------
  // NOTE: because the getAmountOut function is debounced,
  // it returns undefined in some cases, so instead we 
  // listen for changes to `amountOut` and `quouting`
  // via effects and update form state accordingly.
  useEffect(() => {
    if (state.token !== tokenOut) {
      console.debug(`[TokenQuoteProvider] Inputs changed. Refreshing amount out: ${state.amount} ${state.token?.symbol} => X ${tokenOut.symbol}`);
      getAmountOut(
        state.token,                      // tokenIn
        new BigNumber(state.amount || 0)  // amountIn
      );
    }
  }, [
    state.token,
    state.amount,
    getAmountOut,
    tokenOut
  ]);

  // Store amountOut and quoting in form state.
  // ------------------------------------------
  // FIXME: Antipattern here? Should we have 
  // a version of `useQuote` that handles this automatically?
  useEffect(() => {
    console.debug(`[TokenQuoteProvider] update ${name}.amountOut =>`, result?.amountOut?.toString());
    setFieldValue(`${name}.amountOut`, result?.amountOut); // calculated amountOut
  }, [name, setFieldValue, result]);
  useEffect(() => {
    console.debug(`[TokenQuoteProvider] update ${name}.quoting =>`, quoting);
    setFieldValue(`${name}.quoting`, quoting);
  }, [name, setFieldValue, quoting]);

  // Memoized token adornment
  const InputProps = useMemo(() => ({
    endAdornment: (
      <TokenAdornment
        token={state.token}
        onClick={showTokenSelect}
        disabled={isSubmitting || disableTokenSelect}
        sx={{ 
          // TEMP:
          // Before Unpause, grey out the token selector
          // if `disableTokenSelect` is provided; also
          // reduce the opacity to make it less obvious.
          opacity: disableTokenSelect ? 0.3 : 1,
        }}
        size={props.size}
        buttonLabel={tokenSelectLabel}
        balanceFrom={props.TokenAdornmentProps?.balanceFrom}
      />
    )
  }), [
    state.token,
    showTokenSelect,
    isSubmitting,
    disableTokenSelect,
    tokenSelectLabel,
    props.size,
    props.TokenAdornmentProps?.balanceFrom
  ]);

  // Render info about the quote beneath the input.
  // ----------------------------------------------
  // use state.amountOut instead of amountOut to hide Quote display
  // when the user switches selected tokens.
  const Quote = useMemo(() => (
    displayQuote ? (
      <Row gap={0.5} sx={{ display: { xs: 'none', md: 'flex' } }}>
        {displayQuote(state.amountOut, tokenOut)}
        {quoting && (
          <CircularProgress variant="indeterminate" size="small" sx={{ width: 14, height: 14 }} />
        )}
      </Row>
    ) : undefined
  ), [displayQuote, state.amountOut, tokenOut, quoting]);

  return (  
    <TokenInputField
      name={`${name}.amount`}
      // MUI
      fullWidth
      InputProps={InputProps}
      {...props}
      // Other
      balance={balance}
      quote={props.quote || Quote}
      token={state.token}
    />
  );
};

export default TokenQuoteProviderNew;
