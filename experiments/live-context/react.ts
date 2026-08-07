import { useSyncExternalStore } from "react";
import type { Live, LiveContext, LiveToken } from "./core";

export function useLive<TSnapshot>(live: Live<TSnapshot>): TSnapshot {
    return useSyncExternalStore(
        live.subscribe,
        live.getSnapshot,
        live.getSnapshot
    );
}

export function useContextLive<TSnapshot, TCommands = Record<string, never>>(
    context: LiveContext,
    token: LiveToken<TSnapshot, TCommands>
): TSnapshot {
    const live = useSyncExternalStore(
        context.subscribe,
        () => context.resolve(token),
        () => context.resolve(token)
    );

    return useLive(live);
}
