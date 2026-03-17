const STORAGE_KEY = 'wordlejp-stats';

const DEFAULT_STATS = {
  gamesPlayed: 0,
  gamesWon: 0,
  currentStreak: 0,
  maxStreak: 0,
  guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
};

/** Ensure a value is a non-negative integer, or return the fallback. */
function safeInt(value, fallback) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

/** Validate and sanitize loaded stats to protect against tampered localStorage. */
function sanitizeStats(raw) {
  const stats = {
    gamesPlayed: safeInt(raw.gamesPlayed, 0),
    gamesWon: safeInt(raw.gamesWon, 0),
    currentStreak: safeInt(raw.currentStreak, 0),
    maxStreak: safeInt(raw.maxStreak, 0),
    guessDistribution: { ...DEFAULT_STATS.guessDistribution },
  };

  // Sanitize distribution values
  if (raw.guessDistribution && typeof raw.guessDistribution === 'object') {
    for (let i = 1; i <= 7; i++) {
      stats.guessDistribution[i] = safeInt(raw.guessDistribution[i], 0);
    }
  }

  // Logical consistency: gamesWon can't exceed gamesPlayed
  if (stats.gamesWon > stats.gamesPlayed) {
    stats.gamesWon = stats.gamesPlayed;
  }

  return stats;
}

export function loadStats() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return sanitizeStats(JSON.parse(data));
    }
  } catch {
    // Corrupted data — fall through to defaults
  }
  return sanitizeStats({});
}

export function saveStats(stats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function recordGame(won, numGuesses) {
  const stats = loadStats();
  stats.gamesPlayed++;
  if (won) {
    stats.gamesWon++;
    stats.currentStreak++;
    stats.maxStreak = Math.max(stats.currentStreak, stats.maxStreak);
    stats.guessDistribution[numGuesses] = (stats.guessDistribution[numGuesses] || 0) + 1;
  } else {
    stats.currentStreak = 0;
  }
  saveStats(stats);
  return stats;
}
