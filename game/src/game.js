// Skyline Courier — the game itself: state machine, missions, scoring, ring
// threading, landings, messages and the main loop's update step.

import { FLIGHT, MISSIONS, SCORE } from './config.js';
import { createPlane, ringDistance, updatePlane } from './physics.js';
import { generateClouds, generateRings, generateTown, heightAt } from './terrain.js';

export function createGame() {
  const game = {
    state: 'title',           // title | briefing | flying | paused | missionComplete | crashed | landedEarly | victory
    missionIndex: 0,
    mission: MISSIONS[0],
    rings: [],
    town: generateTown(),
    clouds: generateClouds(),
    plane: createPlane(),
    score: 0,
    bestScore: 0,
    missionScore: 0,
    missionTime: 0,
    missionCompleteText: '',
    time: 0,
    frozen: false,            // screenshot mode: the world holds still
    message: '',
    messageSub: '',
    messageTimer: 0,
  };
  startMission(game, 0);
  game.state = 'title';
  return game;
}

export function startMission(game, index) {
  game.missionIndex = index;
  game.mission = MISSIONS[index];
  game.rings = generateRings(game.mission);
  game.plane = createPlane();
  game.missionScore = 0;
  game.missionTime = 0;
  game.message = '';
  game.messageSub = '';
  game.messageTimer = 0;
}

function setMessage(game, text, sub, seconds) {
  game.message = text;
  game.messageSub = sub || '';
  game.messageTimer = seconds || 2.4;
}

function addScore(game, points) {
  game.score += points;
  game.missionScore += points;
  game.bestScore = Math.max(game.bestScore, game.score);
}

// Touchdown quality: inside the marked zone and gentle.
function landingQuality(game) {
  const plane = game.plane;
  const rwZ0 = 800 - 310;
  const inZone = Math.abs(plane.x) < 9 && plane.z > rwZ0 + 80 && plane.z < rwZ0 + 170;
  const gentle = plane.verticalSpeed > -3.5 && plane.speed < 85;
  return inZone && gentle ? 'perfect' : 'good';
}

export function updateGame(game, input, audio, dt) {
  if (game.frozen) return;
  game.time += dt;

  if (game.messageTimer > 0) {
    game.messageTimer -= dt;
    if (game.messageTimer <= 0) {
      game.message = '';
      game.messageSub = '';
    }
  }

  // One-shot actions first.
  if (input.takeAction('mute')) {
    const muted = audio.toggleMute();
    setMessage(game, muted ? 'SOUND OFF' : 'SOUND ON', '', 1.2);
  }

  switch (game.state) {
    case 'title': {
      if (input.takeAction('start') || input.takeClick()) {
        audio.ensure();
        audio.click();
        game.state = 'briefing';
      }
      break;
    }
    case 'briefing': {
      if (input.takeAction('start') || input.takeClick()) {
        audio.ensure();
        audio.click();
        game.state = 'flying';
        setMessage(game, game.mission.name, 'Throttle up with Shift — lift off at 70 kt', 3.5);
      }
      break;
    }
    case 'flying': {
      if (input.takeAction('pause')) {
        game.state = 'paused';
        break;
      }
      game.missionTime += dt;
      const controls = input.flight();
      updatePlane(game.plane, controls, dt, game.mission.wind);
      audio.update(game.plane, true);

      // Ring threading.
      for (const ring of game.rings) {
        if (ring.passed) continue;
        const d = ringDistance(game.plane, ring);
        if (d < ring.radius) {
          ring.passed = true;
          ring.perfect = d < ring.radius * 0.45;
          const points = SCORE.ring + (ring.perfect ? SCORE.ringPerfect : 0);
          addScore(game, points);
          game.plane.fuel = Math.min(FLIGHT.fuelCapacity, game.plane.fuel + FLIGHT.ringFuelBonus);
          audio.chime(ring.perfect);
          const done = game.rings.filter((r) => r.passed).length;
          setMessage(
            game,
            ring.perfect ? `PERFECT RING! +${points}` : `RING! +${points}`,
            done === game.rings.length
              ? 'All rings flown — bring her home to Runway 36'
              : `Ring ${done} of ${game.rings.length} · fuel +${FLIGHT.ringFuelBonus}%`,
            2.4,
          );
        }
      }

      if (game.plane.crashed) {
        game.state = 'crashed';
        audio.crash();
        audio.update(game.plane, false);
      } else if (game.plane.landed) {
        audio.thud();
        const allRings = game.rings.every((r) => r.passed);
        if (allRings) {
          const quality = landingQuality(game);
          const landingPoints = SCORE.landing + (quality === 'perfect' ? SCORE.landingPerfect : 0);
          const timeBonus = Math.max(0, game.mission.timeBonus - Math.floor(game.missionTime) * 5);
          addScore(game, landingPoints + timeBonus + SCORE.missionComplete);
          game.missionCompleteText =
            quality === 'perfect'
              ? `Greased it on the numbers! Landing +${landingPoints} · Time bonus +${timeBonus}`
              : `Down safe. Landing +${landingPoints} · Time bonus +${timeBonus}`;
          game.state = game.missionIndex + 1 >= MISSIONS.length ? 'victory' : 'missionComplete';
        } else {
          game.state = 'landedEarly';
        }
        audio.update(game.plane, false);
      }
      break;
    }
    case 'paused': {
      audio.update(game.plane, false);
      if (input.takeAction('pause') || input.takeAction('start') || input.takeClick()) {
        game.state = 'flying';
      }
      break;
    }
    case 'missionComplete': {
      if (input.takeAction('start') || input.takeClick()) {
        audio.click();
        startMission(game, game.missionIndex + 1);
        game.state = 'briefing';
      }
      break;
    }
    case 'crashed':
    case 'landedEarly': {
      if (input.takeAction('restart') || input.takeAction('start') || input.takeClick()) {
        audio.click();
        startMission(game, game.missionIndex);
        game.state = 'briefing';
      }
      break;
    }
    case 'victory': {
      if (input.takeAction('restart') || input.takeAction('start') || input.takeClick()) {
        audio.click();
        game.score = 0;
        startMission(game, 0);
        game.state = 'briefing';
      }
      break;
    }
    default:
      break;
  }
}
