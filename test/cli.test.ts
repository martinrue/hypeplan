import { describe, expect, test } from "bun:test";

describe("cli", () => {
  test("explains that OPENAI_API_KEY must be passed in the environment", async () => {
    const proc = Bun.spawn(["bun", "run", "src/cli.ts"], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        OPENAI_API_KEY: "",
      },
    });
    proc.stdin.write(`# Plan

## Summary
- Add validation
- Update tests

## Test Plan
- Run bun test
`);
    proc.stdin.end();

    const [code, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stderr).text(),
    ]);

    expect(code).not.toBe(0);
    expect(stderr).toContain("OPENAI_API_KEY");
    expect(stderr).toContain(".env");
  });

  test("rejects input that is clearly not a plan before requiring an API key", async () => {
    const proc = Bun.spawn(["bun", "run", "src/cli.ts"], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        OPENAI_API_KEY: "",
      },
    });
    proc.stdin.write("remember to buy milk and call sam\n");
    proc.stdin.end();

    const [code, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stderr).text(),
    ]);

    expect(code).not.toBe(0);
    expect(stderr).toContain(
      "Please pipe in or have copied to the clipboard a valid plan",
    );
    expect(stderr).not.toContain("OPENAI_API_KEY");
  });
});
