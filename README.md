```asciiarmor
               ___             _   _
  _  _ ___ ___| _ \___ __ _ __| |_(_)_ _____ 
 | || (_-</ -_)   / -_) _` / _|  _| \ V / -_)
  \_,_/__/\___|_|_\___\__,_\__|\__|_|\_/\___|
```
# useReactive

`useReactive` is a custom React hook that provides a reactive state object. Methods on the state object use `this` to access members, enabling OOP-style encapsulation of data and behavior. There is also a companion React context for sharing a reactive state within a component hierarchy, see [createReactiveStore](#createReactiveStore) below.

```tsx
const state = useReactive({
  count: 0,
  increment() {
    this.count++;
  },
  init() {
    console.log('Only runs once!')
  }
});
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
- A method named `init` on the state object runs only once.
- Supports computed properties (getters). 
- State changes trigger partial React re-render.
- Supports **async** methods.
- Arbitrarily nested state objects
- Add effect handling like `useEffect`, with additional arguments.

## Live preview

https://stackblitz.com/edit/vitejs-vite-mcpb2gpf?file=src%2FApp.tsx

## Contents

  - [Installation](#installation)
  - [Basic Usage](#basic-usage)
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

## Basic Usage

```tsx
import { useReactive } from "@diginet/use-reactive";

function ExampleComponent() {
  const state = useReactive({
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

`useReactive(state, effectOrEffects, ...deps)`

- `state`: The state object with properties and methods bound to `this`.
- `effectOrEffects`: Effect function OR array of function and dependency pairs. State is supplied as argument (also `this`).
- `deps`: Array of dependencies for a single effect function.

###### TypeScript

`useReactive<T>(state: T, effectOrEffects?: EffectFunction<T> | Array<[EffectFunction<T>, unknown[]]>, ...deps: unknown[]): T`

where `type EffectFunction<T> = (this: T, state: T) => void | (() => void);`

#### Parameters:

- `state`: The state object.
  - Properties
    - Simple data types
    - objects
      - Create with useReactive to make child objects reactive, see example below.
    - arrays
      - Reactive by replacing with a new array or using `push`, `pop`, `shift`, `unshift`, `splice`, `sort` and `reverse` in-place array methods
    - [async] `<`method`>`:  Any function. The `this` keyword will refer to the state object. Can be declared without the `function` keyword (object shorthand notation). Do not use an arrow function as this will make `this` refer to the global scope.
    - `init(state)`: Special method that runs once. Do not use an arrow function as this will make `this` refer to the global scope.
- `effectOrEffects?`: Side effect(s) that can run when a dependency changes. State is supplied as argument to the function.  Must be declared with the `function` keyword. Do not use an arrow function as this will make `this` refer to the global scope. Return a cleanup function if needed.
  - Optionally this can be an array of effect and dependency pairs: [ [`function foo1 {}`, [`dep1`] ], [`function foo2 {}`, [`dep2`] ] ]

- `deps?`: Dependency array to control when the effect re-runs. Defaults to `[]` (run once). Only used when `effect` is a simple function.

#### Returns:

- A state object wrapped by a Proxy that updates the React state reactively when its properties change.

## Examples

  - [Using components props and other data](#using-components-props-and-other-data)
  - [Simple counter](#simple-counter)
  - [Array values](#array-values)
  - [Computed property](#computed-property)
  - [Async state update](#async-state-update)
  - [Nested state](#nested-state)
  - [Single effect](#single-effect)
  - [Multiple effects](#multiple-effects)

### Using components props and other data

Props passed to a component can be used directly by methods on the `useReactive` object. The object state is retained while methods use the latest values:

```tsx
const Sum = ({ value }: { value: number }) => {
  const [someState, setSomeState] = useState(0)
  const state = useReactive({ 
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
  const state = useReactive({ value: 0 });
  return <div>
      <Sum value={ state.value } />
      <button onClick={() => state.value++ }>Increment value</button>
  </div>
}
```



### Simple counter

```tsx
const Counter = () => {
    const state = useReactive({ count: 0 });

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
    const state = useReactive({ 
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
    const state = useReactive({
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
    const state = useReactive({
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
    const state = useReactive({
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
    const state = useReactive(
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
    const state = useReactive(
        { count: 0, text: "Hello" },
        [
            [function () { console.log("Count changed:", this.count); }, []],
            [function () { console.log("Text changed:", this.text); }, []],
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



## createReactiveStore

The `createReactiveStore` function provides a globally shared reactive state using React Context and `useReactive`. It allows components to access and modify a reactive state object while ensuring updates trigger re-renders.

### Usage

### 1. Define a Global Store

Create a file `globalState.ts` and initialize the global store:

```
import { createReactiveStore } from "@diginet/useReactive";

export cconst [ ReactiveStoreProvider, useReactiveStore ] = createReactiveStore({
    counter: 0,
    user: { name: "John Doe", age: 30 },
});
```

### 2. Wrap the Application

In `App.tsx`, wrap your components with your`ReactiveStoreProvider` to enable global state access:

```
import React from "react";
import { ReactiveStoreProvider } from "./globalState";
import Counter from "./Counter";
import UserInfo from "./UserInfo";

export function App() {
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

### 3. Use the Global State in Components

#### Counter Component (`Counter.tsx`)

```
import React from "react";
import { useReactiveStore } from "./globalState";

export const Counter = () => {
    const store = useReactiveStore();

    return (
        <div>
            <h2>Counter: {store.counter}</h2>
            <button onClick={() => store.counter++}>Increment</button>
            <button onClick={() => store.counter--}>Decrement</button>
        </div>
    );
};
```

#### User Info Component (`UserInfo.tsx`)

```
import React from "react";
import { useReactiveStore } from "./globalState";

export const UserInfo = () => {
    const store = useReactiveStore();

    return (
        <div>
            <h2>User: {store.user.name}, Age: {store.user.age}, Counter: { store.counter }</h2>
            <button onClick={() => store.user.age++}>Increase Age</button>
        </div>
    );
};
```

### createReactiveStore feature

**Reactive Global State** - Changes automatically trigger re-renders.

**Lightweight & Simple** - No external state management libraries needed. 

**Flexible** - Can be used in any React project requiring a shared state.

This makes `createReactiveStore` a powerful tool for managing global reactive state in React applications.

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

