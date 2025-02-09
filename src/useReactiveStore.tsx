import React, { createContext, useContext, useEffect, useState } from "react";
import { useReactive } from "./useReactive"; // Assuming your existing function

/**
 * Creates a globally shared reactive state using React Context and useReactive.
 *
 * @param initialState The initial state object
 * @returns {ReactiveStoreProvider, useReactiveStore} Context provider and hook
 */
export function createReactiveStore<T extends object>(initialState: T) {
    const ReactiveStoreContext = createContext<T | null>(null);
    const ReactiveUpdateContext = createContext<(() => void) | null>(null);

    const ReactiveStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
        const [, forceUpdate] = useState(0);
        const [store] = useReactive(initialState);

        // Override the global state setter to trigger re-renders
        const triggerUpdate = () => forceUpdate((prev) => prev + 1);

        return (
            <ReactiveStoreContext.Provider value={store}>
                <ReactiveUpdateContext.Provider value={triggerUpdate}>
                    {children}
                </ReactiveUpdateContext.Provider>
            </ReactiveStoreContext.Provider>
        );
    };

    const useReactiveStore = (): T => {
        const context = useContext(ReactiveStoreContext);
        const triggerUpdate = useContext(ReactiveUpdateContext);

        if (!context || !triggerUpdate) {
            throw new Error("useReactiveStore must be used within a ReactiveStoreProvider");
        }

        useEffect(() => {
            triggerUpdate(); // Force a re-render on state change
        }, [context]); // Depend on store object

        return context;
    };

    return [ ReactiveStoreProvider, useReactiveStore ] as const;
}
