// Tic-tac-toe and rock-paper-scissors rules. Pure, so they're tested.

export type Mark = "X" | "O" | null; // X = your kitten, O = the coach's kitten
export const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

export function winner(b: Mark[]): { mark: "X" | "O"; line: number[] } | "draw" | null {
  for (const l of LINES) {
    const [a, c, d] = l as [number, number, number];
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { mark: b[a]!, line: l };
  }
  return b.every(Boolean) ? "draw" : null;
}

/** Perfect play for O: +1 win, -1 loss, 0 draw. */
function minimax(b: Mark[], turn: "X" | "O"): number {
  const w = winner(b);
  if (w === "draw") return 0;
  if (w) return w.mark === "O" ? 1 : -1;
  const scores = b.flatMap((m, i) => (m ? [] : [minimax(b.map((x, j) => (j === i ? turn : x)), turn === "X" ? "O" : "X")]));
  return turn === "O" ? Math.max(...scores) : Math.min(...scores);
}

/**
 * The coach's move. Plays perfectly most of the time but sometimes picks a
 * random square (`slip`), so a kid can actually win; an unbeatable game isn't fun.
 */
export function coachMove(b: Mark[], slip = 0.3, rnd = Math.random): number {
  const free = b.flatMap((m, i) => (m ? [] : [i]));
  if (rnd() < slip) return free[Math.floor(rnd() * free.length)]!;
  let best = free[0]!, bestV = -Infinity;
  for (const i of free) {
    const v = minimax(b.map((x, j) => (j === i ? "O" : x)), "X");
    if (v > bestV) { bestV = v; best = i; }
  }
  return best;
}

export type Hand = "rock" | "paper" | "scissors";
export const HANDS: Hand[] = ["rock", "paper", "scissors"];
const BEATS: Record<Hand, Hand> = { rock: "scissors", paper: "rock", scissors: "paper" };
export const judge = (me: Hand, them: Hand): "win" | "lose" | "draw" =>
  me === them ? "draw" : BEATS[me] === them ? "win" : "lose";
