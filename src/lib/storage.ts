import type { QuizConfig } from "@/types/quiz";

const STORAGE_KEY = "solana-quiz-session-v1";
const STATS_KEY = "solana-quiz-stats-v1";

export interface StoredSession {
  config: QuizConfig;
  answers: Record<string, number | null>;
  currentIndex: number;
  seed: string;
  questionIds: string[];
  startedAt: number;
  mode: string;
}

export interface StoredStats {
  totalRuns: number;
  totalAnswered: number;
  totalCorrect: number;
  lastScores: { accuracy: number; total: number; correct: number; at: number }[];
}

export function loadSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function loadStats(): StoredStats {
  if (typeof window === "undefined") {
    return { totalRuns: 0, totalAnswered: 0, totalCorrect: 0, lastScores: [] };
  }
  try {
    const raw = window.localStorage.getItem(STATS_KEY);
    if (!raw) return { totalRuns: 0, totalAnswered: 0, totalCorrect: 0, lastScores: [] };
    return JSON.parse(raw) as StoredStats;
  } catch {
    return { totalRuns: 0, totalAnswered: 0, totalCorrect: 0, lastScores: [] };
  }
}

export function saveStats(stats: StoredStats) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // ignore
  }
}
