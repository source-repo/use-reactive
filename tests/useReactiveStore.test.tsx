import React from "react";
import { renderHook, act } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { createReactiveStore } from "../src/useReactiveStore.js";

describe("createReactiveStore", () => {
  test("provides a shared reactive state object to consumers", () => {
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

  test("throws when used outside of its provider", () => {
    const [, useStore] = createReactiveStore({ counter: 0 });

    expect(() => renderHook(() => useStore())).toThrow(
      "useReactiveStore must be used within a ReactiveStoreProvider"
    );
  });

  test("supports multiple properties and nested updates", () => {
    const [Provider, useStore] = createReactiveStore({
      counter: 0,
      user: { name: "John" },
    });

    const { result } = renderHook(() => useStore(), {
      wrapper: ({ children }) => <Provider>{children}</Provider>,
    });

    act(() => {
      result.current.counter += 5;
      result.current.user.name = "Doe";
    });

    expect(result.current.counter).toBe(5);
    expect(result.current.user.name).toBe("Doe");
  });
});
