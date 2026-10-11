# Boabosh's World: developer notes

For what the game is, see the [README](../README.md).

A 3D web game for a second grader. Adopt a kitten, walk it across a map to the
Reading Forest, Math Mountain and the Science Lab, answer questions, earn fish
and things to wear.

Vite + TypeScript + three.js, static hosting, Supabase for cross-device saves.

## Run it

```bash
npm install
npm run dev
```

Works immediately with no Supabase — progress saves to this browser only.

## Cross-device saves (Supabase)

1. Create a project at supabase.com.
2. SQL Editor → paste and run `supabase/schema.sql`.
3. `cp .env.example .env`, fill in Project Settings → API (URL + anon key).
4. Restart `npm run dev`.

Each browser gets a random 8-character tag, shown to kids as a **picture
code**: 8 pictures, one per letter (`PICTURES` in `src/state.ts`). On another
device, "🐾 Picture code" → tap the same 8 pictures in order → "Fetch my cats".
Grown-ups can still type the letters under "use letters instead". Same code
either way, so older letter tags keep working.

### Security notes

- `schema.sql` turns on RLS with **no policies**, so the anon key cannot read or
  write the tables directly. Only the `security definer` functions can, and each
  one is scoped to the single code passed in. Do not add a policy granting `anon`
  access to `saves` or `attempts`.
- The picture code / collar tag is a bearer token. Anyone holding it can read and
  overwrite that save. The screen tells kids to only show it to a grown-up. 8 characters from a 31-character alphabet is ~850 billion combinations, so
  guessing is impractical, but a tag shared in a screenshot is a working key.
- The cat is always named Boabosh. No free-text name field, so no child's real
  name ever reaches the server. The `attempts` table is behavioral
  data about a child — keep it keyed only by the random code, and do not add
  name, email, school or class columns.
- Free Supabase projects pause after 7 days with no requests; the first load
  after that is slow while it wakes.

## Deploy

```bash
npm run build     # -> dist/
```

Drop `dist/` on Netlify, Vercel, Cloudflare Pages or GitHub Pages. Set the two
`VITE_` env vars in the host's dashboard. They are public by design — RLS is the
gate, not the key.

## Tests

```bash
npm test          # node --test, no framework
```

Covers coins, unlocks, buying, cats, outfits, furnishing, care needs, the litter
chore reward, v1→v2 save migration, save-merge and code generation.

## Layout

| File | What |
| --- | --- |
| `src/state.ts` | Pure game rules: coins, shop buys, cats, outfits, home, care needs, save migration. No DOM, no network — this is what the tests import. |
| `src/shop.ts` | The shop catalog (116 items): cats, clothes, toys, food, furniture, decor. |
| `src/games.ts` | Game Garden scene + Kitten Chess, Kitten Tic-Tac-Toe, Paw Rock-Paper-Scissors boards. |
| `src/chess.ts` | Chess rules + a gentle 2-ply opponent (tested). |
| `src/minigames.ts` | Tic-tac-toe + rock-paper-scissors rules (tested). |
| `src/home.ts` | The cats' home: room, customizable furniture, care props (water level, litter clumps), other cats. |
| `src/store.ts` | localStorage + Supabase sync, attempt logging. |
| `src/quiz.ts` | Question engine: picks grade level, avoids repeats, shuffles choices. Area/boss data. |
| `src/qmath.ts`, `src/qreading.ts`, `src/qscience.ts` | Grade 2–4 questions: generators (numbers, word lists, fact tables) + hand-written ones. |
| `src/cat.ts` | Boabosh the tabby: mesh, stripes, hats/collars. |
| `src/toon.ts` | Anime look: cel-shading materials, outline opt-outs. Ink lines drawn by `OutlineEffect` in `main.ts`. |
| `public/logo.svg` | The app logo. `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-*.png` and `manifest.webmanifest` are made from it (home-screen shortcuts, browser tab). |
| `public/boabosh.jpg` | Boabosh's portrait: title screen and HUD avatar (`boabosh-face.jpg`). |
| `src/sound.ts` | All audio, synthesized with Web Audio (no files): purr, meows, quiz sounds, ambience per place, music box. |
| `src/play.ts` | Toy play, petting, quiz reactions (hop, head tilt, victory spin + confetti). |
| `src/halloween.ts` | Halloween theme: on in October (🎃 toggle), pumpkins, ghosts, bats, sunset sky, "Boo!" taps. |
| `src/world.ts` | Terrain, sky, paths, area scenery, home, pond, clouds, butterflies. |
| `src/main.ts` | Scene, map, clicking, panels. |
| `supabase/schema.sql` | Tables, RLS, RPC functions. |

## Learning vs. playing balance

Games in the Game Garden cost coins (earned only by right answers) **and** need
the 🧠 brain meter full: `BRAIN_PER_GAME` (3) right answers since the last game.
Saving up coins can't skip the learning. Wins give trophies, never coins, so
games can't pay for more games. Tune `GAMES` prices and `BRAIN_PER_GAME` in
`src/state.ts`.

## Questions and difficulty

Each place keeps a grade level (2.0–4.99) in the save. Right answers add 0.12,
misses take away 0.2, so a kid at ~80% climbs a grade about every 18
questions and it eases off when they struggle. Most questions come from the
current grade, ~20% from the grade below (review), ~10% from above (stretch).
The last 60 questions per place are remembered and skipped. Every 10 right
answers in a place is a lesson: fanfare + 50 bonus coins.

Math is generated (thousands per grade, answers computed). Reading and Science
mix generators over word/fact lists with hand-written questions (hundreds per
grade). `npm test` checks every item at every grade: no empty or broken
values, the answer is a choice, choices are unique, math is correct, and no
repeats within 60.

**Adding questions:** append to the right file with `F(level, skill, question,
answer, ...wrongAnswers)`, or a generator with `G(...)`. Keep `skill` strings
stable; renaming one splits its history in the `skill_report` query.

No live AI generation, on purpose: a browser-side API key is public, a child's
activity would go to a third party, and generated questions would reach a kid
unreviewed. AI is fine for drafting questions offline that an adult reviews
and adds here.

## Not built yet

- Skill-targeted practice. Difficulty adapts per place, but `skill_report(code)`
  (weakest skill first) isn't used to pick questions yet.
- Parent progress page.
- Printable worksheet version.
- Per-field save merge. Two devices played offline the same day = newest wins,
  the other loses its progress.
