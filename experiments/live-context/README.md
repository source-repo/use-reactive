# Live Context Experiment

This is a sketch for the wider architecture discussed around `useReactive` and Source RPC.
It is not part of the published package API.

The split is:

- `LiveContext`: logical scoped resolution of live capabilities.
- `Live<T>`: current snapshot plus subscription.
- `commands`: explicit domain operations.
- `state`: optional direct-mutation proxy where writes become operations.
- React adapter: consumes `Live<T>` with `useSyncExternalStore`.
- Source RPC adapter: caches remote snapshots and turns proxy writes into remote mutation operations.

The important distinction is that context is a resolver, not a giant shared object.

```ts
const root = createLiveContext();
const counter = createLocalLive({ count: 0 });

root.provide("workspace.counter", counter);

counter.state.count++;
```

React consumes the same shape:

```tsx
const snapshot = useContextLive<{ count: number }>(context, "workspace.counter");
```

Source RPC can provide the same contract without importing React:

```ts
const counter = createSourceRpcLiveBinding({
    initialSnapshot: { count: 0 },
    commands: {
        increment: rpcCounter.increment,
    },
    subscribeSnapshots: (listener) => rpcCounter.subscribe(listener),
    mutate: (write) => rpcCounter.applyMutation(write),
}, {
    writePolicy: "optimistic",
});
```

Direct mutation is possible:

```ts
counter.state.count++;
```

but the policy is explicit:

- `confirmed`: send the write and wait for a later remote snapshot to update local state.
- `optimistic`: update the local cache immediately and still send the write to the remote owner.

This keeps `remoteState.count++` honest: it is not ordinary memory assignment; it is command
emission through a live proxy with a declared consistency policy.
