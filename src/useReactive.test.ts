import { JSDOM } from 'jsdom';
import { useReactive } from './useReactive.js'; 
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeAll } from 'vitest';
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
  it('initializes correctly', () => {
    const { result } = renderHook(() => useReactive({ count: 0 }));
    expect(result.current.count).toBe(0);
  });

  it('updates state correctly', () => {
    const { result } = renderHook(() => useReactive({ count: 0 }));
    act(() => {
      result.current.count++;
    });
    expect(result.current.count).toBe(1);
  });
});