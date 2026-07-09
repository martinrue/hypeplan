import { describe, expect, test } from "bun:test";
import { Readable } from "node:stream";
import { readPlanInput } from "../src/input";

describe("readPlanInput", () => {
  test("reads piped stdin before clipboard", async () => {
    const stdin = Readable.from(["# Plan\n"]) as NodeJS.ReadStream;
    stdin.isTTY = false;

    const plan = await readPlanInput({
      stdin,
      clipboardReader: () => "# Clipboard\n",
    });

    expect(plan).toBe("# Plan\n");
  });

  test("uses clipboard when stdin is interactive", async () => {
    const stdin = Readable.from([]) as NodeJS.ReadStream;
    stdin.isTTY = true;

    const plan = await readPlanInput({
      stdin,
      clipboardReader: () => "# Clipboard\n",
    });

    expect(plan).toBe("# Clipboard\n");
  });

  test("returns an empty plan when no input is available", async () => {
    const stdin = Readable.from([]) as NodeJS.ReadStream;
    stdin.isTTY = true;

    const plan = await readPlanInput({
      stdin,
      clipboardReader: () => null,
    });

    expect(plan).toBe("");
  });
});
