# Neon Breaker

A playable, Arabic-first neon brick-breaker built with React, TypeScript, Vite, and a custom Canvas 2D engine. English is available from the header.

## Play

- Aim with the mouse and click to launch. On touchscreens, drag and release.
- Use Left/Right or A/D to aim, with Shift for finer adjustments.
- Press Space or Enter to start or launch.
- Press P or Escape to pause and resume, R to restart, and M to toggle sound.
- Collect glowing plus signs for three extra balls. Quick consecutive breaks earn combo bonuses.
- Bricks descend after every volley. The run ends when a brick reaches the bottom line.
- Recall returns the remaining balls and advances to the next round.

## Local Data

The ten best completed runs, player name, language, and preferences are saved in localStorage. No accounts, server, or external game API are needed. Score history can be cleared with confirmation in the high-score dialog.

## Development

Use `npm run dev` for the Vite development server and `npm run build` for the production build.

## Structure

- `src/App.tsx`: interface, input handling, dialogs, and game lifecycle.
- `src/game/engine.ts`: fixed-step physics, collision detection, rendering, particles, and game states.
- `src/game/audio.ts`: synthesized Web Audio sound effects, unlocked by user input.
- `src/game/storage.ts`: validated local preferences and score storage.
- `src/i18n.ts`: Arabic and English interface copy.
- `src/index.css`: responsive arcade styling and reduced-motion support.

## Performance

The engine uses requestAnimationFrame with 120 Hz fixed physics substeps, cached glow sprites, a 2x pixel-ratio cap, a bounded particle count, and UI updates limited to 10 Hz. Visual effects can be disabled. The game pauses when the tab is hidden.

The production build has been verified. Interactive device testing and actual 60 fps benchmarking still need to be performed in target browsers.