'use client'
import { useState, useRef, useEffect } from "react";

declare global {
    interface NodeModule {
        hot?: {
            accept: () => void;
        };
    }

    interface ImportMeta {
        env?: {
            MODE?: string;
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
        if (effect && proxyRef.current) {
            cleanup = effect(proxyRef.current);
        }
        return () => {
            if (cleanup) cleanup();
        };
    }, deps ? [...deps] : []);

    useEffect(() => {
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
    });

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
            } else if (typeof newObj[key as keyof T] === "object" && !Array.isArray(newObj[key as keyof T]) && newObj[key as keyof T] !== null) {
                //syncState(target[key as keyof T] as ReactiveState<T>, newObj[key as keyof T] as ReactiveState<T>);
            }
        });
    };

    const isDev =
        (typeof process !== "undefined" && (
            process.env?.NODE_ENV === "development" ||    // Webpack, general Node.js apps
            process.env?.NEXT_PUBLIC_ENV === "development" || // Next.js
            process.env?.VITE_ENV === "development" // Vite
        )) ||
        (typeof import.meta !== "undefined" && import.meta.env?.MODE === "development"); // Vite & other modern ESM-based bundlers

    if (isDev) {
        syncState(stateRef.current, initialState);
    }

    // Create a proxy for the state object if it doesn't exist
    if (!proxyRef.current) {
        const foo = (target: ReactiveState<T>) => {
            return new Proxy(target, {
                get(target, prop: string | symbol) {
                    const key = prop as keyof T;
                    const value = target[key];

                    // Proxy arrays
                    if (Array.isArray(value)) {
                        return new Proxy(value, {
                            get(arrTarget, arrProp) {
                                const arrValue = arrTarget[arrProp as any];

                                // If accessing a mutating array method, return a wrapped function
                                if (typeof arrValue === "function" && ["push", "pop", "shift", "unshift", "splice", "sort", "reverse"].includes(arrProp as string)) {
                                    return (...args: any[]) => {
                                        const result = arrValue.apply(arrTarget, args);
                                        setTrigger((prev) => prev + 1); // Trigger a state update
                                        return result;
                                    };
                                }

                                return arrValue;
                            },
                        });
                    }

                    // Handle computed properties (getters)
                    const descriptor = Object.getOwnPropertyDescriptor(target, key);
                    if (descriptor && typeof descriptor.get === "function") {
                        const newValue = descriptor.get.call(proxyRef.current);
                        getterCache.current.set(key, newValue);
                        return newValue;
                    }

                    // Wrap nested objects in proxies
                    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                        return foo(value as ReactiveState<T>);
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

        }
        proxyRef.current = foo(stateRef.current);
        
        // If the object has an init method, call it after creation
        if ("init" in proxyRef.current && typeof proxyRef.current.init === "function") {
            proxyRef.current.init!();
        }
    }
    return proxyRef.current;
}
