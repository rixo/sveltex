const KEY = { context_key: 'sveltex' }

export const createServiceFactory = ({ setContext, getContext }) => {
  const service = (name, provider) => {
    // service(name: string, provider: function)
    // service(provider: function)
    if (typeof name === 'function') {
      provider = name
      name = provider.name
    }

    const subscribe = subscriber => {
      const resolve = getContext(KEY)

      if (!resolve) {
        throw new Error(
          'Tried to resolve service outside of a Sveltex container',
        )
      }

      const entry = resolve(handle, provider)
      const { store } = entry

      entry.resolving(true)

      const result = store.subscribe(subscriber)

      entry.resolving(false)

      return result
    }

    const handle = { name, subscribe }

    return handle
  }

  const sveltex = override => {
    const parentResolve = getContext(KEY)
    const registry = new WeakMap()
    const resolving = new Set()
    const overrides = override && new WeakMap(override)

    const hasOverride = handle => overrides && overrides.has(handle)

    const get = handle => {
      let entry = registry.get(handle)
      if (!entry) {
        const deps = new Set()
        entry = {
          deps,
          resolving: (enter = true) => {
            if (entry.resolved) return
            entry.resolved = true
            resolving[enter ? 'add' : 'delete'](handle)
          },
        }
        registry.set(handle, entry)
      }
      return entry
    }

    const resolve = (handle, baseProvider) => {
      if (parentResolve && !hasOverride(handle)) {
        return parentResolve(handle, baseProvider)
      }

      const entry = get(handle)

      if (!entry.store) {
        const provider = (overrides && overrides.get(handle)) || baseProvider
        entry.store = provider()
      }

      resolving.forEach(dep => {
        const entry = get(dep)
        entry.deps.add(handle)
      })

      return entry
    }

    setContext(KEY, resolve)
  }

  return { service, sveltex }
}
