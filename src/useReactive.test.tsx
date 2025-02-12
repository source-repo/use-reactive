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
    expect(result.current[0].count).toBe(0);
  });

  it('should update state correctly', () => {
    const { result } = renderHook(() => useReactive({ count: 0 }));
    act(() => {
      result.current[0].count++;
    });
    expect(result.current[0].count).toBe(1);
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
      result.current[0].user.age++;
    });
    expect(result.current[0].user.age).toBe(31);
  });
});

// Test for reactive effects
describe('useReactive with Effects', () => {
  it('should support effects when dependencies change', () => {
    const effectMock = vi.fn();
    const { result, rerender } = renderHook(() =>
      useReactive(
        { count: 0 },
        {
          effect(state) {
            effectMock(state.count);
          },
          deps() { return [this.count] }
        }
      )
    );

    act(() => {
      result.current[0].count++;
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
      result.current[0].addTodo('Master TypeScript');
    });
    expect(result.current[0].todos).toEqual(['Learn React', 'Master TypeScript']);
    act(() => {
      result.current[0].addTodoInPlace('Master Cobol');
    });
    expect(result.current[0].todos).toEqual(['Learn React', 'Master TypeScript', 'Master Cobol']);
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
        {
          init: initMock, // Init function
        })
    );

    expect(initMock).toHaveBeenCalled();
  });
});

// Utility function for delaying async operations
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("useReactive Hook", () => {
  test("initial state is reactive and accessible", () => {
    const { result } = renderHook(() => useReactive({ count: 0 }));
    expect(result.current[0].count).toBe(0);
  });

  test("state updates trigger re-renders", () => {
    const { result, rerender } = renderHook(() => useReactive({ count: 0 }));
    act(() => {
      result.current[0].count++;
    });
    rerender();
    expect(result.current[0].count).toBe(1);
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
      result.current[0].increment();
    });
    expect(result.current[0].count).toBe(1);
  });

  test("init method runs once", () => {
    const initMock = vitest.fn();
    renderHook(() => useReactive({}, { init: initMock }));
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
    expect(result.current[0].double).toBe(4);
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
      await result.current[0].incrementAsync();
    });
    expect(result.current[0].count).toBe(1);
  });

  test("nested state objects are reactive", () => {
    const { result } = renderHook(() =>
      useReactive({
        nested: { value: 10 },
      })
    );
    act(() => {
      result.current[0].nested.value++;
    });
    expect(result.current[0].nested.value).toBe(11);
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
        {
          effect(state) {
            console.log('this: ', this);
            const { count } = state;
            console.log(count)
            effectMock(this.count);
          },
          deps: () => [propCount] // Using component prop as dependency
        }),
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
      {
        effect: [
          [
            function () {
              effectMock1(this.count);
            },
            () => [propCount],
          ],
          [
            function () {
              effectMock2(this.value);
            },
            () => [anotherProp],
          ],
          [
            function () {
              effectMock1(this.count2);
            },
            function () { 
              return [this.count2] 
            },
          ],
        ]
      }
    ),
    { initialProps: { propCount: 0, anotherProp: "a" } }
  );
  expect(effectMock1).toHaveBeenCalledWith(0);
  expect(effectMock2).toHaveBeenCalledWith("a");

  rerender({ propCount: 1, anotherProp: "b" });

  expect(effectMock1).toHaveBeenCalledWith(1);
  expect(effectMock2).toHaveBeenCalledWith("b");

  act(() => {
    result.current[0].count2++;
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

    expect(result.current.state.counter).toBe(0);

    act(() => {
      result.current.state.counter++;
    });

    expect(result.current.state.counter).toBe(1);
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

    expect(result.current.state.counter).toBe(0);
    expect(result.current.state.user.name).toBe("John");

    act(() => {
      result.current.state.counter += 5;
      result.current.state.user.name = "Doe";
    });

    expect(result.current.state.counter).toBe(5);
    expect(result.current.state.user.name).toBe("Doe");
  });

  it("should trigger re-renders when state updates", () => {
    const [Provider, useStore] = createReactiveStore({ count: 0 });

    const { result, rerender } = renderHook(() => useStore(), {
      wrapper: ({ children }) => <Provider>{children}</Provider>,
    });

    act(() => {
      result.current.state.count++;
    });

    rerender();

    expect(result.current.state.count).toBe(1);
  });
  it("should trigger a callback when a given property updates", () => {
    const effectMock = vi.fn();
    const { result, rerender } = renderHook(() => useReactive({ count: 0 }));
    act(() => {
      result.current[1](() => [result.current[0].count], () => effectMock(1));
      result.current[0].count++;
    });
    expect(result.current[0].count).toBe(1);
    expect(effectMock).toHaveBeenCalledWith(1);
  });
  it("should trigger a callback from init function when a given property updates", () => {
    const effectMock = vi.fn();
    let unsubscribe: () => void;
    const { result, rerender } = renderHook(() => useReactive(
      {
        count: 0

      },
      {
        init(state, subscribe) {
          unsubscribe = subscribe(() => [this.count], () => effectMock(this.count));
        }
      }
    ));
    act(() => {
      result.current[0].count++;
    });
    expect(result.current[0].count).toBe(1);
    expect(effectMock).toHaveBeenCalledWith(1);
    act(() => {
      unsubscribe();
      result.current[0].count++;
    });
    expect(result.current[0].count).toBe(2);
    expect(effectMock).toHaveBeenCalledWith(1);
  });
});

describe("useReactive - History Functionality", () => {
  it("should initialize state correctly", () => {
    const { result } = renderHook(() => useReactive({ count: 0, message: "Hello" }));

    expect(result.current[0].count).toBe(0);
    expect(result.current[0].message).toBe("Hello");
  });

  it("should update state and track changes when history is enabled", () => {
    const { result } = renderHook(() => useReactive({ count: 0 }, { historySettings: { enabled: true } }));

    act(() => {
      result.current[0].count++;
    });

    expect(result.current[0].count).toBe(1);
    expect(result.current[2].entries.length).toBe(1);
  });

  it("should not track changes when history is disabled", () => {
    const { result } = renderHook(() => useReactive({ count: 0 }));

    act(() => {
      result.current[0].count++;
    });

    expect(result.current[0].count).toBe(1);
    expect(result.current[2].entries.length).toBe(0);
  });

  it("should undo the last change", () => {
    const { result } = renderHook(() => useReactive({ count: 0 }, { historySettings: { enabled: true } }));

    act(() => {
      result.current[0].count++;
      result.current[2].undo();
    });

    expect(result.current[0].count).toBe(0);
    expect(result.current[2].entries.length).toBe(0);
  });

  it("should revert a specific change", () => {
    const { result } = renderHook(() => useReactive({ count: 0 }, { historySettings: { enabled: true } }));

    act(() => {
      result.current[0].count++;
      result.current[0].count++;
      result.current[2].revert(0);
    });

    expect(result.current[0].count).toBe(0);
    expect(result.current[2].entries.length).toBe(1);
  });

  it("should undo to a specific index", () => {
    const { result } = renderHook(() => useReactive({ count: 0, message: "Hello" }, { historySettings: { enabled: true } }));

    act(() => {
      result.current[0].count++;
      result.current[0].message = "Updated";
      result.current[2].undo(0);
    });

    expect(result.current[0].count).toBe(0);
    expect(result.current[0].message).toBe("Hello");
    expect(result.current[2].entries.length).toBe(0);
  });

  it("should restore to a specific snapshot", () => {
    const { result } = renderHook(() => useReactive({ count: 0 }, { historySettings: { enabled: true } }));
    let savedPoint;

    act(() => {
      result.current[0].count++;
      savedPoint = result.current[2].snapshot();
      result.current[0].count++;
      result.current[2].restore(savedPoint);
    });

    expect(result.current[0].count).toBe(1);
    expect(result.current[2].entries.length).toBe(1);
  });
});
