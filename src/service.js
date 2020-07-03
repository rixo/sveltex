const KEY = { context_key: 'sveltex' }

export const createServiceFactory = ({ setContext, getContext }) => {
  let nextId = 0

  const service = (name, provider) => {
    // service(name: string, provider: function)
    // service(provider: function)
    if (typeof name === 'function') {
      provider = name
      name = provider.name
    }

    const subscribe = subscriber => {
      const container = getContext(KEY)

      if (!container) {
        throw new Error(
          'Tried to resolve service outside of a Sveltex container',
        )
      }

      return container.subscribe(handle, provider, subscriber)
    }

    const handle = { name, subscribe }

    return handle
  }

  const sveltex = override => {
    const parent = getContext(KEY)
    const registry = new WeakMap()
    const overrides = override && new WeakMap(override)

    const resolving = (parent && parent.resolving) || new Set()

    const get = handle => registry.get(handle) || (parent && parent.get(handle))

    const getProvider = handle =>
      (overrides && overrides.get(handle)) ||
      (parent && parent.getProvider(handle))

    const subscribe = (handle, baseProvider, subscriber) => {
      const entry = resolve(handle, baseProvider)
      resolving.add(handle)
      const result = entry.store.subscribe(subscriber)
      resolving.delete(handle)
      return result
    }

    const container = { subscribe, resolving, get, getProvider }

    const hasOverride = handle => {
      if (overrides && overrides.has(handle)) return true
      const entry = get(handle)
      if (entry) {
        for (const dep of entry.deps) {
          if (hasOverride(dep))
            return true

        }
      }
      return false
    }

    // get & create
    const pull = (handle, parent) => {
      let entry = registry.get(handle)
      if (!entry) {
        const deps = parent ? new Set(parent.get(handle).deps) : new Set()
        entry = {
          id: nextId++,
          deps,
        }
        registry.set(handle, entry)
      }
      return entry
    }

    const resolve = (handle, baseProvider) => {
      const isLocal = overrides && overrides.has(handle)

      if (parent && !isLocal && !hasOverride(handle)) {
        return parent.resolve(handle, baseProvider)
      }

      const entry = pull(handle, !isLocal && parent)

      if (!entry.store) {
        const provider = getProvider(handle) || baseProvider
        entry.store = provider()
      }

      resolving.forEach(dep => {
        pull(dep).deps.add(handle)
      })

      return entry
    }

    setContext(KEY, Object.assign(container, { resolve, hasOverride }))
  }

  return { service, sveltex }
}
