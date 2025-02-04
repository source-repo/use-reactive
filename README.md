# useReactive

## Description

`useReactive` is a custom React hook that provides a reactive state object. It enables fine-grained reactivity similar to Vue's `reactive` function, allowing computed properties (getters) and automatic re-renders when properties change.

## Installation

```sh
npm install @diginet/use-reactive
```

or

```sh
yarn add @diginet/use-reactive
```

## Usage

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
      <p>Double Count: {state.doubleCount}</p>
      <button onClick={state.increment}>Increment</button>
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

