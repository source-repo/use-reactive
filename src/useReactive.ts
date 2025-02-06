import { useState, useRef, useEffect, useReducer } from "react";

declare global {
    interface ImportMeta {
        env?: {
            MODE?: string;
        };
    }
}

type ReactiveState<T> = T & { init?: () => void };

type EffectFunction<T> = (this: T, state: T) => void | (() => void);

// Map structure for storing state and setState hooks for each property
//   key: Property key
//   value: [state, setState, updateFlag, childMap]
//
// The updateFlag is used to track changes in the property value done via the proxy (as opposed to from props).
//
type UseStateMap = Map<string | number | symbol, [any, React.Dispatch<React.SetStateAction<any>> | undefined, boolean, UseStateMap | undefined]>;

/**
 * useReactive - A custom React hook that creates a reactive state object.
 * 
 * This hook provides a proxy-based reactive state that triggers re-renders
 * when properties change. It also supports computed properties (getters),
 * hot module reloading (HMR) synchronization, and optional side effects.
 * 
 * @param reactiveState - The initial state object.
 * @param effect - Optional effect function that runs when dependencies change.
 * @param deps - Dependencies array for triggering reactivity updates.
 * @returns A reactive proxy of the state object.
 */
export function useReactive<T extends object>(
    reactiveState: T,
    effect?: EffectFunction<T> | Array<[EffectFunction<T>, unknown[]]>,
    deps?: unknown[]
): T {
    if (typeof window === "undefined") {
        throw new Error("useReactive should only be used in the browser");
    }
    console.log("useReactive called");

    const reactiveStateRef = useRef(reactiveState);
    const [, setTrigger] = useState(0); // State updater to trigger re-renders
    const proxyRef = useRef<T>(null);
    const getterCache = useRef<Map<keyof T, T[keyof T]>>(new Map()); // Cache for computed property values
    const proxyCache = new WeakMap<object, any>();
    const boundFunctions = new WeakMap<Function, Function>();
    const stateMapRef = useRef<WeakMap<object, UseStateMap>>(null);

    // Recursively creates a structure of useState hooks for each property.
    const initializeState = <T extends object>(obj: T, stateMap: UseStateMap, newObj?: T): void => {
        Object.keys(obj).forEach((keyAny) => {
            const key = keyAny as keyof T
            if (typeof obj[key] !== "object" || Array.isArray(obj[key])) {
                if (typeof obj[key] === "function") return;
                const [state, setState] = useState(obj[key]);
                const [,, savedFlag] = stateMap.get(key) || [undefined, undefined, false];
                if (!savedFlag && newObj && newObj[key] !== state) {
                    setState(newObj[key]);
                }
                stateMap.set(key, [state, setState, savedFlag, undefined]);
            } else {
                let childStateMap: UseStateMap | undefined;
                if (!stateMap.has(key)) {
                    childStateMap = new Map();
                    stateMap.set(key, [undefined, undefined, false, childStateMap]);
                } else {
                    childStateMap = stateMap.get(key)![3];
                }
                stateMapRef.current?.set(obj[key] as T, childStateMap!);
                initializeState(obj[key] as T, childStateMap!, newObj ? newObj[key] as T : undefined);
            }
        });
    };
    if (!stateMapRef.current) {
        stateMapRef.current = new WeakMap()
        const map = new Map();
        stateMapRef.current.set(reactiveStateRef.current, map);
        initializeState(reactiveStateRef.current, map);
    } else {
        initializeState(reactiveStateRef.current, stateMapRef.current.get(reactiveStateRef.current)!, reactiveState);
    }

    /**
     * HMR synchronizs the existing state with a new state object.
     * This is used to add and remove functions during hot reloads.
     */
    const syncState = (target: ReactiveState<T>, newObj: ReactiveState<T>) => {
        Object.keys(target).forEach((key) => {
            if (!(key in newObj)) {
                delete target[key as keyof T];
            }
        });
        Object.keys(newObj).forEach((keyAny) => {
            const key = keyAny as keyof T
            if (typeof newObj[key] === "function") {
                target[key] = newObj[key];
            } else if (typeof newObj[key] === "object" && !Array.isArray(newObj[key]) && newObj[key] !== null) {
                syncState(target[key] as ReactiveState<T>, newObj[key] as ReactiveState<T>);
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
        syncState(reactiveStateRef.current, reactiveState);
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
                    let value: any
                    const [savedValue, setValue, proxyUpdateFlag, map] = stateMap?.has(prop as keyof T) ? stateMap.get(prop as keyof T)! : [obj[key]];
                    if (!map) {
                        value = savedValue;
                    } else {
                        value = obj[key];
                    }   

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
                    if (!stateMap?.has(prop as keyof T)) return false;
                    const [state, setState,, map] = stateMap.get(prop as keyof T)!;
                    if (state !== value) {
                        stateMap.set(prop as keyof T, [value, setState, true, map]);
                        if (setState) {
                            setState(value);
                        }
                    }
                    return true;
                },
            });
            proxyCache.set(target, proxy);
            return proxy;
        }
        proxyRef.current = createReactiveProxy(reactiveStateRef.current);

        // If the object has an init method, call it after creation
        if ("init" in proxyRef.current && typeof proxyRef.current.init === "function") {
            proxyRef.current.init!();
        }
    }

    // useEffect to handle side effects and cleanup
    if (effect) {
        if (typeof effect === "function") {
            // Single effect function
            useEffect(() => {
                let cleanup: (() => void) | void;
                if (effect && proxyRef.current) {
                    cleanup = effect.apply(proxyRef.current, [proxyRef.current]);
                }
                return () => {
                    if (cleanup) cleanup();
                };
            }, deps);
        } else if (Array.isArray(effect)) {
            // Multiple effect/dependency pairs
            effect.forEach(([effectF, effectDeps]) => {
                useEffect(() => {
                    let cleanup: (() => void) | void;
                    if (effectF && proxyRef.current) {
                        cleanup = effectF.apply(proxyRef.current, [proxyRef.current]);
                    }
                    return () => {
                        if (cleanup) cleanup();
                    };
                }, effectDeps);
            });
        }
    }

    useEffect(() => {
        // Check for changes in computed properties (getters) and trigger a re-render if needed
        let hasChanged = false;
        getterCache.current.forEach((prevValue, key) => {
            const descriptor = Object.getOwnPropertyDescriptor(reactiveStateRef, key);
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

    return proxyRef.current;
}
