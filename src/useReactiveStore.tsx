import React, { createContext, useContext, useRef } from "react";
import { useReactive, S, H, RO } from "./useReactive"; // Assuming your existing function

interface ReactiveStoreContext<T> {
    state: T;
    subscribe: S<T>;
    history: H<T>;
}

/**
 * Creates a globally shared reactive state using React Context and useReactive.
 *
 * @param initialState The initial state object
 * @returns {ReactiveStoreProvider, useReactiveStore} Context provider and hook
 */
export function createReactiveStore<T extends object>(initialState: T, options?: RO<T>) {
    const ReactiveStoreContext = createContext<ReactiveStoreContext<T> | null>(null);

    const ReactiveStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
        const [state, subscribe, history] = useReactive(initialState, { ...options, noUseState: true });

        return (
            <ReactiveStoreContext.Provider value={{ state, subscribe, history }}>
                {children}
            </ReactiveStoreContext.Provider>
        );
    };

    const useReactiveStore = (): ReactiveStoreContext<T> => {
        const context = useContext(ReactiveStoreContext);
        if (!context) {
            throw new Error("useReactiveStore must be used within a ReactiveStoreProvider");
        }
        const [, setTrigger] = React.useState(0);
        const proxyProxy = useReactive(context.state, { noUseState: true });
        const subscriptionsRef = useRef<WeakMap<object, Map<string, boolean>> | null>(null);
        if (!subscriptionsRef.current) {
            subscriptionsRef.current = new WeakMap<object, Map<string, boolean>>();
        }
        const removerRef = useRef<() => void | null>(null);
        if (!removerRef.current) {
            removerRef.current = proxyProxy[1](() => proxyProxy[0], function (state, key, _value, _previous, read) {
                let map = subscriptionsRef.current!.get(state);
                if (!map) {
                    map = new Map<string, boolean>();
                    subscriptionsRef.current!.set(state, map);
                }
                if (read && !map.has(key as string)) {
                    map.set(key as string, true);
                    context.subscribe(() => state[key as keyof T], () => {
                        setTrigger((prev: any) => prev + 1);
                    });
                }
            }, 'deep', true)
        }

        return { state: proxyProxy[0], subscribe: context.subscribe, history: context.history };
    }

    return [ReactiveStoreProvider, useReactiveStore] as const;
}
