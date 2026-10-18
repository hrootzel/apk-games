import type { ArcadeParticle, InputSnapshot, Vec2, VectorPath } from './types';

export interface SwarmPlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  aimAngle: number;
  invulnerableMs: number;
}

export type SwarmEnemyKind = 'chaser' | 'spinner';

export interface SwarmEnemyState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  kind: SwarmEnemyKind;
  phase: number;
  color: number;
}

export interface SwarmBulletState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifeMs: number;
  color: number;
}

export interface SwarmParticleState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifeMs: number;
  maxLifeMs: number;
  color: number;
  size: number;
  rotation: number;
  spin: number;
}

export interface SwarmRippleState {
  x: number;
  y: number;
  ageMs: number;
  durationMs: number;
  amplitude: number;
}

export interface PhosphorSwarmState {
  width: number;
  height: number;
  player: SwarmPlayerState;
  bullets: SwarmBulletState[];
  enemies: SwarmEnemyState[];
  particles: SwarmParticleState[];
  ripples: SwarmRippleState[];
  score: number;
  lives: number;
  wave: number;
  pulseBombs: number;
  fireCooldownMs: number;
  dashCooldownMs: number;
  paused: boolean;
  elapsedMs: number;
  nextEnemyId: number;
}

export interface PhosphorSwarmOptions {
  onSettingsRequested?: () => void;
  random?: () => number;
  initialEnemyCount?: number;
  autoAdvance?: boolean;
}

const TAU = Math.PI * 2;
const ENEMY_COLORS = [0xff5ce1, 0x61f8ff, 0xffb548, 0x9cff57, 0xb98cff];

/**
 * Geometry-Wars/Robotron-inspired arena shooter. The simulation stays Pixi-free;
 * high-volume sparks are exported as ArcadeParticle snapshots for ParticleRenderer.
 */
export class PhosphorSwarmGame {
  private width = 1600;
  private height = 1000;
  private player: SwarmPlayerState = this.newPlayer();
  private bullets: SwarmBulletState[] = [];
  private enemies: SwarmEnemyState[] = [];
  private particles: SwarmParticleState[] = [];
  private ripples: SwarmRippleState[] = [];
  private score = 0;
  private lives = 3;
  private wave = 1;
  private pulseBombs = 2;
  private fireCooldownMs = 0;
  private dashCooldownMs = 0;
  private paused = false;
  private elapsedMs = 0;
  private nextEnemyId = 1;
  private lastInput: InputSnapshot | null = null;
  private readonly onSettingsRequested?: () => void;
  private readonly random: () => number;
  private readonly autoAdvance: boolean;

  constructor(options: PhosphorSwarmOptions = {}) {
    this.onSettingsRequested = options.onSettingsRequested;
    this.random = options.random ?? Math.random;
    this.autoAdvance = options.autoAdvance ?? true;
    this.spawnWave(options.initialEnemyCount ?? 8);
  }

  resize(width: number, height: number): void {
    const oldWidth = this.width;
    const oldHeight = this.height;
    const centeredAtBoot = this.elapsedMs === 0
      && Math.abs(this.player.x - oldWidth * 0.5) < 0.001
      && Math.abs(this.player.y - oldHeight * 0.5) < 0.001;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    if (centeredAtBoot) {
      this.player.x = this.width * 0.5;
      this.player.y = this.height * 0.5;
    } else {
      this.player.x = this.clamp(this.player.x, 0, this.width);
      this.player.y = this.clamp(this.player.y, 0, this.height);
    }
    for (const enemy of this.enemies) {
      enemy.x = this.clamp(enemy.x, 8, Math.max(8, this.width - 8));
      enemy.y = this.clamp(enemy.y, 8, Math.max(8, this.height - 8));
    }
  }

  update(dtMs: number, input: InputSnapshot): void {
    const safeDtMs = Math.max(0, dtMs);
    const dt = Math.min(safeDtMs, 50) / 1000;

    if (this.wasPressed(input, 'start')) this.paused = !this.paused;
    if (this.wasPressed(input, 'select')) this.onSettingsRequested?.();
    if (this.paused) {
      this.lastInput = input;
      return;
    }

    this.elapsedMs += safeDtMs;
    this.fireCooldownMs -= safeDtMs;
    this.dashCooldownMs = Math.max(0, this.dashCooldownMs - safeDtMs);
    this.player.invulnerableMs = Math.max(0, this.player.invulnerableMs - safeDtMs);

    this.updatePlayer(dt, input);
    this.updateCombat(safeDtMs, dt, input);
    this.updateEnemies(dt);
    this.updateBullets(safeDtMs, dt);
    this.updateParticles(safeDtMs, dt);
    this.updateRipples(safeDtMs);
    this.resolveBulletCollisions();
    this.resolvePlayerCollisions();

    if (this.autoAdvance && this.enemies.length === 0) {
      this.wave += 1;
      if (this.wave % 3 === 0) this.pulseBombs = Math.min(3, this.pulseBombs + 1);
      this.spawnWave(Math.min(24, 6 + this.wave * 2));
    }

    this.lastInput = input;
  }

  getVectorPaths(input: InputSnapshot): VectorPath[] {
    const paths: VectorPath[] = [];
    paths.push(...this.gridPaths());

    const aim = this.aimDirection();
    const playerBlink = this.player.invulnerableMs > 0 && Math.floor(this.player.invulnerableMs / 70) % 2 === 0;
    if (!playerBlink) {
      const side = { x: -aim.y, y: aim.x };
      paths.push({
        points: [
          { x: this.player.x + aim.x * 20, y: this.player.y + aim.y * 20 },
          { x: this.player.x - aim.x * 12 + side.x * 11, y: this.player.y - aim.y * 12 + side.y * 11 },
          { x: this.player.x - aim.x * 5, y: this.player.y - aim.y * 5 },
          { x: this.player.x - aim.x * 12 - side.x * 11, y: this.player.y - aim.y * 12 - side.y * 11 },
        ],
        color: 0x72fff2,
        intensity: 1.35,
        width: 1.45,
        closed: true,
      });
      paths.push({
        points: [
          { x: this.player.x + aim.x * 12, y: this.player.y + aim.y * 12 },
          { x: this.player.x + aim.x * 48, y: this.player.y + aim.y * 48 },
        ],
        color: input.buttons.a ? 0xffffff : 0x72fff2,
        intensity: input.buttons.a ? 1.2 : 0.45,
        width: 0.85,
      });
    }

    for (const enemy of this.enemies) paths.push(...this.enemyPaths(enemy));
    for (const bullet of this.bullets) {
      const speed = Math.max(1, Math.hypot(bullet.vx, bullet.vy));
      const ux = bullet.vx / speed;
      const uy = bullet.vy / speed;
      paths.push({
        points: [
          { x: bullet.x - ux * 9, y: bullet.y - uy * 9 },
          { x: bullet.x + ux * 9, y: bullet.y + uy * 9 },
        ],
        color: bullet.color,
        intensity: 1.55,
        width: 1.25,
      });
    }

    for (const ripple of this.ripples) {
      const t = ripple.ageMs / ripple.durationMs;
      const radius = 30 + t * 300;
      const points: Vec2[] = [];
      for (let i = 0; i < 28; i += 1) {
        const angle = (i / 28) * TAU;
        points.push({ x: ripple.x + Math.cos(angle) * radius, y: ripple.y + Math.sin(angle) * radius });
      }
      paths.push({ points, color: 0x8c6cff, intensity: (1 - t) * 0.9, width: 1.0, closed: true });
    }

    return paths;
  }

  getParticles(): ArcadeParticle[] {
    return this.particles.map((particle) => {
      const alpha = Math.max(0, particle.lifeMs / Math.max(1, particle.maxLifeMs));
      const speed = Math.hypot(particle.vx, particle.vy);
      return {
        x: particle.x,
        y: particle.y,
        color: particle.color,
        alpha: alpha * 0.92,
        size: particle.size * (0.5 + alpha * 0.8),
        rotation: particle.rotation,
        stretch: 1 + Math.min(3.5, speed / 180),
      };
    });
  }

  getHudText(): string {
    return `SWARM ${String(this.score).padStart(7, '0')}  //  WAVE ${String(this.wave).padStart(2, '0')}  //  LIVES ${this.lives}  //  BOMB ${this.pulseBombs}${this.paused ? '  //  PAUSED' : ''}`;
  }

  exportState(): PhosphorSwarmState {
    return {
      width: this.width,
      height: this.height,
      player: { ...this.player },
      bullets: this.bullets.map((bullet) => ({ ...bullet })),
      enemies: this.enemies.map((enemy) => ({ ...enemy })),
      particles: this.particles.map((particle) => ({ ...particle })),
      ripples: this.ripples.map((ripple) => ({ ...ripple })),
      score: this.score,
      lives: this.lives,
      wave: this.wave,
      pulseBombs: this.pulseBombs,
      fireCooldownMs: this.fireCooldownMs,
      dashCooldownMs: this.dashCooldownMs,
      paused: this.paused,
      elapsedMs: this.elapsedMs,
      nextEnemyId: this.nextEnemyId,
    };
  }

  importState(state: PhosphorSwarmState): void {
    this.width = Math.max(1, state.width);
    this.height = Math.max(1, state.height);
    this.player = { ...state.player };
    this.bullets = state.bullets.map((bullet) => ({ ...bullet }));
    this.enemies = state.enemies.map((enemy) => ({ ...enemy }));
    this.particles = state.particles.map((particle) => ({ ...particle }));
    this.ripples = state.ripples.map((ripple) => ({ ...ripple }));
    this.score = state.score;
    this.lives = state.lives;
    this.wave = state.wave;
    this.pulseBombs = state.pulseBombs;
    this.fireCooldownMs = state.fireCooldownMs;
    this.dashCooldownMs = state.dashCooldownMs;
    this.paused = state.paused;
    this.elapsedMs = state.elapsedMs;
    this.nextEnemyId = state.nextEnemyId;
    this.lastInput = null;
  }

  private updatePlayer(dt: number, input: InputSnapshot): void {
    const move = input.joystick;
    const moveLength = Math.min(1, Math.hypot(move.x, move.y));
    if (moveLength > 0.03) {
      const accel = 760;
      this.player.vx += (move.x / Math.max(moveLength, 0.001)) * accel * moveLength * dt;
      this.player.vy += (move.y / Math.max(moveLength, 0.001)) * accel * moveLength * dt;
    }
    const aimLength = Math.hypot(input.aim.x, input.aim.y);
    if (aimLength > 0.12) this.player.aimAngle = Math.atan2(input.aim.y, input.aim.x);

    this.player.vx *= Math.pow(0.90, dt * 60);
    this.player.vy *= Math.pow(0.90, dt * 60);
    const speed = Math.hypot(this.player.vx, this.player.vy);
    const maxSpeed = 430;
    if (speed > maxSpeed) {
      this.player.vx *= maxSpeed / speed;
      this.player.vy *= maxSpeed / speed;
    }
    const margin = 26;
    this.player.x = this.clamp(this.player.x + this.player.vx * dt, margin, Math.max(margin, this.width - margin));
    this.player.y = this.clamp(this.player.y + this.player.vy * dt, margin, Math.max(margin, this.height - margin));
  }

  private updateCombat(dtMs: number, dt: number, input: InputSnapshot): void {
    if (input.buttons.a && this.fireCooldownMs <= 0) {
      this.fire();
      this.fireCooldownMs = 92;
    }

    if (this.wasPressed(input, 'b') && this.dashCooldownMs <= 0) {
      const moveLength = Math.hypot(input.joystick.x, input.joystick.y);
      const direction = moveLength > 0.15
        ? { x: input.joystick.x / moveLength, y: input.joystick.y / moveLength }
        : this.aimDirection();
      this.player.vx += direction.x * 620;
      this.player.vy += direction.y * 620;
      this.player.invulnerableMs = Math.max(this.player.invulnerableMs, 260);
      this.dashCooldownMs = 900;
      this.addRipple(this.player.x, this.player.y, 55);
      this.emitBurst(this.player.x, this.player.y, 0x61f8ff, 18, 120, 340);
    }

    if (this.wasPressed(input, 'x') && this.pulseBombs > 0) this.pulseBomb();

    if (input.buttons.y) {
      for (const enemy of this.enemies) {
        const dx = enemy.x - this.player.x;
        const dy = enemy.y - this.player.y;
        const distance = Math.max(18, Math.hypot(dx, dy));
        if (distance > 290) continue;
        const strength = (1 - distance / 290) * 950;
        enemy.vx += (dx / distance) * strength * dt;
        enemy.vy += (dy / distance) * strength * dt;
      }
      if (Math.floor(this.elapsedMs / 55) !== Math.floor((this.elapsedMs - dtMs) / 55)) {
        this.emitBurst(this.player.x, this.player.y, 0xb98cff, 3, 70, 160);
      }
    }
  }

  private updateEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      const dx = this.player.x - enemy.x;
      const dy = this.player.y - enemy.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const nx = dx / distance;
      const ny = dy / distance;
      enemy.phase += dt * (enemy.kind === 'spinner' ? 3.2 : 1.4);
      const tangentX = -ny;
      const tangentY = nx;
      const chase = enemy.kind === 'spinner' ? 105 : 180;
      const orbit = enemy.kind === 'spinner' ? Math.sin(enemy.phase) * 190 : 0;
      enemy.vx += (nx * chase + tangentX * orbit) * dt;
      enemy.vy += (ny * chase + tangentY * orbit) * dt;
      enemy.vx *= Math.pow(0.985, dt * 60);
      enemy.vy *= Math.pow(0.985, dt * 60);
      enemy.x = this.clamp(enemy.x + enemy.vx * dt, 8, Math.max(8, this.width - 8));
      enemy.y = this.clamp(enemy.y + enemy.vy * dt, 8, Math.max(8, this.height - 8));
    }
  }

  private updateBullets(dtMs: number, dt: number): void {
    for (const bullet of this.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.lifeMs -= dtMs;
    }
    this.bullets = this.bullets.filter((bullet) => bullet.lifeMs > 0
      && bullet.x >= -40 && bullet.x <= this.width + 40 && bullet.y >= -40 && bullet.y <= this.height + 40);
  }

  private updateParticles(dtMs: number, dt: number): void {
    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.pow(0.95, dt * 60);
      particle.vy *= Math.pow(0.95, dt * 60);
      particle.rotation += particle.spin * dt;
      particle.lifeMs -= dtMs;
    }
    this.particles = this.particles.filter((particle) => particle.lifeMs > 0).slice(-1400);
  }

  private updateRipples(dtMs: number): void {
    for (const ripple of this.ripples) ripple.ageMs += dtMs;
    this.ripples = this.ripples.filter((ripple) => ripple.ageMs < ripple.durationMs);
  }

  private fire(): void {
    const direction = this.aimDirection();
    const speed = 780;
    this.bullets.push({
      x: this.player.x + direction.x * 24,
      y: this.player.y + direction.y * 24,
      vx: direction.x * speed + this.player.vx * 0.25,
      vy: direction.y * speed + this.player.vy * 0.25,
      lifeMs: 780,
      color: 0xeaffff,
    });
    this.emitBurst(this.player.x + direction.x * 20, this.player.y + direction.y * 20, 0x72fff2, 3, 35, 130);
  }

  private pulseBomb(): void {
    this.pulseBombs -= 1;
    this.addRipple(this.player.x, this.player.y, 95);
    const survivors: SwarmEnemyState[] = [];
    for (const enemy of this.enemies) {
      const distance = Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y);
      if (distance <= 420) {
        this.score += 125;
        this.emitBurst(enemy.x, enemy.y, enemy.color, 28, 120, 430);
      } else {
        const dx = enemy.x - this.player.x;
        const dy = enemy.y - this.player.y;
        const safe = Math.max(1, distance);
        enemy.vx += (dx / safe) * 450;
        enemy.vy += (dy / safe) * 450;
        survivors.push(enemy);
      }
    }
    this.enemies = survivors;
    this.emitBurst(this.player.x, this.player.y, 0xffffff, 80, 180, 520);
  }

  private resolveBulletCollisions(): void {
    const bulletsRemoved = new Set<SwarmBulletState>();
    const enemiesRemoved = new Set<SwarmEnemyState>();
    for (const bullet of this.bullets) {
      for (const enemy of this.enemies) {
        const radius = enemy.radius + 5;
        const dx = bullet.x - enemy.x;
        const dy = bullet.y - enemy.y;
        if (dx * dx + dy * dy > radius * radius) continue;
        bulletsRemoved.add(bullet);
        enemy.hp -= 1;
        this.emitBurst(bullet.x, bullet.y, enemy.color, 8, 70, 210);
        if (enemy.hp <= 0) {
          enemiesRemoved.add(enemy);
          this.score += enemy.kind === 'spinner' ? 180 : 110;
          this.emitBurst(enemy.x, enemy.y, enemy.color, enemy.kind === 'spinner' ? 34 : 24, 110, 390);
          this.addRipple(enemy.x, enemy.y, enemy.kind === 'spinner' ? 38 : 26);
        }
        break;
      }
    }
    this.bullets = this.bullets.filter((bullet) => !bulletsRemoved.has(bullet));
    this.enemies = this.enemies.filter((enemy) => !enemiesRemoved.has(enemy));
  }

  private resolvePlayerCollisions(): void {
    if (this.player.invulnerableMs > 0) return;
    for (const enemy of this.enemies) {
      const radius = enemy.radius + 13;
      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;
      if (dx * dx + dy * dy > radius * radius) continue;
      this.lives = Math.max(0, this.lives - 1);
      this.emitBurst(this.player.x, this.player.y, 0x72fff2, 60, 130, 450);
      this.addRipple(this.player.x, this.player.y, 70);
      this.player = this.newPlayer();
      this.player.invulnerableMs = 1300;
      if (this.lives === 0) {
        this.score = 0;
        this.wave = 1;
        this.lives = 3;
        this.pulseBombs = 2;
        this.enemies = [];
        this.spawnWave(8);
      }
      break;
    }
  }

  private spawnWave(count: number): void {
    for (let i = 0; i < count; i += 1) {
      const edge = Math.floor(this.random() * 4);
      const margin = 34;
      const x = edge === 0 ? margin : edge === 1 ? this.width - margin : margin + this.random() * Math.max(1, this.width - margin * 2);
      const y = edge === 2 ? margin : edge === 3 ? this.height - margin : margin + this.random() * Math.max(1, this.height - margin * 2);
      const kind: SwarmEnemyKind = this.random() > 0.72 ? 'spinner' : 'chaser';
      this.enemies.push({
        id: this.nextEnemyId++,
        x,
        y,
        vx: 0,
        vy: 0,
        radius: kind === 'spinner' ? 20 : 16,
        hp: kind === 'spinner' ? 2 : 1,
        kind,
        phase: this.random() * TAU,
        color: ENEMY_COLORS[Math.floor(this.random() * ENEMY_COLORS.length)] ?? 0xff5ce1,
      });
    }
  }

  private emitBurst(x: number, y: number, color: number, count: number, minSpeed: number, maxSpeed: number): void {
    for (let i = 0; i < count; i += 1) {
      const angle = this.random() * TAU;
      const speed = minSpeed + this.random() * Math.max(0, maxSpeed - minSpeed);
      const lifeMs = 260 + this.random() * 720;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        lifeMs,
        maxLifeMs: lifeMs,
        color,
        size: 2 + this.random() * 5,
        rotation: angle,
        spin: (this.random() - 0.5) * 8,
      });
    }
  }

  private addRipple(x: number, y: number, amplitude: number): void {
    this.ripples.push({ x, y, ageMs: 0, durationMs: 720, amplitude });
  }

  private gridPaths(): VectorPath[] {
    const paths: VectorPath[] = [];
    const cols = 10;
    const rows = 7;
    const samples = 18;
    for (let c = 0; c <= cols; c += 1) {
      const x = (c / cols) * this.width;
      const points: Vec2[] = [];
      for (let s = 0; s <= samples; s += 1) points.push(this.warpPoint(x, (s / samples) * this.height));
      paths.push({ points, color: c % 2 ? 0x174f69 : 0x205f78, intensity: 0.22, width: 0.55 });
    }
    for (let r = 0; r <= rows; r += 1) {
      const y = (r / rows) * this.height;
      const points: Vec2[] = [];
      for (let s = 0; s <= samples; s += 1) points.push(this.warpPoint((s / samples) * this.width, y));
      paths.push({ points, color: r % 2 ? 0x4b1f66 : 0x562677, intensity: 0.2, width: 0.55 });
    }
    return paths;
  }

  private warpPoint(x: number, y: number): Vec2 {
    let wx = x;
    let wy = y;
    for (const ripple of this.ripples) {
      const dx = x - ripple.x;
      const dy = y - ripple.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const t = ripple.ageMs / ripple.durationMs;
      const ring = 35 + t * 300;
      const influence = Math.exp(-Math.pow((distance - ring) / 85, 2)) * (1 - t) * ripple.amplitude;
      wx += (dx / distance) * influence;
      wy += (dy / distance) * influence;
    }
    const shimmer = Math.sin((x + y) * 0.008 + this.elapsedMs * 0.0015) * 1.4;
    return { x: wx, y: wy + shimmer };
  }

  private enemyPaths(enemy: SwarmEnemyState): VectorPath[] {
    const points: Vec2[] = [];
    const vertices = enemy.kind === 'spinner' ? 6 : 4;
    const rotation = enemy.phase + (enemy.kind === 'spinner' ? this.elapsedMs * 0.0018 : 0);
    for (let i = 0; i < vertices; i += 1) {
      const angle = rotation + (i / vertices) * TAU;
      const radius = enemy.radius * (i % 2 === 0 ? 1 : 0.62);
      points.push({ x: enemy.x + Math.cos(angle) * radius, y: enemy.y + Math.sin(angle) * radius });
    }
    const result: VectorPath[] = [{ points, color: enemy.color, intensity: 0.95, width: 1.2, closed: true }];
    if (enemy.kind === 'spinner') {
      result.push({
        points: [
          { x: enemy.x - enemy.radius * 1.5, y: enemy.y },
          { x: enemy.x + enemy.radius * 1.5, y: enemy.y },
        ],
        color: 0xffffff,
        intensity: 0.55,
        width: 0.7,
      });
    }
    return result;
  }

  private aimDirection(): Vec2 {
    return { x: Math.cos(this.player.aimAngle), y: Math.sin(this.player.aimAngle) };
  }

  private newPlayer(): SwarmPlayerState {
    return {
      x: this.width * 0.5,
      y: this.height * 0.5,
      vx: 0,
      vy: 0,
      aimAngle: 0,
      invulnerableMs: 0,
    };
  }

  private wasPressed(input: InputSnapshot, button: keyof InputSnapshot['buttons']): boolean {
    return input.buttons[button] && !(this.lastInput?.buttons[button] ?? false);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
