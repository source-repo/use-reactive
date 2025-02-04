'use client'
import { useState, useRef, useEffect } from "react";

declare global {
  interface NodeModule {
    hot?: {
      accept: () => void;
    };
  }
}

type ReactiveState<T> = T & { init?: () => void };

/**
 * useReactive - A custom React hook that creates a reactive state object.
 * 
 * This hook provides a proxy-based reactive state that triggers re-renders
 * when properties change. It also supports computed properties (getters),
 * hot module reloading (HMR) synchronization, and optional side effects.
 * 
 * @param initial - The initial state object.
 * @param effect - Optional effect function that runs when dependencies change.
 * @param deps - Dependencies array for triggering reactivity updates.
 * @returns A reactive proxy of the state object.
 */
export function useReactive<T extends object>(
  initial: T,
  effect?: (state: T) => (() => void) | void,
  ...deps: unknown[]
): T {
  if (typeof window === "undefined") {
    throw new Error("useReactive should only be used in the browser");
  }

  const [, setTrigger] = useState(0); // State updater to trigger re-renders
  const initialState: ReactiveState<T> = initial;
  const stateRef = useRef<ReactiveState<T>>(initialState);
  const proxyRef = useRef<T>(null);
  const getterCache = useRef<Map<keyof T, T[keyof T]>>(new Map()); // Cache for computed property values

  // useEffect to handle side effects and cleanup
  useEffect(() => {
    let cleanup: (() => void) | void;
    if (effect) {
      cleanup = effect(stateRef.current);
    }

    // Check for changes in computed properties (getters) and trigger a re-render if needed
    let hasChanged = false;
    getterCache.current.forEach((prevValue, key) => {
      const descriptor = Object.getOwnPropertyDescriptor(stateRef.current, key);
      if (descriptor && typeof descriptor.get === "function") {
        const newValue = descriptor.get.call(proxyRef.current);
        if (prevValue !== newValue) {
          hasChanged = true;
          getterCache.current.set(key, newValue);
        }
      }
    });

    if (hasChanged) {
      setTrigger((prev) => prev + 1);
    }

    return () => {
      if (cleanup) cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effect, ...deps]);

  /**
   * Synchronizes the existing state with a new state object.
   * This is mainly used for maintaining state consistency during hot reloads.
   */
  const syncState = (target: ReactiveState<T>, newObj: ReactiveState<T>) => {
    Object.keys(target).forEach((key) => {
      if (!(key in newObj)) {
        delete target[key as keyof T];
      }
    });
    Object.keys(newObj).forEach((key) => {
      if (!(key in target)) {
        target[key as keyof T] = newObj[key as keyof T];
      } else if (typeof newObj[key as keyof T] === "function") {
        target[key as keyof T] = newObj[key as keyof T];
      } else if (typeof newObj[key as keyof T] === "object" && newObj[key as keyof T] !== null) {
        syncState(target[key as keyof T] as ReactiveState<T>, newObj[key as keyof T] as ReactiveState<T>);
      }
    });
  };

  const isDev = process.env.NEXT_PUBLIC_ENV === "development";
  if (isDev) {
    syncState(stateRef.current, initialState);
    console.log('hot reload');
  }
  
  // Create a proxy for the state object if it doesn't exist
  if (!proxyRef.current) {
    proxyRef.current = new Proxy(stateRef.current, {
      get(target, prop: string | symbol) {
        const key = prop as keyof T;
        const value = target[key];

        // Handle computed properties (getters)
        const descriptor = Object.getOwnPropertyDescriptor(target, key);
        if (descriptor && typeof descriptor.get === "function") {
          const newValue = descriptor.get.call(proxyRef.current);
          getterCache.current.set(key, newValue);
          return newValue;
        }

        // Nested objects should also be reactive
        if (value && typeof value === "object" && !Array.isArray(value)) {
          // eslint-disable-next-line react-hooks/rules-of-hooks
          return useReactive(value as T);
        }

        // Ensure functions are bound to the proxy object
        if (typeof value === "function") {
          return value.bind(proxyRef.current);
        }

        return value;
      },
      set(target, prop: string | symbol, value: unknown) {
        const key = prop as keyof T;
        if (target[key] === value) return true;
        target[key] = value as T[keyof T];
        setTrigger((prev) => prev + 1);
        return true;
      },
    });

    // If the object has an init method, call it after creation
    if ("init" in proxyRef.current && typeof proxyRef.current.init === "function") {
      proxyRef.current.init();
    }
  }

  return proxyRef.current;
}
