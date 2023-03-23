import { ERC20Token, Token, TokenValue } from "@beanstalk/sdk-core";
import { BigNumber, CallOverrides, ContractTransaction, Overrides } from "ethers";
import { Well__factory } from "src/constants/generated";
import { Well as WellContract } from "src/constants/generated";

import { Aquifer } from "./Aquifer";
import { Pump } from "./Pump";
import { loadToken, setReadOnly, validateAddress, validateAmount, validateToken } from "./utils";
import { WellFunction } from "./WellFunction";
import { WellsSDK } from "./WellsSDK";

export type WellDetails = {
  tokens: ERC20Token[];
  wellFunction: WellFunction;
  pumps: Pump[];
  aquifer: Aquifer;
};

export type CallStruct = {
  target: string;
  data: string;
};

export type TxOverrides = Overrides & { from?: string };

export type PreloadOptions = {
  name?: boolean;
  lpToken?: boolean;
  tokens?: boolean;
  wellFunction?: boolean;
  pumps?: boolean;
  aquifer?: boolean;
  reserves?: boolean;
};

const MAX_UINT256 = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

export class Well {
  public sdk: WellsSDK;
  public address: string;
  public contract: WellContract;

  public name: string | undefined = undefined;
  public lpToken: ERC20Token | undefined = undefined;
  public tokens: ERC20Token[] | undefined = undefined;
  public wellFunction: WellFunction | undefined = undefined;
  public pumps: Pump[] | undefined = undefined;
  public aquifer: Aquifer | undefined = undefined;
  public reserves: TokenValue[] | undefined = undefined;

  constructor(sdk: WellsSDK, address: string) {
    if (!address) {
      throw new Error("Address must be provided");
    }
    setReadOnly(this, "address", address, true);
    setReadOnly(this, "sdk", sdk, false);
    setReadOnly(this, "contract", Well__factory.connect(address, sdk.providerOrSigner), false);
  }

  /**
   * Loads Well data from chain
   *
   * If no options are specified, it will load everything. However, if
   * an options object is passed, it will only load those the data
   * whose options is set to true.
   *
   * loadWell() -- loads everything
   * loadWell({tokens: true}) - only loads tokens
   *
   */
  async loadWell(options?: PreloadOptions): Promise<void> {
    // TODO: use a multicall
    const toLoad = [];

    if (!options) {
      toLoad.push(this.getName(), this.getLPToken(), this.getWell());
    } else {
      if (options.name) toLoad.push(this.getName());
      if (options.lpToken) toLoad.push(this.getLPToken());
      if (options.tokens || options.wellFunction || options.pumps || options.aquifer) toLoad.push(this.getWell());
    }

    await Promise.all(toLoad);

    // We have to do getReserves separately to avoid a race condition
    // with setToken(), where both .getWell() and .getReserves() call setToken()
    // at roughly the same time, causing the writing to .tokens twice, the second time
    // which would fail due to the readonly definition of the prop.
    if (!options || options.reserves) {
      await this.getReserves();
    }
  }

  /**
   * Get this Well's name
   */
  async getName(): Promise<string> {
    if (!this.name) {
      setReadOnly(this, "name", await this.contract.name(), true);
    }

    return this.name!;
  }

  /**
   * Get this Well's LP Token
   */
  async getLPToken(): Promise<ERC20Token> {
    if (!this.lpToken) {
      const token = new ERC20Token(this.sdk.chainId, this.address, undefined, undefined, undefined, this.sdk.providerOrSigner);
      await token.loadFromChain();
      setReadOnly(this, "lpToken", token, true);
    }

    return this.lpToken!;
  }

  /**
   * Get the tradeable tokens paired in this Well
   */
  async getTokens(): Promise<ERC20Token[]> {
    if (!this.tokens) {
      await this.getWell();
    }

    return this.tokens!;
  }

  /**
   * Returns the Well function of this well.
   * **Well functions** define a relationship between the reserves of the
   * tokens in the Well and the number of LP tokens.
   *
   */
  async getWellFunction(): Promise<WellFunction> {
    if (!this.wellFunction) {
      await this.getWell();
    }

    return this.wellFunction!;
  }

  /**
   * Returns the Pumps attached to the Well.
   */
  async getPumps(): Promise<Pump[]> {
    if (!this.pumps) {
      await this.getWell();
    }
    return this.pumps!;
  }

  /**
   * Returns the Aquifer that bored this Well.
   * The Aquifer is a Well factory; it creates Wells based on "templates".
   */
  async getAquifer(): Promise<Aquifer> {
    if (!this.aquifer) {
      await this.getWell();
    }

    return this.aquifer!;
  }

  /**
   * Returns the tokens, Well function, and Pump associated with this Well.
   *
   * This is an aggregate of calling these individual methods:
   * getTokens(), getWellFunction(), getPumps(), getAquifer()
   *
   * Since this is one contract call, the other individual methods also
   * call this under the hood, getting other data cached for "free"
   */
  async getWell(): Promise<WellDetails> {
    const all = this.tokens && this.wellFunction && this.pumps && this.aquifer;

    if (!all) {
      const { _tokens, _wellFunction, _pumps, _aquifer } = await this.contract.well();

      if (!this.tokens) {
        await this.setTokens(_tokens);
      }

      if (!this.wellFunction) {
        this.setWellFunction(_wellFunction);
      }

      if (!this.pumps) {
        this.setPumps(_pumps);
      }

      if (!this.aquifer) {
        this.setAquifer(_aquifer);
      }
    }

    return { tokens: this.tokens!, wellFunction: this.wellFunction!, pumps: this.pumps!, aquifer: this.aquifer! };
  }

  private async setTokens(addresses: string[]) {
    let tokens: ERC20Token[] = [];
    for await (const address of addresses) {
      tokens.push(await loadToken(this.sdk, address));
    }
    Object.freeze(tokens);
    setReadOnly(this, "tokens", tokens, true);
  }

  private setWellFunction({ target, data }: CallStruct) {
    setReadOnly(this, "wellFunction", new WellFunction(target, data), true);
  }

  private setPumps(pumpData: CallStruct[]) {
    let pumps = (pumpData ?? []).map((p) => new Pump(p.target, p.data));
    Object.freeze(pumps);
    setReadOnly(this, "pumps", pumps, true);
  }

  private setAquifer(address: string) {
    setReadOnly(this, "aquifer", new Aquifer(this.sdk, address), true);
  }

  ////// Swap FROM

  /**
   * Swaps from an exact amount of `fromToken` to a minimum amount of `toToken`.
   * @param fromToken The token to swap from
   * @param toToken The token to swap to
   * @param amountIn The amount of `fromToken` to spend
   * @param minAmountOut The minimum amount of `toToken` to receive
   * @param recipient The address to receive `toToken`
   * @param _deadline The txn deadline
   * Defaults to `MAX_UINT256` (effectively no deadline)
   * @return amountOut The amount of `toToken` received
   */
  async swapFrom(
    fromToken: Token,
    toToken: Token,
    amountIn: TokenValue,
    minAmountOut: TokenValue,
    recipient: string,
    _deadline: number | string,
    overrides?: Overrides
  ): Promise<ContractTransaction> {
    validateToken(fromToken, "fromToken");
    validateToken(toToken, "toToken");
    validateAmount(amountIn, "amountIn");
    validateAmount(minAmountOut, "minAmountOut");
    validateAddress(recipient, "recipient");
    const deadline = _deadline || MAX_UINT256;

    return this.contract.swapFrom(
      fromToken.address,
      toToken.address,
      amountIn.toBigNumber(),
      minAmountOut.toBigNumber(),
      recipient,
      deadline,
      overrides ?? {}
    );
  }

  /**
   * Gets the amount of `toToken` received for swapping an amount of `fromToken`.
   * @param fromToken The token to swap from
   * @param toToken The token to swap to
   * @param amountIn The amount of `fromToken` to spend
   * @return amountOut The amount of `toToken` to receive
   */
  async swapFromQuote(fromToken: Token, toToken: Token, amountIn: TokenValue, overrides?: CallOverrides): Promise<TokenValue> {
    validateToken(fromToken, "fromToken");
    validateToken(toToken, "toToken");
    validateAmount(amountIn, "amountIn");

    const amount = await this.contract.getSwapOut(fromToken.address, toToken.address, amountIn.toBigNumber(), overrides ?? {});

    return toToken.fromBlockchain(amount);
  }

  /**
   * Swaps from an exact amount of `fromToken` to a minimum amount of `toToken` and supports
   * fee on transfer tokens.
   * @param fromToken The token to swap from
   * @param toToken The token to swap to
   * @param amountIn The amount of `fromToken` to spend
   * @param minAmountOut The minimum amount of `toToken` to receive
   * @param recipient The address to receive `toToken`
   * @param _deadline The txn deadline
   * Defaults to `MAX_UINT256` (effectively no deadline).
   * @return amountOut The amount of `toToken` received
   */
  async swapFromFeeOnTransfer(
    fromToken: Token,
    toToken: Token,
    amountIn: TokenValue,
    minAmountOut: TokenValue,
    recipient: string,
    _deadline: number | string,
    overrides?: Overrides
  ): Promise<ContractTransaction> {
    validateToken(fromToken, "fromToken");
    validateToken(toToken, "toToken");
    validateAmount(amountIn, "amountIn");
    validateAmount(minAmountOut, "minAmountOut");
    validateAddress(recipient, "recipient");
    const deadline = _deadline || MAX_UINT256;

    return this.contract.swapFromFeeOnTransfer(
      fromToken.address,
      toToken.address,
      amountIn.toBigNumber(),
      minAmountOut.toBigNumber(),
      recipient,
      deadline,
      overrides ?? {}
    );
  }

  ////// Swap TO

  /**
   * Swaps from a maximum amount of `fromToken` to an exact amount of `toToken`.
   * @param fromToken The token to swap from
   * @param toToken The token to swap to
   * @param maxAmountIn The maximum amount of `fromToken` to spend
   * @param amountOut The amount of `toToken` to receive
   * @param recipient The address to receive `toToken`
   * @param _deadline The txn deadline
   * Defaults to `MAX_UINT256` (effectively no deadline).
   * @return amountIn The amount of `toToken` received
   */
  async swapTo(
    fromToken: Token,
    toToken: Token,
    maxAmountIn: TokenValue,
    amountOut: TokenValue,
    recipient: string,
    _deadline: number | string,
    overrides?: TxOverrides
  ): Promise<ContractTransaction> {
    const from = fromToken.address;
    const to = toToken.address;
    const maxIn = maxAmountIn.toBigNumber();
    const out = amountOut.toBigNumber();
    const deadline = _deadline || MAX_UINT256;

    return this.contract.swapTo(from, to, maxIn, out, recipient, deadline, overrides ?? {});
  }

  /**
   * Gets the amount of `fromToken` needed in order to receive a specific amount of `toToken`
   * @param fromToken The token to swap from
   * @param toToken The token to swap to
   * @param amountOut The amount of `toToken` desired
   * @return amountIn The amount of `fromToken` that must be spent
   */
  async swapToQuote(fromToken: Token, toToken: Token, amountOut: TokenValue, overrides?: CallOverrides): Promise<TokenValue> {
    const from = fromToken.address;
    const to = toToken.address;
    const amount = amountOut.toBigNumber();
    const quote = await this.contract.getSwapIn(from, to, amount, overrides ?? {});

    return fromToken.fromBlockchain(quote);
  }

  ////// Add Liquidity

  /**
   * Adds liquidity to the Well as multiple tokens in any ratio.
   * @param tokenAmountsIn The amount of each token to add; MUST match the indexing of {Well.tokens}
   * @param minLpAmountOut The minimum amount of LP tokens to receive
   * @param recipient The address to receive the LP tokens
   * @param _deadline The txn deadline
   * Defaults to `MAX_UINT256` (effectively no deadline).
   */
  addLiquidity(
    tokenAmountsIn: TokenValue[],
    minLpAmountOut: TokenValue,
    recipient: string,
    _deadline?: number | string,
    overrides?: TxOverrides
  ): Promise<ContractTransaction> {
    const amountsIn = tokenAmountsIn.map((tv) => tv.toBigNumber());
    const minLp = minLpAmountOut.toBigNumber();
    const deadline = _deadline || MAX_UINT256;

    return this.contract.addLiquidity(amountsIn, minLp, recipient, deadline, overrides ?? {});
  }

  /**
   * Gets the amount of LP tokens received from adding liquidity as multiple tokens in any ratio.
   * @param tokenAmountsIn The amount of each token to add; MUST match the indexing of {Well.tokens}
   * @return lpAmountOut The amount of LP tokens to receive
   */
  async addLiquidityQuote(tokenAmountsIn: TokenValue[], overrides?: CallOverrides): Promise<TokenValue> {
    await this.getLPToken();
    const amountsIn = tokenAmountsIn.map((tv) => tv.toBigNumber());
    const result = await this.contract.getAddLiquidityOut(amountsIn, overrides ?? {});

    return this.lpToken!.fromBlockchain(result);
  }

  /**
   * Adds liquidity to the Well as multiple tokens in any ratio and supports
   * fee on transfer tokens.
   * @param tokenAmountsIn The amount of each token to add; MUST match the indexing of {Well.tokens}
   * @param minLpAmountOut The minimum amount of LP tokens to receive
   * @param recipient The address to receive the LP tokens
   * @param _deadline The txn deadline
   * Defaults to `MAX_UINT256` (effectively no deadline).
   */
  addLiquidityFeeOnTransfer(
    tokenAmountsIn: TokenValue[],
    minLpAmountOut: TokenValue,
    recipient: string,
    _deadline: number | string,
    overrides?: TxOverrides
  ): Promise<ContractTransaction> {
    const amountsIn = tokenAmountsIn.map((tv) => tv.toBigNumber());
    const minLp = minLpAmountOut.toBigNumber();
    const deadline = _deadline || MAX_UINT256;

    return this.contract.addLiquidityFeeOnTransfer(amountsIn, minLp, recipient, deadline, overrides ?? {});
  }

  ////// Remove Liquidity

  /**
   * Removes liquidity from the Well as all underlying tokens in a balanced ratio.
   * @param lpAmountIn The amount of LP tokens to burn
   * @param minTokenAmountsOut The minimum amount of each underlying token to receive; MUST match the indexing of {Well.tokens}
   * @param recipient The address to receive the underlying tokens
   * @param _deadline The txn deadline
   * Defaults to `MAX_UINT256` (effectively no deadline).
   * @return tokenAmountsOut The amount of each underlying token received
   */
  async removeLiquidity(
    lpAmountIn: TokenValue,
    minTokenAmountsOut: TokenValue[],
    recipient: string,
    _deadline: number | string,
    overrides?: CallOverrides
  ): Promise<ContractTransaction> {
    const lpAmount = lpAmountIn.toBigNumber();
    const minOutAmounts = minTokenAmountsOut.map((a) => a.toBigNumber());
    const deadline = _deadline || MAX_UINT256;

    return this.contract.removeLiquidity(lpAmount, minOutAmounts, recipient, deadline, overrides ?? {});
  }

  /**
   * Gets the amount of each underlying token received from removing liquidity in a balanced ratio.
   * @param lpAmountIn The amount of LP tokens to burn
   * @return tokenAmountsOut The amount of each underlying token to receive
   */
  async removeLiquidityQuote(lpAmountIn: TokenValue, overrides?: CallOverrides): Promise<TokenValue[]> {
    const tokens = await this.getTokens();
    const res = await this.contract.getRemoveLiquidityOut(lpAmountIn.toBigNumber(), overrides ?? {});
    const quote = res.map((value: BigNumber, i: number) => tokens[i].fromBlockchain(value));

    return quote;
  }

  /**
   * Removes liquidity from the Well as a single underlying token.
   * @param lpAmountIn The amount of LP tokens to burn
   * @param tokenOut The underlying token to receive
   * @param minTokenAmountOut The minimum amount of `tokenOut` to receive
   * @param recipient The address to receive the underlying tokens
   * @param _deadline The txn deadline
   * Defaults to `MAX_UINT256` (effectively no deadline).
   * @return tokenAmountOut The amount of `tokenOut` received
   */
  async removeLiquidityOneToken(
    lpAmountIn: TokenValue,
    tokenOut: Token,
    minTokenAmountOut: TokenValue,
    recipient: string,
    _deadline: number | string,
    overrides?: TxOverrides
  ): Promise<ContractTransaction> {
    const amountIn = lpAmountIn.toBigNumber();
    const token = tokenOut.address;
    const minOut = minTokenAmountOut.toBigNumber();
    const deadline = _deadline || MAX_UINT256;

    return this.contract.removeLiquidityOneToken(amountIn, token, minOut, recipient, deadline, overrides ?? {});
  }

  /**
   * Gets the amount received from removing liquidity from the Well as a single underlying token.
   * @param lpAmountIn The amount of LP tokens to burn
   * @param tokenOut The underlying token to receive
   * @return tokenAmountOut The amount of `tokenOut` to receive
   *
   */
  async removeLiquidityOneTokenQuote(lpAmountIn: TokenValue, tokenOut: Token, overrides?: CallOverrides): Promise<TokenValue> {
    const amountIn = lpAmountIn.toBigNumber();
    const address = tokenOut.address;

    const quote = await this.contract.getRemoveLiquidityOneTokenOut(amountIn, address, overrides ?? {});
    return tokenOut.fromBlockchain(quote);
  }

  /**
   * Removes liquidity from the Well as multiple underlying tokens in any ratio.
   * @param maxLpAmountIn The maximum amount of LP tokens to burn
   * @param tokenAmountsOut The amount of each underlying token to receive; MUST match the indexing of {Well.tokens}
   * @param recipient The address to receive the underlying tokens
   * @param _deadline The txn deadline
   * Defaults to `MAX_UINT256` (effectively no deadline).
   * @return lpAmountIn The amount of LP tokens burned
   */
  async removeLiquidityImbalanced(
    maxLpAmountIn: TokenValue,
    tokenAmountsOut: TokenValue[],
    recipient: string,
    _deadline: number | string,
    overrides?: TxOverrides
  ): Promise<ContractTransaction> {
    const maxIn = maxLpAmountIn.toBigNumber();
    const amounts = tokenAmountsOut.map((tv) => tv.toBigNumber());
    const deadline = _deadline || MAX_UINT256;

    return this.contract.removeLiquidityImbalanced(maxIn, amounts, recipient, deadline, overrides ?? {});
  }

  /**
   * Gets the amount of LP tokens to burn from removing liquidity as multiple underlying tokens in any ratio.
   * @param tokenAmountsOut The amount of each underlying token to receive; MUST match the indexing of {Well.tokens}
   * @return lpAmountIn The amount of LP tokens to burn
   */
  async removeLiquidityImbalancedQuote(tokenAmounts: TokenValue[], overrides?: CallOverrides): Promise<TokenValue> {
    const amounts = tokenAmounts.map((tv) => tv.toBigNumber());
    const quote = await this.contract.getRemoveLiquidityImbalancedIn(amounts, overrides ?? {});
    const lpToken = await this.getLPToken();

    return lpToken.fromBlockchain(quote);
  }

  ////// Other

  /**
   * Syncs the reserves of the Well with the Well's balances of underlying tokens.
   */
  async sync(overrides?: CallOverrides): Promise<ContractTransaction> {
    return this.contract.sync(overrides ?? {});
  }

  /**
   * Sends excess ERC-20 tokens held by the Well to the `recipient`.
   * @param recipient The address to send the tokens
   * @return skimAmounts The amount of each token skimmed
   */
  async skim(address: string, overrides?: TxOverrides): Promise<ContractTransaction> {
    return this.contract.skim(address, overrides ?? {});
  }

  /**
   * Shifts excess tokens held by the Well into `toToken` and delivers to `recipient`.
   * @param toToken The token to shift into
   * @param minAmountOut The minimum amount of `toToken` to receive
   * @param recipient The address to receive the token
   * @return amountOut The amount of `toToken` received
   */
  async shift(toToken: Token, minAmountOut: TokenValue, recipient: string, overrides?: CallOverrides): Promise<ContractTransaction> {
    validateToken(toToken, "toToken");
    validateAmount(minAmountOut, "minAmountOut");
    validateAddress(recipient, "recipient");

    return this.contract.shift(toToken.address, minAmountOut.toBigNumber(), recipient, overrides ?? {});
  }

  /**
   * Calculates the amount of the token out received from shifting excess tokens held by the Well.
   * @param tokenOut The token to shift into
   * @return amountOut The amount of `tokenOut` received
   */
  async shiftQuote(toToken: Token): Promise<TokenValue> {
    const amount = await this.contract.getShiftOut(toToken.address);
    return toToken.fromBlockchain(amount);
  }

  /**
   * Gets the reserves of each token held by the Well.
   */
  async getReserves(overrides?: CallOverrides): Promise<TokenValue[]> {
    const tokens = await this.getTokens();
    const res = await this.contract.getReserves(overrides ?? {});
    this.reserves = res.map((value: BigNumber, i: number) => tokens[i].fromBlockchain(value));

    return this.reserves;
  }
}
