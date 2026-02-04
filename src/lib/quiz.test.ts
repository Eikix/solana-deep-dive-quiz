import { buildQuizSession, scoreQuiz } from "@/lib/quiz";
import type { Question } from "@/types/quiz";
import { describe, expect, it } from "vitest";

const sampleQuestions: Question[] = [
  {
    id: "Q1",
    section: "Basics",
    tags: ["accounts"],
    difficulty: "foundation",
    prompt: "Test 1",
    choices: ["A", "B"],
    answerIndex: 0,
    explanation: "A",
  },
  {
    id: "Q2",
    section: "Basics",
    tags: ["transactions"],
    difficulty: "advanced",
    prompt: "Test 2",
    choices: ["A", "B"],
    answerIndex: 1,
    explanation: "B",
  },
];

describe("buildQuizSession", () => {
  it("filters by difficulty and tags", () => {
    const session = buildQuizSession(sampleQuestions, {
      count: 10,
      difficulties: ["foundation"],
      tags: ["accounts"],
      mode: "learn",
      seed: "seed",
    });

    expect(session.questions).toHaveLength(1);
    expect(session.questions[0].id).toBe("Q1");
  });
});

describe("scoreQuiz", () => {
  it("calculates accuracy and totals", () => {
    const answers = { Q1: 0, Q2: 0 };
    const summary = scoreQuiz(sampleQuestions, answers);
    expect(summary.total).toBe(2);
    expect(summary.correct).toBe(1);
    expect(summary.accuracy).toBe(50);
  });
});
