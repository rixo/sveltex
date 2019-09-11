(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('svelte'), require('rxjs'), require('rxjs/operators'), require('..')) :
  typeof define === 'function' && define.amd ? define(['exports', 'svelte', 'rxjs', 'rxjs/operators', '..'], factory) :
  (global = global || self, factory(global.sx = {}, global.svelte, global.rxjs, global.operators, global.__));
}(this, function (exports, svelte, rxjs, operators, __) { 'use strict';

  const isFunction = x => typeof x === 'function';

  const isStream = x => x && isFunction(x.subscribe);

  const loop = () => loop;

  const mergeEntry = (o, [k, v]) => {
    o[k] = v;
    return o
  };

  const fromEntries = entries => entries.reduce(mergeEntry, {});

  const mapEntries = mapper => o =>
    fromEntries(Object.entries(o).map(mapper));

  const flattenRegex = /(?:^_|_$)/g;

  const flattenName = name => name.replace(flattenRegex, '');

  const isReadOnly = factory => factory.length === 0;

  const Cache = env => {
    if (env) {
      return {
        fromCache: env.getContext,
        toCache: env.setContext,
      }
    }
    const cache = new Map();
    return {
      fromCache: cache.get.bind(cache),
      toCache: cache.set.bind(cache),
    }
  };

  // This allows Svelte "store assignment":
  //
  //     const foo = connect(_foo)
  //     foo$ = 42
  //
  //     const bar$ = connect(_bar$$)
  //     bar$ = 54
  //
  const makeAssignable = (set, target = set) =>
    Object.assign(target, {
      set,
      subscribe: loop,
    });

  const wrapConnection = (_ = {}, $ = {}) =>
    Object.assign($, {
      _,
      $,
      // enables: `const [_, $] = connect(_foo$$)`
      [Symbol.iterator]: () => [_, $][Symbol.iterator](),
      // enables: `$foo$ = 42` in svelte
      set: _.set,
      // NOTE subscribe is already present since $ is an actual stream
    });

  // monkey patches a method to run a handler once after its next call
  const afterOnce = (o, method, handler) => {
    const sup = o[method];
    const own = o.hasOwnProperty(method);
    const restore = () => {
      if (own) o[method] = sup;
      else delete o[method];
    };
    o[method] = function(...args) {
      const result = sup.apply(this, args);
      handler(...args);
      restore();
      return result
    };
  };

  const bindSink = (sink, socket) => {
    sink.next = socket.next.bind(socket);
    sink.error = socket.error.bind(socket);
    sink.complete = socket.complete.bind(socket);
    return sink
  };

  // 1. remember everything that is written until the first reader
  // 2. flush everything to first reader
  // 3. becomes & stay hot
  const createSink = () => {
    // input socket
    const socket = new rxjs.Subject();

    let readers = 0;
    const before = socket.pipe(
      operators.shareReplay(),
      operators.takeWhile(() => readers < 1)
    );

    const after = socket.pipe();

    const sink = rxjs.merge(before, after);

    // add input methods to sink
    bindSink(sink, socket);

    // subscribe immediately or writes before first subscriber will be lost
    const sub = sink.subscribe();

    // spec: on first subscriber, replay all previous emissions and become hot
    afterOnce(sink, 'subscribe', () => {
      readers += 1;
      // test seems to indicate it is safe to unsubscribe once we've got our
      // first subscriber
      sub.unsubscribe();
    });

    return sink
  };

  const create = factory => {
    if (isReadOnly(factory)) {
      return { source$: factory() }
    } else {
      const sink = createSink();
      const source$ = factory(sink);
      return { sink, source$ }
    }
  };

  const createConnector = env => {
    const { onDestroy } = env;
    const { fromCache, toCache } = Cache(env);

    const resolveOne = factory => {
      const existing = fromCache(factory);
      if (existing) {
        return existing
      }
      const result = create(factory);
      toCache(factory, result);
      return result
    };

    const createWriter = sink => input => {
      if (!isStream(input)) {
        sink.next(input);
        return
      }
      const sub = input.subscribe({
        next: x => sink.next(x),
        error: err => sink.error(err),
        // not complete: sink is a forever stream
      });
      // unsubscribe
      onDestroy(() => sub.unsubscribe());
    };

    const wrapSink = rxjs.pipe(
      createWriter,
      makeAssignable
    );

    const connectOne = factory => {
      const { source$, sink } = resolveOne(factory);
      // guard: read-only
      if (!sink) return wrapConnection(undefined, source$)
      const _ = wrapSink(sink);
      // guard: write-only
      if (!source$) return wrapConnection(_, _)
      // read/write
      return wrapConnection(_, source$)
    };

    const connectAll = mapEntries(([key, factory]) => [
      flattenName(key),
      connectOne(factory),
    ]);

    const connect = arg => (isFunction(arg) ? connectOne(arg) : connectAll(arg));

    return connect
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
      return observer => __.connect(driver).subscribe(observer)
    }
    if (length === 0) {
      return rxjs.NEVER
    }
    return observer =>
      drivers
        .map(__.connect)
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

  const connect = createConnector({
    getContext: svelte.getContext,
    setContext: svelte.setContext,
    onDestroy: svelte.onDestroy,
  });

  exports.binder = binder;
  exports.connect = connect;
  exports.connectable = connectable;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
