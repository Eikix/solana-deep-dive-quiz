"use client";

import { questions as questionBank } from "@/data/questions";
import { buildQuizSession, formatAccuracy, getQuestionBankStats, scoreQuiz } from "@/lib/quiz";
import { clearSession, loadSession, loadStats, saveSession, saveStats } from "@/lib/storage";
import type { Difficulty, Question, QuizConfig, QuizMode, QuizSession } from "@/types/quiz";
import { useCallback, useEffect, useMemo, useState } from "react";

const QUIZ_LENGTHS = [10, 20, 30, 40, 60, 80];
const DEFAULT_DIFFICULTIES: Difficulty[] = ["foundation", "advanced"];
const DEFAULT_MODE: QuizMode = "learn";

const difficultyLabel: Record<Difficulty, string> = {
  foundation: "Foundation",
  advanced: "Advanced",
  expert: "Expert",
};

const difficultyColor: Record<Difficulty, string> = {
  foundation: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40",
  advanced: "bg-sky-500/20 text-sky-200 border-sky-400/40",
  expert: "bg-purple-500/20 text-purple-200 border-purple-400/40",
};

type Phase = "setup" | "quiz" | "results";

export default function Home() {
  const bankStats = useMemo(() => getQuestionBankStats(questionBank), []);
  const allTags = useMemo(() => bankStats.tags.map(([tag]) => tag), [bankStats.tags]);
  const questionById = useMemo(() => new Map(questionBank.map((q) => [q.id, q])), []);

  const [phase, setPhase] = useState<Phase>("setup");
  const [config, setConfig] = useState<QuizConfig>({
    count: 30,
    difficulties: DEFAULT_DIFFICULTIES,
    tags: [],
    mode: DEFAULT_MODE,
    seed: "",
  });
  const [session, setSession] = useState<QuizSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [flagged, setFlagged] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const poolSize = useMemo(() => {
    return questionBank.filter((question) => {
      const difficultyMatch = config.difficulties.includes(question.difficulty);
      const tagMatch =
        config.tags.length === 0 || config.tags.some((tag) => question.tags.includes(tag));
      return difficultyMatch && tagMatch;
    }).length;
  }, [config.difficulties, config.tags]);

  useEffect(() => {
    const stored = loadSession();
    if (stored) {
      const storedQuestions = stored.questionIds
        .map((id) => questionById.get(id))
        .filter((item): item is Question => Boolean(item));
      if (storedQuestions.length > 0) {
        setSession({ seed: stored.seed, questions: storedQuestions, startedAt: stored.startedAt });
        setConfig((prev) => ({
          ...prev,
          ...stored.config,
        }));
        setAnswers(stored.answers);
        setCurrentIndex(stored.currentIndex);
        setFlagged(stored.flagged);
        setPhase("quiz");
      }
    }
    setHydrated(true);
  }, [questionById]);

  useEffect(() => {
    if (!session) return;
    saveSession({
      config,
      answers,
      currentIndex,
      seed: session.seed,
      questionIds: session.questions.map((question) => question.id),
      startedAt: session.startedAt,
      mode: config.mode,
      flagged,
    });
  }, [answers, config, currentIndex, flagged, session]);

  const startQuiz = useCallback(
    (override?: Partial<QuizConfig>, questionsOverride?: Question[]) => {
      const nextConfig = { ...config, ...override };
      const baseQuestions = questionsOverride ?? questionBank;
      const nextSession = buildQuizSession(baseQuestions, nextConfig);
      const nextAnswers: Record<string, number | null> = {};
      const nextRevealed: Record<string, boolean> = {};
      for (const question of nextSession.questions) {
        nextAnswers[question.id] = null;
        nextRevealed[question.id] = false;
      }
      setConfig(nextConfig);
      setSession(nextSession);
      setAnswers(nextAnswers);
      setRevealed(nextRevealed);
      setFlagged([]);
      setCurrentIndex(0);
      setPhase("quiz");
    },
    [config],
  );

  const resetAll = useCallback(() => {
    clearSession();
    setPhase("setup");
    setSession(null);
    setAnswers({});
    setCurrentIndex(0);
    setFlagged([]);
    setRevealed({});
  }, []);

  const currentQuestion = session?.questions[currentIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : null;
  const isAnswered = currentAnswer !== null && currentAnswer !== undefined;
  const isCorrect = currentQuestion ? currentAnswer === currentQuestion.answerIndex : false;

  const answeredCount = session
    ? session.questions.filter((question) => answers[question.id] !== null).length
    : 0;
  const totalQuestions = session?.questions.length ?? 0;

  const revealExplanation =
    config.mode === "learn" ? isAnswered : revealed[currentQuestion?.id ?? ""];

  const handleSelectAnswer = useCallback(
    (choiceIndex: number) => {
      if (!currentQuestion) return;
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: choiceIndex }));
      if (config.mode === "learn") {
        setRevealed((prev) => ({ ...prev, [currentQuestion.id]: true }));
      }
    },
    [config.mode, currentQuestion],
  );

  const handleToggleReveal = useCallback(() => {
    if (!currentQuestion) return;
    setRevealed((prev) => ({ ...prev, [currentQuestion.id]: !prev[currentQuestion.id] }));
  }, [currentQuestion]);

  const handleNext = useCallback(() => {
    if (!session) return;
    if (currentIndex < session.questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentIndex, session]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentIndex]);

  const handleFinish = useCallback(() => {
    setPhase("results");
    if (!session) return;
    const summary = scoreQuiz(session.questions, answers);
    const stats = loadStats();
    const updated = {
      totalRuns: stats.totalRuns + 1,
      totalAnswered: stats.totalAnswered + summary.total,
      totalCorrect: stats.totalCorrect + summary.correct,
      lastScores: [
        {
          accuracy: summary.accuracy,
          total: summary.total,
          correct: summary.correct,
          at: Date.now(),
        },
        ...stats.lastScores,
      ].slice(0, 6),
    };
    saveStats(updated);
  }, [answers, session]);

  const handleFlag = useCallback(() => {
    if (!currentQuestion) return;
    setFlagged((prev) =>
      prev.includes(currentQuestion.id)
        ? prev.filter((id) => id !== currentQuestion.id)
        : [...prev, currentQuestion.id],
    );
  }, [currentQuestion]);

  const handleReviewMistakes = useCallback(() => {
    if (!session) return;
    const wrongQuestions = session.questions.filter(
      (question) => answers[question.id] !== question.answerIndex,
    );
    startQuiz({ count: wrongQuestions.length, seed: "" }, wrongQuestions);
  }, [answers, session, startQuiz]);

  const handleQuickRetry = useCallback(() => {
    if (!session) return;
    startQuiz({ seed: "" });
  }, [session, startQuiz]);

  const summary = useMemo(() => {
    if (!session) return null;
    return scoreQuiz(session.questions, answers);
  }, [answers, session]);

  const weakestTags = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.byTag)
      .filter(([, value]) => value.total >= 2)
      .map(([tag, value]) => ({ tag, accuracy: value.total ? value.correct / value.total : 0 }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 6);
  }, [summary]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-200">
        Preparing your quiz…
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10 md:px-12">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus-visible:rounded-full focus-visible:bg-emerald-400/20 focus-visible:px-4 focus-visible:py-2 focus-visible:text-emerald-100"
      >
        Skip to Content
      </a>
      <main id="main" className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">Solana Deep Dive</p>
            <h1 className="text-balance text-3xl font-semibold text-white md:text-4xl">
              Protocol Mastery Quiz
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              A long-form, replayable quiz for serious Solana learners. Mix modes, filter topics,
              and get explanations after every answer.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={resetAll}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/30 hover:text-white"
            >
              Reset
            </button>
            <a
              href="https://github.com/Eikix/solana-deep-dive-quiz"
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20"
            >
              GitHub
            </a>
          </div>
        </header>

        {phase === "setup" && (
          <section className="grid gap-8 md:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-8 shadow-2xl shadow-black/40">
              <h2 className="text-xl font-semibold text-white">Build your session</h2>
              <p className="mt-2 text-sm text-slate-300">
                Choose a length, filter topics, and decide how intense you want the feedback loop.
              </p>

              <div className="mt-6 grid gap-6">
                <div>
                  <p className="text-sm font-medium text-slate-200">Quiz length</p>
                  <div className="mt-3 flex flex-wrap gap-2" style={{ contentVisibility: "auto" }}>
                    {QUIZ_LENGTHS.map((length) => (
                      <button
                        key={length}
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, count: length }))}
                        className={`rounded-full px-4 py-2 text-sm transition ${
                          config.count === length
                            ? "bg-emerald-400 text-slate-900"
                            : "border border-white/15 text-slate-200 hover:border-emerald-300/60"
                        }`}
                      >
                        {length} Q
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-200">Difficulty mix</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["foundation", "advanced", "expert"] as Difficulty[]).map((level) => {
                      const active = config.difficulties.includes(level);
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() =>
                            setConfig((prev) => ({
                              ...prev,
                              difficulties: active
                                ? prev.difficulties.filter((item) => item !== level)
                                : [...prev.difficulties, level],
                            }))
                          }
                          className={`rounded-full border px-4 py-2 text-sm transition ${
                            active
                              ? difficultyColor[level]
                              : "border-white/15 text-slate-300 hover:border-emerald-300/40"
                          }`}
                        >
                          {difficultyLabel[level]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-200">Mode</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {[
                      {
                        mode: "learn" as QuizMode,
                        title: "Learn mode",
                        description: "Instant explanations after every answer.",
                      },
                      {
                        mode: "exam" as QuizMode,
                        title: "Exam mode",
                        description: "Hold explanations until you finish.",
                      },
                    ].map((item) => (
                      <button
                        key={item.mode}
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, mode: item.mode }))}
                        className={`rounded-2xl border p-4 text-left transition ${
                          config.mode === item.mode
                            ? "border-emerald-300/60 bg-emerald-400/10"
                            : "border-white/10 hover:border-white/20"
                        }`}
                      >
                        <p className="font-semibold text-white">{item.title}</p>
                        <p className="mt-1 text-sm text-slate-300">{item.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-200">Topic focus (optional)</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {allTags.map((tag) => {
                      const active = config.tags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() =>
                            setConfig((prev) => ({
                              ...prev,
                              tags: active
                                ? prev.tags.filter((item) => item !== tag)
                                : [...prev.tags, tag],
                            }))
                          }
                          className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-wide transition ${
                            active
                              ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-100"
                              : "border-white/10 text-slate-300 hover:border-white/30"
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <div>
                    <label htmlFor="seed-input" className="text-sm font-medium text-slate-200">
                      Seed (optional)
                    </label>
                    <input
                      id="seed-input"
                      name="seed"
                      autoComplete="off"
                      value={config.seed ?? ""}
                      onChange={(event) =>
                        setConfig((prev) => ({ ...prev, seed: event.target.value }))
                      }
                      placeholder="Leave blank for random…"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, seed: "" }))}
                    className="mt-7 h-11 rounded-2xl border border-white/10 px-4 text-sm text-slate-200 transition hover:border-emerald-300/40"
                  >
                    Randomize
                  </button>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm text-slate-300">
                  <p>Question bank: {questionBank.length} total</p>
                  <p>Pool size now: {poolSize} questions</p>
                </div>
                <button
                  type="button"
                  onClick={() => startQuiz()}
                  className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-emerald-300"
                >
                  Start Session
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-semibold text-white">What you’ll get</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                <li>• Detailed explanations and deep-dive notes for every question.</li>
                <li>• Breakdown by topic + difficulty to expose blind spots.</li>
                <li>• Replayable runs with deterministic seeds.</li>
                <li>• Review mode to drill missed concepts.</li>
              </ul>

              <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Bank overview</p>
                <div className="mt-3 grid gap-2 text-sm text-slate-200">
                  {bankStats.sections.slice(0, 6).map(([section, count]) => (
                    <div key={section} className="flex items-center justify-between">
                      <span>{section}</span>
                      <span className="text-slate-400">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {phase === "quiz" && session && currentQuestion && (
          <section className="grid gap-6">
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">In Progress</p>
                  <p className="text-lg font-semibold text-white">
                    Question {currentIndex + 1} of {totalQuestions}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200">
                    {answeredCount}/{totalQuestions} answered
                  </span>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs ${difficultyColor[currentQuestion.difficulty]}`}
                  >
                    {difficultyLabel[currentQuestion.difficulty]}
                  </span>
                </div>
              </div>

              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
                />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
              <div className="flex flex-wrap items-center gap-2">
                {currentQuestion.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-wide text-slate-300"
                  >
                    {tag}
                  </span>
                ))}
                <span className="ml-auto rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">
                  {currentQuestion.section}
                </span>
              </div>

              <h2 className="mt-6 text-2xl font-semibold text-white">{currentQuestion.prompt}</h2>

              <div className="mt-6 grid gap-3">
                {currentQuestion.choices.map((choice, index) => {
                  const selected = currentAnswer === index;
                  const correct = currentQuestion.answerIndex === index;
                  const reveal = revealExplanation;
                  const variant = reveal
                    ? correct
                      ? "border-emerald-400 bg-emerald-400/10 text-emerald-100"
                      : selected
                        ? "border-rose-400 bg-rose-400/10 text-rose-100"
                        : "border-white/10 text-slate-200"
                    : selected
                      ? "border-emerald-400 bg-emerald-400/10 text-emerald-100"
                      : "border-white/10 text-slate-200 hover:border-emerald-300/50";

                  return (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => handleSelectAnswer(index)}
                      className={`rounded-2xl border px-5 py-4 text-left text-sm transition ${variant}`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleReveal}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/30"
                >
                  {revealExplanation ? "Hide Explanation" : "Reveal Explanation"}
                </button>
                <button
                  type="button"
                  onClick={handleFlag}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    flagged.includes(currentQuestion.id)
                      ? "border-amber-300/60 bg-amber-400/10 text-amber-100"
                      : "border-white/10 text-slate-300 hover:border-amber-300/40"
                  }`}
                >
                  {flagged.includes(currentQuestion.id) ? "Flagged" : "Flag"}
                </button>
                <span className="text-sm text-slate-400">
                  {isAnswered ? (isCorrect ? "✅ Correct" : "❌ Incorrect") : "Not answered"}
                </span>
              </div>

              {revealExplanation && (
                <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/60 p-5">
                  <p className="text-sm font-semibold text-white">Why</p>
                  <p className="mt-2 text-sm text-slate-300">{currentQuestion.explanation}</p>
                  {currentQuestion.deepDive && (
                    <p className="mt-3 text-sm text-slate-400">{currentQuestion.deepDive}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevious}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/30"
                  disabled={currentIndex === 0}
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/30"
                  disabled={currentIndex === totalQuestions - 1}
                >
                  Next
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFinish}
                  className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-emerald-300"
                >
                  Finish Run
                </button>
              </div>
            </div>
          </section>
        )}

        {phase === "results" && session && summary && (
          <section className="grid gap-8">
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-8">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Results</p>
              <h2 className="mt-3 text-3xl font-semibold text-white tabular-nums">
                {summary.correct}/{summary.total} correct · {summary.accuracy}%
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                Great work. Use the breakdowns below to target your weak spots.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleQuickRetry}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/30"
                >
                  New Run (Same Settings)
                </button>
                <button
                  type="button"
                  onClick={handleReviewMistakes}
                  className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-300"
                >
                  Review Mistakes Only
                </button>
                <button
                  type="button"
                  onClick={() => setPhase("setup")}
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/30"
                >
                  Back to Setup
                </button>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-semibold text-white">By section</h3>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  {Object.entries(summary.bySection).map(([section, value]) => (
                    <div key={section} className="flex items-center justify-between">
                      <span>{section}</span>
                      <span className="text-slate-400 tabular-nums">
                        {formatAccuracy(value.correct, value.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-semibold text-white">By difficulty</h3>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  {Object.entries(summary.byDifficulty).map(([difficulty, value]) => (
                    <div key={difficulty} className="flex items-center justify-between">
                      <span>{difficultyLabel[difficulty as Difficulty]}</span>
                      <span className="text-slate-400 tabular-nums">
                        {formatAccuracy(value.correct, value.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-semibold text-white">Weakest topics</h3>
                <p className="mt-2 text-sm text-slate-300">
                  Focus here until these accuracy bars move up.
                </p>
                <div className="mt-4 space-y-3">
                  {weakestTags.length === 0 && (
                    <p className="text-sm text-slate-400">No weak topics yet. Keep playing!</p>
                  )}
                  {weakestTags.map((item) => (
                    <div key={item.tag}>
                      <div className="flex items-center justify-between text-sm text-slate-300">
                        <span className="uppercase tracking-wide">{item.tag}</span>
                        <span className="tabular-nums">{Math.round(item.accuracy * 100)}%</span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-emerald-400"
                          style={{ width: `${item.accuracy * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-6">
                <h3 className="text-lg font-semibold text-white">Your history</h3>
                <HistoryPanel />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
              <h3 className="text-lg font-semibold text-white">Review flagged questions</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {flagged.length === 0 && (
                  <p className="text-sm text-slate-400">No flagged questions this run.</p>
                )}
                {flagged.map((id) => {
                  const question = questionById.get(id);
                  if (!question) return null;
                  const selected = answers[id];
                  return (
                    <div key={id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-semibold text-white">{question.prompt}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        Your answer:{" "}
                        {selected !== null ? question.choices[selected] : "Not answered"}
                      </p>
                      <p className="mt-2 text-xs text-emerald-200">
                        Correct: {question.choices[question.answerIndex]}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function HistoryPanel() {
  const [stats, setStats] = useState(() => loadStats());

  useEffect(() => {
    setStats(loadStats());
  }, []);

  const accuracy = stats.totalAnswered
    ? Math.round((stats.totalCorrect / stats.totalAnswered) * 1000) / 10
    : 0;

  return (
    <div className="mt-4 space-y-3 text-sm text-slate-300 tabular-nums">
      <div className="flex items-center justify-between">
        <span>Runs completed</span>
        <span className="text-slate-400">{stats.totalRuns}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Lifetime accuracy</span>
        <span className="text-slate-400">{accuracy}%</span>
      </div>
      <div className="pt-2">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Recent runs</p>
        <div className="mt-2 space-y-2">
          {stats.lastScores.length === 0 && <p className="text-xs text-slate-500">No runs yet.</p>}
          {stats.lastScores.map((score) => (
            <div
              key={score.at}
              className="flex items-center justify-between text-xs text-slate-300"
            >
              <span>{new Date(score.at).toLocaleDateString()}</span>
              <span>
                {score.correct}/{score.total} · {score.accuracy}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
