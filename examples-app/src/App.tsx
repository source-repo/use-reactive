import { useState, memo, useCallback, useRef } from "react";
import { Examples } from './symlink/Examples.jsx'
import { Button } from "@/components/ui/button.jsx";
import './App.css'
import { useReactive } from "./symlink/useReactive.js";

const Sum = ({ value }: { value: number }) => {
  const [someState, setSomeState] = useState(0)
  const state = useReactive({ 
      initial: 100,
      get sum() {
          return this.initial + value + someState;
      }
  });
  return (
      <div>
          <h3>Sum example</h3>
          <p>Sum: { state.sum }</p>
	      <button onClick={() => setSomeState(someState + 2) }>Increase someState</button>
      </div>
  );
};

const TestSum = () => {
  const state = useReactive({ value: 0 });
  return <div>
      <Sum value={ state.value } />
      <button onClick={() => state.value++ }>Increment value</button>
  </div>
}

const Counter1 = memo(({ label, count, onIncrement }: { label: string; count: number; onIncrement: () => void }) => {
  console.log(`${label} re-rendered 1`);
  const renders = useRef(0);
  renders.current++;
  return (
    <div className="p-4 border rounded-lg shadow-sm bg-gray-100">
      <h2 className="text-xl font-semibold">{label}</h2>
      <p className="text-lg">Count: {count}, renders {renders.current}</p>
      <Button onClick={onIncrement}>Increment</Button>
    </div>
  );
});

const Counter2 = memo(({ label, count, onIncrement }: { label: string; count: number; onIncrement: () => void }) => {
  console.log(`${label} re-rendered 2`);
  const renders = useRef(0);
  renders.current++;
  return (
    <div className="p-4 border rounded-lg shadow-sm bg-gray-100">
      <h2 className="text-xl font-semibold">{label}</h2>
      <p className="text-lg">Count: {count}, renders {renders.current}</p>
      <Button onClick={onIncrement}>Increment</Button>
    </div>
  );
});

export function DualCounter() {
  const [count1, setCount1] = useState(0);
  const [count2, setCount2] = useState(0);

  const incrementCount1 = useCallback(() => setCount1(prev => prev + 1), []);
  const incrementCount2 = useCallback(() => setCount2(prev => prev + 1), []);

  return (
    <div className="p-4 space-y-6 border rounded-lg shadow-md">
      <Counter1 label="Counter1" count={count1} onIncrement={incrementCount1} />
      <Counter2 label="Counter2" count={count2} onIncrement={incrementCount2} />
    </div>
  );
}

export function DualCounter2() {
  const [state, setState] = useState({ count1: 0, count2: 0 });

  const incrementCount1 = useCallback(() => { state.count1++; setState({ ...state }) }, [state]);
  const incrementCount2 = useCallback(() => { state.count2++; setState({ ...state }) }, [state]);

  return (
    <div className="p-4 space-y-6 border rounded-lg shadow-md">
      <Counter1 label="Counter1" count={state.count1} onIncrement={incrementCount1} />
      <Counter2 label="Counter2" count={state.count2} onIncrement={incrementCount2} />
    </div>
  );
}

type DualCounter3Props = {
  inputCounter1?: number;
  inputCounter2?: number;
};

export function DualCounter3({ inputCounter1 = 0, inputCounter2 = 0 }: DualCounter3Props) {
  const state = useReactive({
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
    <div className="p-4 space-y-6 border rounded-lg shadow-md">
      <Button onClick={() => state.count1++}>Increment count1</Button>
      <Button onClick={() => state.count2++}>Increment count2</Button>
      <Counter1 label="Counter1" count={state.getCount1} onIncrement={incrementCount1} />
      <Counter2 label="Counter2" count={state.getCount2} onIncrement={incrementCount2} />
    </div>
  );
}

function App() {

  const state = useReactive({
    count1: 123,
    count2: 456,
  });
  return (
    <>
      <div>
        <TestSum />
        <Button onClick={() => state.count1++}>Increment inputCount1 {state.count1}</Button>
        <Button onClick={() => state.count2++}>Increment inputCount2 {state.count2}</Button>
        <DualCounter3 inputCounter1={state.count1} inputCounter2={state.count2} />
        <Examples />
      </div>
    </>
  )
}

export default App
