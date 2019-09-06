import assert from 'assert'

import flattenName from '@/util/flattenName'

describe('lib/fromContext.util', () => {
  describe('flattenName', () => {
    it('is a function', () => {
      assert.equal(typeof flattenName, 'function')
    })

    it('drops $ from "name$$"', () => {
      const result = flattenName('name$$')
      assert.equal(result, 'name$')
    })

    it('drops $ from "name$"', () => {
      const result = flattenName('name$')
      assert.equal(result, 'name')
    })

    it('drops _ from "__name"', () => {
      const result = flattenName('__name')
      assert.equal(result, '_name')
    })

    it('drops _ from "_name"', () => {
      const result = flattenName('_name')
      assert.equal(result, 'name')
    })

    it('drops _ and $ from "_name$$"', () => {
      const result = flattenName('_name$$')
      assert.equal(result, 'name$')
    })

    it('does not change "name"', () => {
      const result = flattenName('name')
      assert.equal(result, 'name')
    })
  })
})
