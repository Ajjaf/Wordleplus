import { scoreGuess } from "../game.js";

describe("scoreGuess", () => {
  it("returns all green for exact match", () => {
    const result = scoreGuess("APPLE", "APPLE");
    expect(result).toEqual(["green", "green", "green", "green", "green"]);
  });

  it("returns mostly gray for completely wrong guess", () => {
    // ZEBRA vs APPLE: Z=gray, E=yellow (E is in APPLE), B=gray, R=gray, A=yellow (A is in APPLE)
    const result = scoreGuess("APPLE", "ZEBRA");
    expect(result).toEqual(["gray", "yellow", "gray", "gray", "yellow"]);
  });

  it("handles all letters present but wrong positions (all yellow)", () => {
    const result = scoreGuess("APPLE", "LEAPP");
    expect(result).toEqual(["yellow", "yellow", "yellow", "yellow", "yellow"]);
  });

  it("handles mixed green, yellow, and gray", () => {
    // APPLE vs APLSE: A=green, P=green, L=yellow (L is in APPLE but wrong position), S=gray, E=green (E is in correct position)
    const result = scoreGuess("APPLE", "APLSE");
    expect(result).toEqual(["green", "green", "yellow", "gray", "green"]);
  });

  it("handles duplicate letters correctly - first occurrence gets priority", () => {
    // In "APPLE", there are two P's
    // If guess is "PAPER": P=yellow (P exists in APPLE), A=yellow (A exists), P=yellow (second P, but only one P in APPLE at pos1), E=yellow (E exists), R=gray
    const result = scoreGuess("APPLE", "PAPER");
    expect(result).toEqual(["yellow", "yellow", "green", "yellow", "gray"]);
  });

  it("handles duplicate letters with one in correct position", () => {
    // Secret: "APPLE", Guess: "APPPP"
    // A=green, P=green (pos1), P=green (pos2, but APPLE has P at pos1 only, so this is wrong), P=gray, P=gray
    // Actually: A=green, P=green(pos1), P=green(pos2? no, APPLE only has one P), wait let me check
    // APPLE has: A, P, P, L, E - so two P's at positions 1 and 2
    // APPPP: A=green, P=green(pos1 matches), P=green(pos2 matches), P=gray (no more P's), P=gray
    const result = scoreGuess("APPLE", "APPPP");
    expect(result).toEqual(["green", "green", "green", "gray", "gray"]);
  });

  it("is case insensitive", () => {
    const result1 = scoreGuess("apple", "APPLE");
    const result2 = scoreGuess("APPLE", "apple");
    const result3 = scoreGuess("Apple", "aPpLe");
    expect(result1).toEqual(["green", "green", "green", "green", "green"]);
    expect(result2).toEqual(["green", "green", "green", "green", "green"]);
    expect(result3).toEqual(["green", "green", "green", "green", "green"]);
  });

  it("handles word with all same letter", () => {
    const result = scoreGuess("AAAAA", "AAAAA");
    expect(result).toEqual(["green", "green", "green", "green", "green"]);
  });

  it("handles partial match with duplicates", () => {
    // Secret: "TREES", Guess: "TEETH"
    // T: green (position 0), E: yellow (position 1, E exists in TREES), E: green (position 2, E is correct), T: gray (T already used at pos0), H: gray
    const result = scoreGuess("TREES", "TEETH");
    expect(result).toEqual(["green", "yellow", "green", "gray", "gray"]);
  });

  it("handles no matching letters", () => {
    const result = scoreGuess("ABCDE", "FGHIJ");
    expect(result).toEqual(["gray", "gray", "gray", "gray", "gray"]);
  });
});

