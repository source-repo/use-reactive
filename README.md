```asciiarmor
               ___             _   _
  _  _ ___ ___| _ \___ __ _ __| |_(_)_ _____ 
 | || (_-</ -_)   / -_) _` / _|  _| \ V / -_)
  \_,_/__/\___|_|_\___\__,_\__|\__|_|\_/\___|
```
# useReactive

**NOTE: This is work in progress and there may be minor breaking changes in patch releases!**

`useReactive` is a custom React hook that provides a reactive state object. Methods on the state object use `this` to access members, enabling OOP-style encapsulation of data and behavior.

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
    - [async] `<`method`>`:  Any function. The `this` keyword will refer to the state object. Can be declared without the `function` keyword (object shorthand notation). Do not use an arrow function as this will make `this` refer to the global scope.
    - `init(state)`: Special method that runs once. Do not use an arrow function as this will make `this` refer to the global scope.
- `effect?`: Side effect(s) that can run when a dependency changes. State is supplied as argument to the function.  Must be declared with the `function` keyword. Do not use an arrow function as this will make `this` refer to the global scope.
  - Optionally this can be an array of effect and dependency pairs: [ [`function foo1 {}`, [`dep1`] ], [`function foo2 {}`, [`dep2`] ] ]

- `deps?`: Dependency array to control when the effect re-runs. Defaults to `[]` (run once). Only used when `effect` is a simple function.

#### Returns:

- A proxy-wrapped state object that updates reactively when its properties change.

## Examples

```tsx
import * as React from "react";
import { useReactive } from "./useReactive.js";

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

// Using objects and nested properties

function UserComponent() {
  const user = useReactive({
    name: "John",
    age: 30,
    address: {
      city: "New York",
      country: "USA",
    },
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

// Using effect
// Note: The effect function must be declared with the `function` 
//   keyword (shorthand notation is only allowed in objects). Do not
//   use `arrow` syntax as this will make this refer to the global scope.

function TimerComponent() {
  const state = useReactive(
    {
      seconds: 0,
      called: false,
    },
    function (state) {
      this.called = true;
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

// Using arrays

function TodoList() {
  const state = useReactive({
    todos: ["Learn React", "Master TypeScript"],
    addTodo(todo: string) {
      this.todos = [...this.todos, todo];
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

export function Examples() {
    return <div>
        <h1>Examples</h1>
        <InitComponent />
        <UserComponent />
        <TimerComponent />
        <TodoList />
    </div>;
}
```

## Contributions

Are welcome, create a pull request.

Add tests for new functionality.

Debugging tests with breakpoints can be done from Visual Studio Codes JavaScript console with:

`npm test`

or

```bash
npx vitest --inspect --run --no-file-parallelism --testTimeout=3600000
```

## License

MIT

