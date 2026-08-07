# CLAUDE.md

This file provides guidance to coding agents working in this repository.

## What this is

`@diginet/use-reactive` is a small React library built around one idea: an object can hold reactive data, methods and computed getters.

Version 7 intentionally keeps the public API narrow:

```ts
const state = useReactive(initialState)
const [Provider, useStore] = createReactiveStore(initialState)
```

The old tuple return, subscriptions, history and options-managed effects were removed. Do not reintroduce those into the core hook. If a feature needs history, network sync or external observation, build it as a separate layer.

## Commands

```sh
npx vitest run                    # run all tests once
npm test                          # vitest in watch mode
npm run build                     # tsc + rollup -> dist/
npm install --package-lock-only   # refresh package-lock.json after metadata/dependency edits
```

`examples-app/` is a separate Vite demo app with its own `package.json`; it symlinks `examples-app/src/symlink` to `src`.

## Architecture

`src/useReactive.ts` owns the hook:

- Valtio provides the underlying proxy store and `useSnapshot` render tracking.
- A WeakMap maps the same input object to the same store, which gives shared state by object identity.
- Data properties are deep-cloned into the store so the input object is not mutated.
- Root-level methods/getters/setters are stored beside the data store and refreshed each render, so closures can see current React props/state.
- The returned state proxy routes render reads through the current snapshot and writes through to the live store.

`src/useReactiveStore.tsx` owns the context helper. The provider only supplies the shared seed object; each consumer calls `useReactive(seed)` so render tracking remains per consumer.

`src/index.ts` should export only library API. Demo components should not be public package exports.

## Conventions

- 4-space indentation in `src/`.
- Keep the API boring and direct. Prefer a separate package or helper over adding optional subsystems to `useReactive`.
- Add tests for user-visible behavior changes.
- Update `README.md` when API or semantics change.
