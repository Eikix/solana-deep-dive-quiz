export type Difficulty = "foundation" | "advanced" | "expert";

export type QuizMode = "learn" | "exam";

export interface Question {
  id: string;
  section: string;
  tags: string[];
  difficulty: Difficulty;
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
  deepDive?: string;
}

export interface QuizConfig {
  count: number;
  difficulties: Difficulty[];
  tags: string[];
  mode: QuizMode;
  seed?: string;
}

export interface QuizSession {
  seed: string;
  questions: Question[];
  startedAt: number;
}

export interface QuestionResult {
  questionId: string;
  isCorrect: boolean;
  selectedIndex: number | null;
}

export interface ScoreSummary {
  total: number;
  correct: number;
  accuracy: number;
  bySection: Record<string, { correct: number; total: number }>;
  byDifficulty: Record<Difficulty, { correct: number; total: number }>;
  byTag: Record<string, { correct: number; total: number }>;
}
