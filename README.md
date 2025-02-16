```asciiarmor
               ___             _   _
  _  _ ___ ___| _ \___ __ _ __| |_(_)_ _____ 
 | || (_-</ -_)   / -_) _` / _|  _| \ V / -_)
  \_,_/__/\___|_|_\___\__,_\__|\__|_|\_/\___|
```
# useReactive

`useReactive` is a custom React hook that provides a reactive state object. 

Methods on this object use `this` to access members, enabling an object-oriented approach to encapsulating data and behavior.

You can `subscribe` to property changes.

State modifications can be saved to a history with support for `undo`, `redo`, `revert` and `snapshot` / `restore`. 

Additionally, a companion React context is available for sharing reactive state across a component hierarchy—see [createReactiveStore](#createReactiveStore) below.

```tsx
const [state] = useReactive(
  { // Reactive state object with methods
      count: 0,
      increment() { 
          this.count++; 
      } 
  },
  { // Options
      init() { console.log('Only runs once!') }
});
```

Use directly in markup:


```tsx
<div>
  <p>Count: { state.count }</p>
  <button onClick={ state.increment }>Increment</button>
</div>
```

## Features

- ⚡ **Fine-grained reactivity** with direct property access.
- 🏗️ **Full TypeScript support** with generics for `IntelliSense` and type checking.
- 🔄 **Auto-bound methods** on the state object, allowing `this` to be used inside them.
- 🎯 **One-time initialization function** can be specified in the options argument.

- 🧮 **Supports computed properties** (via getters).

- ⚡ **Efficient rendering**: State changes trigger only partial React re-renders.
- ⏳ **Supports asynchronous methods** seamlessly.
- 🌳 **Deeply nested reactive objects** are fully supported.
- 🔁  **Effect handling** similar to `useEffect`, configurable via options.
- 📡 **Property-level subscriptions** to react to specific state changes.
- 🕒 **Built-in history management** with undo functionality.

## Live preview

https://stackblitz.com/edit/vitejs-vite-mcpb2gpf?file=src%2FApp.tsx

## Contents

  - [Installation](#installation)
  - [Basic usage](#basic-usage)
  - [useReactive API](#usereactive-api)
  - [Examples](#examples)
  - [Subscribe](#subscribe)
  - [History](#history)
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

Note: The function `increment` above can be declared without the `function` keyword when using object shorthand syntax.

## useReactive API

###### JavaScript (TL;DR)

`const [state, subscribe, history] = useReactive(state, options)`

- `state`: The state object with properties and methods bound to `this`.
- `options?`: An options object: { init,  effects, historySettings }

###### TypeScript

```typescript
const [ state, subscribe, history ] = useReactive<T extends object>( state: T, options?: RO<T> ): [ T, S<T>, H<T> ]
```

T is the state object, S is a subscribe function and E is an effect function, like React useEffect. RO is an `options` object, see below.

#### Parameters:

- `state`: The state object. Can be of any type.  Functions may be async and the `this` keyword will refer to the state object. Can be declared without the `function` keyword (object shorthand notation). Do not use an arrow function as this will make `this` refer to the global scope.
- options?: Optional object with options:
  - `init?`: Function to  runs once only. Arguments:
    - state: The reactive state object. Can also be referenced by `this`  if not using an arrow function.
    - subscribe: The subscribe function.
    - history: The history API
  - `effects?`: Array of side effects that can run when a dependency changes.  Each effect is a pair of:
    - An effect function. Return a cleanup function if needed. Arguments:
      - state: The reactive state object. Can also be referenced by `this`  if not using an arrow function.
      - subscribe: The subscribe function.
      - history: The history API
    - A function returning a dependency array.
  
  - historySettings?: Settings for the `history` function.


#### Returns:

- A tuple:
  - `[0]`: The state object wrapped by a Proxy that updates the React state reactively when its properties change.
  - `[1]`: A function for subscribing to property changes. 
    - Arguments:
      - `targets`: A function returning a state property or an array of state properties to subscribe to.
      - `callback`: A callback function `(this: T, key: keyof T, value: unknown, previous: unknown)`
    - Returns an unsubscribe function
  - [2]: A `history` interface with undo, redo, revert any previous change, and rollback to any previous state. See [history](#History) below.

## Upgrade

Version 2.0: useReactive returns a tuple with the reactive object and a subscribe function. Simply change `const state = useReactive({})` to `const [state] = useReactive({})`, disregarding the new subscribe function. 

Version 2.1 adds [history](#History).

Version 3.0 uses a function to return the dependence array for effects. This makes it possible to directly reference properties of the reactive state object using the  `this` keyword.

Version 4.0: the useReactive function has an [options]() argument instead of individual items. The context is now an object with state, subscribe and history properties.

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
        {
	        effects: [[ 
                function () {
	    	        console.log("Count changed:", this.count);
    	            return () => console.log('bye');
       			},
	            function () {
    	            return [this.count];
        	    }
          	]]
        }
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
        {
        	effects: [
	            [function () { console.log("Count changed:", this.count); }, ()=> [this.count]],
    	        [function () { console.log("Text changed:", this.text); }, () => [this.text]],
        	]
        }
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



## Subscribe

### Features

### Subscribe example

```tsx
const SubscribedCounter = () => {
    const [state, subscribe] = useReactive({
        count: 0,
    },
    {
    	init(state, subscribe) {
	        subscribe(() => [this.count], (key, value, previous) => {
    	        console.log(`${key} changed from ${previous} to ${value}`);
        	});
	    }
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

### **Subscription API**

`subscribe(targets: () => unknown | unknown[], callback: SC<T>, recursive?: boolean) => () => void`

| Argument    | Description                                                  |
| ----------- | ------------------------------------------------------------ |
| `targets`   | A function returning a reference to a property in the reactive object such as `function() { return this.counter; }` or a function returning an array of properties: `function() { return [this.counter1, this.counter2, this.obj]; }`. |
| `callback`  | A callback function with arguments key, value and previous where key is the property name, value is the new property value and previous is the previous property value. |
| `recursive` | For nested object properties, subscribe to all properties when true. Default is false. Use 'deep' to subscribe also to deeply nested object properties. |

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
    const [state, , history] = useReactive(
        { count: 0 },
        { historySettings: { enabled: true } }
    );
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

The `createReactiveStore` function provides a globally shared reactive state using a React context and `useReactive`. It allows components to access and modify a reactive state object while ensuring updates trigger re-renders.

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



#### Use the global store in Components

```
const Counter = () => {
    const store = useReactiveStore();

    return (
        <div>
            <h2>Counter: {store.state.counter}</h2>
            <button onClick={() => store.state.counter++}>Increment</button>
            <button onClick={() => store.state.counter--}>Decrement</button>
        </div>
    );
};

const UserInfo = () => {
    const store = useReactiveStore();

    return (
        <div>
            <h2>User: {store.state.user.name}, Age: {store.state.user.age}, Counter: { store.state.counter }</h2>
            <button onClick={() => store.state.user.age++}>Increase Age</button>
        </div>
    );
};
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

