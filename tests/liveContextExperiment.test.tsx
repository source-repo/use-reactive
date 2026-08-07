import React from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import {
  createLiveContext,
  createLocalLive,
  type LiveWrite,
} from "../experiments/live-context/core";
import { useContextLive, useLive } from "../experiments/live-context/react";
import { createSourceRpcLiveBinding } from "../experiments/live-context/source-rpc";

describe("live-context experiment", () => {
  test("resolves live bindings through a logical context tree", () => {
    const root = createLiveContext();
    const child = root.child();
    const rootCounter = createLocalLive({ count: 1 });
    const childCounter = createLocalLive({ count: 10 });

    root.provide("counter", rootCounter);

    expect(root.resolve<{ count: number }>("counter").getSnapshot().count).toBe(1);
    expect(child.resolve<{ count: number }>("counter").getSnapshot().count).toBe(1);

    const removeOverride = child.provide("counter", childCounter);

    expect(child.resolve<{ count: number }>("counter").getSnapshot().count).toBe(10);

    removeOverride();

    expect(child.resolve<{ count: number }>("counter").getSnapshot().count).toBe(1);
  });

  test("local live state can be consumed by React", () => {
    const counter = createLocalLive({ count: 0 });

    const Counter = () => {
      const snapshot = useLive(counter);
      return <p data-testid="count">{snapshot.count}</p>;
    };

    render(<Counter />);

    expect(screen.getByTestId("count").textContent).toBe("0");

    act(() => {
      counter.state.count++;
    });

    expect(screen.getByTestId("count").textContent).toBe("1");
  });

  test("reactive context resolution can switch bindings", () => {
    const context = createLiveContext();
    const first = createLocalLive({ count: 1 });
    const second = createLocalLive({ count: 2 });

    context.provide("counter", first);

    const Counter = () => {
      const snapshot = useContextLive<{ count: number }>(context, "counter");
      return <p data-testid="count">{snapshot.count}</p>;
    };

    render(<Counter />);

    expect(screen.getByTestId("count").textContent).toBe("1");

    act(() => {
      context.provide("counter", second);
    });

    expect(screen.getByTestId("count").textContent).toBe("2");

    act(() => {
      second.state.count++;
    });

    expect(screen.getByTestId("count").textContent).toBe("3");
  });

  test("Source RPC adapter can use confirmed remote writes", async () => {
    const writes: LiveWrite[] = [];
    const remote = createSourceRpcLiveBinding(
      {
        initialSnapshot: { count: 0 },
        commands: {
          increment: vi.fn(),
        },
        subscribeSnapshots: () => () => {},
        mutate: (write) => {
          writes.push(write);
        },
      },
      { writePolicy: "confirmed" }
    );

    remote.state.count++;

    expect(writes).toEqual([{ type: "set", path: ["count"], value: 1 }]);
    expect(remote.getSnapshot().count).toBe(0);

    act(() => {
      remote.publishRemoteSnapshot({ count: 1 });
    });

    expect(remote.getSnapshot().count).toBe(1);

    await remote.connect();
  });

  test("Source RPC adapter can use optimistic direct mutation", () => {
    const writes: LiveWrite[] = [];
    const remote = createSourceRpcLiveBinding(
      {
        initialSnapshot: { nested: { count: 0 } },
        commands: {},
        subscribeSnapshots: () => () => {},
        mutate: (write) => {
          writes.push(write);
        },
      },
      { writePolicy: "optimistic" }
    );

    remote.state.nested.count++;

    expect(writes).toEqual([{ type: "set", path: ["nested", "count"], value: 1 }]);
    expect(remote.getSnapshot().nested.count).toBe(1);
  });
});
