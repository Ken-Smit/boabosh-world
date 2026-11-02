// Which seasonal theme belongs to a date. Pure (no DOM, no three.js) so the
// tests can import it. A date has one season, so two themes can never both run.

export type Season = "halloween" | "christmas";

/** October is Halloween; Nov 1 through Jan 6 is Christmas; otherwise neither. */
export function seasonOf(d = new Date()): Season | null {
  const m = d.getMonth();
  if (m === 9) return "halloween";
  return m >= 10 || (m === 0 && d.getDate() <= 6) ? "christmas" : null;
}

/** What the toggle saves when turned off. It names the season's year, so "off" doesn't last into next year. */
export const offMark = (d = new Date()) => `off-${d.getFullYear() - (d.getMonth() === 0 ? 1 : 0)}`;

/** Is this theme on? Only in its own season (a stale saved "on" can't bring it back), and not if turned off this year. */
export const themeOn = (theme: Season, saved: string | null, d = new Date()) => seasonOf(d) === theme && saved !== offMark(d);
