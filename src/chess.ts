// Chess rules and a gentle computer opponent. Pure (no DOM), so it's tested.
// Full rules: castling, en passant, check, checkmate, stalemate.
// ponytail: pawns always promote to a queen; a promotion picker is one more
// screen for a seven-year-old. Add it if a kid ever asks for a knight.

export type Side = "w" | "b";
export type Kind = "K" | "Q" | "R" | "B" | "N" | "P";
export type Piece = `${Side}${Kind}`;
export type Pos = {
  board: (Piece | null)[]; // index = row * 8 + col, row 0 is black's back rank (rank 8)
  turn: Side;
  castle: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };
  ep: number | null; // square a pawn can capture into en passant
};
export type Move = { from: number; to: number; promo?: boolean; castle?: "K" | "Q"; ep?: boolean };

const BACK: Kind[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];
export function start(): Pos {
  const board: (Piece | null)[] = Array(64).fill(null);
  BACK.forEach((k, c) => {
    board[c] = `b${k}`; board[8 + c] = "bP";
    board[48 + c] = "wP"; board[56 + c] = `w${k}`;
  });
  return { board, turn: "w", castle: { wK: true, wQ: true, bK: true, bQ: true }, ep: null };
}

const rc = (i: number) => [i >> 3, i & 7] as const;
const on = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
const other = (s: Side): Side => (s === "w" ? "b" : "w");
const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const ROOK = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

/** Is square `sq` attacked by any piece of side `by`? */
export function attacked(p: Pos, sq: number, by: Side): boolean {
  const [r, c] = rc(sq);
  const at = (rr: number, cc: number) => (on(rr, cc) ? p.board[rr * 8 + cc] : null);
  const pr = by === "w" ? r + 1 : r - 1; // a white pawn attacks upward, so it sits below
  if (at(pr, c - 1) === `${by}P` || at(pr, c + 1) === `${by}P`) return true;
  if (KNIGHT.some(([dr, dc]) => at(r + dr!, c + dc!) === `${by}N`)) return true;
  if (KING.some(([dr, dc]) => at(r + dr!, c + dc!) === `${by}K`)) return true;
  const ray = (dirs: number[][], kinds: Kind[]) => dirs.some(([dr, dc]) => {
    for (let rr = r + dr!, cc = c + dc!; on(rr, cc); rr += dr!, cc += dc!) {
      const q = p.board[rr * 8 + cc];
      if (q) return q[0] === by && kinds.includes(q[1] as Kind);
    }
    return false;
  });
  return ray(ROOK, ["R", "Q"]) || ray(BISHOP, ["B", "Q"]);
}

const kingSq = (p: Pos, s: Side) => p.board.indexOf(`${s}K`);
export const inCheck = (p: Pos, s: Side = p.turn) => attacked(p, kingSq(p, s), other(s));

function pseudo(p: Pos): Move[] {
  const moves: Move[] = [];
  const s = p.turn, them = other(s);
  for (let i = 0; i < 64; i++) {
    const q = p.board[i];
    if (!q || q[0] !== s) continue;
    const [r, c] = rc(i);
    const kind = q[1] as Kind;
    const add = (to: number, extra: Partial<Move> = {}) => moves.push({ from: i, to, ...extra });
    if (kind === "P") {
      const dir = s === "w" ? -1 : 1, last = s === "w" ? 0 : 7, home = s === "w" ? 6 : 1;
      const one = (r + dir) * 8 + c;
      if (on(r + dir, c) && !p.board[one]) {
        add(one, { promo: r + dir === last });
        const two = (r + 2 * dir) * 8 + c;
        if (r === home && !p.board[two]) add(two);
      }
      for (const dc of [-1, 1]) {
        if (!on(r + dir, c + dc)) continue;
        const to = (r + dir) * 8 + c + dc;
        if (p.board[to]?.[0] === them) add(to, { promo: r + dir === last });
        else if (to === p.ep) add(to, { ep: true });
      }
    } else if (kind === "N" || kind === "K") {
      for (const [dr, dc] of kind === "N" ? KNIGHT : KING) {
        if (!on(r + dr!, c + dc!)) continue;
        const to = (r + dr!) * 8 + c + dc!;
        if (p.board[to]?.[0] !== s) add(to);
      }
      if (kind === "K" && !inCheck(p, s)) {
        const row = s === "w" ? 56 : 0;
        const ok = (sqs: number[]) => sqs.every((x) => !p.board[row + x]);
        const safe = (sqs: number[]) => sqs.every((x) => !attacked(p, row + x, them));
        if (p.castle[`${s}K`] && ok([5, 6]) && safe([5, 6]) && p.board[row + 7] === `${s}R`) add(row + 6, { castle: "K" });
        if (p.castle[`${s}Q`] && ok([1, 2, 3]) && safe([2, 3]) && p.board[row] === `${s}R`) add(row + 2, { castle: "Q" });
      }
    } else {
      const dirs = kind === "R" ? ROOK : kind === "B" ? BISHOP : [...ROOK, ...BISHOP];
      for (const [dr, dc] of dirs) {
        for (let rr = r + dr!, cc = c + dc!; on(rr, cc); rr += dr!, cc += dc!) {
          const q2 = p.board[rr * 8 + cc];
          if (q2?.[0] === s) break;
          add(rr * 8 + cc);
          if (q2) break;
        }
      }
    }
  }
  return moves;
}

export function play(p: Pos, m: Move): Pos {
  const board = p.board.slice();
  const piece = board[m.from]!;
  const s = piece[0] as Side;
  board[m.to] = m.promo ? `${s}Q` : piece;
  board[m.from] = null;
  if (m.ep) board[m.to + (s === "w" ? 8 : -8)] = null;
  if (m.castle) {
    const row = s === "w" ? 56 : 0;
    const [rf, rt] = m.castle === "K" ? [7, 5] : [0, 3];
    board[row + rt] = board[row + rf]!;
    board[row + rf] = null;
  }
  const castle = { ...p.castle };
  if (piece[1] === "K") { castle[`${s}K`] = false; castle[`${s}Q`] = false; }
  // A rook moving off, or being captured on, its corner loses that castling right.
  for (const sq of [m.from, m.to]) {
    if (sq === 63) castle.wK = false; if (sq === 56) castle.wQ = false;
    if (sq === 7) castle.bK = false; if (sq === 0) castle.bQ = false;
  }
  const double = piece[1] === "P" && Math.abs(m.to - m.from) === 16;
  return { board, turn: other(p.turn), castle, ep: double ? (m.from + m.to) / 2 : null };
}

export const legal = (p: Pos): Move[] => pseudo(p).filter((m) => !inCheck(play(p, m), p.turn));

export type Status = "play" | "check" | "mate" | "stalemate";
export function status(p: Pos): Status {
  const any = legal(p).length > 0;
  return inCheck(p) ? (any ? "check" : "mate") : any ? "play" : "stalemate";
}

// ---------- the opponent -------------------------------------------------------
// Looks two moves ahead (its move, your reply), counts material, likes the
// centre, and adds a pinch of randomness so it's beatable and not repetitive.

const VALUE: Record<Kind, number> = { P: 100, N: 300, B: 310, R: 500, Q: 900, K: 0 };
function evaluate(p: Pos, me: Side): number {
  let score = 0;
  p.board.forEach((q, i) => {
    if (!q) return;
    const [r, c] = rc(i);
    const centre = q[1] === "P" || q[1] === "N" ? (3.5 - Math.abs(3.5 - r)) * 4 + (3.5 - Math.abs(3.5 - c)) * 4 : 0;
    score += (q[0] === me ? 1 : -1) * (VALUE[q[1] as Kind] + centre);
  });
  return score;
}

function search(p: Pos, depth: number, me: Side, alpha: number, beta: number): number {
  const moves = legal(p);
  if (!moves.length) return inCheck(p) ? (p.turn === me ? -100000 : 100000) : 0;
  if (depth === 0) return evaluate(p, me);
  const maxing = p.turn === me;
  let best = maxing ? -Infinity : Infinity;
  for (const m of moves) {
    const v = search(play(p, m), depth - 1, me, alpha, beta);
    if (maxing) { best = Math.max(best, v); alpha = Math.max(alpha, v); }
    else { best = Math.min(best, v); beta = Math.min(beta, v); }
    if (beta <= alpha) break;
  }
  return best;
}

/** The computer's move. `wobble` = how much randomness (bigger = easier). */
export function bestMove(p: Pos, wobble = 60, rnd = Math.random): Move | null {
  const moves = legal(p);
  if (!moves.length) return null;
  let best: Move | null = null, bestV = -Infinity;
  for (const m of moves) {
    const v = search(play(p, m), 1, p.turn, -Infinity, Infinity) + rnd() * wobble;
    if (v > bestV) { bestV = v; best = m; }
  }
  return best;
}

export const NAMES: Record<Kind, string> = { K: "King", Q: "Queen", R: "Castle", B: "Bishop", N: "Knight", P: "Pawn" };
