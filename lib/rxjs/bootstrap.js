import { Observable } from 'rxjs'

import { bootstrap as bootstrapCore } from './index'
import { noop } from './util/fp'

// source: https://github.com/staltz/callbag-to-rxjs/blob/master/readme.js
// license: MIT
//
// the original does not work when imported in the REPL
//
const toRx = source =>
  Observable.create(observer => {
    let talkback
    try {
      source(0, (t, d) => {
        if (t === 0) talkback = d
        if (t === 1) observer.next(d)
        if (t === 2 && d) observer.error(d)
        else if (t === 2) {
          talkback = void 0
          observer.complete(d)
        }
      })
    } catch (err) {
      observer.error(err)
    }
    return () => {
      if (talkback) talkback(2)
    }
  })

export const readAdapter = toRx

export const writeAdapter = _ => input$ => _.next(input$)

export const wrapConnection = (_, $) => {
  if (!$) {
    if (!_) {
      return Object.assign([_, $], { _, $ })
    }
    return wrapConnection(_, _)
  }
  return Object.assign($, {
    _,
    $,
    // enables: `const [_, $] = connect(_foo$$)`
    [Symbol.iterator]: () => [_, $][Symbol.iterator](),
    // enables: `$foo$ = 42` in svelte
    set: _ ? _.set : noop,
    // NOTE subscribe is already present since $ is an actual stream
  })
}

export const bootstrap = config =>
  bootstrapCore({
    readAdapter: toRx,
    writeAdapter,
    wrapConnection,
    ...config,
  })
