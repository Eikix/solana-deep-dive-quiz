import type { Difficulty, Question, QuizConfig, QuizSession, ScoreSummary } from "@/types/quiz";

const DEFAULT_SEED = "solana";

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithRng<T>(items: T[], rng: () => number): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function ensureSeed(seed?: string) {
  if (seed && seed.trim().length > 0) return seed.trim();
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return `${DEFAULT_SEED}-${Date.now().toString(36)}`;
}

export function buildQuizSession(questions: Question[], config: QuizConfig): QuizSession {
  const seed = ensureSeed(config.seed);
  const rng = mulberry32(hashSeed(seed));

  const filtered = questions.filter((question) => {
    const difficultyMatch = config.difficulties.includes(question.difficulty);
    return difficultyMatch;
  });

  const shuffled = shuffleWithRng(filtered, rng);
  const count = Math.min(config.count, shuffled.length);

  return {
    seed,
    questions: shuffled.slice(0, count),
    startedAt: Date.now(),
  };
}

export function scoreQuiz(
  questions: Question[],
  answers: Record<string, number | null>,
): ScoreSummary {
  const bySection: ScoreSummary["bySection"] = {};
  const byDifficulty: ScoreSummary["byDifficulty"] = {
    foundation: { correct: 0, total: 0 },
    advanced: { correct: 0, total: 0 },
    expert: { correct: 0, total: 0 },
  };
  const byTag: ScoreSummary["byTag"] = {};

  let correct = 0;
  for (const question of questions) {
    const selected = answers[question.id] ?? null;
    const isCorrect = selected === question.answerIndex;
    const section = question.section;

    if (!bySection[section]) {
      bySection[section] = { correct: 0, total: 0 };
    }
    bySection[section].total += 1;
    byDifficulty[question.difficulty].total += 1;

    for (const tag of question.tags) {
      if (!byTag[tag]) {
        byTag[tag] = { correct: 0, total: 0 };
      }
      byTag[tag].total += 1;
      if (isCorrect) byTag[tag].correct += 1;
    }

    if (isCorrect) {
      correct += 1;
      bySection[section].correct += 1;
      byDifficulty[question.difficulty].correct += 1;
    }
  }

  const total = questions.length;
  const accuracy = total === 0 ? 0 : Math.round((correct / total) * 1000) / 10;

  return { total, correct, accuracy, bySection, byDifficulty, byTag };
}

export function getQuestionBankStats(questions: Question[]) {
  const sections = new Map<string, number>();
  const tags = new Map<string, number>();
  const difficulties = new Map<Difficulty, number>();

  for (const question of questions) {
    sections.set(question.section, (sections.get(question.section) ?? 0) + 1);
    difficulties.set(question.difficulty, (difficulties.get(question.difficulty) ?? 0) + 1);
    for (const tag of question.tags) {
      tags.set(tag, (tags.get(tag) ?? 0) + 1);
    }
  }

  return {
    sections: Array.from(sections.entries()).sort((a, b) => b[1] - a[1]),
    tags: Array.from(tags.entries()).sort((a, b) => b[1] - a[1]),
    difficulties: Array.from(difficulties.entries()).sort((a, b) => b[1] - a[1]),
  };
}

export function formatAccuracy(correct: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((correct / total) * 100)}%`;
}
