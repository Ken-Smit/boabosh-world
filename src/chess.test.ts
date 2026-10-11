import { test } from "node:test";
import assert from "node:assert/strict";
import { start, legal, play, status, bestMove, type Pos, type Move } from "./chess.ts";

const sq = (name: string) => (8 - Number(name[1])) * 8 + (name.charCodeAt(0) - 97);
const go = (p: Pos, from: string, to: string): Pos => {
  const m = legal(p).find((x) => x.from === sq(from) && x.to === sq(to));
  assert.ok(m, `illegal ${from}-${to}`);
  return play(p, m as Move);
};

test("20 moves from the start for each side", () => {
  const p = start();
  assert.equal(legal(p).length, 20);
  assert.equal(legal(go(p, "e2", "e4")).length, 20);
});

test("fool's mate is checkmate", () => {
  let p = start();
  p = go(p, "f2", "f3"); p = go(p, "e7", "e5"); p = go(p, "g2", "g4"); p = go(p, "d8", "h4");
  assert.equal(status(p), "mate");
});

test("castling king side moves both king and rook, then the right is gone", () => {
  let p = start();
  for (const [a, b] of [["e2", "e4"], ["e7", "e5"], ["g1", "f3"], ["b8", "c6"], ["f1", "c4"], ["g8", "f6"]]) p = go(p, a!, b!);
  p = go(p, "e1", "g1");
  assert.equal(p.board[sq("g1")], "wK");
  assert.equal(p.board[sq("f1")], "wR");
  assert.equal(p.castle.wK, false);
});

test("can't move into check; en passant works; pawns promote to queens", () => {
  let p = start();
  for (const [a, b] of [["e2", "e4"], ["a7", "a6"], ["e4", "e5"], ["d7", "d5"]]) p = go(p, a!, b!);
  p = go(p, "e5", "d6"); // en passant
  assert.equal(p.board[sq("d5")], null);
  const promo: Pos = { board: Array(64).fill(null), turn: "w", castle: { wK: false, wQ: false, bK: false, bQ: false }, ep: null };
  promo.board[sq("a7")] = "wP"; promo.board[sq("e1")] = "wK"; promo.board[sq("h8")] = "bK";
  assert.equal(go(promo, "a7", "a8").board[sq("a8")], "wQ");
  const pinned: Pos = { ...promo, board: Array(64).fill(null) };
  pinned.board[sq("e1")] = "wK"; pinned.board[sq("e2")] = "wR"; pinned.board[sq("e8")] = "bQ"; pinned.board[sq("a8")] = "bK";
  assert.ok(legal(pinned).every((m) => m.from !== sq("e2") || m.to % 8 === 4)); // pinned rook stays on the e-file
});

test("the computer takes a free queen and returns null when it has no moves", () => {
  const p: Pos = { board: Array(64).fill(null), turn: "b", castle: { wK: false, wQ: false, bK: false, bQ: false }, ep: null };
  p.board[sq("a8")] = "bK"; p.board[sq("d8")] = "bR"; p.board[sq("d1")] = "wQ"; p.board[sq("h1")] = "wK";
  const m = bestMove(p, 0)!;
  assert.equal(m.to, sq("d1"));
  let mate = start();
  mate = go(mate, "f2", "f3"); mate = go(mate, "e7", "e5"); mate = go(mate, "g2", "g4"); mate = go(mate, "d8", "h4");
  assert.equal(bestMove(mate), null);
});
