import { useState, useRef, useEffect, useReducer } from "react";

declare global {
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
    console.log("useReactive called");

    const [, setTrigger] = useState(0); // State updater to trigger re-renders
    const initialState: ReactiveState<T> = initial;
    const updateFunctions = useRef(new Map<string | symbol, () => void>());
    const stateRef = useRef<ReactiveState<T>>(initialState);
    const proxyRef = useRef<T>(null);
    const getterCache = useRef<Map<keyof T, T[keyof T]>>(new Map()); // Cache for computed property values
    const proxyCache = new WeakMap<object, any>();
    const boundFunctions = new WeakMap<Function, Function>();
    const stateMapRef = useRef<WeakMap<object, Map<string | symbol, [() => any, React.Dispatch<React.SetStateAction<any>>]>>>(null);

    if (!stateMapRef.current)
        stateMapRef.current = new WeakMap<object, Map<string | symbol, [any, React.Dispatch<React.SetStateAction<any>>]>>()

    // Recursively creates a structure of useState hooks for each property.
    const initializeState = <T extends object>(obj: T): void => {
        let stateMap = stateMapRef.current?.get(obj);
        if (!stateMap) {
            stateMap = new Map<string | symbol, [any, React.Dispatch<React.SetStateAction<any>>]>();
            stateMapRef.current?.set(obj, stateMap);
        }
        Object.keys(obj).forEach((key) => {
            if (typeof obj[key as keyof T] !== "object" || Array.isArray(obj[key as keyof T])) {
                if (typeof obj[key as keyof T] === "function") return;
                if (!stateMap.has(key)) {
                    const [state, setState] = useState(obj[key as keyof T]);
                    stateMap.set(key, [() => state, setState]);
                }
            } else {
                initializeState(obj[key as keyof T] as T);
            }
        });
    };

    initializeState(initial); // Ensure state is only initialized once

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
                syncState(target[key as keyof T] as ReactiveState<T>, newObj[key as keyof T] as ReactiveState<T>);
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
        const createReactiveProxy = (target: ReactiveState<T>): T => {
            // If a proxy already exists, return it
            if (proxyCache.has(target)) {
                return proxyCache.get(target);
            }
            const proxy = new Proxy(target, {
                get(obj, prop: string | symbol) {
                    const key = prop as keyof T;
                    const stateMap = stateMapRef.current?.get(obj);
                    const [valueF, setState] = stateMap?.has(prop) ? stateMap.get(prop)! : [() => obj[key]];
                    const value = valueF();

                    // Proxy arrays         
                    /*         
                    if (Array.isArray(value)) {
                        return new Proxy(value, {
                            get(arrTarget, arrProp) {
                                const arrValue = arrTarget[arrProp as any];

                                // If accessing a mutating array method, return a wrapped function
                                if (typeof arrValue === "function" && ["push", "pop", "shift", "unshift", "splice", "sort", "reverse"].includes(arrProp as string)) {
                                    return (...args: any[]) => {
                                        const result = arrValue.apply(arrTarget, args);
                                        if (setState) {
                                            stateMap?.set(prop, [() => arrTarget, setState]);
                                            setState(arrTarget);
                                        }
                                        return result;
                                    };
                                }

                                return arrValue;
                            },
                        });
                    }
                    */

                    // Handle computed properties (getters)
                    const descriptor = Object.getOwnPropertyDescriptor(obj, key);
                    if (descriptor && typeof descriptor.get === "function") {
                        const newValue = descriptor.get.call(proxy);
                        getterCache.current.set(key, newValue);
                        return newValue;
                    }

                    // Wrap nested objects in proxies
                    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                        if (!proxyCache.has(value)) {
                            proxyCache.set(value, createReactiveProxy(value as ReactiveState<T>));
                        }
                        return proxyCache.get(value);
                    }


                    // Ensure functions are bound to the proxy object
                    if (typeof value === "function") {
                        if (!boundFunctions.has(value)) {
                            boundFunctions.set(value, function (...args: any[]) {
                                return value.apply(proxy, args); // Now correctly bound to the current proxy
                            });
                        }
                        return boundFunctions.get(value);
                    }

                    return value;
                },
                set(obj, prop: string | symbol, value) {
                    const stateMap = stateMapRef.current?.get(obj);
                    if (!stateMap?.has(prop)) return false;
                    const [state, setState] = stateMap.get(prop)!;
                    if (state() !== value) {
                        stateMap.set(prop, [() => value, setState]);
                        setState(value);
                    }
                    return true;
                },
            });
            proxyCache.set(target, proxy);
            return proxy;
        }
        proxyRef.current = createReactiveProxy(stateRef.current);

        // If the object has an init method, call it after creation
        if ("init" in proxyRef.current && typeof proxyRef.current.init === "function") {
            proxyRef.current.init!();
        }
    }
    return proxyRef.current;
}
