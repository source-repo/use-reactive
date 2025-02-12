```asciiarmor
               ___             _   _
  _  _ ___ ___| _ \___ __ _ __| |_(_)_ _____ 
 | || (_-</ -_)   / -_) _` / _|  _| \ V / -_)
  \_,_/__/\___|_|_\___\__,_\__|\__|_|\_/\___|
```
# useReactive

`useReactive` is a custom React hook that provides a reactive state object. Methods on the state object use `this` to access members, enabling OOP-style encapsulation of data and behavior. There is also a companion React context for sharing a reactive state within a component hierarchy, see [createReactiveStore](#createReactiveStore) below.

**NOTE:** Upgrade from v1 to v2: useReactive now returns a tuple with the reactive object and a subscribe function. Simply change `const state = useReactive({})` to `const [state] = useReactive({})`, disregarding the new subscribe function. Version 2.1 adds [history](#History).

**NEW:** Version 3.0 now uses a function to return the dependence array for effects. This makes it possible to directly reference properties of the reactive state object using the  `this` keyword.

```tsx
const [state] = useReactive(
  {
    count: 0,
    increment() {
      this.count++;
    },
  },
  function init() {
    console.log('Only runs once!')
  }
);
```

Use directly in markup:


```tsx
<div>
  <p>Count: { state.count }</p>
  <button onClick={ state.increment }>Increment</button>
</div>
```

`useReactive` features:

- Fine-grained reactivity through direct property access. 
- **Intellisense** and **type checking** through generics when using TypeScript 
- Methods on the state object are automatically bound, allowing `this` to be used within them. 
- A function to run once only may be passed as a second argument.
- Supports computed properties (getters). 
- State changes trigger partial React re-render.
- Supports **async** methods.
- Arbitrarily nested state objects
- Add effect handling like `useEffect`, with additional arguments.

## Live preview

https://stackblitz.com/edit/vitejs-vite-mcpb2gpf?file=src%2FApp.tsx

## Contents

  - [Installation](#installation)
  - [Basic usage](#basic-usage)
  - [useReactive API](#usereactive-api)
  - [Examples](#examples)
  - [createReactiveStore](#createreactivestore)
  - [Contributions](#contributions)
  - [License](#license)

## Installation


```sh
npm install @diginet/use-reactive
```

or

```sh
yarn add @diginet/use-reactive
```

## Basic usage

```tsx
import { useReactive } from "@diginet/use-reactive";

function ExampleComponent() {
  const [state] = useReactive({
    count: 0,
    increment() {
      this.count++;
    },
  });

  return <div>
      <p>Count: {state.count}</p>
      <button onClick={state.increment}>Increment</button>
    </div>;
}
```

Note: The function `increment` above can be declared without the `function` keyword using object shorthand syntax.

## useReactive API

###### JavaScript (TL;DR)

`const [state, subscribe, history] = useReactive(state, effect, ...deps)`

- `state`: The state object with properties and methods bound to `this`.
- `init?`: A function to run only once.
- `effect?`: Effect function OR array of function and dependency function pairs (see deps)). State is supplied as argument (also `this`).
- `deps?`: function returning the array of dependencies for a single effect function. Use `this` to reference the reactive object.

###### TypeScript

```typescript
const [state, subscribe, history] = useReactive<T extends object>(
    reactiveState: T,
    init?: (this: T, state: T, subscribe: S<T>) => void,
    effect?: E<T> | Array<[E<T>, (this: T) => unknown[]]>,
    deps?: (this: T) => unknown[]
): [T, S<T>, H<T>]
```

T is the state object, S is a subscribe function and E is an effect function, like React useEffect.

#### Parameters:

- `state`: The state object. Can be of any type.  Functions may be async and the `this` keyword will refer to the state object. Can be declared without the `function` keyword (object shorthand notation). Do not use an arrow function as this will make `this` refer to the global scope.
- `init?`: Function to  runs once only.
- `effect?`: Side effect(s) that can run when a dependency changes. Return a cleanup function if needed.
  - Optionally this can be an array of effect and function returning dependency pairs (see `deps` below): [ [`function foo1 {}`, function () { return [`dep1`] } ], [`function foo2 {}`, function () { return [`dep2`] } ] ]
- `deps?`: Function returning the dependency array to control when the effect re-runs. Defaults to `[]` (run once). Only used when `effect` is a simple function. Use `this` to reference the reactive object.

#### Returns:

- A tuple:
  - `[0]`: The state object wrapped by a Proxy that updates the React state reactively when its properties change.
  - `[1]`: A function for subscribing to property changes. 
    - Arguments:
      - `targets`: A function returning a state property or an array of state properties to subscribe to.
      - `callback`: A callback function `(this: T, key: keyof T, value: unknown, previous: unknown)`
    - Returns an unsubscribe function
  - [2]: A `history` interface with undo, redo, revert any previous change, and rollback to any previous state. See [history](#History) below.


## Examples

  - [Using components props and other data](#using-components-props-and-other-data)
  - [Simple counter](#simple-counter)
  - [Array values](#array-values)
  - [Computed property](#computed-property)
  - [Async state update](#async-state-update)
  - [Nested state](#nested-state)
  - [Single effect](#single-effect)
  - [Multiple effects](#multiple-effects)
  - [Subscribe](#subscribe)

### Using components props and other data

Props passed to a component can be used directly by methods on the `useReactive` object. The object state is retained while methods use the latest values:

```tsx
const Sum = ({ value }: { value: number }) => {
  const [someState, setSomeState] = useState(0)
  const [state] = useReactive({ 
      initial: 100,
      get sum() {
          return this.initial + value + someState;
      }
  });
  return (
      <div>
          <h3>Sum example</h3>
          <p>Sum: { state.sum }</p>
	      <button onClick={() => setSomeState(someState + 2) }>Increase someState</button>
      </div>
  );
};

const TestSum = () => {
  const [state] = useReactive({ value: 0 });
  return <div>
      <Sum value={ state.value } />
      <button onClick={() => state.value++ }>Increment value</button>
  </div>
}
```



### Simple counter

```tsx
const Counter = () => {
    const [state] = useReactive({ count: 0 });

    return (
        <div>
            <h3>Counter</h3>
            <p>Count: {state.count}</p>
            <button onClick={() => state.count++}>Increment</button>
            <button onClick={() => state.count--}>Decrement</button>
        </div>
    );
};
```



### Array values

```tsx
const ArrayExample = () => {
    const [state] = useReactive({ 
        todos: ['hello'],
        addWorld() {
            this.todos = [...this.todos, ' world'];
        },
        addExclamation() {
            this.todos.push('!'); // Also reactive
        }
    });

    return (
        <div>
            _________________________________
            <h3>Array Example</h3>
            <p>todos: {state.todos.map(todo => todo)}</p>
            <button onClick={state.addWorld}>Add world</button>
            <button onClick={state.addExclamation}>Add !</button>
        </div>
    );
};
```



### Computed property

```tsx
const ComputedPropertyExample = () => {
    const [state] = useReactive({
        count: 2,
        get double() {
            return this.count * 2;
        },
    });

    return (
        <div>
            _________________________________
            <h3>Computed Property</h3>
            <p>Count: {state.count}</p>
            <p>Double: {state.double}</p>
            <button onClick={() => state.count++}>Increment</button>
        </div>
    );
};
```


### Async state update

```tsx
const AsyncExample = () => {
    const [state] = useReactive({
        count: 0,
        async incrementAsync() {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            this.count++;
        },
    });

    return (
        <div>
            _________________________________
            <h3>Async Update</h3>
            <p>Count: {state.count}</p>
            <button onClick={() => state.incrementAsync()}>Increment Async</button>
        </div>
    );
};
```


### Nested state

```tsx
const NestedStateExample = () => {
    const [state] = useReactive({
        nested: { value: 10 },
    });

    return (
        <div>
            _________________________________
            <h3>Nested State</h3>
            <p>Nested Value: {state.nested.value}</p>
            <button onClick={() => state.nested.value++}>Increment Nested</button>
        </div>
    );
};
```



### Single effect

```tsx
const SingleEffectExample = () => {
    const [state] = useReactive(
        { count: 0 },
        function () {
            console.log("Count changed:", this.count);
        },
    );

    return (
        <div>
            _________________________________
            <h3>Single Effect</h3>
            <p>Count: {state.count}</p>
            <button onClick={() => state.count++}>Increment</button>
        </div>
    );
};
```



### Multiple effects

```tsx
const MultipleEffectsExample = () => {
    const [state] = useReactive(
        { count: 0, text: "Hello" },
        [
            [function () { console.log("Count changed:", this.count); }, ()=> []],
            [function () { console.log("Text changed:", this.text); }, () => []],
        ]
    );

    return (
        <div>
            _________________________________
            <h3>Multiple Effects</h3>
            <p>Count: {state.count}</p>
            <p>Text: {state.text}</p>
            <button onClick={() => state.count++}>Increment Count</button>
            <button onClick={() => (state.text = "World")}>Change Text</button>
        </div>
    );
};
```



### Subscribe

```tsx
const SubscribedCounter = () => {
    const [state, subscribe] = useReactive({
        count: 0,
    }, 
    function (state, subscribe) {
        subscribe(() => [this.count], (key, value, previous) => {
            console.log(`${key} changed from ${previous} to ${value}`);
        });
    });
    return (
        <div>
            <h3>Subscribed Counter</h3>
            <p>Count: {state.count}</p>
            <button onClick={() => state.count++}>Increment</button>
            <button onClick={() => state.count--}>Decrement</button>
        </div>
    );
};
```



## **History**

The `useReactive` hook provides a built-in **history tracking system** that allows you to `undo`, `revert` and `rollback` state changes efficiently. The current point in the history can be saved as a `snapshot` for later `restore`.

The history interface is returned as the optional third element of the tuple returned by useReactive.

### **Features**

- **Undo** – Revert all or the last state change.
- **Redo** – Reapply the last undone state change or all undone changes.
- **Revert/rollback** – Undo multiple changes.
- **Snapshot/restore** – Save or restore a point in history.

------

### **Usage example**

```tsx
const ExampleComponent = () => {
    const [state, , history] = useReactive({ count: 0 });
    history.enable(true);
    return (
        <div>
            <h2>Count: {state.count}</h2>
            <button onClick={() => state.count++}>Increment</button>
            <button onClick={() => history.undo()}>Undo</button>
            <button onClick={() => history.redo()}>Redo</button>
        </div>
    );
};
```

------

### **History API**

| Function                                     | Description                                                  |
| -------------------------------------------- | ------------------------------------------------------------ |
| enable(enabled?: boolean, maxDepth?: number) | Enable or disable history tracking (unless `enabled` is left out). Returns current state. |
| `undo(index?: number): void`                 | Undo the last change or up to a given index (0 for all).     |
| `redo(all?: boolean): void`                  | Redo the last undo or all of the saved redo stack.           |
| `revert(index: number): void`                | Undo a specific change by index.                             |
| `snapshot(): string | null`                  | Save a point in history. Return value `null` signifies the empty state (all saved changes will removed). |
| `restore(id: string | null): void`           | Restore a saved snapshot.                                    |
| `clear(): void`                              | Clear the history.                                           |



## createReactiveStore

The `createReactiveStore` function provides a globally shared reactive state using React Context and `useReactive`. It allows components to access and modify a reactive state object while ensuring updates trigger re-renders.

### Usage

#### Define a Global Store

Initialize the global store like this:

```
import { createReactiveStore } from "@diginet/useReactive";

const [ ReactiveStoreProvider, useReactiveStore ] = createReactiveStore({
    counter: 0,
    user: { name: "John Doe", age: 30 },
});
```



#### Use the Global State in Components

```
const Counter = () => {
    const store = useReactiveStore();

    return (
        <div>
            <h2>Counter: {store.counter}</h2>
            <button onClick={() => store.counter++}>Increment</button>
            <button onClick={() => store.counter--}>Decrement</button>
        </div>
    );
};

const UserInfo = () => {
    const store = useReactiveStore();

    return (
        <div>
            <h2>User: {store.user.name}, Age: {store.user.age}, Counter: { store.counter }</h2>
            <button onClick={() => store.user.age++}>Increase Age</button>
        </div>
    );
};
```



#### Wrap the Application

Wrap your components with your`ReactiveStoreProvider` to enable global state access:

```
function App() {
    return (
        <ReactiveStoreProvider>
            <div>
                <h2>Global Reactive State Example</h2>
                <Counter />
                <UserInfo />
            </div>
        </ReactiveStoreProvider>
    );
}
```



### Features

**Reactive Global State** - Changes automatically trigger re-renders.

**Lightweight & Simple** - No external state management libraries needed. 

**Flexible** - Can be used in any React project requiring a shared state.

This makes `createReactiveStore` a tool for managing global reactive state in React applications.



## Contributions

Contributions are welcome, create a pull request.

Add tests for new functionality.

Debugging tests with breakpoints can be done from Visual Studio Codes JavaScript console with:

`npm test`

or

```bash
npx vitest --inspect --run --no-file-parallelism --testTimeout=3600000 --max-workers=1
```



## License

MIT

