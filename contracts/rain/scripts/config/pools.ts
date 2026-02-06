/**
 * DeepBook pool configuration for Rain (mainnet).
 * Use with @mysten/deepbook-v3 SDK (getPoolIdByAssets, poolKey, etc.).
 * See deepbookv3/scripts/config/constants.ts for admin/margin caps.
 */

/** Pool key for SUI/USDC (base=SUI, quote=USDC). Used for liquidations: sell SUI collateral for USDC. */
export const SUI_USDC_POOL_KEY = "SUI_USDC";

/**
 * Mainnet DeepBook SUI/USDC pool object ID (shared object).
 * Resolve at runtime via SDK getPoolIdByAssets(baseType, quoteType) when possible.
 * This value is a reference; verify against Sui docs or chain.
 */
export const SUI_USDC_POOL_ID_MAINNET =
  "0xf948981b806057580f91622417534f491da5f61aeaf33d0ed8e69fd5691c95ce";

export const pools = {
  mainnet: {
    suiUsdc: {
      poolKey: SUI_USDC_POOL_KEY,
      poolId: SUI_USDC_POOL_ID_MAINNET,
    },
  },
} as const;
