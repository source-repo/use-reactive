import { useSyncExternalStore } from "react";
import type { Live, LiveContext, LiveKey } from "./core";

export function useLive<TSnapshot>(live: Live<TSnapshot>): TSnapshot {
    return useSyncExternalStore(
        live.subscribe,
        live.getSnapshot,
        live.getSnapshot
    );
}

export function useContextLive<TSnapshot>(
    context: LiveContext,
    key: LiveKey
): TSnapshot {
    const live = useSyncExternalStore(
        context.subscribe,
        () => context.resolve<TSnapshot>(key),
        () => context.resolve<TSnapshot>(key)
    );

    return useLive(live);
}
