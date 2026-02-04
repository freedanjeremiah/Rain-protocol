/**
 * Rain protocol config. Set NEXT_PUBLIC_RAIN_PACKAGE_ID after deploying contracts.
 */
const PACKAGE_ID = process.env.NEXT_PUBLIC_RAIN_PACKAGE_ID ?? "0x0";

export const RAIN = {
  packageId: PACKAGE_ID,
  custody: {
    module: "custody",
    type: `${PACKAGE_ID}::custody::CustodyVault`,
    createVault: `${PACKAGE_ID}::custody::create_vault`,
    deposit: `${PACKAGE_ID}::custody::deposit`,
  },
} as const;

export function isRainConfigured(): boolean {
  return PACKAGE_ID !== "0x0";
}
