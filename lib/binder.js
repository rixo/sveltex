import { Subject } from 'rxjs'
import { multicast } from 'rxjs/operators'

const decorate = (target, set) => {
  // enables `<input bind:this={div$._} />`
  Object.defineProperty(target, '_', { set })

  // enables: <input bind:value={$value$} />
  target.set = set

  // enables: <div use:div$ />
  target.call = (_, node) => set(node)

  const pipeTarget = target.pipe.bind(target)

  // enables: binder().pipe(...)
  target.pipe = (...operators) => {
    const newTarget = pipeTarget(...operators)
    return decorate(newTarget, set)
  }

  return target
}

export const binder = source => {
  let subject

  const createSubject = () => (subject = new Subject())

  const wrapSource = () => source.pipe(multicast(createSubject())).refCount()

  const target = source ? wrapSource() : createSubject()

  const set = x => subject.next(x)

  decorate(target, set)

  return target
}
