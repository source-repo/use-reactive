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
        {
            effects: [[
                function () {
                    console.log("Count changed:", this.count);
                },
                function () {
                    return [this!.count]
                }
            ]]
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
        {
            effects: [
                [function () { console.log("Count changed:", this.count); }, () => []],
                [function () { console.log("Text changed:", this.text); }, () => []],
            ]
        }
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
        {
            init() {
                console.log("Count changed due to prop update:", this.count);
            },
        }
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
}, { init(_state, _subscribe, history) { history.enable(true) }  });

function ReactiveStoreUser() {
    const store = useReactiveStore();
    return (
        <div>
            _________________________________
            <h3>Reactive store user</h3>
            <p>Name: {store.state.user.name}, Age: {store.state.user.age}</p>
            <button onClick={() => store.state.user.name = "Jane Doe"}>Change name</button>
            <button onClick={() => store.state.user.age++}>Increment age</button>
            <button onClick={() => store.history.undo()}>Undo</button>
        </div>
    );
}

function AnotherReactiveStoreUser() {
    const store = useReactiveStore();
    return (
        <div>
            <h3>Another Reactive store user</h3>
            <p>Name: {store.state.user.name}, Age: {store.state.user.age}</p>
            <button onClick={() => store.state.user.name = "Jane Doe"}>Change name</button>
            <button onClick={() => store.state.user.age++}>Increment age</button>
            <button onClick={() => store.history.redo()}>Redo</button>
        </div>
    );
}

export const SubscribedCounter = () => {
    const [items, setItems] = useState<Array<string>>([]);
    const [state] = useReactive({
        count: 0,
        count2: 0,
    },
        {
            init(_state, subscribe) {
                this.count = 10;
                setItems(items => [...items, "SubscribedCounter initialized"]);
                subscribe(() => [this.count2, this.count], (_state, key, value, previous) => {
                    setItems(items => [...items, `${key} changed from ${previous} to ${value}`]);
                })
        }
        });
    return (
        <div>
            _________________________________
            <h3>Subscribed Counter</h3>
            <p>Count: {state.count} Count2: {state.count2}</p>
            <button onClick={() => state.count++}>Increment</button>
            <button onClick={() => state.count--}>Decrement</button>
            <button onClick={() => state.count2++}>Increment 2</button>
            <button onClick={() => state.count2--}>Decrement 2</button>
            <p>Items: <button onClick={() => setItems([])}>Clear</button></p>
            {items.map((item, index) => (
                <p key={index}>{item}</p>
            ))}
        </div>
    );
};

const ExampleComponent = () => {
    const [state, , history] = useReactive({ count: 0 }, { historySettings: { enabled: true } });
    return (
        <div>
            _________________________________
            <h3>Count: {state.count}</h3>
            <button onClick={() => state.count++}>Increment</button>
            <button onClick={() => history.undo()}>Undo</button>
            <button onClick={() => history.redo()}>Redo</button>
        </div>
    );
};

const CheckBox = ({ caption, checked, setChecked }: { caption: string, checked: boolean, setChecked: (checked: boolean) => void }) => {
    return (
        <div>
            <label>
                <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
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
            _________________________________
            <h3>History</h3>
            <CheckBox caption="Some boolean" checked={state.checked} setChecked={(checked) => state.checked = checked} />
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
            <CheckBox caption="Enable history" checked={historyEnabled} setChecked={(checked) => {
                setHistoryEnabled(checked);
                history.enable(checked);
            }} />
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
            <h4>Changes:</h4>
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
            <EffectDependencyExample />
            <ArrayExample />
            <MultipleEffectsExample />
            <ReactiveStoreProvider>
                <ReactiveStoreUser />
                <AnotherReactiveStoreUser />
            </ReactiveStoreProvider>
            <SubscribedCounter />
            <ExampleComponent />
            <ReactiveHistoryExample />
        </div>
    );
};
