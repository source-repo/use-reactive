import { useState, useRef, useEffect } from "react";

type R<T> = T & {
    subscribe: (targets: () => unknown | unknown[], callback: (key: keyof T, value: unknown, previous: unknown) => void) => void,
};

type C<T> = (key: keyof T, value: unknown, previous: unknown) => void;

type S<T> = (targets: () => unknown | unknown[], callback: C<T>) => void

// Effect function type
type E<T> = (this: R<T>, state: R<T>) => void | (() => void);

type Subscriber<T> = {
    recording: boolean,
    callback: C<T>,
    targets: {
        obj: object,
        prop: keyof T
    }[]
};

/**
 * Map for storing data about each property
 * key: Property key
 * value: [updateFlag, childMap, propValue]
 * 
 * The updateFlag is used to track changes in the property value done via the proxy (as opposed to from props).
 */
type PropertyMap = Map<string | number | symbol, [boolean, PropertyMap | undefined, any]>;

function isEqual(x: any, y: any): boolean {
    const ok = Object.keys, tx = typeof x, ty = typeof y;
    return x && y && tx === 'object' && tx === ty ? (
        ok(x).length === ok(y).length &&
        ok(x).every(key => isEqual(x[key], y[key]))
    ) : (x === y);
}

// Recursively creates and updates a structure of info about each property.
const syncState = <T extends object>(stateMapRef: WeakMap<object, PropertyMap>, obj: T, stateMap: PropertyMap, newObj?: T): void => {
    Object.keys(obj).forEach((keyAny) => {
        const key = keyAny as keyof T
        const descriptor = Object.getOwnPropertyDescriptor(obj, key);
        const isFunction = (descriptor && descriptor.value && typeof descriptor.value === "function");
        const isGetter = (descriptor && descriptor.get && typeof descriptor.get === "function");
        if (!isFunction && !isGetter) {
            if (typeof obj[key] !== "object" || Array.isArray(obj[key])) {
                if (typeof obj[key] === "function") return;
                const [modifiedFlag, , lastPropValue] = stateMap.get(key) || [undefined, undefined, false];
                let propValue = newObj ? newObj[key] : obj[key];

                const propValueChanged = !isEqual(lastPropValue, propValue);
                if ((!modifiedFlag || propValueChanged) && newObj && obj[key] !== propValue) {
                    obj[key] = propValue;
                }
                stateMap.set(key, [modifiedFlag!, undefined, propValue]);
            } else {
                let childStateMap: PropertyMap | undefined;
                if (!stateMap.has(key)) {
                    childStateMap = new Map();
                    stateMap.set(key, [false, childStateMap, obj[key]]);
                } else {
                    childStateMap = stateMap.get(key)![1];
                }
                stateMapRef.set(obj[key] as T, childStateMap!);
                if (childStateMap)
                    syncState(stateMapRef, obj[key] as T, childStateMap, newObj ? newObj[key] as T : undefined);
            }
        } else {
            Object.defineProperty(obj, key, descriptor);
        }
    });
};

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
    init?: (this: R<T>, state: R<T>) => void,
    effect?: E<T> | Array<[E<T>, unknown[]]>,
    deps?: unknown[]
): [R<T>, S<T>] {
    if (typeof window === "undefined") {
        throw new Error("useReactive should only be used in the browser");
    }
    const reactiveStateRef = useRef(reactiveState);
    const [, setTrigger] = useState(0); // State updater to trigger re-renders
    const proxyRef = useRef<R<T>>(null);
    const stateMapRef = useRef<WeakMap<object, PropertyMap>>(new WeakMap());
    const subscribersRef = useRef<Array<Subscriber<T>>>([]);

    let stateMap = stateMapRef.current.get(reactiveStateRef.current);
    if (!stateMap) {
        stateMap = new Map();
        stateMapRef.current.set(reactiveStateRef.current, stateMap);
    }
    syncState(stateMapRef.current, reactiveStateRef.current, stateMap!, reactiveState);

    // Create a proxy for the state object if it doesn't exist
    if (!proxyRef.current) {
        const createReactiveProxy = (target: T): R<T> => {
            const proxy = new Proxy(target, {
                get(obj, prop: string | symbol) {
                    const key = prop as keyof T;

                    if (subscribersRef.current) {
                        for (const subscriber of subscribersRef.current) {
                            if (subscriber.recording) {
                                subscriber.targets.push({ obj, prop: key });
                            }
                        }
                    }

                    // Handle computed properties (getters)
                    const descriptor = Object.getOwnPropertyDescriptor(obj, key);
                    if (descriptor && typeof descriptor.get === "function") {
                        const newValue = descriptor.get.call(proxy);
                        return newValue;
                    }

                    let value: any
                    value = obj[key];

                    // Proxy arrays to trigger updates on mutating methods
                    if (Array.isArray(value)) {
                        return new Proxy(value, {
                            get(arrTarget, arrProp) {
                                const prevValue = [...arrTarget];
                                const arrValue = arrTarget[arrProp as any];

                                // If accessing a possibly mutating array method, return a wrapped function
                                if (typeof arrValue === "function") {
                                    return (...args: any[]) => {
                                        const result = arrValue.apply(arrTarget, args);
                                        if (!isEqual(prevValue, arrTarget)) {
                                            const stateMap = stateMapRef.current?.get(obj);
                                            if (!stateMap?.has(prop as keyof T)) return false;
                                            const [, map, propValue] = stateMap.get(prop as keyof T)!;
                                            if (!isEqual(prevValue, arrTarget)) {
                                                stateMap.set(prop as keyof T, [true, map, propValue]);
                                                obj[prop as keyof T] = arrTarget as any;
                                                setTrigger((prev) => prev + 1);
                                            }
                                        }
                                        return result;
                                    };
                                }
                                return arrValue;
                            },
                        });
                    }

                    // Wrap nested objects in proxies
                    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                        return createReactiveProxy(value as T);
                    }

                    // Ensure functions are bound to the proxy object
                    if (typeof value === "function") {
                        return function (...args: any[]) {
                            return value.apply(proxy, args); // Now correctly bound to the current proxy
                        };
                    }

                    return value;
                },
                set(obj, prop: string | symbol, value) {
                    const stateMap = stateMapRef.current?.get(obj);
                    if (!stateMap?.has(prop as keyof T)) return false;
                    const [, map, propValue] = stateMap.get(prop as keyof T)!;
                    const previousValue = obj[prop as keyof T];
                    if (!isEqual(previousValue, value)) {
                        stateMap.set(prop as keyof T, [true, map, propValue]);
                        obj[prop as keyof T] = value;
                        setTrigger((prev) => prev + 1);
                    }
                    if (subscribersRef.current) {
                        for (const subscriber of subscribersRef.current) {
                            if (!subscriber.recording) {
                                if (subscriber.targets.some(target => target.obj === obj && target.prop === prop)) {
                                    subscriber.callback(prop as keyof T, value, previousValue);
                                }
                            }
                        }
                    }
                    return true;
                },
            });
            const result = proxy as R<T>;
            return result;
        }
        proxyRef.current = createReactiveProxy(reactiveStateRef.current);

        // If we have an init method, call it after creation
        if (init && typeof init === "function") {
            init!.call(proxyRef.current, proxyRef.current);
        }
    }

    // useEffect to handle side effects and cleanup
    if (effect) {
        function getNestedValue<T>(obj: unknown, path?: string): T | undefined {
            return path ? path.split('.').reduce<any>((acc, key) =>
                acc && acc[key.match(/^\d+$/) ? Number(key) : key], obj) : undefined;
        }
        function getDeps(deps?: unknown[]): unknown[] | undefined {
            if (!deps) return undefined;
            return deps.map(prop => (typeof prop === 'symbol') ? getNestedValue(reactiveStateRef.current!, prop.description) : prop);
        }
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
            }, getDeps(deps));
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
                }, getDeps(effectDeps));
            });
        }
    }

    function subscribe(targets: () => unknown | unknown[], callback: C<T>) {
        let result: S<T> = () => undefined;
        if (subscribersRef.current && targets) {
            const subscriber: Subscriber<T> = {
                callback,
                recording: true,
                targets: []
            };
            subscribersRef.current?.push(subscriber);
            if (Array.isArray(targets)) {
                targets.forEach(target => {
                    target();
                });
            } else {
                targets();
            }
            subscriber.recording = false;
            result = () => {
                const index = subscribersRef.current?.indexOf(subscriber);
                if (index !== undefined && index !== -1) {
                    subscribersRef.current?.splice(index, 1);
                }
            };
        }
        return result;
    }

    // Return the reactive proxy object
    return [proxyRef.current, subscribe] as const;
}
