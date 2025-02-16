import { useState, memo, useCallback, useRef } from "react";
import { Examples } from './symlink/Examples.jsx'
import { Button } from "@/components/ui/button.jsx";
import './App.css'
import { useReactive } from "./symlink/useReactive.js";
import { createReactiveStore } from './symlink/useReactiveStore.js'

const Sum = ({ value }: { value: number }) => {
    const [someState, setSomeState] = useState(0)
    const [state] = useReactive({
        initial: 100,
        get sum() {
            return this.initial + value + someState;
        }
    });
    return (
        <div>
            <h3>Sum example</h3>
            <p>Sum: {state.sum}</p>
            <button onClick={() => setSomeState(someState + 2)}>Increase someState</button>
        </div>
    );
};

const [ReactiveStoreProvider1, useReactiveStore1] = createReactiveStore({
    counter1: 0,
    counter2: 0,
    user: { name: "John Doe", age: 30 },
});

function TestReactiveStore() {
    return (
        <ReactiveStoreProvider1>
            <TopTestReactiveStore />
        </ReactiveStoreProvider1>
    );
}

function TopTestReactiveStore() {
    const store = useReactiveStore1();
    return (
        <div>
            _________________________________
            <h3>Global Reactive State Example</h3>
            <StoreCounter1 />
            <StoreCounter2 />
            <StoreUserInfo />
            <button onClick={() => store.state.counter1++}>Increment 1</button>
            <button onClick={() => store.state.counter1--}>Decrement 1</button>
            <button onClick={() => store.state.counter2++}>Increment 2</button>
            <button onClick={() => store.state.counter2--}>Decrement 2</button>
            <button onClick={() => store.state.user.age++}>Increase Age</button>
        </div>
    );
}

export const StoreCounter1 = memo(() => {
    const store = useReactiveStore1();

    return (
        <div>
            <h4>Counter 1: {store.state.counter1}</h4>
            <button onClick={() => store.state.counter1++}>Increment</button>
            <button onClick={() => store.state.counter1--}>Decrement</button>
            Rnd {Math.random()}
        </div>
    );
});

export const StoreCounter2 = memo(() => {
    const store = useReactiveStore1();

    return (
        <div>
            <h4>Counter 2: {store.state.counter2}</h4>
            <button onClick={() => store.state.counter2++}>Increment</button>
            <button onClick={() => store.state.counter2--}>Decrement</button>
            Rnd {Math.random()}
        </div>
    );
});

export const StoreUserInfo = memo(() => {
    const store = useReactiveStore1();

    return (
        <div>
            <h4>User: {store.state.user.name}, Age: {store.state.user.age}</h4>
            <button onClick={() => store.state.user.age++}>Increase Age</button>
            Rnd {Math.random()}
        </div>
    );
});


const TestSum = () => {
    const [state] = useReactive({ value: 0 });
    return <div>
        <Sum value={state.value} />
        <button onClick={() => state.value++}>Increment value</button>
    </div>
}

const Counter1 = memo(({ label, count, onIncrement }: { label: string; count: number; onIncrement: () => void }) => {
    const renders = useRef(0);
    renders.current++;
    return (
        <div>
            <h4>{label}</h4>
            <p>Count: {count}, renders {renders.current}</p>
            <Button onClick={onIncrement}>Increment</Button>
            {Math.random()}
        </div>
    );
});

const Counter2 = memo(({ label, count, onIncrement }: { label: string; count: number; onIncrement: () => void }) => {
    const renders = useRef(0);
    renders.current++;
    return (
        <div>
            <h4>{label}</h4>
            <p>Count: {count}, renders {renders.current}</p>
            <Button onClick={onIncrement}>Increment</Button>
            {Math.random()}
        </div>
    );
});

type DualCounterProps = {
    inputCounter1?: number;
    inputCounter2?: number;
};

export function DualCounter({ inputCounter1 = 0, inputCounter2 = 0 }: DualCounterProps) {
    const [state] = useReactive({
        inputCounter1,
        inputCounter2,
        count1: 0,
        count2: 0,
        get getCount1() {
            return this.count1 + inputCounter1;
        },
        get getCount2() {
            return this.count2 + this.inputCounter2;
        }
    });

    const incrementCount1 = useCallback(() => { state.count1++; }, [state]);
    const incrementCount2 = useCallback(() => { state.count2++; }, [state]);

    return (
        <div>
            _________________________________
            <h3>Dual Counter</h3>
            <Button onClick={() => state.count1++}>Increment count1</Button>
            <Button onClick={() => state.count2++}>Increment count2</Button>
            <Counter1 label="Counter1" count={state.getCount1} onIncrement={incrementCount1} />
            <Counter2 label="Counter2" count={state.getCount2} onIncrement={incrementCount2} />
        </div>
    );
}

function App() {
    const [state] = useReactive({
        count1: 123,
        count2: 456,
    });
    return (
        <>
            <div>
                <h2>App examples</h2>
                <TestSum />
                <TestReactiveStore />
                <p>_________________________________</p>
                <Button onClick={() => state.count1++}>Increment inputCount1 {state.count1}</Button>
                <Button onClick={() => state.count2++}>Increment inputCount2 {state.count2}</Button>
                <DualCounter inputCounter1={state.count1} inputCounter2={state.count2} />
                _________________________________
                <Examples />
            </div>
        </>
    )
}

export default App
