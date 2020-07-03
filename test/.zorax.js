import registerSvelte from 'svelte/register'
registerSvelte()

import { plug } from 'zorax'

export const { test, describe } = plug({
  test(t) {
    t.isStore = (x, _msg) => {
      const msg = [_msg, 'is a store'].filter(Boolean).join(' ')
      t.ok(x, msg)
      t.eq(typeof x.subscribe, 'function', msg)
    }
  },
})
