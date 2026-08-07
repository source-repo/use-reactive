import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useReactiveWithHistory } from "../src/useReactiveWithHistory.js";

describe("useReactiveWithHistory", () => {
  test("returns state with an explicit history object", () => {
    const { result } = renderHook(() => useReactiveWithHistory({ count: 0 }));

    const [state, history] = result.current;

    expect(state.count).toBe(0);
    expect(history.index).toBe(0);
    expect(history.length).toBe(1);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
  });

  test("commits snapshots and supports undo and redo", () => {
    const { result } = renderHook(() => useReactiveWithHistory({ count: 0 }));

    act(() => {
      const [state, history] = result.current;
      state.count = 1;
      history.commit();
      state.count = 2;
      history.commit();
    });

    expect(result.current[0].count).toBe(2);
    expect(result.current[1].index).toBe(2);
    expect(result.current[1].length).toBe(3);

    act(() => {
      result.current[1].undo();
    });

    expect(result.current[0].count).toBe(1);
    expect(result.current[1].canRedo).toBe(true);

    act(() => {
      result.current[1].redo();
    });

    expect(result.current[0].count).toBe(2);
    expect(result.current[1].canRedo).toBe(false);
  });

  test("drops redo snapshots after committing from the middle of history", () => {
    const { result } = renderHook(() => useReactiveWithHistory({ count: 0 }));

    act(() => {
      const [state, history] = result.current;
      state.count = 1;
      history.commit();
      state.count = 2;
      history.commit();
      history.undo();
      state.count = 10;
      history.commit();
    });

    expect(result.current[0].count).toBe(10);
    expect(result.current[1].length).toBe(3);
    expect(result.current[1].canRedo).toBe(false);

    act(() => {
      result.current[1].undo();
    });

    expect(result.current[0].count).toBe(1);
  });

  test("restores nested objects and arrays from snapshots", () => {
    const { result } = renderHook(() =>
      useReactiveWithHistory({
        user: { name: "Ada" },
        todos: ["first"],
      })
    );

    act(() => {
      const [state, history] = result.current;
      state.user.name = "Grace";
      state.todos.push("second");
      history.commit();
      state.user.name = "Katherine";
      state.todos.push("third");
      history.commit();
      history.undo();
    });

    expect(result.current[0].user.name).toBe("Grace");
    expect([...result.current[0].todos]).toEqual(["first", "second"]);
  });

  test("reset restores the initial snapshot or a replacement snapshot", () => {
    const { result } = renderHook(() => useReactiveWithHistory({ count: 0, label: "a" }));

    act(() => {
      const [state, history] = result.current;
      state.count = 5;
      state.label = "b";
      history.commit();
      history.reset({ label: "reset" });
    });

    expect(result.current[0].count).toBe(0);
    expect(result.current[0].label).toBe("reset");
    expect(result.current[1].index).toBe(0);
    expect(result.current[1].length).toBe(1);
  });

  test("preserves methods and computed values while restoring data", () => {
    const { result } = renderHook(() =>
      useReactiveWithHistory({
        count: 1,
        increment() {
          this.count++;
        },
        get double() {
          return this.count * 2;
        },
      })
    );

    act(() => {
      const [state, history] = result.current;
      state.increment();
      history.commit();
      state.increment();
      history.commit();
      history.undo();
    });

    expect(result.current[0].count).toBe(2);
    expect(result.current[0].double).toBe(4);

    act(() => {
      result.current[0].increment();
    });

    expect(result.current[0].count).toBe(3);
  });

  test("keeps methods callable immediately after restoring a snapshot", () => {
    const { result } = renderHook(() =>
      useReactiveWithHistory({
        count: 0,
        increment() {
          this.count++;
        },
      })
    );

    act(() => {
      const [state, history] = result.current;
      state.increment();
      history.commit();
      state.increment();
      history.commit();
      history.undo();
      state.increment();
    });

    expect(result.current[0].count).toBe(2);
  });

  test("updates rendered UI when undo and redo are used", () => {
    const Counter = () => {
      const [state, history] = useReactiveWithHistory({ count: 0 });
      return (
        <div>
          <p data-testid="count">{state.count}</p>
          <button
            onClick={() => {
              state.count++;
              history.commit();
            }}
          >
            Increment
          </button>
          <button onClick={history.undo}>Undo</button>
          <button onClick={history.redo}>Redo</button>
        </div>
      );
    };

    render(<Counter />);

    fireEvent.click(screen.getByText("Increment"));
    fireEvent.click(screen.getByText("Increment"));
    expect(screen.getByTestId("count").textContent).toBe("2");

    fireEvent.click(screen.getByText("Undo"));
    expect(screen.getByTestId("count").textContent).toBe("1");

    fireEvent.click(screen.getByText("Redo"));
    expect(screen.getByTestId("count").textContent).toBe("2");
  });
});
