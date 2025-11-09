import React, { createContext, useContext, useRef } from "react";
import { useReactive, S, H, RO } from "./useReactive"; // Assuming your existing function

/**
 * The context object for the reactive store.
 */
type ReactiveStoreContext<T> = [
    state: T,
    subscribe: S<T>,
    history: H<T>
];

/**
 * Creates a globally shared reactive state using React Context and useReactive.
 *
 * @param initialState The initial state object
 * @returns {ReactiveStoreProvider, useReactiveStore} Context provider and hook
 */
export function createReactiveStore<T extends object>(initialState: T, options?: RO<T>) {
    // Create the context and provider
    const ReactiveStoreContext = createContext<ReactiveStoreContext<T> | null>(null);    
    const ReactiveStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
        // Create the reactive state
        const [state, subscribe, history] = useReactive(initialState, { ...options, noUseState: true });
        // Return the provider
        return (
            <ReactiveStoreContext.Provider value={[ state, subscribe, history ]}>
                {children}
            </ReactiveStoreContext.Provider>
        );
    };

    /**
     * Hook to access the reactive state and subscribe to changes.
     *
     * @returns {ReactiveStoreContext<T>} The reactive state and subscribe function
     */
    const useReactiveStore = (): ReactiveStoreContext<T> => {
        const context = useContext(ReactiveStoreContext);
        if (!context) {
            throw new Error("useReactiveStore must be used within a ReactiveStoreProvider");
        }
        const [contextStore, contextSubscribe, contextHistory] = context;
        // Create a trigger to force updates
        const [, setTrigger] = React.useState(0);
        // Create a proxy to track the subscriptions
        const [store, subscribe, history] = useReactive(contextStore, { noUseState: true });
        // Track the subscriptions
        const subscriptionsRef = useRef<WeakMap<object, Map<string, boolean>> | null>(null);
        if (!subscriptionsRef.current) {
            subscriptionsRef.current = new WeakMap<object, Map<string, boolean>>();
        }
        const removerRef = useRef<() => void | null>(null);
        if (!removerRef.current) {
            // Subscribe to the proxy to track the subscriptions
            removerRef.current = subscribe(() => store, function (state, key, _value, _previous, read) {
                // Get the map of subscriptions for the state
                let map = subscriptionsRef.current!.get(state);
                if (!map) {
                    // Create a new map if it doesn't exist
                    map = new Map<string, boolean>();
                    subscriptionsRef.current!.set(state, map);
                }
                // Check if the key is not already subscribed
                if (read && !map.has(key as string)) {
                    // Subscribe to the key
                    map.set(key as string, true);                    
                    contextSubscribe(() => state[key as keyof T], () => {
                        setTrigger((prev: any) => prev + 1);
                    });
                }
            }, 'deep', true)
        }      
        return [ store, contextSubscribe, contextHistory ] as const;
    }
    return [ReactiveStoreProvider, useReactiveStore] as const;
}
