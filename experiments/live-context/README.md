# Live Context Experiment

This is a sketch for the wider architecture discussed around `useReactive` and Source RPC.
It is not part of the published package API.

The split is:

- `LiveToken<TState, TCommands>`: typed identity for a logical capability. The label is only for diagnostics.
- `LiveContext`: scoped resolution of live capabilities by token identity.
- `Live<T>`: current snapshot plus subscription.
- `commands`: explicit domain operations.
- `state`: optional direct-mutation proxy where writes become operations.
- React adapter: consumes `Live<T>` with `useSyncExternalStore`.
- Source RPC adapter: caches remote snapshots and turns proxy writes into remote mutation operations.

The important distinction is that context is a resolver, not a giant shared object.

## React Example

```tsx
import React from "react";
import {
    createLiveContext,
    createLiveToken,
    createLocalLive,
} from "./core";
import { useContextLive } from "./react";

type CounterState = {
    count: number;
};

type CounterCommands = {
    increment(): void;
};

const CounterToken = createLiveToken<CounterState, CounterCommands>("Counter");

const rootContext = createLiveContext();
const counter = createLocalLive<CounterState, CounterCommands>(
    { count: 0 },
    {
        increment() {
            counter.state.count++;
        },
    }
);

rootContext.provide(CounterToken, counter);

function CounterView() {
    const snapshot = useContextLive(rootContext, CounterToken);
    const binding = rootContext.resolve(CounterToken);

    return (
        <section>
            <p>{snapshot.count}</p>
            <button onClick={binding.commands.increment}>Increment</button>
        </section>
    );
}
```

No string key is involved in resolution. This is type checked:

```ts
const binding = rootContext.resolve(CounterToken);
binding.getSnapshot().count;      // number
binding.commands.increment();     // void
```

Two tokens may share the same label without colliding, because token identity is the `symbol`
inside the token object.

## Source RPC Example

This is the intended adapter shape, not a hard dependency on `@source-repo/rpc`.

```ts
import {
    createLiveContext,
    createLiveToken,
    type LiveWrite,
} from "./core";
import { createSourceRpcLiveBinding } from "./source-rpc";

type CounterState = {
    count: number;
};

type CounterCommands = {
    increment(): Promise<void>;
};

const CounterToken = createLiveToken<CounterState, CounterCommands>("Counter");

// This represents a Source RPC client proxy. Method names are illustrative.
// Source RPC may use its own service lookup identity; LiveContext resolution below uses the token.
const rpcCounter = await rpc.resolve("Counter");

const remoteCounter = createSourceRpcLiveBinding<CounterState, CounterCommands>(
    {
        initialSnapshot: await rpcCounter.getSnapshot(),
        commands: {
            increment: () => rpcCounter.increment(),
        },
        subscribeSnapshots(listener) {
            return rpcCounter.subscribeSnapshots(listener);
        },
        mutate(write: LiveWrite) {
            return rpcCounter.applyMutation(write);
        },
        onError(error, write) {
            console.error("remote write failed", write, error);
        },
    },
    {
        writePolicy: "optimistic",
    }
);

await remoteCounter.connect();

const context = createLiveContext();
context.provide(CounterToken, remoteCounter);
```

The same token resolves the remote binding:

```ts
const counter = context.resolve(CounterToken);

counter.commands.increment(); // explicit RPC command
counter.state.count++;        // proxy write emitted as LiveWrite
```

Direct mutation is possible, but the policy is explicit:

- `confirmed`: send the write and wait for a later remote snapshot to update local state.
- `optimistic`: update the local cache immediately and still send the write to the remote owner.

This keeps `remoteState.count++` honest: it is not ordinary memory assignment; it is command
emission through a live proxy with a declared consistency policy.

## Critical Notes

This experiment deliberately does not hide locality completely. A remote binding can expose
metadata such as `owner` and `location`, and write policy is part of adapter construction.

The currently useful rule of thumb:

- Local live objects may feel like normal direct mutation.
- Remote live objects may use the same mutation syntax, but only with explicit consistency policy.
- When a caller needs completion/failure semantics, add an explicit async boundary such as a command,
  transaction, `flush`, or future `mutate(fn)` helper.
