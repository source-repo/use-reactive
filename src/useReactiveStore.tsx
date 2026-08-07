import React, { createContext, useContext } from "react";
import { useReactive } from "./useReactive";

/**
 * Creates a shared reactive store for a React subtree.
 *
 * Each consumer calls useReactive with the same initial object, so consumers share
 * state while keeping per-component render tracking.
 */
export function createReactiveStore<T extends object>(initialState: T) {
    const ReactiveStoreContext = createContext<T | null>(null);

    const ReactiveStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <ReactiveStoreContext.Provider value={initialState}>
            {children}
        </ReactiveStoreContext.Provider>
    );

    const useReactiveStore = (): T => {
        const storeSeed = useContext(ReactiveStoreContext);
        if (!storeSeed) {
            throw new Error("useReactiveStore must be used within a ReactiveStoreProvider");
        }
        return useReactive(storeSeed);
    };

    return [ReactiveStoreProvider, useReactiveStore] as const;
}
