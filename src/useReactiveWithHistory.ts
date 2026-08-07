import { useMemo, useRef } from "react";
import { useReactive } from "./useReactive";

export interface ReactiveHistory<T extends object> {
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    readonly index: number;
    readonly length: number;
    commit(): void;
    undo(): void;
    redo(): void;
    reset(nextState?: Partial<T>): void;
}

type Snapshot = Record<string, unknown>;

function isBehavior(desc: PropertyDescriptor): boolean {
    return !!desc.get || !!desc.set || typeof desc.value === "function";
}

function cloneValue(value: unknown): unknown {
    if (value === null || typeof value !== "object") return value;
    if (value instanceof Date) return new Date(value.getTime());
    if (Array.isArray(value)) return value.map(cloneValue);

    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
        output[key] = cloneValue((value as Record<string, unknown>)[key]);
    }
    return output;
}

function takeSnapshot(value: object): Snapshot {
    const snapshot: Snapshot = {};
    for (const key of Object.keys(value)) {
        const desc = Object.getOwnPropertyDescriptor(value, key);
        if (!desc || isBehavior(desc)) continue;
        snapshot[key] = cloneValue(desc.value);
    }
    return snapshot;
}

function applySnapshot(target: Record<string, unknown>, snapshot: Snapshot): void {
    for (const key of Object.keys(target)) {
        const desc = Object.getOwnPropertyDescriptor(target, key);
        if (desc && isBehavior(desc)) continue;
        if (!(key in snapshot)) delete target[key];
    }
    for (const key of Object.keys(snapshot)) {
        target[key] = cloneValue(snapshot[key]);
    }
}

function mergeSnapshot<T extends object>(base: Snapshot, patch?: Partial<T>): Snapshot {
    return {
        ...base,
        ...(patch ? takeSnapshot(patch) : null),
    };
}

/**
 * Creates a reactive object with explicit snapshot history.
 *
 * History is recorded when `history.commit()` is called. This keeps the core hook simple
 * and avoids depending on mutation-observer internals.
 */
export function useReactiveWithHistory<T extends object>(
    initialState: T
): [state: T, history: ReactiveHistory<T>] {
    const state = useReactive(initialState);
    const historyRef = useRef<Snapshot[] | null>(null);
    const indexRef = useRef(0);

    if (!historyRef.current) {
        historyRef.current = [takeSnapshot(initialState)];
    }

    return useMemo(() => {
        const entries = () => historyRef.current!;

        const history: ReactiveHistory<T> = {
            get canUndo() {
                return indexRef.current > 0;
            },
            get canRedo() {
                return indexRef.current < entries().length - 1;
            },
            get index() {
                return indexRef.current;
            },
            get length() {
                return entries().length;
            },
            commit() {
                const next = takeSnapshot(state);
                entries().splice(indexRef.current + 1);
                entries().push(next);
                indexRef.current = entries().length - 1;
            },
            undo() {
                if (!history.canUndo) return;
                indexRef.current--;
                applySnapshot(state as Record<string, unknown>, entries()[indexRef.current]);
            },
            redo() {
                if (!history.canRedo) return;
                indexRef.current++;
                applySnapshot(state as Record<string, unknown>, entries()[indexRef.current]);
            },
            reset(nextState?: Partial<T>) {
                const next = mergeSnapshot(entries()[0], nextState);
                entries().splice(0, entries().length, next);
                indexRef.current = 0;
                applySnapshot(state as Record<string, unknown>, next);
            },
        };

        return [state, history] as [T, ReactiveHistory<T>];
    }, [state]);
}
