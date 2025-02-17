import React from "react";
import { JSDOM } from 'jsdom';
import { useReactive } from '../src/useReactive.js';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeAll, vi, test, vitest } from 'vitest';
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

// Utility function for delaying async operations
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('General', () => {
  test('should initialize correctly', () => {
    const { result } = renderHook(() => useReactive({ count: 0 }));
    expect(result.current[0].count).toBe(0);
  });

  test('should update state correctly', () => {
    const { result } = renderHook(() => useReactive({ count: 0 }));
    act(() => {
      result.current[0].count++;
    });
    expect(result.current[0].count).toBe(1);
  });
  test('should allow updating nested properties', () => {
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
  test('should allow modifying an array', () => {
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
  test('should call init function on creation', () => {
    const initMock = vi.fn();
    const { } = renderHook(() =>
      useReactive({
        count: 0,

      },
        {
          init: initMock, // Init function
        })
    );

    expect(initMock).toHaveBeenCalled();
  });
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
});

// Test for reactive effects
describe('Effects', () => {
  test('should support effects when dependencies change', () => {
    const effectMock = vi.fn();
    const { result, rerender } = renderHook(() =>
      useReactive(
        { count: 0 },
        {
          effects: [[function (state) {
            effectMock(state.count);
          },
          function () { return [this.count] }
          ]]
        }
      )
    );

    act(() => {
      result.current[0].count++;
    });
    rerender();
    expect(effectMock).toHaveBeenCalledWith(1);
  });

  test("effects run when dependencies change", () => {
    const effectMock = vitest.fn();
    const { rerender } = renderHook(({ propCount }) =>
      useReactive(
        {
          count: propCount,
          inc() {
            this.count++;
          }
        },
        {
          effects: [[
            function (state) {
              const { count } = state;
              effectMock(this.count);
            },
            function () {
              return [propCount] // Using component prop as dependency
            }
          ]]
        }),
      { initialProps: { propCount: 0 } }
    );
    expect(effectMock).toHaveBeenCalledWith(0);
    rerender({ propCount: 1 });
    expect(effectMock).toHaveBeenCalledWith(1);
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
          effects: [
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
});

describe("Subscribe", () => {
  test("should trigger a callback when a given property updates", () => {
    const effectMock = vi.fn();
    const { result } = renderHook(() => useReactive({ count: 0 }));
    act(() => {
      result.current[1](() => [result.current[0].count], () => effectMock(1));
      result.current[0].count++;
    });
    expect(result.current[0].count).toBe(1);
    expect(effectMock).toHaveBeenCalledWith(1);
  });
  test("should trigger a callback when a given object property updates", () => {
    const effectMock = vi.fn();
    const { result } = renderHook(() => useReactive({ obj: { count: 0 } }));
    act(() => {
      result.current[1](() => [result.current[0].obj], () => effectMock(1));
      result.current[0].obj = { count: 1 };
    });
    expect(result.current[0].obj.count).toBe(1);
    expect(effectMock).toHaveBeenCalledWith(1);
  });
  test("should trigger a callback when a given nested object property updates", () => {
    const effectMock = vi.fn();
    const { result } = renderHook(() => useReactive({ obj: { count: 0 } }));
    act(() => {
      result.current[1](() => [result.current[0].obj], () => effectMock(1), true);
      result.current[0].obj.count++;
    });
    expect(result.current[0].obj.count).toBe(1);
    expect(effectMock).toHaveBeenCalledWith(1);
  });
  test("should NOT trigger a callback when a given nested object property updates without deep recursive flag", () => {
    const effectMock = vi.fn();
    const { result } = renderHook(() => useReactive({ obj: { obj2: { count: 0 } } }));
    act(() => {
      result.current[1](() => [result.current[0].obj], () => effectMock(1), true);
      result.current[0].obj.obj2.count++;
    });
    expect(result.current[0].obj.obj2.count).toBe(1);
    expect(effectMock).not.toHaveBeenCalledWith(1);
  });
  test("should trigger a callback when a given nested object property updates with deep recursive flag", () => {
    const effectMock = vi.fn();
    const { result } = renderHook(() => useReactive({ obj: { obj2: { count: 0 } } }));
    act(() => {
      result.current[1](() => [result.current[0].obj], () => effectMock(1), 'deep');
      result.current[0].obj.obj2.count++;
    });
    expect(result.current[0].obj.obj2.count).toBe(1);
    expect(effectMock).toHaveBeenCalledWith(1);
  });
  test("should trigger a callback when a given very deeply nested object property updates", () => {
    const effectMock = vi.fn();
    const { result } = renderHook(() => useReactive({ obj: { obj2: { obj3: { count: 0 } } } }));
    act(() => {
      result.current[1](() => [result.current[0].obj], () => effectMock(1), 'deep');
      result.current[0].obj.obj2.obj3.count++;
    });
    expect(result.current[0].obj.obj2.obj3.count).toBe(1);
    expect(effectMock).toHaveBeenCalledWith(1);
  });
  test("should trigger a callback when a given array property updates", () => {
    const effectMock = vi.fn();
    const { result } = renderHook(() => useReactive({ arr: [1, 2, 3] }));
    act(() => {
      result.current[1](() => [result.current[0].arr], () => effectMock(1));
      result.current[0].arr = [1, 2, 3, 4];
    });
    expect(result.current[0].arr).toEqual([1, 2, 3, 4]);
    expect(effectMock).toHaveBeenCalledWith(1);
  });
  test("should trigger a callback from init function when a given property updates", () => {
    const effectMock = vi.fn();
    let unsubscribe: () => void;
    const { result } = renderHook(() => useReactive(
      {
        count: 0

      },
      {
        init(_state, subscribe) {
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

  test("should trigger a callback when any property of a given object property updates", () => {
    const effectMock1 = vi.fn();
    const effectMock2 = vi.fn();
    const { result } = renderHook(() => useReactive({ sub: { count1: 0, count2: 10 } }));
    act(() => {
      result.current[1](() => [result.current[0].sub], (state, key, value, previous) => {
        if (key === 'count1')
          effectMock1(key, value, previous);
        if (key === 'count2')
          effectMock2(key, value, previous);
      }, true)
      result.current[0].sub.count1++;
      result.current[0].sub.count2++;
    });
    expect(result.current[0].sub.count1).toBe(1);
    expect(result.current[0].sub.count2).toBe(11);
    expect(effectMock1).toHaveBeenCalledWith('count1', 1, 0);
    expect(effectMock2).toHaveBeenCalledWith('count2', 11, 10);
  });
});

describe("History", () => {
  test("should initialize state correctly", () => {
    const { result } = renderHook(() => useReactive({ count: 0, message: "Hello" }));

    expect(result.current[0].count).toBe(0);
    expect(result.current[0].message).toBe("Hello");
  });

  test("should update state and track changes when history is enabled", () => {
    const { result } = renderHook(() => useReactive({ count: 0 }, { historySettings: { enabled: true } }));

    act(() => {
      result.current[0].count++;
    });

    expect(result.current[0].count).toBe(1);
    expect(result.current[2].entries.length).toBe(1);
  });

  test("should not track changes when history is disabled", () => {
    const { result } = renderHook(() => useReactive({ count: 0 }));

    act(() => {
      result.current[0].count++;
    });

    expect(result.current[0].count).toBe(1);
    expect(result.current[2].entries.length).toBe(0);
  });

  test("should undo the last change", () => {
    const { result } = renderHook(() => useReactive({ count: 0 }, { historySettings: { enabled: true } }));

    act(() => {
      result.current[0].count++;
      result.current[2].undo();
    });

    expect(result.current[0].count).toBe(0);
    expect(result.current[2].entries.length).toBe(0);
  });

  test("should revert a specific change", () => {
    const { result } = renderHook(() => useReactive({ count: 0 }, { historySettings: { enabled: true } }));

    act(() => {
      result.current[0].count++;
      result.current[0].count++;
      result.current[2].revert(0);
    });

    expect(result.current[0].count).toBe(0);
    expect(result.current[2].entries.length).toBe(1);
  });

  test("should undo to a specific index", () => {
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

  test("should restore to a specific snapshot", () => {
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
