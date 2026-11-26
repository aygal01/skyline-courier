// Skyline Courier — screenshot presets. `?shot=start|play|land|end` puts the game
// in a fixed, deterministic state for a screenshot, with the world frozen so the
// frame is the same whenever it is taken.

import { FLIGHT, MISSIONS } from './config.js';
import { generateRings, heightAt } from './terrain.js';
import { createPlane } from './physics.js';

export function applyShot(game, shot) {
  game.frozen = true;
  game.time = 12.5; // fixed light: strobe and prop sit the same every time

  if (shot === 'start') {
    game.state = 'title';
    game.plane = createPlane();
    game.plane.throttle = 0.35;
    game.rings = generateRings(MISSIONS[0]);
    game.bestScore = 1250;
    return;
  }

  if (shot === 'play') {
    game.state = 'flying';
    game.missionIndex = 0;
    game.mission = MISSIONS[0];
    game.rings = generateRings(MISSIONS[0]);
    game.rings[0].passed = true;
    game.rings[1].passed = true;
    game.score = 650;
    game.missionScore = 650;
    game.bestScore = 1250;
    const plane = createPlane();
    const next = game.rings[2];
    plane.x = next.x - 40;
    plane.z = next.z - 260;
    plane.y = next.y + 18;
    plane.heading = 0.08;
    plane.pitch = 0.04;
    plane.roll = -0.08;
    plane.speed = 148;
    plane.throttle = 0.72;
    plane.fuel = 78;
    plane.airborne = true;
    game.plane = plane;
    game.message = 'RING! +250';
    game.messageSub = 'Ring 2 of 6 · fuel +6%';
    game.messageTimer = 99;
    return;
  }

  if (shot === 'land') {
    game.state = 'flying';
    game.missionIndex = 2;
    game.mission = MISSIONS[2];
    game.rings = generateRings(MISSIONS[2]);
    for (const ring of game.rings) ring.passed = true;
    game.score = 3420;
    game.missionScore = 3420;
    game.bestScore = 3420;
    const plane = createPlane();
    // Turning onto final from the west: the runway lies ahead and to the right.
    plane.x = -120;
    plane.z = 800 - 310 - 620; // 620 m short of the threshold
    plane.y = heightAt(plane.x, plane.z) + 110;
    plane.heading = 0.02;
    plane.pitch = -0.05;
    plane.roll = 0.12;
    plane.speed = 82;
    plane.throttle = 0.3;
    plane.fuel = 41;
    plane.airborne = true;
    plane.verticalSpeed = -2.4;
    game.plane = plane;
    game.message = 'TURNING FINAL — RUNWAY 36';
    game.messageSub = 'All rings flown · 82 kt · line her up';
    game.messageTimer = 99;
    return;
  }

  if (shot === 'end') {
    game.state = 'victory';
    game.missionIndex = 2;
    game.mission = MISSIONS[2];
    game.rings = generateRings(MISSIONS[2]);
    for (const ring of game.rings) ring.passed = true;
    game.score = 5840;
    game.missionScore = 2100;
    game.bestScore = 5840;
    game.plane = createPlane();
    game.plane.throttle = 0;
    return;
  }
}
