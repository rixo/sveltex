// TODO remove rxjs dep
import { Observable } from 'rxjs'

// auto turns the provider into an autoconnect stream, to enable:
//
//     const foo$ = auto(() => of(
//       () => 'foo',
//       () => 'bar',
//     ))
//
//     $: foo = $foo$  // STILL REACTIVE!!!!!
//
//     foo() // OK
//

const Callbacker = () => {
  let callback
  const set = cb => {
    if (callback) throw new Error('Only one callback is supported')
    callback = cb
  }
  const fire = () => {
    if (!callback) return
    callback()
  }
  return [set, fire]
}

export const makeAuto = ({ attach }) => handler =>
  new Observable(subscriber => {
    const [onComplete, flushComplete] = Callbacker()
    // don't attach cyclo to a given component
    const connect = attach(onComplete)
    const service = connect(handler)
    // disconnect on unsubcribe
    subscriber.add(flushComplete)
    // subscribe
    return service.subscribe(subscriber)
  })

export default makeAuto
