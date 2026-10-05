import type { SoundCue } from './audio';
import type { Settings } from './storage';

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 540;
const COLUMNS = 8;
const GAP = 10;
const PAD = 25;
const STEP = (GAME_WIDTH - PAD * 2 + GAP) / COLUMNS;
const BRICK_SIZE = STEP - GAP;
const BALL_RADIUS = 5;
const SPEED = 760;
const LAUNCH_Y = GAME_HEIGHT - 37;
const DANGER_Y = GAME_HEIGHT - 78;
const WALL = 12;
const PALETTE = ['#b06cff', '#8178ff', '#568cff', '#35cddd', '#b7ee65', '#f0ce68'];

export type Phase = 'menu' | 'aiming' | 'shooting' | 'advancing' | 'paused' | 'gameover';

export interface Snapshot {
  phase: Phase;
  score: number;
  wave: number;
  balls: number;
  remaining: number;
  combo: number;
  angle: number;
}

export const INITIAL_SNAPSHOT: Snapshot = {
  phase: 'menu', score: 0, wave: 1, balls: 20, remaining: 0, combo: 0, angle: -2.25,
};

interface Point { x: number; y: number }
interface Brick extends Point { id: number; targetY: number; hp: number; maxHp: number; color: string; hit: number }
interface Ball extends Point { vx: number; vy: number; trail: Point[]; age: number }
interface Pickup extends Point { targetY: number }
interface Particle extends Point { vx: number; vy: number; life: number; maxLife: number; color: string; size: number }
interface Popup extends Point { text: string; color: string; life: number; big?: boolean }
interface Ring extends Point { color: string; life: number }

interface EngineCallbacks {
  onChange: (snapshot: Snapshot) => void;
  onGameOver: (score: number, wave: number) => void;
  onSound: (cue: SoundCue, value?: number) => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function rayRect(x: number, y: number, dx: number, dy: number, brick: Brick): number {
  const left = (brick.x - BALL_RADIUS - x) / (dx || 0.000001);
  const right = (brick.x + BRICK_SIZE + BALL_RADIUS - x) / (dx || 0.000001);
  const top = (brick.y - BALL_RADIUS - y) / (dy || 0.000001);
  const bottom = (brick.y + BRICK_SIZE + BALL_RADIUS - y) / (dy || 0.000001);
  const near = Math.max(Math.min(left, right), Math.min(top, bottom));
  const far = Math.min(Math.max(left, right), Math.max(top, bottom));
  return far >= near && near > 0 ? near : Infinity;
}

export class NeonEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;
  private settings: Settings;
  private observer: ResizeObserver;
  private frame = 0;
  private disposed = false;
  private lastTime = 0;
  private accumulator = 0;
  private time = 0;
  private phase: Phase = 'menu';
  private pausedPhase: Phase = 'aiming';
  private score = 0;
  private wave = 1;
  private ballCount = 20;
  private angle = -2.25;
  private launchX = GAME_WIDTH / 2;
  private firstLanding: number | null = null;
  private balls: Ball[] = [];
  private bricks: Brick[] = [];
  private pickups: Pickup[] = [];
  private particles: Particle[] = [];
  private popups: Popup[] = [];
  private rings: Ring[] = [];
  private brickSprites = new Map<string, HTMLCanvasElement>();
  private ballSprite: HTMLCanvasElement;
  private background: HTMLCanvasElement;
  private nextId = 0;
  private launched = 0;
  private volleySize = 20;
  private spawnClock = 0;
  private roundTime = 0;
  private transitionTime = 0;
  private recallMode = false;
  private combo = 0;
  private comboTime = 0;
  private shake = 0;
  private emitClock = 0;
  private lastHaptic = 0;
  private leftPressed = false;
  private rightPressed = false;
  private fineAim = false;

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks, settings: Settings) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas 2D is not supported in this browser.');
    this.ctx = context;
    this.callbacks = callbacks;
    this.settings = settings;
    this.background = this.makeBackground();
    this.ballSprite = this.makeBallSprite();
    PALETTE.forEach((color) => this.brickSprites.set(color, this.makeBrickSprite(color)));
    this.makeInitialBricks(true);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.frame = requestAnimationFrame(this.tick);
  }

  private makeBackground() {
    const canvas = document.createElement('canvas');
    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, '#10101b');
    gradient.addColorStop(0.65, '#101019');
    gradient.addColorStop(1, '#0e1516');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const glow = ctx.createRadialGradient(GAME_WIDTH / 2, GAME_HEIGHT, 0, GAME_WIDTH / 2, GAME_HEIGHT, 330);
    glow.addColorStop(0, '#a9ed6410');
    glow.addColorStop(1, '#a9ed6400');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.strokeStyle = '#b0b9db06';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < GAME_WIDTH; x += 30) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, GAME_HEIGHT); }
    for (let y = 0; y < GAME_HEIGHT; y += 30) { ctx.moveTo(0, y + 0.5); ctx.lineTo(GAME_WIDTH, y + 0.5); }
    ctx.stroke();
    ctx.fillStyle = '#adb5d826';
    for (let x = 30; x < GAME_WIDTH; x += 90) {
      for (let y = 30; y < GAME_HEIGHT; y += 90) ctx.fillRect(x, y, 1, 1);
    }
    return canvas;
  }

  private makeBrickSprite(color: string) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(BRICK_SIZE + 36);
    canvas.height = canvas.width;
    const ctx = canvas.getContext('2d')!;
    const padding = 18;
    const fill = ctx.createLinearGradient(0, padding, 0, padding + BRICK_SIZE);
    fill.addColorStop(0, `${color}19`);
    fill.addColorStop(0.5, `${color}06`);
    fill.addColorStop(1, `${color}1c`);
    roundedRect(ctx, padding, padding, BRICK_SIZE, BRICK_SIZE, 4);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = `${color}88`;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    roundedRect(ctx, padding + 4, padding + 4, BRICK_SIZE - 8, BRICK_SIZE - 8, 2);
    ctx.strokeStyle = `${color}24`;
    ctx.lineWidth = 1;
    ctx.stroke();
    return canvas;
  }

  private makeBallSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 40;
    const ctx = canvas.getContext('2d')!;
    const glow = ctx.createRadialGradient(20, 20, 2, 20, 20, 20);
    glow.addColorStop(0, '#ffffff');
    glow.addColorStop(0.23, '#ffffff');
    glow.addColorStop(0.3, '#f1ffdf70');
    glow.addColorStop(1, '#eaffcd00');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 40, 40);
    return canvas;
  }

  private resize() {
    const bounds = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(bounds.width * dpr));
    this.canvas.height = Math.max(1, Math.round(bounds.height * dpr));
  }

  private makeInitialBricks(preview = false) {
    this.bricks = [];
    this.pickups = [];
    const pattern = [
      [0, 1, 2, 3, 4, 5, 6, 7],
      [0, 1, 2, 5, 6, 7],
      [0, 1, 6, 7],
      [0, 1, 7],
    ];
    const colors = [PALETTE[0], PALETTE[2], PALETTE[3], PALETTE[4]];
    pattern.forEach((columns, row) => {
      columns.forEach((column) => {
        const hp = preview ? [24, 18, 12, 8][row] + (column * 7 % 9) : Math.max(2, 9 - row * 2 + Math.floor(Math.random() * 3));
        const y = 29 + row * STEP;
        this.bricks.push({ id: this.nextId++, x: PAD + column * STEP, y, targetY: y, hp, maxHp: hp, color: colors[row], hit: 0 });
      });
    });
    this.pickups.push({ x: PAD + 4 * STEP + BRICK_SIZE / 2, y: 29 + 2 * STEP + BRICK_SIZE / 2, targetY: 29 + 2 * STEP + BRICK_SIZE / 2 });
  }

  getSnapshot(): Snapshot {
    return {
      phase: this.phase, score: this.score, wave: this.wave, balls: this.ballCount,
      remaining: this.phase === 'shooting' ? this.balls.length + this.volleySize - this.launched : 0,
      combo: this.comboTime > 0 ? this.combo : 0, angle: this.angle,
    };
  }

  private emit() {
    this.emitClock = 0;
    this.callbacks.onChange(this.getSnapshot());
  }

  setSettings(settings: Settings) {
    this.settings = settings;
    if (!settings.effects) {
      this.particles = [];
      this.rings = [];
      this.shake = 0;
      this.balls.forEach((ball) => { ball.trail = []; });
    }
  }

  start() {
    this.score = 0;
    this.wave = 1;
    this.ballCount = 20;
    this.angle = -2.25;
    this.launchX = GAME_WIDTH / 2;
    this.balls = [];
    this.particles = [];
    this.popups = [];
    this.rings = [];
    this.combo = 0;
    this.comboTime = 0;
    this.shake = 0;
    this.roundTime = 0;
    this.clearKeys();
    this.makeInitialBricks();
    this.phase = 'aiming';
    this.callbacks.onSound('start');
    this.emit();
  }

  menu() {
    this.phase = 'menu';
    this.score = 0;
    this.wave = 1;
    this.ballCount = 20;
    this.balls = [];
    this.particles = [];
    this.popups = [];
    this.rings = [];
    this.combo = 0;
    this.launchX = GAME_WIDTH / 2;
    this.clearKeys();
    this.makeInitialBricks(true);
    this.emit();
  }

  pause() {
    if (!['aiming', 'shooting', 'advancing'].includes(this.phase)) return false;
    this.pausedPhase = this.phase;
    this.phase = 'paused';
    this.shake = 0;
    this.clearKeys();
    this.emit();
    return true;
  }

  resume() {
    if (this.phase !== 'paused') return;
    this.phase = this.pausedPhase;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.emit();
  }

  setKey(key: string, pressed: boolean) {
    if (key === 'ArrowLeft' || key.toLowerCase() === 'a') this.leftPressed = pressed;
    if (key === 'ArrowRight' || key.toLowerCase() === 'd') this.rightPressed = pressed;
    if (key === 'Shift') this.fineAim = pressed;
  }

  clearKeys() {
    this.leftPressed = this.rightPressed = this.fineAim = false;
  }

  aimAt(x: number, y: number) {
    if (this.phase !== 'aiming' || y > LAUNCH_Y - 12) return false;
    this.angle = clamp(Math.atan2(y - LAUNCH_Y, x - this.launchX), -Math.PI + 0.13, -0.13);
    return true;
  }

  nudgeAim(direction: number) {
    if (this.phase !== 'aiming') return;
    this.angle = clamp(this.angle + direction * 0.045, -Math.PI + 0.13, -0.13);
    this.emit();
  }

  shoot() {
    if (this.phase !== 'aiming') return;
    this.phase = 'shooting';
    this.volleySize = this.ballCount;
    this.launched = 0;
    this.spawnClock = 0;
    this.roundTime = 0;
    this.firstLanding = null;
    this.recallMode = false;
    this.balls = [];
    this.callbacks.onSound('shoot');
    this.emit();
  }

  recall() {
    if (this.phase !== 'shooting') return;
    this.recallMode = true;
    this.launched = this.volleySize;
    this.firstLanding ??= this.launchX;
    this.emit();
  }

  private addRow() {
    const empty: number[] = [];
    let added = 0;
    for (let column = 0; column < COLUMNS; column++) {
      const mustAdd = COLUMNS - column <= 2 - added;
      if (!mustAdd && Math.random() > Math.min(0.75, 0.5 + this.wave * 0.012)) { empty.push(column); continue; }
      const hp = Math.max(2, Math.ceil(this.wave * 1.6 + Math.random() * (3 + this.wave * 0.55)));
      this.bricks.push({
        id: this.nextId++, x: PAD + column * STEP, y: -BRICK_SIZE - 6, targetY: 29,
        hp, maxHp: hp, color: PALETTE[(this.wave + column) % PALETTE.length], hit: 0,
      });
      added++;
    }
    if (empty.length && this.pickups.length < 3) {
      const column = empty[Math.floor(Math.random() * empty.length)];
      this.pickups.push({ x: PAD + column * STEP + BRICK_SIZE / 2, y: -35, targetY: 29 + BRICK_SIZE / 2 });
    }
  }

  private finishRound() {
    if (this.phase !== 'shooting') return;
    if (this.bricks.length === 0) {
      this.score += 250;
      this.popups.push({ x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, text: 'PERFECT! +250', color: '#c2f884', life: 1.5, big: true });
    }
    this.launchX = clamp(this.firstLanding ?? this.launchX, 24, GAME_WIDTH - 24);
    this.ballCount = Math.min(90, this.ballCount + 1);
    this.wave++;
    this.bricks.forEach((brick) => { brick.targetY += STEP; });
    this.pickups.forEach((pickup) => { pickup.targetY += STEP; });
    this.pickups = this.pickups.filter((pickup) => pickup.targetY < DANGER_Y);
    this.addRow();
    this.phase = 'advancing';
    this.transitionTime = 0.55;
    this.callbacks.onSound('round');
    this.emit();
  }

  private endGame() {
    this.phase = 'gameover';
    this.shake = this.settings.effects ? 8 : 0;
    this.callbacks.onSound('over');
    this.callbacks.onGameOver(this.score, this.wave);
    this.emit();
  }

  private burst(x: number, y: number, color: string, amount: number) {
    if (!this.settings.effects) return;
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 160;
      const life = 0.25 + Math.random() * 0.45;
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, color, size: 1.5 + Math.random() * 3 });
    }
    if (this.particles.length > 220) this.particles.splice(0, this.particles.length - 220);
  }

  private hitBrick(brick: Brick, x: number, y: number) {
    brick.hp--;
    brick.hit = 1;
    this.score += 10;
    this.burst(x, y, brick.color, 3);
    if (brick.hp <= 0) {
      this.combo = this.comboTime > 0 ? Math.min(this.combo + 1, 9) : 1;
      this.comboTime = 1.45;
      const bonus = 30 * Math.min(this.combo, 5);
      this.score += bonus;
      this.burst(brick.x + BRICK_SIZE / 2, brick.y + BRICK_SIZE / 2, brick.color, 18);
      this.popups.push({ x: brick.x + BRICK_SIZE / 2, y: brick.y + BRICK_SIZE / 2, text: `+${bonus + 10}`, color: brick.color, life: 0.85 });
      if (this.settings.effects) {
        this.rings.push({ x: brick.x + BRICK_SIZE / 2, y: brick.y + BRICK_SIZE / 2, color: brick.color, life: 0.4 });
        this.shake = Math.min(4.5, this.shake + 1.7);
      }
      if (this.settings.haptics && navigator.vibrate && this.time - this.lastHaptic > 0.08) {
        try { navigator.vibrate(10); } catch { /* Optional on embedded or restricted devices. */ }
        this.lastHaptic = this.time;
      }
      this.callbacks.onSound('break', this.combo);
    } else this.callbacks.onSound('hit', brick.hp);
  }

  private updateBall(ball: Ball, dt: number): boolean {
    if (this.settings.effects) {
      ball.trail.unshift({ x: ball.x, y: ball.y });
      if (ball.trail.length > 7) ball.trail.pop();
    }
    if (this.recallMode) {
      const target = this.firstLanding ?? this.launchX;
      ball.x += (target - ball.x) * Math.min(1, dt * 13);
      ball.y += (LAUNCH_Y - ball.y) * Math.min(1, dt * 13);
      return Math.hypot(target - ball.x, LAUNCH_Y - ball.y) > 7;
    }
    ball.age += dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (ball.x < WALL + BALL_RADIUS) { ball.x = WALL + BALL_RADIUS; ball.vx = Math.abs(ball.vx); }
    if (ball.x > GAME_WIDTH - WALL - BALL_RADIUS) { ball.x = GAME_WIDTH - WALL - BALL_RADIUS; ball.vx = -Math.abs(ball.vx); }
    if (ball.y < WALL + BALL_RADIUS) { ball.y = WALL + BALL_RADIUS; ball.vy = Math.abs(ball.vy); }
    if (ball.y >= LAUNCH_Y && ball.vy > 0) {
      this.firstLanding ??= ball.x;
      return false;
    }

    // Fixed substeps and contact normals keep fast balls from tunneling through bricks.
    for (const brick of this.bricks) {
      if (brick.hp <= 0) continue;
      const closestX = clamp(ball.x, brick.x, brick.x + BRICK_SIZE);
      const closestY = clamp(ball.y, brick.y, brick.y + BRICK_SIZE);
      const dx = ball.x - closestX;
      const dy = ball.y - closestY;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared >= BALL_RADIUS * BALL_RADIUS) continue;
      let nx: number;
      let ny: number;
      if (distanceSquared > 0.0001) {
        const distance = Math.sqrt(distanceSquared);
        nx = dx / distance;
        ny = dy / distance;
        ball.x = closestX + nx * (BALL_RADIUS + 0.3);
        ball.y = closestY + ny * (BALL_RADIUS + 0.3);
      } else {
        const sides = [ball.x - brick.x, brick.x + BRICK_SIZE - ball.x, ball.y - brick.y, brick.y + BRICK_SIZE - ball.y];
        const side = sides.indexOf(Math.min(...sides));
        nx = side === 0 ? -1 : side === 1 ? 1 : 0;
        ny = side === 2 ? -1 : side === 3 ? 1 : 0;
        ball.x += nx * (sides[side] + BALL_RADIUS + 0.3);
        ball.y += ny * (sides[side] + BALL_RADIUS + 0.3);
      }
      const approach = ball.vx * nx + ball.vy * ny;
      if (approach < 0) {
        ball.vx -= 2 * approach * nx;
        ball.vy -= 2 * approach * ny;
        if (Math.abs(ball.vy) < 100) {
          ball.vy = (ball.vy < 0 ? -1 : 1) * 100;
          ball.vx = (ball.vx < 0 ? -1 : 1) * Math.sqrt(SPEED * SPEED - 10000);
        }
        this.hitBrick(brick, closestX, closestY);
      }
      break;
    }
    for (let index = this.pickups.length - 1; index >= 0; index--) {
      const pickup = this.pickups[index];
      if (Math.hypot(ball.x - pickup.x, ball.y - pickup.y) < 19) {
        this.pickups.splice(index, 1);
        this.ballCount = Math.min(90, this.ballCount + 3);
        this.burst(pickup.x, pickup.y, '#c3f786', 15);
        this.popups.push({ x: pickup.x, y: pickup.y, text: '+3 BALLS', color: '#c3f786', life: 1 });
        this.callbacks.onSound('pickup');
      }
    }
    return true;
  }

  private update(dt: number) {
    this.time += dt;
    if (this.phase === 'paused') return;
    this.shake *= Math.exp(-dt * 14);
    this.comboTime = Math.max(0, this.comboTime - dt);
    this.bricks.forEach((brick) => { brick.hit = Math.max(0, brick.hit - dt * 6); });
    this.particles = this.particles.filter((particle) => {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 100 * dt;
      return particle.life > 0;
    });
    this.popups = this.popups.filter((popup) => { popup.life -= dt; popup.y -= 26 * dt; return popup.life > 0; });
    this.rings = this.rings.filter((ring) => { ring.life -= dt; return ring.life > 0; });
    if (this.phase === 'aiming') {
      const direction = Number(this.rightPressed) - Number(this.leftPressed);
      this.angle = clamp(this.angle + direction * dt * (this.fineAim ? 0.35 : 1.25), -Math.PI + 0.13, -0.13);
    }
    if (this.phase === 'shooting') {
      this.roundTime += dt;
      this.spawnClock -= dt;
      while (this.launched < this.volleySize && this.spawnClock <= 0) {
        this.balls.push({ x: this.launchX, y: LAUNCH_Y, vx: Math.cos(this.angle) * SPEED, vy: Math.sin(this.angle) * SPEED, trail: [], age: 0 });
        this.launched++;
        this.spawnClock += 0.048;
      }
      this.balls = this.balls.filter((ball) => this.updateBall(ball, dt));
      this.bricks = this.bricks.filter((brick) => brick.hp > 0);
      if (this.roundTime > 13 && !this.recallMode) this.recall();
      if (this.balls.length === 0 && this.launched >= this.volleySize) this.finishRound();
    }
    if (this.phase === 'advancing') {
      this.transitionTime -= dt;
      const progress = this.settings.effects ? Math.min(1, dt * 15) : 1;
      this.bricks.forEach((brick) => { brick.y += (brick.targetY - brick.y) * progress; });
      this.pickups.forEach((pickup) => { pickup.y += (pickup.targetY - pickup.y) * progress; });
      if (this.transitionTime <= 0) {
        this.bricks.forEach((brick) => { brick.y = brick.targetY; });
        this.pickups.forEach((pickup) => { pickup.y = pickup.targetY; });
        if (this.bricks.some((brick) => brick.y + BRICK_SIZE >= DANGER_Y)) this.endGame();
        else { this.phase = 'aiming'; this.emit(); }
      }
    }
    this.emitClock += dt;
    if (this.emitClock >= 0.1 && !['menu', 'gameover'].includes(this.phase)) this.emit();
  }

  private drawBricks(ctx: CanvasRenderingContext2D) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '500 22px "Space Grotesk", sans-serif';
    for (const brick of this.bricks) {
      ctx.save();
      if (brick.hit > 0 && this.settings.effects) {
        const scale = 1 + brick.hit * 0.045;
        ctx.translate(brick.x + BRICK_SIZE / 2, brick.y + BRICK_SIZE / 2);
        ctx.scale(scale, scale);
        ctx.translate(-brick.x - BRICK_SIZE / 2, -brick.y - BRICK_SIZE / 2);
      }
      const sprite = this.brickSprites.get(brick.color);
      if (sprite) ctx.drawImage(sprite, brick.x - 18, brick.y - 18);
      if (brick.hit > 0) {
        ctx.fillStyle = `${brick.color}${Math.round(brick.hit * 65).toString(16).padStart(2, '0')}`;
        roundedRect(ctx, brick.x + 2, brick.y + 2, BRICK_SIZE - 4, BRICK_SIZE - 4, 3);
        ctx.fill();
      }
      ctx.fillStyle = brick.hit > 0.2 ? '#ffffff' : `${brick.color}ee`;
      ctx.fillText(String(brick.hp), brick.x + BRICK_SIZE / 2, brick.y + BRICK_SIZE / 2 + 1);
      ctx.restore();
    }
  }

  private drawPickups(ctx: CanvasRenderingContext2D) {
    for (const pickup of this.pickups) {
      const pulse = this.settings.effects ? Math.sin(this.time * 3) * 2 : 0;
      ctx.strokeStyle = '#bef386';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y, 12 + pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#bef38630';
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y, 18 + pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#e1ffbd';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pickup.x - 4, pickup.y); ctx.lineTo(pickup.x + 4, pickup.y);
      ctx.moveTo(pickup.x, pickup.y - 4); ctx.lineTo(pickup.x, pickup.y + 4);
      ctx.stroke();
    }
  }

  private drawAim(ctx: CanvasRenderingContext2D) {
    let x = this.launchX;
    let y = LAUNCH_Y;
    let dx = Math.cos(this.angle);
    let dy = Math.sin(this.angle);
    let budget = 880;
    ctx.save();
    ctx.strokeStyle = '#c0f38991';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.setLineDash([1, 11]);
    ctx.lineDashOffset = this.settings.effects ? -this.time * 17 : 0;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let bounce = 0; bounce < 3 && budget > 0; bounce++) {
      const tx = dx > 0 ? (GAME_WIDTH - WALL - BALL_RADIUS - x) / dx : (WALL + BALL_RADIUS - x) / dx;
      const ty = dy < 0 ? (WALL + BALL_RADIUS - y) / dy : (LAUNCH_Y - y) / dy;
      let distance = Math.min(tx, ty, budget);
      let hit = false;
      for (const brick of this.bricks) {
        const result = rayRect(x, y, dx, dy, brick);
        if (result < distance) { distance = result; hit = true; }
      }
      x += dx * distance;
      y += dy * distance;
      ctx.lineTo(x, y);
      budget -= distance;
      if (hit || distance <= 0 || budget <= 0 || y >= LAUNCH_Y) break;
      if (tx < ty) dx = -dx; else dy = -dy;
      x += dx * 0.1;
      y += dy * 0.1;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#cffaa66a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawBall(ctx: CanvasRenderingContext2D, ball: Ball) {
    if (this.settings.effects && ball.trail.length > 1) {
      const end = ball.trail[ball.trail.length - 1];
      const trail = ctx.createLinearGradient(end.x, end.y, ball.x + 0.01, ball.y + 0.01);
      trail.addColorStop(0, '#efffd600');
      trail.addColorStop(1, '#efffd650');
      ctx.strokeStyle = trail;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      for (let i = ball.trail.length - 2; i >= 0; i--) ctx.lineTo(ball.trail[i].x, ball.trail[i].y);
      ctx.lineTo(ball.x, ball.y);
      ctx.stroke();
    }
    ctx.drawImage(this.ballSprite, ball.x - 20, ball.y - 20);
  }

  private drawDemo(ctx: CanvasRenderingContext2D) {
    const path = [{ x: 215, y: 510 }, { x: 680, y: 360 }, { x: 408, y: 95 }, { x: 74, y: 394 }, { x: 215, y: 510 }];
    const lengths = path.slice(1).map((point, index) => Math.hypot(point.x - path[index].x, point.y - path[index].y));
    const total = lengths.reduce((sum, length) => sum + length, 0);
    const at = (distance: number): Point => {
      let remaining = ((distance % total) + total) % total;
      for (let i = 0; i < lengths.length; i++) {
        if (remaining <= lengths[i]) {
          const fraction = remaining / lengths[i];
          return { x: path[i].x + (path[i + 1].x - path[i].x) * fraction, y: path[i].y + (path[i + 1].y - path[i].y) * fraction };
        }
        remaining -= lengths[i];
      }
      return path[0];
    };
    ctx.globalAlpha = 0.65;
    const motion = this.settings.effects ? this.time * 46 : 0;
    for (let i = 0; i < 15; i++) {
      const distance = motion + i * 54;
      const point = at(distance);
      this.drawBall(ctx, { ...point, vx: 0, vy: 0, age: 0, trail: [at(distance - 5), at(distance - 12), at(distance - 23), at(distance - 34)] });
    }
    ctx.globalAlpha = 1;
  }

  private draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.canvas.width / GAME_WIDTH, 0, 0, this.canvas.height / GAME_HEIGHT, 0, 0);
    ctx.fillStyle = '#0f1118';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.save();
    if (this.shake > 0.1 && this.settings.effects) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    ctx.drawImage(this.background, 0, 0);
    this.drawBricks(ctx);
    this.drawPickups(ctx);

    const inDanger = this.bricks.some((brick) => brick.y + BRICK_SIZE > DANGER_Y - 30);
    ctx.strokeStyle = inDanger && this.phase !== 'menu' ? '#ef758559' : '#b0b9cd16';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 7]);
    ctx.beginPath();
    ctx.moveTo(24, DANGER_Y); ctx.lineTo(GAME_WIDTH - 24, DANGER_Y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = inDanger && this.phase !== 'menu' ? '#ed748a' : '#555d63';
    ctx.beginPath();
    ctx.moveTo(12, DANGER_Y - 4); ctx.lineTo(17, DANGER_Y); ctx.lineTo(12, DANGER_Y + 4);
    ctx.moveTo(GAME_WIDTH - 12, DANGER_Y - 4); ctx.lineTo(GAME_WIDTH - 17, DANGER_Y); ctx.lineTo(GAME_WIDTH - 12, DANGER_Y + 4);
    ctx.fill();

    if (this.phase === 'menu') this.drawDemo(ctx);
    else {
      if (this.phase === 'aiming') this.drawAim(ctx);
      for (const ball of this.balls) this.drawBall(ctx, ball);
      if (this.phase !== 'gameover') {
        if (this.phase !== 'shooting' || this.launched < this.volleySize) ctx.drawImage(this.ballSprite, this.launchX - 20, LAUNCH_Y - 20);
        if (this.firstLanding !== null && this.phase === 'shooting') {
          ctx.globalAlpha = 0.45;
          ctx.drawImage(this.ballSprite, this.firstLanding - 20, LAUNCH_Y - 20);
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = '#9da59d';
        ctx.font = '500 11px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`x${this.ballCount}`, this.launchX, LAUNCH_Y + 22);
      }
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const particle of this.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    for (const ring of this.rings) {
      ctx.globalAlpha = ring.life / 0.4;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, (1 - ring.life / 0.4) * 42 + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    for (const popup of this.popups) {
      ctx.globalAlpha = Math.min(1, popup.life * 2.5);
      ctx.fillStyle = popup.color;
      ctx.font = `${popup.big ? '700 27' : '600 17'}px "Space Grotesk", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(popup.text, popup.x, popup.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private tick = (now: number) => {
    if (this.disposed) return;
    const delta = this.lastTime ? Math.min((now - this.lastTime) / 1000, 0.05) : 0;
    this.lastTime = now;
    this.accumulator += delta;
    // Physics is independent of display refresh rate; rendering stays on requestAnimationFrame.
    while (this.accumulator >= 1 / 120) {
      this.update(1 / 120);
      this.accumulator -= 1 / 120;
    }
    this.draw();
    this.frame = requestAnimationFrame(this.tick);
  };

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.brickSprites.clear();
  }
}