import { test } from "node:test";
import assert from "node:assert/strict";
import { winner, coachMove, judge, type Mark } from "./minigames.ts";

const B = (s: string): Mark[] => [...s].map((c) => (c === "X" ? "X" : c === "O" ? "O" : null));

test("tic-tac-toe: rows, diagonals, draws", () => {
  assert.deepEqual(winner(B("XXX......")), { mark: "X", line: [0, 1, 2] });
  assert.deepEqual(winner(B("O...O...O")), { mark: "O", line: [0, 4, 8] });
  assert.equal(winner(B("XOXXOOOXX")), "draw");
  assert.equal(winner(B("XO.......")), null);
});

test("the coach blocks and wins when it isn't slipping", () => {
  assert.equal(coachMove(B("XX..O...."), 0), 2); // block
  assert.equal(coachMove(B("XX.OO.X.."), 0), 5); // win beats block
});

test("rock-paper-scissors", () => {
  assert.equal(judge("rock", "scissors"), "win");
  assert.equal(judge("rock", "paper"), "lose");
  assert.equal(judge("paper", "paper"), "draw");
});
