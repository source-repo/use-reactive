import { useEffect, useLayoutEffect, useRef } from "react";
import { proxy as createValtioProxy } from "valtio/vanilla";
import { useSnapshot } from "valtio/react";

type BehaviorMap = Map<string | symbol, PropertyDescriptor>;

interface Instance<T extends object> {
    store: T;
    state: T;
    snap: object | null;
    rendering: boolean;
    boundFns: Map<string | symbol, { source: Function, bound: Function }>;
}

const storeCache = new WeakMap<object, object>();
const stores = new WeakSet<object>();
const storeBehaviors = new WeakMap<object, BehaviorMap>();

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function isBehavior(desc: PropertyDescriptor): boolean {
    return !!desc.get || !!desc.set || typeof desc.value === "function";
}

function cloneData(value: unknown): unknown {
    if (value === null || typeof value !== "object") return value;
    if (value instanceof Date) return new Date(value.getTime());
    if (Array.isArray(value)) return value.map(cloneData);

    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
        const desc = Object.getOwnPropertyDescriptor(value, key);
        if (!desc || isBehavior(desc)) continue;
        output[key] = cloneData(desc.value);
    }
    return output;
}

function refreshBehaviors(store: object, input: object): void {
    let behaviors = storeBehaviors.get(store);
    if (!behaviors) {
        behaviors = new Map();
        storeBehaviors.set(store, behaviors);
    }

    behaviors.clear();
    for (const key of Reflect.ownKeys(input)) {
        const desc = Object.getOwnPropertyDescriptor(input, key);
        if (!desc || !isBehavior(desc)) continue;
        behaviors.set(key, desc);
    }
}

function getBehavior(store: object, prop: string | symbol): PropertyDescriptor | undefined {
    return storeBehaviors.get(store)?.get(prop);
}

function makeState<T extends object>(inst: Instance<T>): T {
    return new Proxy(inst.store, {
        get(_target, prop) {
            const behavior = getBehavior(inst.store, prop);
            if (behavior) {
                if (behavior.get) return behavior.get.call(inst.state);

                const fn = behavior.value as Function;
                let bound = inst.boundFns.get(prop);
                if (!bound || bound.source !== fn) {
                    bound = {
                        source: fn,
                        bound: (...args: unknown[]) => fn.apply(inst.state, args),
                    };
                    inst.boundFns.set(prop, bound);
                }
                return bound.bound;
            }

            const source = inst.rendering && inst.snap ? inst.snap : inst.store;
            return Reflect.get(source, prop);
        },
        set(_target, prop, value) {
            const behavior = getBehavior(inst.store, prop);
            if (behavior?.set) {
                behavior.set.call(inst.state, value);
                return true;
            }
            if (behavior?.get) return false;

            Reflect.set(inst.store, prop, value);
            return true;
        },
        deleteProperty(_target, prop) {
            const behaviors = storeBehaviors.get(inst.store);
            if (behaviors?.delete(prop)) return true;
            return Reflect.deleteProperty(inst.store, prop);
        },
        has(_target, prop) {
            return !!getBehavior(inst.store, prop) || Reflect.has(inst.store, prop);
        },
        ownKeys() {
            const keys = new Set(Reflect.ownKeys(inst.store));
            storeBehaviors.get(inst.store)?.forEach((_desc, key) => keys.add(key));
            return [...keys];
        },
        getOwnPropertyDescriptor(_target, prop) {
            const desc = getBehavior(inst.store, prop) || Reflect.getOwnPropertyDescriptor(inst.store, prop);
            return desc ? { ...desc, configurable: true } : undefined;
        },
    }) as T;
}

function getStore<T extends object>(input: T): T {
    if (stores.has(input)) return input;

    let store = storeCache.get(input) as T | undefined;
    if (!store) {
        store = createValtioProxy(cloneData(input) as T);
        stores.add(store);
        storeCache.set(input, store);
    }

    refreshBehaviors(store, input);
    return store;
}

function createInstance<T extends object>(input: T): Instance<T> {
    const store = getStore(input);
    const inst: Instance<T> = {
        store,
        state: null as unknown as T,
        snap: null,
        rendering: false,
        boundFns: new Map(),
    };

    inst.state = makeState(inst);
    return inst;
}

/**
 * Creates a reactive object for React components.
 *
 * Data lives in a Valtio proxy store, while root-level methods and accessors stay as
 * user-authored behavior bound to the returned reactive object.
 */
export function useReactive<T extends object>(inputState: T): T {
    const instRef = useRef<Instance<T> | null>(null);
    if (!instRef.current) {
        instRef.current = createInstance(inputState);
    }

    const inst = instRef.current;
    if ((inputState as object) !== (inst.store as object)) {
        refreshBehaviors(inst.store, inputState);
    }

    inst.rendering = true;
    inst.snap = useSnapshot(inst.store, { sync: true }) as object;

    useIsoLayoutEffect(() => {
        inst.rendering = false;
    });

    return inst.state;
}
