import React from "react";
import { JSDOM } from 'jsdom';
import { useReactive } from './useReactive.js';
import { createReactiveStore } from './useReactiveStore.js';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeAll, beforeEach, vi, test, vitest } from 'vitest';
import { TextEncoder, TextDecoder } from 'util';

globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder as any;

beforeAll(() => {
  const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
    url: "http://localhost"
  });
  globalThis.window = dom.window as unknown as (Window & typeof globalThis);
  globalThis.document = dom.window.document;
  globalThis.navigator = dom.window.navigator;
});

describe('useReactive Hook', () => {
  it('should initialize correctly', () => {
    const { result } = renderHook(() => useReactive({ count: 0 }));
    expect(result.current.count).toBe(0);
  });

  it('should update state correctly', () => {
    const { result } = renderHook(() => useReactive({ count: 0 }));
    act(() => {
      result.current.count++;
    });
    expect(result.current.count).toBe(1);
  });
});

// Test for nested objects
describe('useReactive with Objects', () => {
  it('should allow updating nested properties', () => {
    const { result } = renderHook(() =>
      useReactive({
        user: {
          name: 'John',
          age: 30,
        },
      })
    );

    act(() => {
      result.current.user.age++;
    });
    expect(result.current.user.age).toBe(31);
  });
});

// Test for reactive effects
describe('useReactive with Effects', () => {
  it('should support effects when dependencies change', () => {
    const effectMock = vi.fn();
    const { result, rerender } = renderHook(() =>
      useReactive(
        { count: 0 },
        undefined,
        function (state) {
          effectMock(state.count);
        }
      )
    );

    act(() => {
      result.current.count++;
    });
    rerender();
    expect(effectMock).toHaveBeenCalledWith(1);
  });
});

// Test for reactive arrays
describe('useReactive with Arrays', () => {
  it('should allow modifying an array', () => {
    const { result } = renderHook(() =>
      useReactive({
        todos: ['Learn React'],
        addTodo(todo: string) {
          this.todos = [...this.todos, todo]; // New array reference
        },
        addTodoInPlace(todo: string) {
          this.todos.push(todo); // Mutating array directly
        },
      })
    );

    act(() => {
      result.current.addTodo('Master TypeScript');
    });
    expect(result.current.todos).toEqual(['Learn React', 'Master TypeScript']);
    act(() => {
      result.current.addTodoInPlace('Master Cobol');
    });
    expect(result.current.todos).toEqual(['Learn React', 'Master TypeScript', 'Master Cobol']);
  });
});

// Test for call to init argument
describe('useReactive init function', () => {
  it('should call init function on creation', () => {
    const initMock = vi.fn();
    const { result } = renderHook(() =>
      useReactive({
        count: 0,

      },
        initMock, // Init function
      )
    );

    expect(initMock).toHaveBeenCalled();
  });
});

// Utility function for delaying async operations
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("useReactive Hook", () => {
  test("initial state is reactive and accessible", () => {
    const { result } = renderHook(() => useReactive({ count: 0 }));
    expect(result.current.count).toBe(0);
  });

  test("state updates trigger re-renders", () => {
    const { result, rerender } = renderHook(() => useReactive({ count: 0 }));
    act(() => {
      result.current.count++;
    });
    rerender();
    expect(result.current.count).toBe(1);
  });

  test("methods are bound correctly", () => {
    const { result } = renderHook(() =>
      useReactive({
        count: 0,
        increment() {
          this.count++;
        },
      })
    );
    act(() => {
      result.current.increment();
    });
    expect(result.current.count).toBe(1);
  });

  test("init method runs once", () => {
    const initMock = vitest.fn();
    renderHook(() => useReactive({}, initMock));
    expect(initMock).toHaveBeenCalledTimes(1);
  });

  test("computed properties work correctly", () => {
    const { result } = renderHook(() =>
      useReactive({
        count: 2,
        get double() {
          return this.count * 2;
        },
      })
    );
    expect(result.current.double).toBe(4);
  });

  test("async methods work properly", async () => {
    const { result } = renderHook(() =>
      useReactive({
        count: 0,
        async incrementAsync() {
          await delay(100);
          this.count++;
        },
      })
    );
    await act(async () => {
      await result.current.incrementAsync();
    });
    expect(result.current.count).toBe(1);
  });

  test("nested state objects are reactive", () => {
    const { result } = renderHook(() =>
      useReactive({
        nested: { value: 10 },
      })
    );
    act(() => {
      result.current.nested.value++;
    });
    expect(result.current.nested.value).toBe(11);
  });

  test("effects run when dependencies change", () => {
    const effectMock = vitest.fn();
    const { result, rerender } = renderHook(({ propCount }) =>
      useReactive(
        {
          count: propCount,
          inc() {
            this.count++;
          }
        },
        undefined,
        function (state) {
          console.log('this: ', this);
          const { count } = state;
          console.log(count)
          effectMock(this.count);
        },
        [propCount] // Using component prop as dependency
      ),
      { initialProps: { propCount: 0 } }
    );
    expect(effectMock).toHaveBeenCalledWith(0);
    rerender({ propCount: 1 });
    expect(effectMock).toHaveBeenCalledWith(1);
  });
});

test("multiple effects run when dependencies change", () => {
  const effectMock1 = vitest.fn();
  const effectMock2 = vitest.fn();
  const { result, rerender } = renderHook(({ propCount, anotherProp }) =>
    useReactive(
      {
        count: propCount,
        value: anotherProp,
        count2: 33,
      },
      undefined,
      [
        [
          function () {
            effectMock1(this.count);
          },
          [propCount],
        ],
        [
          function () {
            effectMock2(this.value);
          },
          [anotherProp],
        ],
        [
          function () {
            effectMock1(this.count2);
          },
          [Symbol("count2")],
        ],
      ]
    ),
    { initialProps: { propCount: 0, anotherProp: "a" } }
  );
  expect(effectMock1).toHaveBeenCalledWith(0);
  expect(effectMock2).toHaveBeenCalledWith("a");

  rerender({ propCount: 1, anotherProp: "b" });

  expect(effectMock1).toHaveBeenCalledWith(1);
  expect(effectMock2).toHaveBeenCalledWith("b");

  act(() => {
    result.current.count2++;
  });

  rerender({ propCount: 1, anotherProp: "b" });

  expect(effectMock1).toHaveBeenCalledWith(34);

});

describe("createReactiveStore", () => {
  it("should provide reactive state to components", () => {
    const [Provider, useStore] = createReactiveStore({ counter: 0 });

    const { result } = renderHook(() => useStore(), {
      wrapper: ({ children }) => <Provider>{children}</Provider>,
    });

    expect(result.current.counter).toBe(0);

    act(() => {
      result.current.counter++;
    });

    expect(result.current.counter).toBe(1);
  });

  it("should throw an error when used outside of provider", () => {
    const [, useStore] = createReactiveStore({ counter: 0 });

    expect(() => renderHook(() => useStore())).toThrow(
      "useReactiveStore must be used within a ReactiveStoreProvider"
    );
  });

  it("should support multiple state properties", () => {
    const [Provider, useStore] = createReactiveStore({ counter: 0, user: { name: "John" } });

    const { result } = renderHook(() => useStore(), {
      wrapper: ({ children }) => <Provider>{children}</Provider>,
    });

    expect(result.current.counter).toBe(0);
    expect(result.current.user.name).toBe("John");

    act(() => {
      result.current.counter += 5;
      result.current.user.name = "Doe";
    });

    expect(result.current.counter).toBe(5);
    expect(result.current.user.name).toBe("Doe");
  });

  it("should trigger re-renders when state updates", () => {
    const [Provider, useStore] = createReactiveStore({ count: 0 });

    const { result, rerender } = renderHook(() => useStore(), {
      wrapper: ({ children }) => <Provider>{children}</Provider>,
    });

    act(() => {
      result.current.count++;
    });

    rerender();

    expect(result.current.count).toBe(1);
  });
  it("should trigger a callback when a given property updates", () => {
    const effectMock = vi.fn();
    const { result, rerender } = renderHook(() => useReactive({ count: 0 }));
    act(() => {
      result.current.subscribe(() => [result.current.count], () => effectMock(1));
      result.current.count++;
    });
    expect(result.current.count).toBe(1);
    expect(effectMock).toHaveBeenCalledWith(1);
  });
});