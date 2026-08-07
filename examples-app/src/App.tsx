import { memo, useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button.jsx";
import { useReactive } from "./symlink/useReactive.js";
import { createReactiveStore } from "./symlink/useReactiveStore.js";
import "./App.css";

const Sum = ({ value }: { value: number }) => {
    const [offset, setOffset] = useState(0);
    const state = useReactive({
        initial: 100,
        get sum() {
            return this.initial + value + offset;
        },
    });

    return (
        <div>
            <h3>Sum example</h3>
            <p>Sum: {state.sum}</p>
            <Button onClick={() => setOffset(offset + 2)}>Increase offset</Button>
        </div>
    );
};

const TestSum = () => {
    const state = useReactive({ value: 0 });

    return (
        <div>
            <Sum value={state.value} />
            <Button onClick={() => state.value++}>Increment value</Button>
        </div>
    );
};

const [ReactiveStoreProvider, useReactiveStore] = createReactiveStore({
    counter1: 0,
    counter2: 0,
    user: { name: "John Doe", age: 30 },
});

function TestReactiveStore() {
    return (
        <ReactiveStoreProvider>
            <TopTestReactiveStore />
        </ReactiveStoreProvider>
    );
}

function TopTestReactiveStore() {
    const store = useReactiveStore();

    return (
        <div>
            <h3>Shared Reactive Store</h3>
            <StoreCounter1 />
            <StoreCounter2 />
            <StoreUserInfo />
            <Button onClick={() => store.counter1++}>Increment 1</Button>
            <Button onClick={() => store.counter2++}>Increment 2</Button>
            <Button onClick={() => store.user.age++}>Increase age</Button>
        </div>
    );
}

const StoreCounter1 = memo(() => {
    const store = useReactiveStore();

    return (
        <div>
            <h4>Counter 1: {store.counter1}</h4>
            <Button onClick={() => store.counter1++}>Increment</Button>
            Renders marker {Math.random()}
        </div>
    );
});

const StoreCounter2 = memo(() => {
    const store = useReactiveStore();

    return (
        <div>
            <h4>Counter 2: {store.counter2}</h4>
            <Button onClick={() => store.counter2++}>Increment</Button>
            Renders marker {Math.random()}
        </div>
    );
});

const StoreUserInfo = memo(() => {
    const store = useReactiveStore();

    return (
        <div>
            <h4>
                User: {store.user.name}, Age: {store.user.age}
            </h4>
            <Button onClick={() => store.user.age++}>Increase age</Button>
            Renders marker {Math.random()}
        </div>
    );
});

const CounterView = memo(
    ({ label, count, onIncrement }: { label: string; count: number; onIncrement: () => void }) => {
        const renders = useRef(0);
        renders.current++;

        return (
            <div>
                <h4>{label}</h4>
                <p>
                    Count: {count}, renders {renders.current}
                </p>
                <Button onClick={onIncrement}>Increment</Button>
            </div>
        );
    }
);

type DualCounterProps = {
    inputCounter1?: number;
    inputCounter2?: number;
};

function DualCounter({ inputCounter1 = 0, inputCounter2 = 0 }: DualCounterProps) {
    const state = useReactive({
        count1: 0,
        count2: 0,
        get getCount1() {
            return this.count1 + inputCounter1;
        },
        get getCount2() {
            return this.count2 + inputCounter2;
        },
    });

    const incrementCount1 = useCallback(() => {
        state.count1++;
    }, [state]);
    const incrementCount2 = useCallback(() => {
        state.count2++;
    }, [state]);

    return (
        <div>
            <h3>Dual Counter</h3>
            <Button onClick={() => state.count1++}>Increment count1</Button>
            <Button onClick={() => state.count2++}>Increment count2</Button>
            <CounterView label="Counter 1" count={state.getCount1} onIncrement={incrementCount1} />
            <CounterView label="Counter 2" count={state.getCount2} onIncrement={incrementCount2} />
        </div>
    );
}

function App() {
    const state = useReactive({
        count1: 123,
        count2: 456,
    });

    return (
        <div>
            <h2>App examples</h2>
            <TestSum />
            <TestReactiveStore />
            <Button onClick={() => state.count1++}>Increment inputCount1 {state.count1}</Button>
            <Button onClick={() => state.count2++}>Increment inputCount2 {state.count2}</Button>
            <DualCounter inputCounter1={state.count1} inputCounter2={state.count2} />
        </div>
    );
}

export default App;
