export function lerp(x: number, y: number, alpha: number) {
  return x + (y - x) * alpha;
}

export function invLerp(value: number, from: number, to: number) {
  return saturate((value - from) / (to - from));
}

export function clamp(x: number, min: number, max: number) {
  return Math.min(Math.max(x, min), max);
}

export function saturate(x: number) {
  return clamp(x, 0, 1);
}

export function euclideanModulo(n: number, m: number) {
  return ((n % m) + m) % m;
}

export function damp(x: number, y: number, lambda: number, dt: number) {
  return lerp(x, y, 1 - Math.exp(-lambda * dt));
}

export function randomInt(minOrMax: number, max?: number) {
  let from = 0;
  let to = minOrMax;
  if (max !== undefined) {
    from = minOrMax;
    to = max;
  }

  return Math.floor(Math.random() * (to - from + 1)) + from;
}
