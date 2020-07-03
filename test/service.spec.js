import { get, derived } from 'svelte/store'
import { test, describe } from './.zorax.js'
// import { service, sveltex, readable, derived } from '../index.js'
import { service, sveltex, readable } from '../index.js'

const { default: App } = require('./App.svelte')

const render = spec => new Promise(resolve => App.render({ spec, resolve }))

describe('service', () => {
  test('is a function', t => {
    t.eq(typeof service, 'function')
  })

  test('returns a store', t => {
    const a = service()
    t.isStore(a)
  })

  test('crashes when called outside of container', async t => {
    const a = service(() => readable(42))
    await render(() => {
      t.throws(() => {
        get(a)
      }, /outside of a Sveltex container/)
    })
  })

  test('resolves when called inside a container', async t => {
    const a = service(() => readable(42))
    await render(() => {
      sveltex()
      t.eq(get(a), 42)
    })
  })

  test('resolves derived services', async t => {
    {
      const a = service(() => readable(42))
      const b = service(() => readable(43))
      const ab = service(() => derived([a, b], ([a$, b$]) => a$ + b$))
      await render(() => {
        sveltex()
        t.eq(get(ab), 42 + 43)
      })
    }
  })

  test('override', async t => {
    {
      const a = service('a', () => readable('a'))
      const b = service('b', () => readable('b'))
      const ab = service('ab', () => derived([a, b], vals => vals.join(' ')))
      await render({
        init() {
          sveltex()
          t.eq(get(ab), 'a b')
        },
        children: [
          // 1
          {
            init() {
              sveltex([[a, () => readable('a1')]])
              t.eq(get(ab), 'a1 b')
            },
            children: [
              // 1.1
              () => {
                sveltex([[b, () => readable('b1.1')]])
                t.eq(get(ab), 'a1 b1.1')
              },
              // 1.2
              () => {
                sveltex([[b, () => readable('b1.2')]])
                t.eq(get(ab), 'a1 b1.2')
              },
            ],
          },
          // 2
          () => {
            t.eq(get(ab), 'a b')
          },
          // 3
          {
            init: () => {
              sveltex([[a, () => readable('a3')]])
              t.eq(get(ab), 'a3 b')
            },
            children: [
              {
                // 3.1
                init: () => {
                  sveltex([[b, () => readable('b3.1')]])
                  t.eq(get(ab), 'a3 b3.1')
                },
                children: [
                  // 3.1.1
                  {
                    init: () => {
                      sveltex([[a, () => readable('a3.1.1')]])
                      t.eq(get(ab), 'a3.1.1 b3.1')
                    },
                    children: [
                      // 3.1.1.1
                      {
                        init: () => {
                          sveltex([[b, () => readable('b3.1.1.1')]])
                          t.eq(get(ab), 'a3.1.1 b3.1.1.1')
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      })
    }
  })
})
