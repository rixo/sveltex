import assert from 'assert'

import flattenName from '@/util/flattenName'

describe('lib/util', () => {
  describe('flattenName', () => {
    it('is a function', () => {
      assert.equal(typeof flattenName, 'function')
    })

    Object.entries({
      _name_: 'name',
      __name__: '_name_',
      __name: '_name',
      _name: 'name',
      name__: 'name_',
      name_: 'name',
    }).forEach(([source, expected]) => {
      it(`${source} => ${expected}`, () => {
        const result = flattenName(source)
        assert.equal(result, expected)
      })
    })
  })
})
