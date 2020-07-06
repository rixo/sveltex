/* eslint-env node */

import { get, derived } from 'svelte/store'
import { test, describe } from './.zorax.js'
// import { service, sveltex, readable, derived } from '../index.js'
import { service, sveltex, readable } from '../index.js'

const { default: App } = require('./App.svelte')
const {
  default: AutosubContainer,
} = require('./service/AutosubContainer.svelte')

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
    const a = service({ strict: true }, () => readable(42))
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

  test('override with get', async t => {
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
          {
            init: () => {
              t.eq(get(ab), 'a b')
            },
            children: [
              // 2.1
              () => {
                sveltex([
                  [a, () => readable('a2.1')],
                  [b, () => readable('b2.1')],
                ])
                t.eq(get(ab), 'a2.1 b2.1')
              },
            ],
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

  const _sub = t => (name, spec, children) => {
    if (typeof spec === 'function') {
      const init = () => t.test(String(name), spec)
      return { init, children }
    }
    if (typeof spec.init === 'function') {
      const fn = spec.init
      spec.init = () => t.test(String(name), fn)
    }
    return spec
  }

  test('override with subscribe', async t => {
    {
      const sub = _sub(t)

      const create_ab = t.spy(() => derived([a, b], vals => vals.join(' ')))

      const a = service('a', () => readable('a'))
      const b = service('b', () => readable('b'))
      const ab = service('ab', create_ab)

      await render({
        init() {
          sveltex()
          create_ab.wasNotCalled()
          t.subscribe(ab, ['a b'])
          create_ab.wasCalled()
        },
        children: [
          // 0
          sub(0, t => {
            t.subscribe(ab, ['a b'])
            create_ab.wasNotCalled()
          }),
          // 1
          sub(
            1,
            t => {
              sveltex([[a, () => readable('a1')]])
              t.subscribe(ab, ['a1 b'])
              create_ab.wasCalled()
            },
            [
              sub(
                1.1,
                t => {
                  sveltex([[b, () => readable('b1.1')]])
                  t.subscribe(ab, ['a1 b1.1'])
                  create_ab.wasCalled()
                },
                [
                  sub('1.1.1', t => {
                    t.subscribe(ab, ['a1 b1.1'])
                    create_ab.wasNotCalled()
                  }),
                ]
              ),
              sub(1.2, t => {
                sveltex([[b, () => readable('b1.2')]])
                t.subscribe(ab, ['a1 b1.2'])
                create_ab.wasCalled()
              }),
            ]
          ),
          // 2
          sub(
            2,
            t => {
              t.subscribe(ab, ['a b'])
              create_ab.wasNotCalled()
            },
            [
              sub(2.1, t => {
                sveltex([
                  [a, () => readable('a2.1')],
                  [b, () => readable('b2.1')],
                ])
                t.subscribe(ab, ['a2.1 b2.1'])
                create_ab.wasCalled()
              }),
            ]
          ),
          // 3
          sub(
            3,
            t => {
              sveltex([[a, () => readable('a3')]])
              t.subscribe(ab, ['a3 b'])
              create_ab.wasCalled()
            },
            [
              sub(
                3.1,
                t => {
                  sveltex([[b, () => readable('b3.1')]])
                  t.subscribe(ab, ['a3 b3.1'])
                  create_ab.wasCalled()
                },
                [
                  sub(
                    '3.1.1',
                    t => {
                      sveltex([[a, () => readable('a3.1.1')]])
                      t.subscribe(ab, ['a3.1.1 b3.1'])
                      create_ab.wasCalled()
                    },
                    [
                      // 3.1.1.1
                      sub('3.1.1.1', t => {
                        sveltex([[b, () => readable('b3.1.1.1')]])
                        t.subscribe(ab, ['a3.1.1 b3.1.1.1'])
                        create_ab.wasCalled()
                      }),
                    ]
                  ),
                ]
              ),
            ]
          ),
        ],
      })
    }
  })

  test('override with subscribe, change deps', async t => {
    {
      const sub = _sub(t)

      const a = service('a', () => readable('a'))
      const b = service('b', () => readable('b'))
      const ab = service('ab', () => derived([a, b], vals => vals.join(' ')))

      const create_ab = t.spy(() => derived(a, a => a + a))

      await render({
        init() {
          sveltex()
          t.subscribe(ab, ['a b'])
        },
        children: [
          // 1
          sub(
            1,
            t => {
              sveltex([
                //
                [a, () => readable('a1')],
                [ab, create_ab],
              ])
              create_ab.wasNotCalled()
              t.subscribe(ab, ['a1a1'])
              create_ab.wasCalled()
            },
            [
              sub(
                1.1,
                t => {
                  sveltex()
                  t.subscribe(ab, ['a1a1'])
                  create_ab.wasNotCalled()
                },
                [
                  sub('1.1.1', t => {
                    t.subscribe(ab, ['a1a1'])
                    create_ab.wasNotCalled()
                  }),
                ]
              ),
              sub(
                1.2,
                t => {
                  sveltex([[b, () => readable('b1.2')]])
                  t.subscribe(ab, ['a1a1'])
                  create_ab.wasNotCalled()
                },
                []
              ),
            ]
          ),
        ],
      })
    }
  })
})

describe('service placeholder', () => {
  test('auto creates container when called in empty context', async t => {
    {
      const foo = service('foo', () => readable('foo'))
      await new Promise(resolve => {
        AutosubContainer.render({
          sveltex,
          service: foo,
          answer: x => {
            t.eq(x, 'foo')
            resolve()
          },
        })
      })
    }
  })

  test('synchronous read is undefined', async t => {
    {
      const foo = service('foo', () => readable('foo'))
      let n = 0
      await new Promise(resolve => {
        AutosubContainer.render({
          sveltex,
          service: foo,
          answerSync: x => {
            n++
            t.eq(x, undefined, 'sync read is undefined')
          },
          answer: x => {
            n++
            t.eq(x, 'foo', 'first async read is defined')
            t.eq(n, 2, 'expects 2 assertions')
            resolve()
          },
        })
      })
    }
  })

  test('reads overridden service', async t => {
    {
      const foo = service('foo', () => readable('foo'))
      await new Promise(resolve => {
        AutosubContainer.render({
          sveltex: () => sveltex([[foo, () => readable('foot')]]),
          service: foo,
          answer: x => {
            t.eq(x, 'foot')
            resolve()
          },
        })
      })
    }
  })
})
