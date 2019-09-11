import { NEVER } from 'rxjs'

import { connect } from '..'

const pipeDrivers = ({ $ }, { _, $: out$ }) => {
  _($)
  return out$
}

const makeSubscribe = drivers => {
  const length = drivers.length
  if (length === 1) {
    const [driver] = drivers
    return observer => connect(driver).subscribe(observer)
  }
  if (length === 0) {
    return NEVER
  }
  return observer =>
    drivers
      .map(connect)
      .reduce(pipeDrivers)
      .subscribe(observer)
}

// connectable turns the provider into an autoconnect stream, to enable:
//
//     const foo_$ = connectable(() => of(
//       () => 'foo',
//       () => 'bar',
//     ))
//
//     $: foo = $foo_$  // STILL REACTIVE!!!!!
//
//     foo() // OK
//
const connectable = (...drivers) => ({
  subscribe: makeSubscribe(drivers),
})

export default connectable
