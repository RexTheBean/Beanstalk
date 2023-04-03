import { Token, TokenValue } from "@beanstalk/sdk";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { multicall } from "@wagmi/core";
import { BigNumber } from "ethers";
import { useCallback, useMemo } from "react";
import { useAccount } from "wagmi";
import { useTokens } from "./TokenProvider";

const TokenBalanceABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function"
  }
] as const;

export const useAllTokensBalance = () => {
  const tokens = useTokens();
  const { address } = useAccount();
  const queryClient = useQueryClient();

  const tokensToLoad = Object.values(tokens);
  if (tokensToLoad.length > 20) throw new Error("Too many tokens to load balances. Fix me");

  const calls = useMemo(() => {
    const contractCalls: any[] = [];
    for (const t of tokensToLoad) {
      contractCalls.push({
        address: t.address as `0x{string}`,
        abi: TokenBalanceABI,
        functionName: "balanceOf",
        args: [address]
      });
    }
    return contractCalls;
  }, [address, tokensToLoad]);

  /**
   * The query here is either [token, balance, all] or [token, balance, {SYMBOL}]
   * depending on weather or not this hooks is called with a specific token.
   * If no token is passed to the hook, that means we want to fetch balance for ALL
   * tokens. When doing so, we will also create a cache for the individual tokens
   * so if later queries for the token happen, they will be retrieved from the cache
   */
  const key = ["token", "balance"];

  const { data, isLoading, error, refetch, isFetching } = useQuery<Record<string, TokenValue>, Error>(
    key,
    async () => {
      console.log(`Query: Get ALL tokens balance`);
      const res = (await multicall({
        contracts: calls,
        allowFailure: true
      })) as unknown as BigNumber[];
      const balances: Record<string, TokenValue> = {};

      for (let i = 0; i < res.length; i++) {
        const value = res[i];
        const token = tokensToLoad[i];
        balances[token.symbol] = token.fromBlockchain(value);

        // set the balance in the query cache too
        queryClient.setQueryData(["token", "balance", token.symbol], { [token.symbol]: balances[token.symbol] });
      }

      return balances;
    },
    {
      staleTime: 1000 * 30,
      refetchInterval: 1000 * 30
    }
  );

  return { data, isLoading, isFetching, error, refetch };
};

export const useTokenBalance = (token: Token) => {
  const { address } = useAccount();
  const queryClient = useQueryClient();

  const key = ["token", "balance", token.symbol];

  const { data, isLoading, error, refetch, isFetching } = useQuery<Record<string, TokenValue>, Error>(
    key,
    async () => {
      console.log(`Query: Get ${token.symbol} balance`);

      let balance: TokenValue;
      if (!address) {
        balance = TokenValue.ZERO;
      } else {
        balance = await token.getBalance(address);
      }

      const result = {
        [token.symbol]: balance
      };

      // Also update the cache of "ALL" token query
      queryClient.setQueryData(["token", "balance"], (oldData: undefined | void | Record<string, TokenValue>) => {
        if (!oldData) return result;

        return { ...oldData, ...result };
      });

      return result;
    },
    {
      staleTime: 1000 * 30,
      refetchInterval: 1000 * 30
    }
  );

  return { data, isLoading, error, refetch, isFetching };
};
