import { useState, useRef, useEffect } from "react";

type C<T> = (this: T, key: keyof T, value: unknown, previous: unknown) => void;

type S<T> = (targets: () => unknown | unknown[], callback: C<T>) => () => void

// Effect function type
type E<T> = (this: T, state: T) => void | (() => void);

type Subscriber<T> = {
    recording: boolean,
    callback: C<T>,
    targets: {
        obj: object,
        prop: keyof T
    }[]
};

type HE<T> = {
    id: string;
    timestamp: number;
    obj: object;
    key: keyof T;
    previous: unknown;
    value: unknown;
};

type H<T> = {
    enable(enabled?: boolean, maxDepth?: number): HistorySettings;
    undo(index?: number):  void;
    redo(all?: boolean): void;
    revert (index: number): void;
    snapshot(): string | null;
    restore(id: string | null): void;
    clear(): void;
    entries: HE<T>[];
};

type HistorySettings = { enabled: boolean, maxDepth: number };

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
    init?: (this: T, state: T, subscribe: S<T>) => void,
    effect?: E<T> | Array<[E<T>, (this: T) => unknown[]]>,
    deps?: (this: T) => unknown[]
): [T, S<T>, H<T>] {
    if (typeof window === "undefined") {
        throw new Error("useReactive should only be used in the browser");
    }
    const reactiveStateRef = useRef(reactiveState);
    const [, setTrigger] = useState(0); // State updater to trigger re-renders
    const proxyRef = useRef<T>(null);
    const stateMapRef = useRef<WeakMap<object, PropertyMap>>(new WeakMap());
    const subscribersRef = useRef<Array<Subscriber<T>>>([]);
    const history = useRef<HE<T>[]>([]);
    const historyEnabled = useRef<HistorySettings>({ enabled: false, maxDepth: 100 });
    const redoStack = useRef<HE<T>[]>([]);

    let stateMap = stateMapRef.current.get(reactiveStateRef.current);
    if (!stateMap) {
        stateMap = new Map();
        stateMapRef.current.set(reactiveStateRef.current, stateMap);
    }
    syncState(stateMapRef.current, reactiveStateRef.current, stateMap!, reactiveState);

    function subscribe(targets: () => unknown | unknown[], callback: C<T>) {
        let result = () => { };
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

    // Create a proxy for the state object if it doesn't exist
    if (!proxyRef.current) {
        const createReactiveProxy = (target: T): T => {
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
                        if (historyEnabled.current.enabled) {
                            if (history.current.length >= historyEnabled.current.maxDepth)
                                history.current.shift();
                            history.current.push({ id: crypto.randomUUID(), obj: proxy, key: prop as keyof T, previous: previousValue, value, timestamp: Date.now() });
                        }
                        setTrigger((prev) => prev + 1);
                    }
                    if (subscribersRef.current) {
                        for (const subscriber of subscribersRef.current) {
                            if (!subscriber.recording) {
                                if (subscriber.targets.some(target => target.obj === obj && target.prop === prop)) {
                                    subscriber.callback.call(proxy, prop as keyof T, value, previousValue);
                                }
                            }
                        }
                    }
                    return true;
                },
            });
            return proxy;
        }
        proxyRef.current = createReactiveProxy(reactiveStateRef.current);

        // If we have an init method, call it after creation
        if (init && typeof init === "function") {
            init!.call(proxyRef.current, proxyRef.current, subscribe);
        }
    }

    // useEffect to handle side effects and cleanup
    if (effect) {
        function getNestedValue<T>(obj: unknown, path?: string, defaultValue?: T): T | undefined {
            if (!obj || typeof obj !== 'object' || !path) return defaultValue;
        
            // Convert bracket notation to dot notation (e.g., "user.address[0].city" -> "user.address.0.city")
            const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1'); 
        
            return normalizedPath.split('.').reduce<any>((acc, key) => {
                if (acc === null || acc === undefined) return undefined;
                return acc[key];
            }, obj) ?? defaultValue;
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
            }, deps ? getDeps(deps.call(reactiveStateRef.current)) : []);
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
                }, effectDeps ? getDeps(effectDeps.call(reactiveStateRef.current)) : []);
            });
        }
    }

    const enableHistory = (enabled?: boolean, maxDepth?: number) => {
        if (enabled !== undefined) {
            historyEnabled.current.enabled = enabled;
            if (!enabled) {
                history.current = [];
                redoStack.current = [];
            }
        }
        if (maxDepth !== undefined)
            historyEnabled.current.maxDepth = maxDepth;
        return historyEnabled.current;
    };

    const undoLast = () => {
        if (history.current.length === 0) return;
        const lastChange = history.current.pop();
        if (lastChange !== undefined) {
            if (redoStack.current.length >= historyEnabled.current.maxDepth)
                redoStack.current.shift();
            redoStack.current.push({ id: lastChange.id, obj: lastChange.obj, key: lastChange.key, previous: lastChange.previous, value: lastChange.value, timestamp: lastChange.timestamp });
            const savedHistoryEnabled = historyEnabled.current.enabled;
            historyEnabled.current.enabled = false;
            (lastChange.obj as any)[lastChange.key] = lastChange.previous;
            historyEnabled.current.enabled = savedHistoryEnabled;
        }
    };

    const undo = (index?: number) => {
        if (index !== undefined && (index < 0 || index >= history.current.length)) return;
        if (index !== undefined) {
            while (history.current.length > index) {
                undoLast();
            }
        } else {
            undoLast();
        }
    };

    const redo = (all?: boolean) => {
        if (redoStack.current.length === 0) return;
        do {
            const redoChange = redoStack.current.pop();
            if (redoChange) {
                (redoChange.obj as any)[redoChange.key] = redoChange.value;
            }
        } while (all && redoStack.current.length > 0);
    };

    const revert = (index: number) => {
        if (index < 0 || index >= history.current.length) return;
        const entry = history.current[index];
        if (entry) {
            const savedHistoryEnabled = historyEnabled.current.enabled;
            historyEnabled.current.enabled = false;
            (entry.obj as any)[entry.key] = entry.previous;
            historyEnabled.current.enabled = savedHistoryEnabled;
            history.current.splice(index, 1);
        }
    };

    const clear = () => {
        history.current = []
        redoStack.current = []
        setTrigger((prev) => prev + 1);
    }

    const snapshot = () => {
        return history.current.length > 0 ? history.current[history.current.length - 1].id : null;
    };

    const restore = (id: string | null) => {
        let index
        if (id === null) {
            index = 0;
        } else {
            index = history.current.findIndex(entry => (entry.id === id));
        }
        if (index < 0) return;
        redoStack.current = [];
        if (id !== null) {
            while (history.current.length > index + 1) {
                undo();
            }
        } else {
            while (history.current.length > 0) {
                undo();
            }
        }
    };

    // Return the reactive proxy object
    return [proxyRef.current, subscribe, { enable: enableHistory, clear, undo, redo, revert, snapshot, restore, entries: history.current }] as const;
}
