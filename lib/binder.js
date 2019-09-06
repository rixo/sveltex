import { Subject } from 'rxjs'
import { multicast } from 'rxjs/operators'

export const Binder = source => {
  const subject = new Subject()

  const set = subject.next.bind(subject)

  const target = source ? source.pipe(multicast(subject)).refCount() : subject

  // enables `<input bind:this={div$._} />`
  Object.defineProperty(target, '_', { set })

  // enables `<input bind:value={$value$} />`
  target.set = set

  // enables `<div use:div$ />`
  target.call = (_, node) => set(node)

  return target
}
