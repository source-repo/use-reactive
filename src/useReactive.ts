import { useState, useRef, useEffect } from "react";

// Callback type for subscriber
export type SC<T> = (this: T, state: T, key: string | number | Symbol, value: unknown, previous: unknown, read?: boolean) => void;

// Subscribe function signature
export type S<T> = (targets: () => unknown | unknown[], callback: SC<T>, recursive?: boolean | 'deep', onRead?: boolean) => () => void

// Effect function type
export type E<T> = (this: T, state: T, subscribe: S<T>, history: H<T>) => void | (() => void);

// Options
export interface RO<T> {
    init?: (this: T, state: T, subscribe: S<T>, history: H<T>) => void,
    effects?: Array<[E<T>, (this: T, state: T, subscribe: S<T>, history: H<T>) => unknown[]]>,
    historySettings?: HistorySettings,
    noUseState?: boolean
}

// Subscriber entry
interface SE<T> {
    recording: boolean,
    onRead?: boolean,
    callback: SC<T>,
    targets: {
        obj: object,
        key: keyof T
    }[]
};

// History interface
export interface H<T> {
    enable(enabled?: boolean, maxDepth?: number): HistorySettings;
    undo(index?: number): void;
    redo(all?: boolean): void;
    revert(index: number): void;
    snapshot(): string | null;
    restore(id: string | null): void;
    clear(): void;
    entries: HE<T>[];
};

// History entry
export interface HE<T> {
    id: string;
    timestamp: number;
    obj: object;
    key: keyof T;
    previous: unknown;
    value: unknown;
};

// History settings
export interface HistorySettings {
    enabled?: boolean;
    maxDepth?: number
};

/**
 * Map for storing data about each property
 * key: Property key
 * value: [updateFlag, childMap, propValue]
 * 
 * The updateFlag is used to track changes in the property value done via the proxy (as opposed to from props).
 */
type PropertyMap = Map<string | number | symbol, [boolean, PropertyMap | undefined, any]>;

// Utility function to compare two objects
function isEqual(x: any, y: any): boolean {
    const ok = Object.keys, tx = typeof x, ty = typeof y;
    return x && y && tx === 'object' && tx === ty ? (
        ok(x).length === ok(y).length &&
        ok(x).every(key => isEqual(x[key], y[key]))
    ) : (x === y);
}

export const STATE_VERSION = Symbol("stateVersion");
export const PROXY_VERSIONS = Symbol("storeVersion");

export interface ReactiveObjectVersion {
    [STATE_VERSION]?: number;
    [PROXY_VERSIONS]?: Map<object, { version: number, state?: object }>;
}

/**
 * Recursively synchronizes and updates a structure containing information about each property.
 * - Tracks state changes and updates properties accordingly.
 * - Supports nested objects, while avoiding functions and getters.
 * - Uses a WeakMap for tracking object property maps.
 *
 * @param obj - The target object whose properties are being tracked.
 * @param stateMapRef - A WeakMap that associates objects with their corresponding property maps.
 * @param stateMap - A Map storing metadata about properties, including modification status and last known value.
 * @param newObj - An optional new object to compare against and apply updates from.
 */
const syncState = <T extends object>(
    obj: T,
    stateMapRef: WeakMap<object, PropertyMap>,
    stateMap: PropertyMap,
    newObj?: T
): void => {
    for (const key of Object.keys(obj) as (keyof T)[]) {
        let descriptor = Object.getOwnPropertyDescriptor(obj, key);
        if (newObj) {
            const newDescriptor = Object.getOwnPropertyDescriptor(newObj, key);
            if (newDescriptor) {
                descriptor = newDescriptor;
            }
        }

        // Determine if the property is a function or getter
        const isFunction = descriptor?.value && typeof descriptor.value === "function";
        const isGetter = descriptor?.get && typeof descriptor.get === "function";

        if (isFunction || isGetter) {
            // Re-define getters and functions without modifications
            Object.defineProperty(obj, key, descriptor!);
            continue;
        }

        const value = obj[key];

        // Handle primitive values and arrays
        if (typeof value !== "object" || Array.isArray(value)) {
            if (typeof value === "function") continue; // Redundant check for safety

            // Retrieve stored property metadata
            const [modifiedFlag, , lastPropValue] = stateMap.get(key) || [undefined, undefined, undefined];
            const newValue = newObj ? newObj[key] : value;
            const propValueChanged = !isEqual(lastPropValue, newValue);

            // Update the object property if it has changed
            if (newObj && propValueChanged && obj[key] !== newValue) {
                obj[key] = newValue;
            }

            // Update state tracking map
            stateMap.set(key, [modifiedFlag ?? false, undefined, newValue]);
        } else {
            // Handle nested objects
            let childStateMap = stateMap.get(key)?.[1];

            if (!childStateMap) {
                childStateMap = new Map();
                stateMap.set(key, [false, childStateMap, value]);
            }

            // Track nested object in the WeakMap
            stateMapRef.set(value as T, childStateMap);

            // Recursively sync nested properties
            syncState(value as T, stateMapRef, childStateMap, newObj ? (newObj[key] as T) : undefined);
        }
    }
};

/**
 * useReactive - A custom React hook that creates a reactive state object.
 * 
 * This hook provides a proxy-based reactive state that triggers re-renders
 * when properties change. It also supports computed properties (getters),
 * hot module reloading (HMR) synchronization, and optional side effects.
 * 
 * @param inputState - The initial state object.
 * @param effect - Optional effect function that runs when dependencies change.
 * @param deps - Dependencies array for triggering reactivity updates.
 * @returns A reactive proxy of the state object.
 */
export function useReactive<T extends object>(
    inputState: T,
    options?: RO<T>
): [T, S<T>, H<T>] {
    if (typeof window === "undefined") {
        throw new Error("useReactive should only be used in the browser");
    }
    const reactiveStateRef = useRef<T & ReactiveObjectVersion>(inputState);
    const [, setTriggerF] = useState(0); // State updater to trigger re-renders
    const setTrigger = (foo: (prev: number) => number) => { 
        if (!options?.noUseState) {
            setTriggerF(foo)
        }   
    };
    const proxyRef = useRef<T>(null);
    const versionMapRef = useRef(new WeakMap<object, number>());
    const nestedproxyrefs = useRef<Map<object, T>>(new Map());
    const stateMapRef = useRef<WeakMap<object, PropertyMap>>(new WeakMap());
    const subscribersRef = useRef<Array<SE<T>>>([]);
    const historyRef = useRef<HE<T>[]>([]);
    const historySettingsRef = useRef<HistorySettings>({ enabled: false, maxDepth: 100 });
    const redoStack = useRef<HE<T>[]>([]);

    if (options?.historySettings?.enabled)
        historySettingsRef.current.enabled = options.historySettings.enabled;
    if (options?.historySettings?.maxDepth)
        historySettingsRef.current.maxDepth = options.historySettings.maxDepth;

    let stateMap = stateMapRef.current.get(reactiveStateRef.current);
    if (!stateMap) {
        stateMap = new Map();
        stateMapRef.current.set(reactiveStateRef.current, stateMap);
    }
    // Sync the current state with the input object
    syncState(reactiveStateRef.current, stateMapRef.current, stateMap!, inputState);

    // Subscribe to the state object and track changes
    function subscribe(targets: () => unknown | unknown[], callback: SC<T>, recursive?: boolean | 'deep', onRead?: boolean) {
        let result = () => { };
        if (subscribersRef.current && targets) {
            // Create a new subscriber object, start recording target accesses
            const subscriber: SE<T> = {
                callback,
                recording: true,
                onRead,
                targets: []
            };
            // Add the subscriber to the list
            subscribersRef.current?.push(subscriber);
            // Get the target object
            const target = targets();
            // Handle nested targets
            if (recursive === 'deep' || recursive === true) {
                // Iterate over all properties of the target object except functions and getters, also possibly handle nested objects
                function iterate(target: { [key: string]: unknown }) {
                    for (const key of Object.keys(target)) {
                        const descriptor = Object.getOwnPropertyDescriptor(target, key);
                        const isFunction = descriptor?.value && typeof descriptor.value === "function";
                        const isGetter = descriptor?.get && typeof descriptor.get === "function";
                        if (isFunction || isGetter) {
                            continue;
                        }
                        const value = target[key];
                        if (recursive === 'deep' && typeof value === "object" && !Array.isArray(value)) {
                            iterate(value as { [key: string]: unknown });
                        }
                    }
                }
                if (target && typeof target === 'object' && !Array.isArray(target)) {
                    iterate(target as { [key: string]: unknown });
                } if (target && typeof target === 'object' && Array.isArray(target)) {
                    for (const value of target) {
                        if (typeof value === 'object' && !Array.isArray(value)) {
                            iterate(value as { [key: string]: unknown });
                        }
                    }
                }
            }
            // Stop recording target accesses
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

    // History functions

    // Enable/disable history
    const enableHistory = (enabled?: boolean, maxDepth?: number) => {
        if (enabled !== undefined) {
            historySettingsRef.current.enabled = enabled;
            if (!enabled) {
                historyRef.current = [];
                redoStack.current = [];
            }
        }
        if (maxDepth !== undefined)
            historySettingsRef.current.maxDepth = maxDepth;
        return historySettingsRef.current;
    };

    // Undo/redo functions

    // Undo the last change
    const undoLast = () => {
        if (historyRef.current.length === 0) return;
        const lastChange = historyRef.current.pop();
        if (lastChange !== undefined) {
            if (redoStack.current.length >= (historySettingsRef.current.maxDepth ?? 100))
                redoStack.current.shift();
            redoStack.current.push({ id: lastChange.id, obj: lastChange.obj, key: lastChange.key, previous: lastChange.previous, value: lastChange.value, timestamp: lastChange.timestamp });
            const savedHistoryEnabled = historySettingsRef.current.enabled;
            historySettingsRef.current.enabled = false;
            (lastChange.obj as any)[lastChange.key] = lastChange.previous;
            historySettingsRef.current.enabled = savedHistoryEnabled;
        }
    };

    // Undo the last change or a specific change
    const undo = (index?: number) => {
        if (index !== undefined && (index < 0 || index >= historyRef.current.length)) return;
        if (index !== undefined) {
            while (historyRef.current.length > index) {
                undoLast();
            }
        } else {
            undoLast();
        }
    };

    // Redo the last undone change (or all undone changes)
    const redo = (all?: boolean) => {
        if (redoStack.current.length === 0) return;
        do {
            const redoChange = redoStack.current.pop();
            if (redoChange) {
                (redoChange.obj as any)[redoChange.key] = redoChange.value;
            }
        } while (all && redoStack.current.length > 0);
    };

    // Revert to a specific change
    const revert = (index: number) => {
        if (index < 0 || index >= historyRef.current.length) return;
        const entry = historyRef.current[index];
        if (entry) {
            const savedHistoryEnabled = historySettingsRef.current.enabled;
            historySettingsRef.current.enabled = false;
            (entry.obj as any)[entry.key] = entry.previous;
            historySettingsRef.current.enabled = savedHistoryEnabled;
            historyRef.current.splice(index, 1);
        }
    };

    // Clear the history
    const clear = () => {
        historyRef.current = []
        redoStack.current = []
        setTrigger((prev) => prev + 1);
    }

    // Get the current snapshot
    const snapshot = () => {
        return historyRef.current.length > 0 ? historyRef.current[historyRef.current.length - 1].id : null;
    };

    // Restore a specific snapshot
    const restore = (id: string | null) => {
        let index
        if (id === null) {
            index = 0;
        } else {
            index = historyRef.current.findIndex(entry => (entry.id === id));
        }
        if (index < 0) return;
        redoStack.current = [];
        if (id !== null) {
            while (historyRef.current.length > index + 1) {
                undo();
            }
        } else {
            while (historyRef.current.length > 0) {
                undo();
            }
        }
    };

    // History object
    const history = { enable: enableHistory, clear, undo, redo, revert, snapshot, restore, entries: historyRef.current }

    // Create a proxy for the state object if it doesn't exist
    if (!proxyRef.current) {
        const createReactiveProxy = (target: T & ReactiveObjectVersion): T => {
            if (target[STATE_VERSION] === undefined) {
                target[STATE_VERSION] = 0;
            }
            const proxy = new Proxy(target, {
                get(obj, prop: string | symbol, receiver) {
                    const key = prop as keyof T;
                    if (typeof key === "symbol") {
                        return Reflect.get(obj, prop, receiver);
                    }

                    if (subscribersRef.current) {
                        for (const subscriber of subscribersRef.current) {
                            if (subscriber.recording) {
                                const exists = subscriber.targets.some(target => target.obj === obj && target.key === key);
                                if (!exists) {
                                    subscriber.targets.push({ obj, key });
                                }
                            }
                        }
                    }
                    let value: any

                    // Handle computed properties (getters)
                    const descriptor = Object.getOwnPropertyDescriptor(obj, key);
                    const isFunction = descriptor?.value && typeof descriptor.value === "function";
                    const isGetter = descriptor?.get && typeof descriptor.get === "function";
                    if (isGetter) {
                        value = descriptor.get!.call(proxy);
                    } else
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
                        let result = nestedproxyrefs.current.get(value);
                        if (!result) {
                            result = createReactiveProxy(value as T);
                            nestedproxyrefs.current.set(value, result);
                        }
                        return result;
                    }

                    // Ensure functions are bound to the proxy object
                    if (isFunction) {
                        return function (...args: any[]) {
                            return value.apply(proxy, args); // Now correctly bound to the current proxy
                        };
                    }

                    if (subscribersRef.current) {
                        for (const subscriber of subscribersRef.current) {
                            if (subscriber.onRead && !subscriber.recording) {
                                if (subscriber.targets.some(target => target.obj === obj && target.key === prop)) {
                                    subscriber.callback.call(proxy, proxy, prop as keyof T, value, value, true);
                                }
                            }
                        }
                    }

                    return value;
                },
                set(obj, prop: string | symbol, value, receiver) {
                    if (typeof prop === "symbol") {
                        Reflect.set(obj, prop, value);
                        return true;
                    }
                    const stateMap = stateMapRef.current?.get(obj);
                    if (!stateMap?.has(prop as keyof T)) return false;
                    const [, map, propValue] = stateMap.get(prop as keyof T)!;

                    const previousValue = obj[prop as keyof T];
                    if (!isEqual(previousValue, value)) {
                        // Check for other users of the same object
                        if (obj[STATE_VERSION] && obj[PROXY_VERSIONS] && obj[PROXY_VERSIONS].size > 1) {
                            obj[STATE_VERSION]++;
                            let copy;
                            for (const [userProxy, item] of obj[PROXY_VERSIONS]) {
                                if (userProxy !== receiver && item.version === obj[STATE_VERSION]) {
                                    // Make a shallow copy once
                                    if (!copy)
                                        copy = { ...obj };
                                    item.state = copy;
                                    item.version = obj[STATE_VERSION];
                                }
                            }
                        }

                        stateMap.set(prop as keyof T, [true, map, propValue]);
                        obj[prop as keyof T] = value;

                        obj[STATE_VERSION]!++;
                        versionMapRef.current.set(proxy, target[STATE_VERSION]!);

                        if (historySettingsRef.current.enabled) {
                            if (historyRef.current.length >= (historySettingsRef.current.maxDepth ?? 100))
                                historyRef.current.shift();
                            historyRef.current.push({ id: crypto.randomUUID(), obj: proxy, key: prop as keyof T, previous: previousValue, value, timestamp: Date.now() });
                        }
                        setTrigger((prev) => prev + 1);
                    }
                    if (subscribersRef.current) {
                        for (const subscriber of subscribersRef.current) {
                            if (!subscriber.recording) {
                                if (subscriber.targets.some(target => target.obj === obj && target.key === prop)) {
                                    subscriber.callback.call(proxy, proxy, prop as keyof T, value, previousValue, false);
                                }
                            }
                        }
                    }
                    return true;
                },
            });
            versionMapRef.current.set(proxy, target[STATE_VERSION] ?? 0);

            // Store the current version of the state
            const currentVersion = target[STATE_VERSION] ?? 0;

            // Create a map of used target version for each proxy using the target
            if (!target[PROXY_VERSIONS]) {
                target[PROXY_VERSIONS] = new Map();
            }
            // Save the proxy and the version of the target
            (target[PROXY_VERSIONS]).set(proxy, { version: currentVersion });

            return proxy;
        }
        proxyRef.current = createReactiveProxy(reactiveStateRef.current);

        // If we have an init method, call it after creation
        if (options?.init && typeof options?.init === "function") {
            options.init.call(proxyRef.current, proxyRef.current, subscribe, history);
        }
    }

    // useEffect to handle side effects and cleanup
    if (options?.effects) {
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
        // Multiple effect/dependency pairs
        for (const [effectF, effectDeps] of options.effects) {
            useEffect(() => {
                let cleanup: (() => void) | void;
                if (effectF && proxyRef.current) {
                    cleanup = effectF.apply(proxyRef.current, [proxyRef.current, subscribe, history]);
                }
                return () => {
                    if (cleanup) cleanup();
                };
            }, effectDeps ? getDeps(effectDeps.call(reactiveStateRef.current, reactiveStateRef.current, subscribe, history)) : []);
        }
    }

    // Return the reactive proxy object etc
    return [proxyRef.current, subscribe, history] as const;
}
