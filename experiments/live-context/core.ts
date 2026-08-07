export type LiveKey = string;
export type LivePath = Array<string | number | symbol>;
export type Unsubscribe = () => void;
export type MaybePromise<T> = T | Promise<T>;

export type LiveWrite =
    | { type: "set"; path: LivePath; value: unknown }
    | { type: "delete"; path: LivePath };

export interface LiveMeta {
    key?: LiveKey;
    owner?: string;
    location?: "local" | "remote";
}

export interface Live<TSnapshot> {
    getSnapshot(): TSnapshot;
    subscribe(listener: () => void): Unsubscribe;
}

export interface LiveBinding<TSnapshot, TCommands = Record<string, never>> extends Live<TSnapshot> {
    readonly commands: TCommands;
    readonly meta?: LiveMeta;
}

export interface LiveContext {
    provide<TSnapshot, TCommands>(
        key: LiveKey,
        binding: LiveBinding<TSnapshot, TCommands>
    ): Unsubscribe;
    resolve<TSnapshot, TCommands = Record<string, never>>(
        key: LiveKey
    ): LiveBinding<TSnapshot, TCommands>;
    child(): LiveContext;
    subscribe(listener: () => void): Unsubscribe;
}

export interface LocalLive<TState extends object, TCommands = Record<string, never>>
    extends LiveBinding<TState, TCommands> {
    readonly state: TState;
    publish(snapshot: TState): void;
    apply(write: LiveWrite): void;
}

function notify(listeners: Set<() => void>): void {
    for (const listener of [...listeners]) listener();
}

function cloneValue<T>(value: T): T {
    if (value === null || typeof value !== "object") return value;
    if (value instanceof Date) return new Date(value.getTime()) as T;
    if (Array.isArray(value)) return value.map(cloneValue) as T;

    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
        output[key] = cloneValue((value as Record<string, unknown>)[key]);
    }
    return output as T;
}

function getAtPath(root: unknown, path: LivePath): unknown {
    let current = root as Record<PropertyKey, unknown>;
    for (const part of path) {
        if (current == null) return undefined;
        current = current[part] as Record<PropertyKey, unknown>;
    }
    return current;
}

function setAtPath(root: unknown, path: LivePath, value: unknown): void {
    let current = root as Record<PropertyKey, unknown>;
    for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]] as Record<PropertyKey, unknown>;
    }
    current[path[path.length - 1]] = cloneValue(value);
}

function deleteAtPath(root: unknown, path: LivePath): void {
    let current = root as Record<PropertyKey, unknown>;
    for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]] as Record<PropertyKey, unknown>;
    }
    delete current[path[path.length - 1]];
}

function applyWrite<TState extends object>(snapshot: TState, write: LiveWrite): TState {
    const next = cloneValue(snapshot);
    if (write.type === "set") setAtPath(next, write.path, write.value);
    else deleteAtPath(next, write.path);
    return next;
}

function proxyForPath<TState extends object>(
    readRoot: () => TState,
    write: (operation: LiveWrite) => void,
    path: LivePath
): object {
    return new Proxy(
        {},
        {
            get(_target, prop) {
                const value = getAtPath(readRoot(), [...path, prop]);
                if (value !== null && typeof value === "object") {
                    return proxyForPath(readRoot, write, [...path, prop]);
                }
                return value;
            },
            set(_target, prop, value) {
                write({ type: "set", path: [...path, prop], value });
                return true;
            },
            deleteProperty(_target, prop) {
                write({ type: "delete", path: [...path, prop] });
                return true;
            },
            has(_target, prop) {
                const parent = getAtPath(readRoot(), path);
                return parent !== null && typeof parent === "object" && prop in parent;
            },
            ownKeys() {
                const value = getAtPath(readRoot(), path);
                return value !== null && typeof value === "object" ? Reflect.ownKeys(value) : [];
            },
            getOwnPropertyDescriptor(_target, prop) {
                const value = getAtPath(readRoot(), path);
                if (value === null || typeof value !== "object") return undefined;
                const desc = Object.getOwnPropertyDescriptor(value, prop);
                return desc ? { ...desc, configurable: true } : undefined;
            },
        }
    );
}

export function createLiveContext(parent?: LiveContext): LiveContext {
    const bindings = new Map<LiveKey, LiveBinding<unknown, unknown>>();
    const listeners = new Set<() => void>();

    return {
        provide(key, binding) {
            bindings.set(key, binding as LiveBinding<unknown, unknown>);
            notify(listeners);
            return () => {
                if (bindings.get(key) === binding) {
                    bindings.delete(key);
                    notify(listeners);
                }
            };
        },
        resolve<TSnapshot, TCommands = Record<string, never>>(key: LiveKey) {
            const local = bindings.get(key);
            if (local) return local as LiveBinding<TSnapshot, TCommands>;
            if (parent) return parent.resolve<TSnapshot, TCommands>(key);
            throw new Error(`No live binding for "${key}"`);
        },
        child() {
            return createLiveContext(this);
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}

export function createLocalLive<TState extends object, TCommands = Record<string, never>>(
    initialState: TState,
    commands = {} as TCommands,
    meta?: LiveMeta
): LocalLive<TState, TCommands> {
    let snapshot = cloneValue(initialState);
    const listeners = new Set<() => void>();

    const live: LocalLive<TState, TCommands> = {
        commands,
        meta: { ...meta, location: meta?.location ?? "local" },
        state: proxyForPath(
            () => snapshot,
            (write) => live.apply(write),
            []
        ) as TState,
        getSnapshot() {
            return snapshot;
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        publish(nextSnapshot) {
            snapshot = cloneValue(nextSnapshot);
            notify(listeners);
        },
        apply(write) {
            snapshot = applyWrite(snapshot, write);
            notify(listeners);
        },
    };

    return live;
}

export const liveInternals = {
    applyWrite,
    cloneValue,
    notify,
    proxyForPath,
};
