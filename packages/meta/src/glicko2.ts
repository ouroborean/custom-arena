// Glicko-2 ratings (GDD §2.2 ranked; Glickman, "Example of the Glicko-2 system", 2013).
// Each match is its own rating period, the usual choice for online games.

export interface Rating {
  rating: number;
  /** Rating deviation. */
  rd: number;
  /** Volatility. */
  vol: number;
}

export const DEFAULT_RATING: Rating = { rating: 1500, rd: 350, vol: 0.06 };

/** System constant: how fast volatility can change (Glickman suggests 0.3–1.2). */
export const TAU = 0.5;
/** RD never drops below this, so established ratings can still move. */
export const MIN_RD = 30;

const SCALE = 173.7178;

export interface GameResult {
  opponent: Pick<Rating, 'rating' | 'rd'>;
  /** 1 win, 0.5 draw, 0 loss. */
  score: number;
}

export function updateRating(player: Rating, results: readonly GameResult[], tau = TAU): Rating {
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.rd / SCALE;
  if (results.length === 0) {
    // No games: only the deviation grows.
    const grown = Math.sqrt(phi * phi + player.vol * player.vol);
    return { ...player, rd: Math.min(350, grown * SCALE) };
  }

  const g = (p: number) => 1 / Math.sqrt(1 + (3 * p * p) / (Math.PI * Math.PI));
  let vInv = 0;
  let sum = 0;
  for (const r of results) {
    const muJ = (r.opponent.rating - 1500) / SCALE;
    const gJ = g(r.opponent.rd / SCALE);
    const e = 1 / (1 + Math.exp(-gJ * (mu - muJ)));
    vInv += gJ * gJ * e * (1 - e);
    sum += gJ * (r.score - e);
  }
  const v = 1 / vInv;
  const delta = v * sum;

  // New volatility: solve f(x) = 0 with the Illinois algorithm (step 5 of the paper).
  const a = Math.log(player.vol * player.vol);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const d = phi * phi + v + ex;
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * d * d) - (x - a) / (tau * tau);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v);
  else {
    let k = 1;
    while (f(a - k * tau) < 0) k++;
    B = a - k * tau;
  }
  let fA = f(A);
  let fB = f(B);
  for (let i = 0; i < 100 && Math.abs(B - A) > 1e-6; i++) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else fA /= 2;
    B = C;
    fB = fC;
  }
  const vol = Math.exp(A / 2);

  const phiStar = Math.sqrt(phi * phi + vol * vol);
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muNew = mu + phiNew * phiNew * sum;
  return {
    rating: muNew * SCALE + 1500,
    rd: Math.max(MIN_RD, Math.min(350, phiNew * SCALE)),
    vol,
  };
}

/** Both players' new ratings after one match (`score` from player A's side). */
export function rateMatch(a: Rating, b: Rating, scoreA: number): [Rating, Rating] {
  return [updateRating(a, [{ opponent: b, score: scoreA }]), updateRating(b, [{ opponent: a, score: 1 - scoreA }])];
}

/** Conservative display rating (rating − 2·RD), used for leaderboards later. */
export function displayRating(r: Rating): number {
  return Math.round(r.rating - 2 * r.rd);
}
