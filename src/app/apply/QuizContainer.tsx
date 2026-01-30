"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QuizProgress, QuizQuestion, ContactForm } from "@/components/quiz";
import {
  quizQuestions,
  QuizAnswer,
  QuizAnswers,
  calculateOutcome,
} from "@/lib/quiz-data";
import { Button } from "@/components/ui/button";
import {
  trackQuizStarted,
  trackQuizQuestionAnswered,
  trackQuizCompleted,
} from "@/lib/analytics";

type QuizStep = "intro" | "questions" | "contact" | "waitlist-confirmed" | "call-already-scheduled";

export function QuizContainer() {
  const router = useRouter();
  const [step, setStep] = useState<QuizStep>("intro");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [isLoading, setIsLoading] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const totalSteps = quizQuestions.length + 1; // +1 for contact form
  const currentStepNumber =
    step === "intro"
      ? 0
      : step === "questions"
      ? currentQuestion + 1
      : totalSteps;

  const handleStartQuiz = () => {
    trackQuizStarted();
    setStep("questions");
  };

  const handleAnswer = (answer: QuizAnswer) => {
    const questionId = quizQuestions[currentQuestion].id as keyof QuizAnswers;
    trackQuizQuestionAnswered(currentQuestion + 1, questionId, answer);
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleNext = () => {
    if (currentQuestion < quizQuestions.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
    } else {
      setStep("contact");
    }
  };

  // Check if user is outside South Florida (Q1 answer is not "A")
  const isOutsideSouthFlorida = answers.q1 && answers.q1 !== "A";

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((prev) => prev - 1);
    } else {
      setStep("intro");
    }
  };

  const handleContactSubmit = async (data: { name: string; phone: string; email: string; recaptchaToken?: string | null }) => {
    setIsLoading(true);

    // Calculate outcome
    const result = calculateOutcome(answers);

    // Track quiz completion with outcome
    trackQuizCompleted(result.outcome, result.score);

    // Store data in sessionStorage for result pages
    sessionStorage.setItem(
      "quizData",
      JSON.stringify({
        answers,
        contact: data,
        result,
      })
    );

    // Submit to API immediately (saves to DB + sends to HubSpot)
    try {
      const response = await fetch("/api/quiz-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone,
          answers,
          outcome: result.outcome,
          recaptchaToken: data.recaptchaToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Check if call is already scheduled (expected case, not an error)
        if (errorData.error === "call_already_scheduled") {
          setIsLoading(false);
          setStep("call-already-scheduled");
          return;
        }

        // For unexpected errors, log and show generic error
        console.error("Quiz submission failed:", errorData.error);
        setSubmissionError(errorData.message || "Something went wrong. Please try again.");
        setIsLoading(false);
        return;
      }

      // Get the booking UUID from response and store in sessionStorage
      const responseData = await response.json();
      if (responseData.bookingUuid) {
        sessionStorage.setItem(
          "quizData",
          JSON.stringify({
            answers,
            contact: data,
            result,
            bookingUuid: responseData.bookingUuid,
          })
        );
      }
    } catch (error) {
      console.error("Error submitting quiz:", error);
      setSubmissionError("Something went wrong. Please try again.");
      setIsLoading(false);
      return;
    }

    setIsLoading(false);

    // Redirect based on outcome
    switch (result.outcome) {
      case "qualified":
        router.push("/book-call");
        break;
      case "waitlist":
        // Show inline confirmation instead of redirecting
        setStep("waitlist-confirmed");
        break;
      case "not-ready":
        router.push("/not-ready");
        break;
    }
  };

  const currentQuestionData = quizQuestions[currentQuestion];
  const currentAnswer = currentQuestionData
    ? (answers[currentQuestionData.id as keyof QuizAnswers] as QuizAnswer | undefined)
    : undefined;

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 md:p-8">
      {step === "intro" && (
        <div className="text-center">
          <h1 className="font-[var(--font-playfair)] text-3xl md:text-4xl font-bold text-white mb-4">
            Quick Check: Are We Right for You?
          </h1>
          <p className="text-white/80 mb-2">
            5 questions. 2 minutes.
          </p>
          <p className="text-white/60 mb-8">
            We&apos;ll tell you honestly if AILO can help.
          </p>
          <Button onClick={handleStartQuiz} className="btn-primary text-lg px-8">
            Start
          </Button>

          {/* Social Proof */}
          <div className="mt-10 pt-6 border-t border-white/10">
            <p className="text-sm text-white/40 mb-4">
              Based on 30 years of compatibility research
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-white/50">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[var(--color-accent)]" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>US Patent #8556630B2</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[var(--color-accent)]" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>70%+ matches only</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[var(--color-accent)]" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>~2 minutes</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === "questions" && currentQuestionData && (
        <>
          <QuizProgress
            currentStep={currentStepNumber}
            totalSteps={totalSteps}
          />
          <QuizQuestion
            question={currentQuestionData}
            selectedAnswer={currentAnswer}
            onAnswer={handleAnswer}
          />
          <div className="flex justify-between mt-8">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              ← Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={!currentAnswer}
              className="btn-primary"
            >
              Continue →
            </Button>
          </div>

          {/* Social Proof Bar */}
          <div className="mt-8 pt-4 border-t border-white/10 text-center">
            <p className="text-xs text-white/40">
              Based on 30+ years of compatibility research • US Patent #8556630B2
            </p>
          </div>
        </>
      )}

      {step === "contact" && (
        <>
          <QuizProgress
            currentStep={currentStepNumber}
            totalSteps={totalSteps}
          />
          <ContactForm
            onSubmit={handleContactSubmit}
            isLoading={isLoading}
            isWaitlist={isOutsideSouthFlorida}
          />
          {submissionError && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm text-center">{submissionError}</p>
            </div>
          )}
          <div className="mt-6">
            <Button
              variant="ghost"
              onClick={() => {
                setStep("questions");
                setCurrentQuestion(quizQuestions.length - 1);
                setSubmissionError(null);
              }}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              ← Back
            </Button>
          </div>
        </>
      )}

      {step === "waitlist-confirmed" && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-[var(--color-accent)]/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-[var(--color-accent)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="font-[var(--font-playfair)] text-2xl md:text-3xl font-bold text-white mb-4">
            You&apos;re on the Waitlist!
          </h2>
          <p className="text-white/70 mb-2">
            Thanks for your interest in AILO.
          </p>
          <p className="text-white/60 text-sm mb-8">
            We&apos;ll notify you as soon as we expand to your area. Check your email for confirmation.
          </p>
          <Button
            onClick={() => router.push("/")}
            variant="ghost"
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            ← Back to Home
          </Button>
        </div>
      )}

      {step === "call-already-scheduled" && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-[var(--color-accent)]/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-[var(--color-accent)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="font-[var(--font-playfair)] text-2xl md:text-3xl font-bold text-white mb-4">
            You Already Have a Call Scheduled!
          </h2>
          <p className="text-white/70 mb-2">
            It looks like you&apos;ve already booked a discovery call with us.
          </p>
          <p className="text-white/60 text-sm mb-8">
            Check your email for the calendar invite. If you need to reschedule, you can do so through the link in your confirmation email.
          </p>
          <Button
            onClick={() => router.push("/")}
            variant="ghost"
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            ← Back to Home
          </Button>
        </div>
      )}
    </div>
  );
}
