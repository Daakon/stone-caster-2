// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * [MODULE] TierValueMapper
 * ----------------------------------------------------------------------
 * ROLE: Converts Director's Textual Tiers to Numerical State Deltas
 * RESPONSIBILITY:
 * - Maps Minor/Moderate/Major/Severe to percentage-based deltas
 * - Applies tier multipliers to base resource values
 *
 * CONSTRAINTS:
 * - 100% deterministic (no randomness)
 * - Percentage-based calculations
 */

/**
 * Tier to Percentage Multiplier Mapping
 * As defined in 05_The_Physics_Ladder.md
 */
export const TIER_MULTIPLIERS = {
  Minor: 0.05,      // 5%
  Moderate: 0.15,   // 15%
  Major: 0.30,      // 30%
  Severe: 0.50,     // 50%
} as const;

export type ImpactTier = 'Minor' | 'Moderate' | 'Major' | 'Severe';
export type ImpactTierLow = 'Low' | 'Moderate' | 'High' | 'Severe';

/**
 * [METHOD] calculateTierDelta
 * ----------------------------------------------------------------
 * @logic_flow
 * 1. Get base value from current state
 * 2. Apply tier multiplier
 * 3. Round to integer
 * 4. Return delta value
 */
export function calculateTierDelta(
  baseValue: number,
  tier: ImpactTier | ImpactTierLow
): number {
  // Map "Low" to "Minor" for compatibility
  const normalizedTier = tier === 'Low' ? 'Minor' : tier;
  
  const multiplier = TIER_MULTIPLIERS[normalizedTier as ImpactTier] || TIER_MULTIPLIERS.Moderate;
  const delta = Math.round(baseValue * multiplier);
  
  console.log(`[LOGIC_TRACE] [TierValueMapper] Tier: ${tier}, Base: ${baseValue}, Multiplier: ${multiplier}, Delta: ${delta}`);
  
  return delta;
}

/**
 * [METHOD] upgradeTierOnCritical
 * ----------------------------------------------------------------
 * Upgrades impact tier by one level on critical success
 * @logic_flow
 * Minor -> Moderate -> Major -> Severe (Severe stays Severe)
 */
export function upgradeTierOnCritical(tier: ImpactTier | ImpactTierLow): ImpactTier | ImpactTierLow {
  const tierMap: Record<string, ImpactTier | ImpactTierLow> = {
    'Low': 'Moderate',
    'Minor': 'Moderate',
    'Moderate': 'Major',
    'Major': 'Severe',
    'High': 'Severe',
    'Severe': 'Severe', // Max tier
  };
  
  return tierMap[tier] || 'Moderate';
}
