// Plain-language explanations that change with the result: how big a change is, which way it
// went, what drove it, and how far to trust a figure. Each function returns the words only;
// the screens decide how to show them.

export type Tone = 'flat' | 'up' | 'strong-up' | 'down' | 'sharp-down'

export interface Story {
  /** Words before the highlighted figure, the figure itself, and words after it. */
  lead: [string, string, string]
  tone: Tone
  sub?: string
  next?: string
}

const pct = (v: number, dp = 1) => `${(Math.abs(v) * 100).toFixed(dp)}%`

/** How net sales moved against the comparison window. `share` is the mover's part of the change. */
export function salesStory(change: number, compareLabel: string, mover?: { key: string; delta: number; amount: string }, netDelta?: number): Story {
  const a = Math.abs(change)
  let tone: Tone
  let lead: Story['lead']
  if (a < 0.02) {
    tone = 'flat'
    lead = ['Sales held steady, within ', pct(change), ` of the ${compareLabel}.`]
  } else if (change > 0) {
    tone = change > 0.15 ? 'strong-up' : 'up'
    lead = [change > 0.15 ? 'Sales jumped ' : 'Sales grew ', pct(change), ` on the ${compareLabel}.`]
  } else {
    tone = change < -0.15 ? 'sharp-down' : 'down'
    lead = [change < -0.15 ? 'Sales fell ' : 'Sales slipped ', pct(change), ` against the ${compareLabel}.`]
  }
  let sub: string | undefined
  let next: string | undefined
  const sameWay = mover && Math.sign(mover.delta) === Math.sign(change) && mover.delta !== 0
  if (tone !== 'flat' && sameWay && mover) {
    const most = netDelta ? Math.abs(mover.delta) / Math.max(1, Math.abs(netDelta)) >= 0.5 : false
    sub =
      change > 0
        ? `${mover.key} drove ${most ? 'most of' : 'the biggest part of'} the rise (${mover.amount}).`
        : `${mover.key} accounts for ${most ? 'most of' : 'the biggest part of'} the drop (${mover.amount}).`
    if (tone === 'sharp-down') {
      sub += ' Check stock and pricing there first.'
      next = `Open Sales mix and pick ${mover.key} to see which products fell.`
    } else if (tone === 'strong-up') next = 'Check Forecast to see whether the rise is likely to hold.'
  }
  return { lead, tone, sub, next }
}

/** How concentrated sales are across the groups on screen. */
export function mixStory(lead: { key: string; share: number }, groups: number): 'dominant' | 'even' | 'normal' {
  if (lead.share >= 0.4) return 'dominant'
  if (groups >= 4 && lead.share < (1 / groups) * 1.6) return 'even'
  return 'normal'
}

/** Which customer story to lead with. */
export function customerStory(c: { customers: number; atRiskCustomers: number; atRiskShare: number; champions: number }): 'at-risk' | 'champions' | 'occasional' {
  if (c.atRiskCustomers > 0 && (c.atRiskShare >= 0.15 || c.atRiskCustomers / Math.max(1, c.customers) >= 0.15)) return 'at-risk'
  if (c.champions > 0) return 'champions'
  return 'occasional'
}

/** How far to trust a forecast, from its typical miss on replayed weeks. */
export function forecastTrust(wape: number): string {
  if (wape < 0.15) return 'Weeks here are steady, so this is fairly reliable.'
  if (wape < 0.35) return `Weeks usually land within ±${pct(wape, 0)}, so treat it as a guide.`
  return `Weeks here swing a lot (usually ±${pct(wape, 0)}), so read it as a rough direction only.`
}
