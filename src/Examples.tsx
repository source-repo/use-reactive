import React from "react";
import { useReactive } from "./useReactive.js";
import { createReactiveStore } from "./useReactiveStore.js";

// Example 1: Simple Counter
const Counter = () => {
    const state = useReactive({ count: 0 });

    return (
        <div>
            <h3>Counter</h3>
            <p>Count: {state.count}</p>
            <button onClick={() => state.count++}>Increment</button>
            <button onClick={() => state.count--}>Decrement</button>
        </div>
    );
};

// Example 2: Computed Property
const ComputedPropertyExample = () => {
    const state = useReactive({
        count: 2,
        get double() {
            return this.count * 2;
        },
    });

    return (
        <div>
            _________________________________
            <h3>Computed Property</h3>
            <p>Count: {state.count}</p>
            <p>Double: {state.double}</p>
            <button onClick={() => state.count++}>Increment</button>
        </div>
    );
};

// Example 3: Async State Update
const AsyncExample = () => {
    const state = useReactive({
        count: 0,
        async incrementAsync() {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            this.count++;
        },
    });

    return (
        <div>
            _________________________________
            <h3>Async Update</h3>
            <p>Count: {state.count}</p>
            <button onClick={() => state.incrementAsync()}>Increment Async</button>
        </div>
    );
};

// Example 4: Nested State
const NestedStateExample = () => {
    const state = useReactive({
        nested: { value: 10 },
    });

    return (
        <div>
            _________________________________
            <h3>Nested State</h3>
            <p>Nested Value: {state.nested.value}</p>
            <button onClick={() => state.nested.value++}>Increment Nested</button>
        </div>
    );
};

// Example 5: Single Effect
const SingleEffectExample = () => {
    const state = useReactive(
        { count: 0 },
        undefined,
        function () {
            console.log("Count changed:", this.count);
        },
    );

    return (
        <div>
            _________________________________
            <h3>Single Effect</h3>
            <p>Count: {state.count}</p>
            <button onClick={() => state.count++}>Increment</button>
        </div>
    );
};

// Example 6: Multiple Effects
const MultipleEffectsExample = () => {
    const state = useReactive(
        { count: 0, text: "Hello" },
        undefined,
        [
            [function () { console.log("Count changed:", this.count); }, []],
            [function () { console.log("Text changed:", this.text); }, []],
        ]
    );

    return (
        <div>
            _________________________________
            <h3>Multiple Effects</h3>
            <p>Count: {state.count}</p>
            <p>Text: {state.text}</p>
            <button onClick={() => state.count++}>Increment Count</button>
            <button onClick={() => (state.text = "World")}>Change Text</button>
        </div>
    );
};

// Generic Button Component
interface ControlButtonsProps {
    onIncrement: () => void;
    onDecrement?: () => void;
    incrementLabel: string;
    decrementLabel?: string;
}

const ControlButtons: React.FC<ControlButtonsProps> = ({ onIncrement, onDecrement, incrementLabel, decrementLabel }) => (
    <div>
        <button onClick={onIncrement}>{incrementLabel}</button>
        {onDecrement && <button onClick={onDecrement}>{decrementLabel}</button>}
    </div>
);

// Child component with useReactive using props
interface ReactiveChildProps {
    initialCount: number;
}

const ReactiveChild: React.FC<ReactiveChildProps> = ({ initialCount }) => {
    const state = useReactive(
        { count: initialCount },
        undefined,
        function () {
            console.log("Count changed due to prop update:", this.count);
        },
        ["count"]
    );

    return (
        <div>
            <h3>Reactive Child</h3>
            <p>Count: {state.count}</p>
            <ControlButtons
                onIncrement={() => state.count++}
                incrementLabel="Increment"
            />
        </div>
    );
};

// Example using ReactiveChild to test prop dependency
const EffectDependencyExample = () => {
    const state = useReactive({ count: 0 });

    return (
        <div>
            _________________________________
            <h3>Effect Dependency Example</h3>
            <p>Parent Count: {state.count}</p>
            <ControlButtons
                onIncrement={() => state.count++}
                incrementLabel="Increment Parent"
            />
            <ReactiveChild initialCount={state.count} />
        </div>
    );
};

// Example using ReactiveChild to test prop dependency
const ArrayExample = () => {
    const state = useReactive({
        todos: ['hello'],
        addWorld() {
            this.todos = [...this.todos, ' world'];
        },
        addExclamation() {
            this.todos.push('!');
        }
    });

    return (
        <div>
            _________________________________
            <h3>Array Example</h3>
            <p>todos: {state.todos.map(todo => todo)}</p>
            <button onClick={state.addWorld}>Add world</button>
            <button onClick={state.addExclamation}>Add !</button>
        </div>
    );
};

const [ReactiveStoreProvider, useReactiveStore] = createReactiveStore({
    counter: 0,
    user: { name: "John Doe", age: 30 },
});

function ReactiveStoreUser() {
    const store = useReactiveStore();
    return (
        <div>
            <h2>Reactive store user</h2>
            <p>Name: {store.user.name}, Age: {store.user.age}</p>
            <button onClick={() => store.user.name = "Jane Doe"}>Change name</button>
            <button onClick={() => store.user.age++}>Increment age</button>
        </div>
    );
}

function AnotherReactiveStoreUser() {
    const store = useReactiveStore();
    return (
        <div>
            <h2>Reactive store user</h2>
            <p>Name: {store.user.name}, Age: {store.user.age}</p>
            <button onClick={() => store.user.name = "Jane Doe"}>Change name</button>
            <button onClick={() => store.user.age++}>Increment age</button>
        </div>
    );
}

export const SubscribedCounter = () => {
    const state = useReactive({
        count: 0,
        count2: 0,
    }, 
    function () {
        this.count = 10;
        console.log("SubscribedCounter initialized");
    },
    function () {
        console.log("SubscribedCounter effect");
        this.subscribe(() => [this.count], (key, value, previous) => {
            console.log(`${key} changed from ${previous} to ${value}`);
        });
    }, []);
    state.subscribe(() => [state.count2], (key, value, previous) => {
        console.log(`${key} changed from ${previous} to ${value}`);
    });
    return (
        <div>
            <h3>Subscribed Counter</h3>
            <p>Count: {state.count}</p>
            <button onClick={() => state.count++}>Increment</button>
            <button onClick={() => state.count--}>Decrement</button>
            <button onClick={() => state.count2++}>Increment 2</button>
            <button onClick={() => state.count2--}>Decrement s</button>
        </div>
    );
};

// Super Component to Include All Examples
export const Examples = () => {
    return (
        <div>
            <h2>useReactive Examples</h2>
            <SubscribedCounter />
            <Counter />
            <ComputedPropertyExample />
            <AsyncExample />
            <NestedStateExample />
            <SingleEffectExample />
            <MultipleEffectsExample />
            <EffectDependencyExample />
            <ReactiveStoreProvider>
                <ReactiveStoreUser />
                <AnotherReactiveStoreUser />
            </ReactiveStoreProvider>
            <ArrayExample />
        </div>
    );
};
