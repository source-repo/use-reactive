import React from "react";
import { JSDOM } from 'jsdom';
import { createReactiveStore } from '../src/useReactiveStore.js';
import { renderHook, act } from '@testing-library/react';
import { describe, test, expect, beforeAll } from 'vitest';
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

describe("General", () => {
  test("should provide reactive state to components", () => {
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

  test("should throw an error when used outside of provider", () => {
    const [, useStore] = createReactiveStore({ counter: 0 });

    expect(() => renderHook(() => useStore())).toThrow(
      "useReactiveStore must be used within a ReactiveStoreProvider"
    );
  });

  test("should support multiple state properties", () => {
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

  test("should trigger re-renders when state updates", () => {
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
});
