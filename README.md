```asciiarmor
               ___             _   _
  _  _ ___ ___| _ \___ __ _ __| |_(_)_ _____ 
 | || (_-</ -_)   / -_) _` / _|  _| \ V / -_)
  \_,_/__/\___|_|_\___\__,_\__|\__|_|\_/\___|
```
# useReactive

`useReactive` is a custom React hook that provides a reactive state object with methods that can use `this`, allowing OOP-style encapsulation of data and methods while retaining Reacts functional programming with composition:

Use directly in markup:


```tsx
<div>
	<p>Count: { state.count }</p>
	<button onClick={ state.increment }>Increment</button>
</div>
```

`useReactive` enables fine-grained reactivity with direct property access. 

Methods on the state object are bound allowing `this` to be used within the methods. 

Computed properties (getters) are also allowed. Changes to the state triggers React re-render.

## Features

- Fine-grained reactivity without needing `useState`
- Supports computed properties (getters)
- Triggers re-renders when state properties update
- Supports cleanup functions for side effects
- Uses a Proxy to intercept access to the state object
- Supports hot module reloading (HMR), retaining state while adding or deleting methods on the Proxy object

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

## API

`useReactive<T>(initialState: T, effect?: (state: T) => (() => void) | void, ...deps: unknown[]): T`

#### Parameters:

- `initialState`: The initial state object.
  - Properties
    - Simple data types
    - objects
      - Create with useReactive to make child objects reactive, see example below.

    - arrays
      - Reactive by replacing with a new array or using `push`, `pop`, `shift`, `unshift`, `splice`, `sort` and `reverse` in-place array methods

    - `init`: Special method that runs once

- `effect?`: A function that runs side effects when dependencies change. State is supplied as argument.
- `deps?`: Dependency array to control when the effect re-runs. Defaults to `[]` (run once).

#### Returns:

- A proxy-wrapped state object that updates reactively when its properties change.

## License

MIT

## Examples

### Running a function once on creation

Use an `init()` method on the reactive state object:

```tsx
import { useReactive } from "@diginet/use-reactive";

function InitComponent() {
  const state = useReactive({
    count: 0,
    increment() {
      this.count++;
    },
    init() {
      this.count = 123;
      console.log('init called!');
    },
  });
  return <div>
      <p>Count: {state.count}</p>
      <button onClick={state.increment}>Increment</button>
    </div>;
}
```

### Using objects and nested properties

```tsx
import { useReactive } from "@diginet/use-reactive";

function UserComponent() {
  const user = useReactive({
    name: "John",
    age: 30,
    address: useReactive({
      city: "New York",
      country: "USA",
    }),
    incrementAge() {
      this.age++;
    },
  });
  return <div>
      <p>Name: {user.name}</p>
      <p>Age: {user.age}</p>
      <p>City: {user.address.city}</p>
      <button onClick={user.incrementAge}>Increase Age</button>
      <button onClick={() => { user.address.city = 'Los Angeles' }}>Change city</button>
    </div>;
}
```

### Using effect

```tsx
import { useReactive } from "@diginet/use-reactive";
import { useEffect } from "react";

unction TimerComponent() {
  const state = useReactive(
    {
      seconds: 0,
    },
    (state) => {
      const interval = setInterval(() => {
        state.seconds++;
      }, 1000);
      return () => clearInterval(interval);
    }
  );

  return <>
    <p>Elapsed Time: {state.seconds} seconds</p>
  </>;
}
```

### Using arrays

```tsx
import { useReactive } from "@diginet/use-reactive";

function TodoList() {
  const state = useReactive({
    todos: ["Learn React", "Master TypeScript"],
    addTodo(todo: string) {
      this.todos.push(todo);
    },
  });

  return (
    <div>
      <ul>
        {state.todos.map((todo, index) => (
          <li key={index}>{todo}</li>
        ))}
      </ul>
      <button onClick={() => state.addTodo("Use useReactive!")}>Add Todo</button>
    </div>
  );
}
```

