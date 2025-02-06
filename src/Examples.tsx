import * as React from "react";
import { useReactive } from "./useReactive.js";

function InitComponent() {
  const state = useReactive({
    count: 0,
    increment() {
      this.count++;
    },
    init() {
      this.count = 123;
      console.log('init called!');
    },
  });
  return <div>
      <p>Count: {state.count}</p>
      <button onClick={state.increment}>Increment</button>
    </div>;
}

// Using objects and nested properties

function UserComponent() {
  const user = useReactive({
    name: "John",
    age: 30,
    address: {
      city: "New York",
      country: "USA",
    },
    incrementAge() {
      this.age++;
    },
  });
  return <div>
      <p>Name: {user.name}</p>
      <p>Age: {user.age}</p>
      <p>City: {user.address.city}</p>
      <button onClick={user.incrementAge}>Increase Age</button>
      <button onClick={() => { user.address.city = 'Los Angeles' }}>Change city</button>
    </div>;
}

// Using effect

function TimerComponent() {
  const state = useReactive(
    {
      seconds: 0,
      called: false,
    },
    function (state) {
      this.called = true;
      const interval = setInterval(() => {
        state.seconds++;
      }, 1000);
      return () => clearInterval(interval);
    }
  );

  return <>
    <p>Elapsed Time: {state.seconds} seconds</p>
  </>;
}

// Using arrays

function TodoList() {
  const state = useReactive({
    todos: ["Learn React", "Master TypeScript"],
    addTodo(todo: string) {
      this.todos = [...this.todos, todo];
    },
  });

  return (
    <div>
      <ul>
        {state.todos.map((todo, index) => (
          <li key={index}>{todo}</li>
        ))}
      </ul>
      <button onClick={() => state.addTodo("Use useReactive!")}>Add Todo</button>
    </div>
  );
}

export function Examples() {
    return <div>
        <h2>Examples</h2>
        <InitComponent />
        <UserComponent />
        <TimerComponent />
        <TodoList />
    </div>;
}
