import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";

const root = process.cwd();

function run(command: string, args: string[]) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

describe("package output", () => {
  beforeAll(() => {
    run("npm", ["run", "build"]);
  }, 60_000);

  test("can be imported as ESM", () => {
    const output = run("node", [
      "--input-type=module",
      "-e",
      [
        "const mod = await import('./dist/index.esm.js');",
        "if (typeof mod.useReactive !== 'function') throw new Error('missing useReactive');",
        "if (typeof mod.createReactiveStore !== 'function') throw new Error('missing createReactiveStore');",
        "console.log(Object.keys(mod).sort().join(','));",
      ].join("\n"),
    ]);

    expect(output.trim()).toBe("createReactiveStore,useReactive");
  });

  test("can be required as CommonJS", () => {
    const output = run("node", [
      "-e",
      [
        "const mod = require('./dist/index.cjs');",
        "if (typeof mod.useReactive !== 'function') throw new Error('missing useReactive');",
        "if (typeof mod.createReactiveStore !== 'function') throw new Error('missing createReactiveStore');",
        "console.log(Object.keys(mod).sort().join(','));",
      ].join("\n"),
    ]);

    expect(output.trim()).toBe("createReactiveStore,useReactive");
  });

  test("can render on the server", () => {
    const output = run("node", [
      "--input-type=module",
      "-e",
      [
        "import React from 'react';",
        "import { renderToString } from 'react-dom/server';",
        "import { useReactive } from './dist/index.esm.js';",
        "function App() {",
        "  const state = useReactive({ count: 2, get double() { return this.count * 2; } });",
        "  return React.createElement('span', null, state.double);",
        "}",
        "const html = renderToString(React.createElement(App));",
        "if (!html.includes('4')) throw new Error(html);",
        "console.log(html);",
      ].join("\n"),
    ]);

    expect(output).toContain("4");
  });

  test("exposes usable TypeScript declarations", () => {
    const dir = join(root, ".tmp", "type-tests");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "consumer.tsx"),
      [
        "import React from 'react';",
        "import { createReactiveStore, useReactive } from '../../dist/index.js';",
        "",
        "const state = useReactive({",
        "  count: 0,",
        "  increment() { this.count++; },",
        "  get label() { return `${this.count}`; },",
        "});",
        "",
        "state.count satisfies number;",
        "state.label satisfies string;",
        "state.increment();",
        "// @ts-expect-error unknown properties are rejected",
        "state.missing;",
        "",
        "const [Provider, useStore] = createReactiveStore({",
        "  user: { name: 'Ada' },",
        "  setName(name: string) { this.user.name = name; },",
        "});",
        "const store = useStore();",
        "store.setName('Grace');",
        "store.user.name satisfies string;",
        "const element: React.ReactElement = React.createElement(Provider, { children: null });",
        "void element;",
      ].join("\n")
    );
    writeFileSync(
      join(dir, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            strict: true,
            jsx: "react-jsx",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            target: "ES2022",
            noEmit: true,
            skipLibCheck: false,
          },
          include: ["consumer.tsx"],
        },
        null,
        2
      )
    );

    run("npx", ["tsc", "--noEmit", "-p", join(dir, "tsconfig.json")]);
  });
});
