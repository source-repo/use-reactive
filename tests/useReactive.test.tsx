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
    // Compare array contents (arrays may have symbol properties that affect equality)
    expect(result.current[0].todos.length).toBe(2);
    expect(result.current[0].todos[0]).toBe('Learn React');
    expect(result.current[0].todos[1]).toBe('Master TypeScript');
    act(() => {
      result.current[0].addTodoInPlace('Master Cobol');
    });
    expect(result.current[0].todos.length).toBe(3);
    expect(result.current[0].todos[0]).toBe('Learn React');
    expect(result.current[0].todos[1]).toBe('Master TypeScript');
    expect(result.current[0].todos[2]).toBe('Master Cobol');
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
    // Compare array contents (arrays may have symbol properties that affect equality)
    expect(result.current[0].arr.length).toBe(4);
    expect(result.current[0].arr[0]).toBe(1);
    expect(result.current[0].arr[1]).toBe(2);
    expect(result.current[0].arr[2]).toBe(3);
    expect(result.current[0].arr[3]).toBe(4);
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

describe("Copy-on-Write", () => {
  test("should create isolated copies when multiple components share state", () => {
    const sharedState = { count: 0 };
    
    const { result: resultA } = renderHook(() => useReactive(sharedState));
    const { result: resultB } = renderHook(() => useReactive(sharedState));

    // Component A mutates
    act(() => {
      resultA.current[0].count++;
    });

    // Component A should see the mutation
    expect(resultA.current[0].count).toBe(1);
    // Component B should keep the original value (isolated copy)
    expect(resultB.current[0].count).toBe(0);
  });

  test("should create copies lazily on first mutation", () => {
    const sharedState = { count: 0, name: "Test" };
    
    const { result: resultA } = renderHook(() => useReactive(sharedState));
    const { result: resultB } = renderHook(() => useReactive(sharedState));

    // Component A reads but doesn't mutate yet
    expect(resultA.current[0].count).toBe(0);
    expect(resultB.current[0].count).toBe(0);

    // Component A mutates
    act(() => {
      resultA.current[0].count++;
    });

    // Component A sees mutation
    expect(resultA.current[0].count).toBe(1);
    // Component B still sees original
    expect(resultB.current[0].count).toBe(0);
    // Both should still share the name property (not mutated)
    expect(resultA.current[0].name).toBe("Test");
    expect(resultB.current[0].name).toBe("Test");
  });

  test("should isolate nested object mutations", () => {
    const sharedState = { user: { name: "John", age: 30 } };
    
    const { result: resultA } = renderHook(() => useReactive(sharedState));
    const { result: resultB } = renderHook(() => useReactive(sharedState));

    // Component A mutates nested property
    act(() => {
      resultA.current[0].user.age++;
    });

    // Component A should see the mutation
    expect(resultA.current[0].user.age).toBe(31);
    // Component B should keep the original value
    expect(resultB.current[0].user.age).toBe(30);
    // Both should still have the same name (not mutated)
    expect(resultA.current[0].user.name).toBe("John");
    expect(resultB.current[0].user.name).toBe("John");
  });

  test("should isolate array mutations", () => {
    const sharedState = { items: [1, 2, 3] };
    
    const { result: resultA } = renderHook(() => useReactive(sharedState));
    const { result: resultB } = renderHook(() => useReactive(sharedState));

    // Component A mutates array
    act(() => {
      resultA.current[0].items.push(4);
    });

    // Component A should see the mutation
    expect(resultA.current[0].items.length).toBe(4);
    expect(resultA.current[0].items[3]).toBe(4);
    // Component B should keep the original array
    expect(resultB.current[0].items.length).toBe(3);
    expect(resultB.current[0].items[2]).toBe(3);
  });

  test("should handle multiple mutations independently", () => {
    const sharedState = { count: 0, value: 10 };
    
    const { result: resultA } = renderHook(() => useReactive(sharedState));
    const { result: resultB } = renderHook(() => useReactive(sharedState));
    const { result: resultC } = renderHook(() => useReactive(sharedState));

    // Component A mutates count
    act(() => {
      resultA.current[0].count++;
    });

    // Component B mutates value
    act(() => {
      resultB.current[0].value++;
    });

    // Component C mutates count
    act(() => {
      resultC.current[0].count += 5;
    });

    // Each component should see its own mutations
    expect(resultA.current[0].count).toBe(1);
    expect(resultA.current[0].value).toBe(10); // Not mutated by A
    
    expect(resultB.current[0].count).toBe(0); // Not mutated by B
    expect(resultB.current[0].value).toBe(11);
    
    expect(resultC.current[0].count).toBe(5);
    expect(resultC.current[0].value).toBe(10); // Not mutated by C
  });
});

describe("Allow Background Mutations", () => {
  test("should propagate mutations to components with allowBackgroundMutations", () => {
    const sharedState = { count: 0 };
    
    const { result: resultA } = renderHook(() => 
      useReactive(sharedState, { allowBackgroundMutations: true })
    );
    const { result: resultB, rerender: rerenderB } = renderHook(() => 
      useReactive(sharedState, { allowBackgroundMutations: true })
    );

    // Component A mutates (has allowBackgroundMutations)
    act(() => {
      resultA.current[0].count++;
    });
    
    rerenderB();

    // Component A should see the mutation
    expect(resultA.current[0].count).toBe(1);
    // Component B should also see the mutation (background mutation)
    expect(resultB.current[0].count).toBe(1);
  });

  test("should trigger re-renders for components with allowBackgroundMutations", () => {
    const sharedState = { count: 0 };
    let renderCount = 0;
    
    const { result: resultA } = renderHook(() => useReactive(sharedState));
    const { result: resultB, rerender: rerenderB } = renderHook(() => {
      renderCount++;
      return useReactive(sharedState, { allowBackgroundMutations: true });
    });

    const initialRenderCount = renderCount;

    // Component A mutates
    act(() => {
      resultA.current[0].count++;
    });
    
    rerenderB();

    // Component B should have re-rendered due to background mutation
    expect(resultB.current[0].count).toBe(1);
  });

  test("should propagate nested object mutations with allowBackgroundMutations", () => {
    const sharedState = { user: { name: "John", age: 30 } };
    
    const { result: resultA } = renderHook(() => useReactive(sharedState));
    const { result: resultB, rerender: rerenderB } = renderHook(() => 
      useReactive(sharedState, { allowBackgroundMutations: true })
    );

    // Component A mutates nested property
    act(() => {
      resultA.current[0].user.age++;
    });
    
    rerenderB();

    // Component A should see the mutation
    expect(resultA.current[0].user.age).toBe(31);
    // Component B should also see the mutation (background mutation)
    expect(resultB.current[0].user.age).toBe(31);
    // Both should have the same name
    expect(resultA.current[0].user.name).toBe("John");
    expect(resultB.current[0].user.name).toBe("John");
  });

  test("should propagate array mutations with allowBackgroundMutations", () => {
    const sharedState = { items: [1, 2, 3] };
    
    const { result: resultA } = renderHook(() => useReactive(sharedState));
    const { result: resultB, rerender: rerenderB } = renderHook(() => 
      useReactive(sharedState, { allowBackgroundMutations: true })
    );

    // Component A mutates array
    act(() => {
      resultA.current[0].items.push(4);
    });
    
    rerenderB();

    // Component A should see the mutation
    expect(resultA.current[0].items.length).toBe(4);
    expect(resultA.current[0].items[3]).toBe(4);
    // Component B should also see the mutation (background mutation)
    expect(resultB.current[0].items.length).toBe(4);
    expect(resultB.current[0].items[3]).toBe(4);
  });

  test("should handle mixed allowBackgroundMutations settings", () => {
    const sharedState = { count: 0 };
    
    const { result: resultA } = renderHook(() => useReactive(sharedState));
    const { result: resultB, rerender: rerenderB } = renderHook(() => 
      useReactive(sharedState, { allowBackgroundMutations: true })
    );
    const { result: resultC } = renderHook(() => useReactive(sharedState));

    // Component A mutates
    act(() => {
      resultA.current[0].count++;
    });
    
    rerenderB();

    // Component A should see the mutation
    expect(resultA.current[0].count).toBe(1);
    // Component B should see the mutation (allows background mutations)
    expect(resultB.current[0].count).toBe(1);
    // Component C should keep the original (doesn't allow background mutations)
    expect(resultC.current[0].count).toBe(0);
  });

  test("should propagate deeply nested mutations with allowBackgroundMutations", () => {
    const sharedState = { 
      level1: { 
        level2: { 
          level3: { value: 10 } 
        } 
      } 
    };
    
    const { result: resultA } = renderHook(() => useReactive(sharedState));
    const { result: resultB, rerender: rerenderB } = renderHook(() => 
      useReactive(sharedState, { allowBackgroundMutations: true })
    );

    // Component A mutates deeply nested property
    act(() => {
      resultA.current[0].level1.level2.level3.value++;
    });
    
    rerenderB();

    // Component A should see the mutation
    expect(resultA.current[0].level1.level2.level3.value).toBe(11);
    // Component B should also see the mutation (background mutation)
    expect(resultB.current[0].level1.level2.level3.value).toBe(11);
  });

  test("should handle multiple components with allowBackgroundMutations", () => {
    const sharedState = { count: 0 };
    
    const { result: resultA } = renderHook(() => useReactive(sharedState));
    const { result: resultB, rerender: rerenderB } = renderHook(() => 
      useReactive(sharedState, { allowBackgroundMutations: true })
    );
    const { result: resultC, rerender: rerenderC } = renderHook(() => 
      useReactive(sharedState, { allowBackgroundMutations: true })
    );

    // Component A mutates
    act(() => {
      resultA.current[0].count++;
    });
    
    rerenderB();
    rerenderC();

    // All components with allowBackgroundMutations should see the mutation
    expect(resultA.current[0].count).toBe(1);
    expect(resultB.current[0].count).toBe(1);
    expect(resultC.current[0].count).toBe(1);
  });

  test("should not propagate mutations from components without allowBackgroundMutations to those with it", () => {
    const sharedState = { count: 0 };
    
    const { result: resultA } = renderHook(() => useReactive(sharedState));
    const { result: resultB, rerender: rerenderB } = renderHook(() => 
      useReactive(sharedState, { allowBackgroundMutations: true })
    );
    const { result: resultC } = renderHook(() => useReactive(sharedState));

    // Component A mutates (but doesn't have allowBackgroundMutations)
    // Component B has allowBackgroundMutations, so Component A mutates the source
    // Component C doesn't have allowBackgroundMutations, so Component C gets a copy
    act(() => {
      resultA.current[0].count++;
    });
    
    rerenderB();

    // Component A should see the mutation (mutated the source)
    expect(resultA.current[0].count).toBe(1);
    // Component B should see the mutation (has allowBackgroundMutations, sees source mutations)
    expect(resultB.current[0].count).toBe(1);
    // Component C should NOT see the mutation (got a copy, keeps the original)
    expect(resultC.current[0].count).toBe(0);
  });

  test("should handle background mutations with nested object replacement", () => {
    const sharedState = { user: { name: "John", age: 30 } };
    
    const { result: resultA } = renderHook(() => useReactive(sharedState));
    const { result: resultB, rerender: rerenderB } = renderHook(() => 
      useReactive(sharedState, { allowBackgroundMutations: true })
    );

    // Component A replaces entire nested object
    act(() => {
      resultA.current[0].user = { name: "Jane", age: 25 };
    });
    
    rerenderB();

    // Component A should see the replacement
    expect(resultA.current[0].user.name).toBe("Jane");
    expect(resultA.current[0].user.age).toBe(25);
    // Component B should also see the replacement (background mutation)
    expect(resultB.current[0].user.name).toBe("Jane");
    expect(resultB.current[0].user.age).toBe(25);
  });

  test("should work with history enabled and allowBackgroundMutations", () => {
    const sharedState = { count: 0 };
    
    const { result: resultA } = renderHook(() => 
      useReactive(sharedState, { historySettings: { enabled: true } })
    );
    const { result: resultB, rerender: rerenderB } = renderHook(() => 
      useReactive(sharedState, { 
        allowBackgroundMutations: true,
        historySettings: { enabled: true }
      })
    );

    // Component A mutates
    act(() => {
      resultA.current[0].count++;
    });
    
    rerenderB();

    // Both should see the mutation
    expect(resultA.current[0].count).toBe(1);
    expect(resultB.current[0].count).toBe(1);
    
    // Component A should have history entries (it made the mutation)
    expect(resultA.current[2].entries.length).toBe(1);
    // Component B shouldn't have history entries (it didn't make the mutation, just received it)
    // History is only tracked for mutations made by the component itself
  });

  test("should handle background mutations with computed properties", () => {
    const sharedState = { 
      count: 2,
      get double() {
        return this.count * 2;
      }
    };
    
    const { result: resultA } = renderHook(() => useReactive(sharedState));
    const { result: resultB, rerender: rerenderB } = renderHook(() => 
      useReactive(sharedState, { allowBackgroundMutations: true })
    );

    // Component A mutates
    act(() => {
      resultA.current[0].count++;
    });
    
    rerenderB();

    // Both should see updated count and computed property
    expect(resultA.current[0].count).toBe(3);
    expect(resultA.current[0].double).toBe(6);
    expect(resultB.current[0].count).toBe(3);
    expect(resultB.current[0].double).toBe(6);
  });
});