// Skyline Courier — bootstrap: wire canvas, input, audio, renderer and game
// together and run the frame loop.

import { createAudio } from './audio.js';
import { createGame, updateGame } from './game.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const input = createInput(canvas);
const audio = createAudio();
const renderer = createRenderer(canvas);
const game = createGame();

// Screenshot mode: ?shot=start|play|land|end freezes a staged scene.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) applyShot(game, shot);

// Audio needs a gesture; the first click or keypress anywhere unlocks it.
window.addEventListener('pointerdown', () => audio.ensure(), { once: true });
window.addEventListener('keydown', () => audio.ensure(), { once: true });

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  updateGame(game, input, audio, dt);
  renderer.render(game);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
