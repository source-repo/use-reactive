import React from "react";
import { useReactive } from '../src/useReactive.js';
import { createReactiveStore } from '../src/useReactiveStore.js';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { describe, test, expect } from 'vitest';

describe("Components", () => {
  test("clicking a button updates the rendered value", () => {
    const Counter = () => {
      const state = useReactive({ count: 0 });
      return (
        <div>
          <p data-testid="count">{state.count}</p>
          <button onClick={() => state.count++}>Increment</button>
        </div>
      );
    };
    render(<Counter />);

    expect(screen.getByTestId("count").textContent).toBe("0");
    fireEvent.click(screen.getByText("Increment"));
    expect(screen.getByTestId("count").textContent).toBe("1");
  });

  test("methods work as event handlers", () => {
    const Counter = () => {
      const state = useReactive({
        count: 0,
        increment() {
          this.count++;
        },
      });
      return (
        <div>
          <p data-testid="count">{state.count}</p>
          <button onClick={state.increment}>Increment</button>
        </div>
      );
    };
    render(<Counter />);

    fireEvent.click(screen.getByText("Increment"));
    fireEvent.click(screen.getByText("Increment"));
    expect(screen.getByTestId("count").textContent).toBe("2");
  });

  test("computed properties update in the UI", () => {
    const Doubler = () => {
      const state = useReactive({
        count: 2,
        get double() {
          return this.count * 2;
        },
      });
      return (
        <div>
          <p data-testid="double">{state.double}</p>
          <button onClick={() => state.count++}>Increment</button>
        </div>
      );
    };
    render(<Doubler />);

    expect(screen.getByTestId("double").textContent).toBe("4");
    fireEvent.click(screen.getByText("Increment"));
    expect(screen.getByTestId("double").textContent).toBe("6");
  });

  test("components only re-render for properties they read", () => {
    const sharedState = { count: 0, name: "unchanged" };
    let countRenders = 0;
    let nameRenders = 0;

    const CountView = () => {
      const state = useReactive(sharedState);
      countRenders++;
      return <p data-testid="count">{state.count}</p>;
    };
    const NameView = () => {
      const state = useReactive(sharedState);
      nameRenders++;
      return <p data-testid="name">{state.name}</p>;
    };
    const Mutator = () => {
      const state = useReactive(sharedState);
      return <button onClick={() => state.count++}>Increment</button>;
    };
    render(
      <div>
        <CountView />
        <NameView />
        <Mutator />
      </div>
    );

    const countRendersBefore = countRenders;
    const nameRendersBefore = nameRenders;

    fireEvent.click(screen.getByText("Increment"));

    expect(screen.getByTestId("count").textContent).toBe("1");
    // The component reading count re-rendered; the one reading only name did not
    expect(countRenders).toBeGreaterThan(countRendersBefore);
    expect(nameRenders).toBe(nameRendersBefore);
  });

  test("createReactiveStore shares state between components with fine-grained re-renders", () => {
    const [Provider, useStore] = createReactiveStore({
      counter: 0,
      user: { name: "John" },
    });
    let userRenders = 0;

    const Counter = () => {
      const store = useStore();
      return (
        <div>
          <p data-testid="counter">{store.counter}</p>
          <button onClick={() => store.counter++}>Increment</button>
        </div>
      );
    };
    const CounterMirror = () => {
      const store = useStore();
      return <p data-testid="mirror">{store.counter}</p>;
    };
    const UserInfo = () => {
      const store = useStore();
      userRenders++;
      return <p data-testid="user">{store.user.name}</p>;
    };
    render(
      <Provider>
        <Counter />
        <CounterMirror />
        <UserInfo />
      </Provider>
    );

    const userRendersBefore = userRenders;
    fireEvent.click(screen.getByText("Increment"));

    // Both counter readers update, the user reader does not re-render
    expect(screen.getByTestId("counter").textContent).toBe("1");
    expect(screen.getByTestId("mirror").textContent).toBe("1");
    expect(userRenders).toBe(userRendersBefore);
  });

  test("async methods update the UI when they resolve", async () => {
    const AsyncCounter = () => {
      const state = useReactive({
        count: 0,
        async incrementAsync() {
          await new Promise((resolve) => setTimeout(resolve, 10));
          this.count++;
        },
      });
      return (
        <div>
          <p data-testid="count">{state.count}</p>
          <button onClick={() => state.incrementAsync()}>Increment</button>
        </div>
      );
    };
    render(<AsyncCounter />);

    fireEvent.click(screen.getByText("Increment"));
    expect(screen.getByTestId("count").textContent).toBe("0");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(screen.getByTestId("count").textContent).toBe("1");
  });

  test("array rendering updates on in-place mutation", () => {
    const Todos = () => {
      const state = useReactive({
        todos: ["first"],
        add() {
          this.todos.push(`item ${this.todos.length}`);
        },
      });
      return (
        <div>
          <ul data-testid="todos">
            {state.todos.map((todo) => <li key={todo}>{todo}</li>)}
          </ul>
          <button onClick={state.add}>Add</button>
        </div>
      );
    };
    render(<Todos />);

    fireEvent.click(screen.getByText("Add"));
    fireEvent.click(screen.getByText("Add"));
    expect(screen.getByTestId("todos").children.length).toBe(3);
  });

  test("props flow into state used by getters", () => {
    const Sum = ({ value }: { value: number }) => {
      const state = useReactive({
        initial: 100,
        get sum() {
          return this.initial + value;
        },
      });
      return <p data-testid="sum">{state.sum}</p>;
    };
    const Parent = () => {
      const state = useReactive({ value: 0 });
      return (
        <div>
          <Sum value={state.value} />
          <button onClick={() => state.value++}>Increment</button>
        </div>
      );
    };
    render(<Parent />);

    expect(screen.getByTestId("sum").textContent).toBe("100");
    fireEvent.click(screen.getByText("Increment"));
    expect(screen.getByTestId("sum").textContent).toBe("101");
  });
});
