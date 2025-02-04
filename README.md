# useReactive

## Description

`useReactive` is a custom React hook that provides a reactive state object with methods and getters. It enables fine-grained reactivity with direct proprty access. Methods on the state object are bound allowing `this` to be used within the methods. Computed properties (getters) are also allowed. Changes to the state triggers re-render.

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
    doubleCount: () => state.count * 2,
    increment() {
      state.count++;
    },
  });

  return (
    <div>
      <p>Count: {state.count}</p>
      <p>Double Count: {state.doubleCount()}</p>
      <button onClick={state.increment}>Increment</button>
    </div>
  );
}
```

## Running a function once on creation

Use an `init()` method on the reactive state object:

```tsx
import { useReactive } from "@diginet/use-reactive";

function InitComponent() {
  const state = useReactive({
    count: 0,
    increment() {
      state.count++;
    },
    init() {
      this.count = 123;
      console.log('init called!');
    },
  });

  return (
    <div>
      <p>Count: {state.count}</p>
      <button onClick={state.increment}>Increment</button>
    </div>
  );
}
```

## Advanced Examples

### Using `useReactive` with Objects and Nested Properties

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
      user.age++;
    },
  });

  return (
    <div>
      <p>Name: {user.name}</p>
      <p>Age: {user.age}</p>
      <p>City: {user.address.city}</p>
      <button onClick={user.incrementAge}>Increase Age</button>
    </div>
  );
}
```

### Using `useReactive` with Effects

```tsx
import { useReactive } from "@diginet/use-reactive";
import { useEffect } from "react";

function TimerComponent() {
  const state = useReactive({
    seconds: 0,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      state.seconds++;
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return <p>Elapsed Time: {state.seconds} seconds</p>;
}
```

### Using `useReactive` with Arrays

```tsx
import { useReactive } from "@diginet/use-reactive";

function TodoList() {
  const state = useReactive({
    todos: ["Learn React", "Master TypeScript"],
    addTodo(todo: string) {
      this.todos = [...this.todos, todo]; // ✅ Ensure new array reference for reactivity
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

## API

### `useReactive<T>(initialState: T, effect?: (state: T) => (() => void) | void, ...deps: unknown[]): T`

#### Parameters:
- `initialState`: The initial state object.
- `effect`: (Optional) A function that runs side effects when dependencies change.
- `deps`: (Optional) Dependency array to control when the effect re-runs.

#### Returns:
- A proxy-wrapped state object that updates reactively when its properties change.

## Features
- ✅ Fine-grained reactivity without needing `useState`
- ✅ Supports computed properties (getters)
- ✅ Triggers re-renders when state properties update
- ✅ Supports cleanup functions for side effects
- ✅ Compatible with React's strict mode
- ✅ Supports hot module reloading (HMR)

## License

MIT
