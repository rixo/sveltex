import { connect } from './index'

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
const auto = handler => ({
  subscribe: observer => connect(handler).subscribe(observer),
})

export default auto
