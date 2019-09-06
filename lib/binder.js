import { Subject } from 'rxjs'
import { multicast } from 'rxjs/operators'

export const Binder = source => {
  let subject

  const createSubject = () => (subject = new Subject())

  const wrapSource = () => source.pipe(multicast(createSubject())).refCount()

  const target = source ? wrapSource() : createSubject()

  const set = x => subject.next(x)

  // enables `<input bind:this={div$._} />`
  Object.defineProperty(target, '_', { set })

  // enables `<input bind:value={$value$} />`
  target.set = set

  // enables `<div use:div$ />`
  target.call = (_, node) => set(node)

  return target
}
