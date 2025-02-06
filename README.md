```asciiarmor
               ___             _   _
  _  _ ___ ___| _ \___ __ _ __| |_(_)_ _____ 
 | || (_-</ -_)   / -_) _` / _|  _| \ V / -_)
  \_,_/__/\___|_|_\___\__,_\__|\__|_|\_/\___|
```
# useReactive

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

## Live preview

https://stackblitz.com/edit/vitejs-vite-mcpb2gpf?file=src%2FApp.tsx

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

`useReactive<T>(state: T, effect?: (state: T) => (() => void) | void, ...deps: unknown[]): T`

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
- `effect?`: Side effect(s) that can run when a dependency changes. State is supplied as argument to the function.  Must be declared with the `function` keyword. Do not use an arrow function as this will make `this` refer to the global scope. Return a cleanup function if needed.
  - Optionally this can be an array of effect and dependency pairs: [ [`function foo1 {}`, [`dep1`] ], [`function foo2 {}`, [`dep2`] ] ]

- `deps?`: Dependency array to control when the effect re-runs. Defaults to `[]` (run once). Only used when `effect` is a simple function.

#### Returns:

- A state object wrapped by a Proxy that updates the React state reactively when its properties change.

## Examples

```tsx
import React from "react";
import { useReactive } from "./useReactive";

// Example 1: Simple Counter
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

// Example 2: Computed Property
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

// Example 3: Async State Update
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

// Example 4: Nested State
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

// Example 5: Single Effect
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

// Example 6: Multiple Effects
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

// Generic Button Component
interface ControlButtonsProps {
    onIncrement: () => void;
    onDecrement?: () => void;
    incrementLabel: string;
    decrementLabel?: string;
}

const ControlButtons: React.FC<ControlButtonsProps> = ({ onIncrement, onDecrement, incrementLabel, decrementLabel }) => (
  <div>
      <button onClick={onIncrement}>{incrementLabel}</button>
      {onDecrement && <button onClick={onDecrement}>{decrementLabel}</button>}
  </div>
);

// Child component with useReactive using props
interface ReactiveChildProps {
    initialCount: number;
}

const ReactiveChild: React.FC<ReactiveChildProps> = ({ initialCount }) => {
  const state = useReactive(
      { count: initialCount },
      function () {
          console.log("Count changed due to prop update:", this.count);
      },
      ["count"]
  );

  return (
      <div>
            <h3>Reactive Child</h3>
          <p>Count: {state.count}</p>
          <ControlButtons 
              onIncrement={() => state.count++} 
              incrementLabel="Increment" 
          />
      </div>
  );
};

// Example using ReactiveChild to test prop dependency
const EffectDependencyExample = () => {
  const state = useReactive({ count: 0 });
  
  return (
      <div>
            _________________________________
            <h3>Effect Dependency Example</h3>
          <p>Parent Count: {state.count}</p>
          <ControlButtons 
              onIncrement={() => state.count++} 
              incrementLabel="Increment Parent" 
          />
          <ReactiveChild initialCount={state.count} />
      </div>
  );
};

// Super Component to Include All Examples
export const Examples = () => {
    return (
        <div>
            <h2>useReactive Examples</h2>
            <Counter />
            <ComputedPropertyExample />
            <AsyncExample />
            <NestedStateExample />
            <SingleEffectExample />
            <MultipleEffectsExample />
            <EffectDependencyExample />
        </div>
    );
};
```

## Contributions

Are welcome, create a pull request.

Add tests for new functionality.

Debugging tests with breakpoints can be done from Visual Studio Codes JavaScript console with:

`npm test`

or

```bash
npx vitest --inspect --run --no-file-parallelism --testTimeout=3600000 --max-workers=1
```

## License

MIT

