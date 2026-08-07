import React from "react";
import { renderHook, act } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useReactive } from "../src/useReactive.js";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("useReactive", () => {
  test("returns the reactive state object directly", () => {
    const { result } = renderHook(() => useReactive({ count: 0 }));

    expect(result.current.count).toBe(0);
  });

  test("updates top-level and nested state", () => {
    const { result } = renderHook(() =>
      useReactive({
        count: 0,
        user: { name: "John", age: 30 },
      })
    );

    act(() => {
      result.current.count++;
      result.current.user.age++;
    });

    expect(result.current.count).toBe(1);
    expect(result.current.user.age).toBe(31);
    expect(result.current.user.name).toBe("John");
  });

  test("supports array replacement and in-place array mutation", () => {
    const { result } = renderHook(() =>
      useReactive({
        todos: ["Learn React"],
        addTodo(todo: string) {
          this.todos = [...this.todos, todo];
        },
        addTodoInPlace(todo: string) {
          this.todos.push(todo);
        },
      })
    );

    act(() => {
      result.current.addTodo("Master TypeScript");
      result.current.addTodoInPlace("Ship the API");
    });

    expect([...result.current.todos]).toEqual([
      "Learn React",
      "Master TypeScript",
      "Ship the API",
    ]);
  });

  test("binds methods to the returned state object", () => {
    const { result } = renderHook(() =>
      useReactive({
        count: 0,
        increment() {
          this.count++;
        },
      })
    );

    act(() => {
      const increment = result.current.increment;
      increment();
    });

    expect(result.current.count).toBe(1);
  });

  test("supports computed getters", () => {
    const { result } = renderHook(() =>
      useReactive({
        count: 2,
        get double() {
          return this.count * 2;
        },
      })
    );

    expect(result.current.double).toBe(4);

    act(() => {
      result.current.count++;
    });

    expect(result.current.double).toBe(6);
  });

  test("supports root-level setters", () => {
    const { result } = renderHook(() =>
      useReactive({
        count: 2,
        get double() {
          return this.count * 2;
        },
        set double(value: number) {
          this.count = value / 2;
        },
      })
    );

    act(() => {
      result.current.double = 10;
    });

    expect(result.current.count).toBe(5);
    expect(result.current.double).toBe(10);
  });

  test("supports delete, in, and own-key reflection", () => {
    const { result } = renderHook(() =>
      useReactive({
        count: 1,
        label: "ready",
        increment() {
          this.count++;
        },
        get doubled() {
          return this.count * 2;
        },
      })
    );

    expect("count" in result.current).toBe(true);
    expect("increment" in result.current).toBe(true);
    expect(Object.keys(result.current)).toEqual(
      expect.arrayContaining(["count", "label", "increment", "doubled"])
    );

    act(() => {
      delete result.current.label;
    });

    expect("label" in result.current).toBe(false);
    expect("increment" in result.current).toBe(true);
    expect(Object.keys(result.current)).not.toContain("label");
    expect(Object.keys(result.current)).toContain("increment");
  });

  test("supports async methods", async () => {
    const { result } = renderHook(() =>
      useReactive({
        count: 0,
        async incrementAsync() {
          await delay(10);
          this.count++;
        },
      })
    );

    await act(async () => {
      await result.current.incrementAsync();
    });

    expect(result.current.count).toBe(1);
  });

  test("refreshes behavior closures on rerender", () => {
    const { result, rerender } = renderHook(
      ({ offset }) =>
        useReactive({
          base: 10,
          get sum() {
            return this.base + offset;
          },
        }),
      { initialProps: { offset: 1 } }
    );

    expect(result.current.sum).toBe(11);

    rerender({ offset: 7 });

    expect(result.current.sum).toBe(17);
  });

  test("refreshes method closures on rerender", () => {
    const { result, rerender } = renderHook(
      ({ amount }) =>
        useReactive({
          count: 0,
          add() {
            this.count += amount;
          },
        }),
      { initialProps: { amount: 1 } }
    );

    act(() => {
      result.current.add();
    });
    expect(result.current.count).toBe(1);

    rerender({ amount: 5 });

    act(() => {
      result.current.add();
    });
    expect(result.current.count).toBe(6);
  });

  test("treats data properties as initial state after creation", () => {
    const { result, rerender } = renderHook(
      ({ count }) => useReactive({ count }),
      { initialProps: { count: 1 } }
    );

    expect(result.current.count).toBe(1);

    rerender({ count: 10 });

    expect(result.current.count).toBe(1);
  });

  test("does not mutate the input object", () => {
    const initial = { count: 0, user: { age: 30 } };
    const { result } = renderHook(() => useReactive(initial));

    act(() => {
      result.current.count++;
      result.current.user.age++;
    });

    expect(result.current.count).toBe(1);
    expect(result.current.user.age).toBe(31);
    expect(initial).toEqual({ count: 0, user: { age: 30 } });
  });

  test("components passing the same object share one store", () => {
    const sharedState = { count: 0, user: { age: 30 } };

    const { result: resultA } = renderHook(() => useReactive(sharedState));
    const { result: resultB } = renderHook(() => useReactive(sharedState));

    act(() => {
      resultA.current.count++;
      resultA.current.user.age++;
    });

    expect(resultA.current.count).toBe(1);
    expect(resultB.current.count).toBe(1);
    expect(resultA.current.user.age).toBe(31);
    expect(resultB.current.user.age).toBe(31);
  });

  test("components passing different objects are isolated", () => {
    const { result: resultA } = renderHook(() => useReactive({ count: 0 }));
    const { result: resultB } = renderHook(() => useReactive({ count: 0 }));

    act(() => {
      resultA.current.count++;
    });

    expect(resultA.current.count).toBe(1);
    expect(resultB.current.count).toBe(0);
  });

  test("clones Date values without mutating the input object", () => {
    const input = { createdAt: new Date("2026-08-07T00:00:00.000Z") };
    const { result } = renderHook(() => useReactive(input));

    act(() => {
      result.current.createdAt.setUTCFullYear(2030);
    });

    expect(result.current.createdAt.getUTCFullYear()).toBe(2030);
    expect(input.createdAt.getUTCFullYear()).toBe(2026);
  });
});
