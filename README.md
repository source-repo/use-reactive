```asciiarmor
               ___             _   _
  _  _ ___ ___| _ \___ __ _ __| |_(_)_ _____
 | || (_-</ -_)   / -_) _` / _|  _| \ V / -_)
  \_,_/__/\___|_|_\___\__,_\__|\__|_|\_/\___|
```

# useReactive

`useReactive` is a small React hook for object-shaped reactive state.

```tsx
const state = useReactive({
    count: 0,
    increment() {
        this.count++;
    },
    get double() {
        return this.count * 2;
    },
});

return (
    <>
        <p>{state.count}</p>
        <p>{state.double}</p>
        <button onClick={state.increment}>Increment</button>
    </>
);
```

The point is to keep the user-level API clean: data, behavior and computed values live in one object. The implementation uses Valtio for proxy state and React snapshot tracking.

## Installation

```sh
npm install @diginet/use-reactive
```

## API

```ts
const state = useReactive<T extends object>(initialState: T): T
```

`initialState` is an object with data properties, methods and root-level getters or setters.

- Data properties are copied into an internal reactive store.
- Root-level methods are bound to the returned state object, so `this` is the reactive state.
- Root-level getters run with `this` set to the reactive state and work as computed properties.
- Nested objects and arrays are reactive.
- Passing the same initial object to multiple components shares one store.
- Passing a different object creates an isolated store.
- The input object is not mutated.

Data properties are initial state. If a component rerenders with a different object literal, existing state is preserved. Methods and getters are refreshed on each render, so they can close over current props and local React state.

## Examples

### Counter

```tsx
const Counter = () => {
    const state = useReactive({
        count: 0,
        increment() {
            this.count++;
        },
    });

    return (
        <>
            <p>Count: {state.count}</p>
            <button onClick={state.increment}>Increment</button>
        </>
    );
};
```

### Computed Values

```tsx
const Price = ({ taxRate }: { taxRate: number }) => {
    const state = useReactive({
        net: 100,
        get gross() {
            return this.net * (1 + taxRate);
        },
    });

    return <p>{state.gross}</p>;
};
```

### Arrays And Nested Objects

```tsx
const Todos = () => {
    const state = useReactive({
        todos: ["first"],
        user: { name: "Ada" },
        add(todo: string) {
            this.todos.push(todo);
        },
    });

    return (
        <>
            <p>{state.user.name}</p>
            <button onClick={() => state.add("next")}>Add</button>
        </>
    );
};
```

## Shared Stores

Use `createReactiveStore` when a subtree should share one reactive object.

```tsx
const [StoreProvider, useStore] = createReactiveStore({
    counter: 0,
    user: { name: "John Doe" },
});

const Counter = () => {
    const store = useStore();
    return <button onClick={() => store.counter++}>{store.counter}</button>;
};

const App = () => (
    <StoreProvider>
        <Counter />
    </StoreProvider>
);
```

Only components that read a changed property rerender.

## Removed In Version 7

Version 7 deliberately removes the tuple return value, built-in subscriptions, built-in history and hook-managed effects. Use React's own `useEffect` for effects. If you need history or network-backed observable state, build that as a separate layer around this smaller core.

## License

MIT
