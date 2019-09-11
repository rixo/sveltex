import { Subject } from 'rxjs'
import { multicast } from 'rxjs/operators'

const DEFAULT = {}

const decorate = (target, set) => {
  // enables `<input bind:this={div$._} />`
  Object.defineProperty(target, '_', { set })

  // enables: <input bind:value={$value$} />
  target.set = set

  // enables: <div use:div$ />
  target.call = (_, node, config = DEFAULT) => {
    if (config !== DEFAULT) {
      set({
        node,
        config,
      })
    } else {
      set(node)
    }
  }

  const pipeTarget = target.pipe.bind(target)

  // enables: binder().pipe(...)
  target.pipe = (...operators) => {
    const newTarget = pipeTarget(...operators)
    return decorate(newTarget, set)
  }

  return target
}

const wrapSource = (source, subject) =>
  source.pipe(multicast(subject)).refCount()

export const binder = source => {
  const subject = new Subject()

  const target = source ? wrapSource(source, subject) : subject

  const set = x => subject.next(x)

  decorate(target, set)

  return target
}
