import { JSDOM } from 'jsdom';
import { useReactive } from './useReactive.js'; 
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
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
        user: useReactive({
          name: 'John',
          age: 30,
        }),
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
        (state) => {
          effectMock(state.count);
        },
        []
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
          this.todos = [...this.todos, todo]; // ✅ Ensure new array reference for reactivity
        },
      })
    );

    act(() => {
      result.current.addTodo('Master TypeScript');
    });
    expect(result.current.todos).toEqual(['Learn React', 'Master TypeScript']);
  });
});

// Test for special `init` function
describe('useReactive init function', () => {
  it('should call init function on creation', () => {
    const initMock = vi.fn();
    const { result } = renderHook(() =>
      useReactive({
        count: 0,
        init: initMock, // Special init function
      })
    );

    expect(initMock).toHaveBeenCalled();
  });
});
