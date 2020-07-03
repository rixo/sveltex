import registerSvelte from 'svelte/register'
registerSvelte()

import { onDestroy } from 'svelte'
import { plug } from 'zorax'

export const { test, describe } = plug({
  test(t) {
    t.isStore = (x, _msg) => {
      const msg = [_msg, 'is a store'].filter(Boolean).join(' ')
      t.ok(x, msg)
      t.eq(typeof x.subscribe, 'function', msg)
    }

    t.subscribe = (handle, expected) => {
      const n = expected.length
      const stop = handle.subscribe(function zora_spec_fn(x) {
        if (expected.length === 0) {
          t.fail(`$${handle.name}: unexpected change`)
          return
        }
        const next = expected.shift()
        t.eq(x, next, `$${handle.name}: wrong value`)
      })
      onDestroy(() => {
        if (expected.length > 0) {
          t.fail(`$${handle.name}: expected ${expected.length} more calls`)
        }
        stop()
      })
    }
  },
})
