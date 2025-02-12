import React, { useState } from "react";
import { useReactive } from "./useReactive.js";
import { createReactiveStore } from "./useReactiveStore.js";

// Example 1: Simple Counter
const Counter = () => {
    const [state] = useReactive({ count: 0 });

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
    const [state] = useReactive({
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
    const [state] = useReactive({
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
    const [state] = useReactive({
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
    const [state] = useReactive(
        { count: 0 },
        undefined,
        function () {
            console.log("Count changed:", this.count);
        },
        function () { 
            return [this!.count]
        }
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
    const [state] = useReactive(
        { count: 0, text: "Hello" },
        undefined,
        [
            [function () { console.log("Count changed:", this.count); }, () => []],
            [function () { console.log("Text changed:", this.text); }, () => []],
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
    const [state] = useReactive(
        { count: initialCount },
        undefined,
        function () {
            console.log("Count changed due to prop update:", this.count);
        },
        function() { return [this.count] }
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
    const [state] = useReactive({ count: 0 });

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
    const [state] = useReactive({
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
    const [state, subscribe] = useReactive({
        count: 0,
        count2: 0,
    }, 
    function () {
        this.count = 10;
        console.log("SubscribedCounter initialized");
    },
    function () {
        console.log("SubscribedCounter effect");
        subscribe(() => [this.count2, this.count], (key, value, previous) => {
            console.log(`${key} changed from ${previous} to ${value}`);
        });
    }, 
    () => []);
    return (
        <div>
            <h3>Subscribed Counter</h3>
            <p>Count: {state.count} Count2: {state.count2}</p>
            <button onClick={() => state.count++}>Increment</button>
            <button onClick={() => state.count--}>Decrement</button>
            <button onClick={() => state.count2++}>Increment 2</button>
            <button onClick={() => state.count2--}>Decrement s</button>
        </div>
    );
};

const SubscribedCounter2 = () => {
    const [state] = useReactive({
        count: 0,
    },
    function (state, subscribe) {
        subscribe(() => [state.count], (key, value, previous) => {
            console.log(`${key} changed from ${previous} to ${value}`);
            console.log(this);
        });    
    });
    return (
        <div>
            <h3>Subscribed Counter2</h3>
            <p>Count: {state.count}</p>
            <button onClick={() => state.count++}>Increment</button>
            <button onClick={() => state.count--}>Decrement</button>
        </div>
    );
};

const TheCheckBox = ({ caption, checked, setChecked }: { caption: string, checked: boolean, setChecked: (checked: boolean) => void }) => {
    return (
        <div>
            <h3>Checkbox</h3>
            <label>
                <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked) } />
                {caption}
            </label>
        </div>
    );
}

const ReactiveHistoryExample = () => {
    const [state, , history] = useReactive({ checked: false, sub: { text1: "", text2: "" } });
    const [historyEnabled, setHistoryEnabled] = useState(false);
    const [snapshot, setSnapshot] = useState<string | null | undefined>(undefined);

    return (
        <div>
            <h2>History</h2>
            <TheCheckBox caption="Some boolean" checked={state.checked} setChecked={(checked) => state.checked = checked} />
            <input
                type="text"
                value={state.sub.text1}
                onChange={(e) => (state.sub.text1 = e.target.value)}
            />
            <p />
            <input
                type="text"
                value={state.sub.text2}
                onChange={(e) => (state.sub.text2 = e.target.value)}
            />
            <br />
            <label>
                <input
                    type="checkbox"
                    checked={historyEnabled}
                    onChange={(e) => {
                        setHistoryEnabled(e.target.checked);
                        history.enable(e.target.checked, 5);
                    }}
                />
                Enable History
            </label>
            <br />
            <button onClick={() => history.undo()} disabled={!historyEnabled}>Undo</button>
            <button onClick={() => history.undo(0)} disabled={!historyEnabled}>Undo all</button>
            <button onClick={() => history.redo()} disabled={!historyEnabled}>Redo</button>
            <button onClick={() => history.redo(true)} disabled={!historyEnabled}>Redo all</button>
            <button onClick={() => history.clear()} disabled={!historyEnabled}>Clear</button>
            <p />
            <button onClick={() => setSnapshot(history.snapshot())} disabled={!historyEnabled}>Take snapshot</button>
            <button onClick={() => history.restore(snapshot!)} disabled={snapshot === undefined || !historyEnabled}>
                Restore snapshot
            </button>
            <h3>Changes:</h3>
            <ul style={{ minHeight: '800px', overflowY: 'scroll' }}>
                {history.entries.map((entry, index) => (
                    <div key={index} style={{ display: 'flex' }}>
                        <li key={entry.id}>
                            [{new Date(entry.timestamp).toLocaleTimeString()}]&nbsp;
                            {entry.key}&nbsp;
                            "{String(entry.previous)}" → "{String(entry.value)}"&nbsp;
                            <button onClick={() => history.revert(index)}>Revert</button>&nbsp;
                            <button onClick={() => history.undo(index)}>Undo to here</button>
                        </li>
                    </div>
                ))}
            </ul>
        </div>
    );
};

const ExampleComponent = () => {
    const [state, , history] = useReactive({ count: 0 });
    history.enable(true);
    return (
        <div>
            <h2>Count: {state.count}</h2>
            <button onClick={() => state.count++}>Increment</button>
            <button onClick={() => history.undo()}>Undo</button>
            <button onClick={() => history.redo()}>Redo</button>
        </div>
    );
};

// Super Component to Include All Examples
export const Examples = () => {
    return (
        <div>
            <h2>useReactive Examples</h2>
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
            <SubscribedCounter />
            <SubscribedCounter2 />
            <ExampleComponent />
            <ReactiveHistoryExample />
        </div>
    );
};
