// Skyline Courier — the flight model: throttle, pitch, roll, turns, stalls, fuel,
// ring threading and landings. Pure functions over a plain plane object.

import { FLIGHT, WORLD } from './config.js';
import { heightAt, onRunway } from './terrain.js';

export const KNOT_TO_MS = 0.514444;
export const M_TO_FT = 3.28084;

export function createPlane() {
  const rw = WORLD.runway;
  return {
    x: rw.x,
    z: rw.z - rw.length / 2 + 40, // on the numbers, ready to roll
    y: heightAt(rw.x, rw.z - rw.length / 2 + 40) + 1.6,
    heading: 0,          // 0 = north, clockwise
    pitch: 0,
    roll: 0,
    speed: 0,            // knots
    throttle: 0,         // 0..1
    fuel: FLIGHT.fuelCapacity,
    verticalSpeed: 0,    // metres per second, + up
    airborne: false,
    stalled: false,
    crashed: false,
    crashReason: '',
    landed: false,
    distanceFlown: 0,
  };
}

// One simulation step. `input` is { pitch, roll, throttle, brake } with pitch/roll
// in [-1, 1] and throttle in [0, 1]. `wind` is a crosswind in knots, + east.
export function updatePlane(plane, input, dt, wind) {
  if (plane.crashed || plane.landed) return;

  const speedMs = plane.speed * KNOT_TO_MS;

  // Throttle and speed: the engine pulls toward its throttle speed.
  plane.throttle = Math.min(1, Math.max(0, input.throttle));
  const targetSpeed = plane.throttle * FLIGHT.maxSpeed;
  const accel = plane.throttle > 0 ? FLIGHT.throttleAccel : -18;
  if (plane.speed < targetSpeed) {
    plane.speed = Math.min(targetSpeed, plane.speed + accel * dt);
  } else {
    plane.speed = Math.max(targetSpeed, plane.speed - FLIGHT.drag * plane.speed * dt);
  }
  if (input.brake) plane.speed = Math.max(0, plane.speed - 40 * dt);

  // Pitch and roll ease toward the pilot's demand.
  const maxPitch = 0.38;
  const maxRoll = 1.05;
  const pitchTarget = input.pitch * maxPitch;
  const rollTarget = input.roll * maxRoll;
  plane.pitch += clamp(pitchTarget - plane.pitch, -FLIGHT.pitchRate * dt, FLIGHT.pitchRate * dt);
  plane.roll += clamp(rollTarget - plane.roll, -FLIGHT.rollRate * dt, FLIGHT.rollRate * dt);

  // A banked wing turns the nose.
  plane.heading += Math.sin(plane.roll) * FLIGHT.turnRate * dt;
  plane.heading = (plane.heading + Math.PI * 2) % (Math.PI * 2);

  // Lift: pitch times speed, minus the sink when the wing is stalled.
  const lift = Math.sin(plane.pitch) * speedMs;
  plane.stalled = plane.speed < FLIGHT.minSpeed && plane.y - heightAt(plane.x, plane.z) > 4;
  let vs = lift;
  if (plane.stalled) vs -= FLIGHT.stallSink;
  // Ground effect softens the descent close to the ground.
  const agl = plane.y - heightAt(plane.x, plane.z);
  if (agl < FLIGHT.groundEffect * 0.3048 && vs < 0) vs *= 0.55;
  plane.verticalSpeed = vs;

  // Move.
  const dx = Math.sin(plane.heading) * speedMs * dt + wind * KNOT_TO_MS * dt;
  const dz = Math.cos(plane.heading) * speedMs * dt;
  plane.x += dx;
  plane.z += dz;
  plane.y += vs * dt;
  plane.distanceFlown += Math.hypot(dx, dz);
  if (plane.y - heightAt(plane.x, plane.z) > 3) plane.airborne = true;

  // Fuel: the engine drinks in proportion to throttle.
  plane.fuel -= FLIGHT.fuelBurn * (0.25 + plane.throttle * 0.75) * dt;
  if (plane.fuel <= 0) {
    plane.fuel = 0;
    plane.throttle = 0;
    if (plane.speed < FLIGHT.minSpeed && agl > 6) {
      crash(plane, 'Out of fuel — she glided down into the valley.');
    }
  }

  // The ground.
  const ground = heightAt(plane.x, plane.z);
  if (plane.y <= ground + 0.4) {
    plane.y = ground + 0.4;
    if (onRunway(plane.x, plane.z) && plane.airborne) {
      tryLand(plane);
    } else if (plane.airborne) {
      crash(plane, 'Terrain strike — the valley wins this one.');
    } else if (!onRunway(plane.x, plane.z)) {
      // Rolling on rough ground, not the runway: fast means the gear gives up.
      if (plane.speed > 70) {
        crash(plane, 'Ran off the runway — the rough ground tore the gear off.');
      }
      plane.speed = Math.max(0, plane.speed - 50 * dt);
      plane.y = ground + 1.6;
      plane.pitch = 0;
    } else {
      // Rolling on the runway: stay put, no crash.
      plane.y = ground + 1.6;
      plane.pitch = 0;
    }
  }

  // The valley has edges: turn back before the mountains eat you.
  if (Math.abs(plane.x) > 2600 || plane.z < -400 || plane.z > 5200) {
    plane.heading += Math.PI; // auto 180 — the valley ends here
    plane.heading %= Math.PI * 2;
  }
}

function tryLand(plane) {
  const vs = plane.verticalSpeed;
  const speed = plane.speed;
  if (speed >= FLIGHT.minSpeed * 0.9 && speed <= 105 && vs > -5.5 && Math.abs(plane.roll) < 0.25) {
    plane.landed = true;
    plane.speed = Math.max(0, plane.speed - 20);
  } else if (vs <= -5.5) {
    crash(plane, 'Hard landing — the gear folded on touchdown.');
  } else if (speed > 105) {
    crash(plane, 'Too fast on the numbers — she ran off the far end.');
  } else {
    crash(plane, 'Stalled onto the runway — not enough speed to fly.');
  }
}

function crash(plane, reason) {
  plane.crashed = true;
  plane.crashReason = reason;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// Ring threading: 3D distance from the plane to a ring centre.
export function ringDistance(plane, ring) {
  const dx = plane.x - ring.x;
  const dy = plane.y - ring.y;
  const dz = plane.z - ring.z;
  return Math.hypot(dx, dy, dz);
}

// Heading in degrees, 0..359, for the HUD compass.
export function headingDeg(plane) {
  return Math.round(((plane.heading * 180) / Math.PI) % 360);
}

// Altitude above ground in feet, for the HUD.
export function altitudeFt(plane) {
  return Math.max(0, Math.round((plane.y - heightAt(plane.x, plane.z)) * M_TO_FT));
}
