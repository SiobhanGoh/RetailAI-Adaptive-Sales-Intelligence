import { describe, expect, it } from 'vitest'
import { decodeView, encodeView } from '../src/share'

describe('views carried in the link', () => {
  it('round-trips a full view, including awkward characters', () => {
    const v = { sample: 'kedai-amber', module: 'customers', from: 17532, to: 17895, dims: { subcategory: ['Nasi & mee', 'Baby food'], city: ['Kota Bharu'] }, compare: 'lastYear' }
    expect(decodeView('#' + encodeView(v))).toEqual(v)
  })
  it('round-trips values containing the separators themselves', () => {
    const v = { dims: { city: ['A;B', 'C|D', 'E:F'] } }
    expect(decodeView('#' + encodeView(v))?.dims).toEqual(v.dims)
  })
  it('leaves defaults out of the link', () => {
    expect(encodeView({ module: 'overview', compare: 'previous' })).toBe('')
    expect(decodeView('')).toBeNull()
    expect(decodeView('#plainanchor')).toBeNull()
  })
  it('refuses a broken period instead of guessing', () => {
    expect(decodeView('#days=99..1')).toBeNull()
    expect(decodeView('#days=notdays')).toBeNull()
  })
})
