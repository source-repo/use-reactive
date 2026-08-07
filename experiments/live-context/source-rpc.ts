import type {
    LiveBinding,
    LiveMeta,
    LiveWrite,
    MaybePromise,
    Unsubscribe,
} from "./core";
import { liveInternals } from "./core";

export type RemoteWritePolicy = "confirmed" | "optimistic";

export interface SourceRpcLiveSource<TState extends object, TCommands> {
    readonly initialSnapshot: TState;
    readonly commands: TCommands;
    readonly meta?: LiveMeta;
    subscribeSnapshots(listener: (snapshot: TState) => void): MaybePromise<Unsubscribe>;
    mutate?(write: LiveWrite): MaybePromise<void>;
    onError?(error: unknown, write?: LiveWrite): void;
}

export interface SourceRpcLiveBinding<TState extends object, TCommands>
    extends LiveBinding<TState, TCommands> {
    readonly state: TState;
    connect(): Promise<Unsubscribe>;
    publishRemoteSnapshot(snapshot: TState): void;
}

export interface SourceRpcLiveOptions {
    writePolicy?: RemoteWritePolicy;
}

export function createSourceRpcLiveBinding<TState extends object, TCommands>(
    source: SourceRpcLiveSource<TState, TCommands>,
    options: SourceRpcLiveOptions = {}
): SourceRpcLiveBinding<TState, TCommands> {
    const writePolicy = options.writePolicy ?? "confirmed";
    let snapshot = liveInternals.cloneValue(source.initialSnapshot);
    const listeners = new Set<() => void>();

    const publish = (nextSnapshot: TState) => {
        snapshot = liveInternals.cloneValue(nextSnapshot);
        liveInternals.notify(listeners);
    };

    const sendWrite = (write: LiveWrite) => {
        if (!source.mutate) {
            throw new Error("This Source RPC live binding is read-only");
        }

        if (writePolicy === "optimistic") {
            snapshot = liveInternals.applyWrite(snapshot, write);
            liveInternals.notify(listeners);
        }

        Promise.resolve(source.mutate(write)).catch((error) => {
            source.onError?.(error, write);
        });
    };

    const binding: SourceRpcLiveBinding<TState, TCommands> = {
        commands: source.commands,
        meta: { ...source.meta, location: "remote" },
        state: liveInternals.proxyForPath(
            () => snapshot,
            sendWrite,
            []
        ) as TState,
        getSnapshot() {
            return snapshot;
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        async connect() {
            const unsubscribe = await source.subscribeSnapshots((nextSnapshot) => {
                publish(nextSnapshot);
            });
            return unsubscribe;
        },
        publishRemoteSnapshot(snapshot) {
            publish(snapshot);
        },
    };

    return binding;
}
