import { describe, expect, it } from 'vitest'
import { customerStory, forecastTrust, mixStory, salesStory } from '../src/explain'

describe('explanations that follow the numbers', () => {
  it('words a sales change by its size and direction', () => {
    expect(salesStory(0.004, 'previous period').tone).toBe('flat')
    expect(salesStory(0.004, 'previous period').lead.join('')).toBe('Sales held steady, within 0.4% of the previous period.')
    expect(salesStory(0.08, 'previous period').lead[0]).toBe('Sales grew ')
    expect(salesStory(0.41, 'previous period').lead[0]).toBe('Sales jumped ')
    expect(salesStory(-0.06, 'previous period').lead[0]).toBe('Sales slipped ')
    expect(salesStory(-0.34, 'previous period').tone).toBe('sharp-down')
  })

  it('names the cause only when it moved the same way, and suggests a next step', () => {
    const drop = salesStory(-0.34, 'previous period', { key: 'Furniture', delta: -60_000, amount: '−$60K' }, -80_000)
    expect(drop.sub).toBe('Furniture accounts for most of the drop (−$60K). Check stock and pricing there first.')
    expect(drop.next).toContain('pick Furniture')
    expect(salesStory(0.1, 'previous period', { key: 'Toys', delta: -500, amount: '−$500' }, 9000).sub).toBeUndefined()
  })

  it('tells dominant, even and ordinary mixes apart', () => {
    expect(mixStory({ key: 'A', share: 0.55 }, 3)).toBe('dominant')
    expect(mixStory({ key: 'Phones', share: 0.145 }, 17)).toBe('normal')
    expect(mixStory({ key: 'A', share: 0.3 }, 4)).toBe('even')
  })

  it('leads with the customer story that matters most', () => {
    expect(customerStory({ customers: 100, atRiskCustomers: 20, atRiskShare: 0.1, champions: 10 })).toBe('at-risk')
    expect(customerStory({ customers: 100, atRiskCustomers: 5, atRiskShare: 0.05, champions: 10 })).toBe('champions')
    expect(customerStory({ customers: 100, atRiskCustomers: 0, atRiskShare: 0, champions: 0 })).toBe('occasional')
  })

  it('says how far to trust a forecast', () => {
    expect(forecastTrust(0.1)).toContain('fairly reliable')
    expect(forecastTrust(0.25)).toContain('±25%')
    expect(forecastTrust(0.6)).toContain('rough direction')
  })
})
