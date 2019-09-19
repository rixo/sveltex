import { getContext, setContext, onDestroy } from 'svelte'

import makeConnector from './connect'
import makeAuto from './auto'

export { binder } from './binder'

export const { bootstrap, attach, connect } = makeConnector({
  getContext,
  setContext,
  onDestroy,
})

export const auto = makeAuto({ attach })
