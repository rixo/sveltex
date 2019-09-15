(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('svelte'), require('callbag-subject'), require('callbag-subscribe'), require('rxjs'), require('rxjs/operators')) :
  typeof define === 'function' && define.amd ? define(['exports', 'svelte', 'callbag-subject', 'callbag-subscribe', 'rxjs', 'rxjs/operators'], factory) :
  (global = global || self, factory(global.sx = {}, global.svelte, global.makeSubject, global.subscribe, global.rxjs, global.operators));
}(this, function (exports, svelte, makeSubject, subscribe, rxjs, operators) { 'use strict';

  makeSubject = makeSubject && makeSubject.hasOwnProperty('default') ? makeSubject['default'] : makeSubject;
  subscribe = subscribe && subscribe.hasOwnProperty('default') ? subscribe['default'] : subscribe;

  const noop = () => {};

  const identity = x => x;

  const pipe = (...fns) => x => fns.reduce((y, f) => f(y), x);

  const DATA = 1;
  const DONE = 2;

  const makeSubscribable = (_, subject) => {
    const { next } = _;

    let memo = [];

    _.next = value => {
      if (memo) {
        memo.push(value);
      } else {
        next(value);
      }
    };

    const $ = (t, d) => {
      if (t === 0) {
        // subscribe
        subject(0, d);
        if (memo) {
          // flush
          memo.forEach(next);
          // become hot
          memo = null;
          _.next = next;
          $.subscribe = observer => subscribe(observer)(subject);
        }
      }
    };

    $.subscribe = observer => subscribe(observer)($);

    return $
  };

  // 1. remember everything that is written until the first reader
  // 2. flush everything to first reader
  // 3. becomes & stay hot
  const createPort = () => {
    const subject = makeSubject();

    const next = value => {
      subject(DATA, value);
    };

    const error = error => subject(DONE, error);

    const complete = () => subject(DONE);

    const _ = { next, error, dispose: complete };
    const $ = makeSubscribable(_, subject);

    const port = [_, $];
    port._ = _;
    port.$ = $;

    return port
  };

  // eslint-disable-next-line no-console
  const consoleWarn = (...args) => console.warn(...args);

  // const callbagWriteAdapter = _ => inputCallbag => subscribe(_)(inputCallbag)
  const callbagWriteAdapter = _ => inputCallbag => _.next(inputCallbag);

  const defaultWrapConnection = (_, $) => ({ $, _ });

  const makeCyclotron = (env = {}, config = {}) => {
    const { onDestroy, warn = consoleWarn } = env;
    const {
      writeAdapter = callbagWriteAdapter,
      readAdapter = null,
      wrapConnection: customWrapConnection = defaultWrapConnection,
    } = config;

    let currentOnDispose = onDestroy;

    const wrapConnection = (service, write) =>
      customWrapConnection(write, service.$);

    const onDisposal = callback => {
      if (!currentOnDispose) {
        throw new Error('Illegal state')
      }
      currentOnDispose(callback);
    };

    const createPort$1 = readAdapter
      ? pipe(
          createPort,
          port => {
            port[1] = port.$ = readAdapter(port.$);
            return port
          }
        )
      : createPort;

    const init = (handler, [_, sink$] = []) => {
      const previousOnDispose = currentOnDispose;

      let disposeListeners = [];

      const dispose = () => {
        const disposed = !disposeListeners;
        if (disposed) return
        if (_) {
          _.dispose(); // top down cleanup
        }
        disposeListeners.forEach(listener => listener());
        disposeListeners = null;
      };

      // used by contexter to prune disposed services
      const onDispose = listener => {
        const disposed = !disposeListeners;
        if (disposed) {
          warn('trying to add a listener to a disposed cyclotron');
          return
        }
        disposeListeners.push(listener);
      };

      currentOnDispose = onDispose;
      const $ = handler(sink$);
      currentOnDispose = previousOnDispose;

      return {
        _,
        $,
        dispose,
        onDispose,
      }
    };

    const initService = handler => {
      // spec: returns a passthrough cyclotron when called with no handler
      if (!handler) {
        const port = createPort$1();
        return init(() => port.$, port)
      }
      // spec: returns a read-only cyclotron when called with a zero-length handler
      const readOnly = handler.length === 0;
      if (readOnly) {
        return init(handler)
      }
      // writable (readable or not)
      {
        const port = createPort$1();
        return init(handler, port)
      }
    };

    const makeWrite = _ => {
      let doWrite;
      const write = input => {
        if (!doWrite) {
          doWrite = writeAdapter(_);
        }
        const dispose = doWrite(input);
        if (dispose) {
          onDisposal(dispose);
          return dispose
        } else {
          return noop
        }
      };
      return write
    };

    const makeConnectable = service => {
      const readOnly = !service._;
      if (readOnly) {
        // for read only services, one single connection can be shared because
        // the entirety of the cleanup logic takes place at the out stream level,
        // that is entirely out of the cyclotron's control / concern
        const connection = wrapConnection(service);
        service.connect = () => connection;
      } else {
        const write = makeWrite(service._);
        service.connect = () => wrapConnection(service, write);
      }
      return service
    };

    const create = pipe(
      initService,
      makeConnectable
    );

    return create
  };

  const runtimeKey = { id: 'sveltex.connect.runtime' };

  const makeConnector = env => {
    const { getContext, setContext } = env;

    const getRuntime = () => {
      const runtime = getContext(runtimeKey);
      if (!runtime) {
        throw new Error(
          'You must call bootstrap from a root component before calling connect'
        )
      }
      return runtime
    };

    const setRuntime = runtime => setContext(runtimeKey, runtime);

    const proxyConnect = (...args) => {
      const { connect } = getRuntime();
      return connect(...args)
    };

    // TODO test env only
    const proxyResolve = x => getRuntime().resolve(x);

    const makeConnect = ({ contextKey = identity }, { Cyclotron, cache }) => {
      const resolve = (handler, existingOnly = false) => {
        const key = contextKey(handler);
        const existing = getContext(key);
        if (existing) {
          return existing
        } else if (existingOnly) {
          return undefined
        } else {
          const cyclo = Cyclotron(handler);
          setContext(key, cyclo);
          cache.add(cyclo);
          cyclo.onDispose(() => {
            setContext(key, null);
            cache.delete(cyclo);
          });
          return cyclo
        }
      };

      const connect = handler => resolve(handler).connect();

      return { connect, resolve }
    };

    const bootstrap = (config = {}) => {
      const Cyclotron = makeCyclotron(env, config);
      const cache = new Set();
      const { connect, resolve } = makeConnect(config, { Cyclotron, cache });
      setRuntime({ config, connect, resolve, cache });
      // dispose
      const dispose = () => {
        const cache = getRuntime().cache;
        cache.forEach(cyclo => {
          cyclo.dispose();
        });
        cache.clear();
      };
      return dispose
    };

    // TODO test env only
    bootstrap.debugConfig = () => getRuntime();

    return {
      bootstrap,
      connect: proxyConnect,
      resolve: proxyResolve,
    }
  };

  const DEFAULT = {};

  const decorate = (target, set) => {
    // enables `<input bind:this={div$._} />`
    Object.defineProperty(target, '_', { set });

    // enables: <input bind:value={$value$} />
    target.set = set;

    // enables: <div use:div$ />
    target.call = (_, node, config = DEFAULT) => {
      if (config !== DEFAULT) {
        set({
          node,
          config,
        });
      } else {
        set(node);
      }
    };

    const pipeTarget = target.pipe.bind(target);

    // enables: binder().pipe(...)
    target.pipe = (...operators) => {
      const newTarget = pipeTarget(...operators);
      return decorate(newTarget, set)
    };

    return target
  };

  const wrapSource = (source, subject) =>
    source.pipe(operators.multicast(subject)).refCount();

  const binder = source => {
    const subject = new rxjs.Subject();

    const target = source ? wrapSource(source, subject) : subject;

    const set = x => subject.next(x);

    decorate(target, set);

    return target
  };

  const pipeDrivers = ({ $ }, { _, $: out$ }) => {
    _($);
    return out$
  };

  const makeSubscribe = drivers => {
    const length = drivers.length;
    if (length === 1) {
      const [driver] = drivers;
      return observer => connect(driver).subscribe(observer)
    }
    if (length === 0) {
      return rxjs.NEVER
    }
    return observer =>
      drivers
        .map(connect)
        .reduce(pipeDrivers)
        .subscribe(observer)
  };

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
  });

  const { bootstrap, connect } = makeConnector({
    getContext: svelte.getContext,
    setContext: svelte.setContext,
    onDestroy: svelte.onDestroy,
  });

  exports.binder = binder;
  exports.bootstrap = bootstrap;
  exports.connect = connect;
  exports.connectable = connectable;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
