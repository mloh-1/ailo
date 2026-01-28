import {
  HubSpotContactPayload,
  QuizSubmissionInput,
  QUIZ_OUTCOMES,
  LOCATIONS,
  ACCESS_STATUS,
  USER_STATUS,
  LEAD_SOURCE,
} from "./types";

// Maps for converting answer codes to full text
const ANSWER_MAPS = {
  q2: {
    A: "A committed relationship — I'm ready",
    B: "Something serious, but balancing priorities",
    C: "Exploring, no rush",
    D: "Just curious about AILO",
  },
  q3: {
    A: "Open and available",
    B: "Mostly open, still processing past experiences",
    C: "Working on it",
    D: "Not fully available right now",
  },
  q4: {
    A: "Willing to invest",
    B: "Open to investing, but not certain",
    C: "Prefer minimal investment",
    D: "Not interested in investing",
  },
  q5: {
    A: "As soon as I find the right person",
    B: "Within the next year",
    C: "No specific timeline",
    D: "Not sure yet",
  },
} as const;

type AnswerCode = "A" | "B" | "C" | "D";

function getAnswerText(question: keyof typeof ANSWER_MAPS, code: string): string {
  const map = ANSWER_MAPS[question];
  return map[code as AnswerCode] || "";
}

/**
 * Build HubSpot contact payload from quiz submission
 */
export function buildHubSpotContactPayload(input: QuizSubmissionInput): HubSpotContactPayload {
  const { name, email, phone, answers, outcome } = input;

  // Location: South Florida (Q1=A) or Outside South Florida (Q1=B,C,D)
  const location = answers.q1 === "A"
    ? LOCATIONS.southFlorida
    : LOCATIONS.outsideSouthFlorida;

  // Access to AILO Unlimited: Rejected if not-ready, otherwise In Review
  const accessToAiloUnlimited = outcome === "not-ready"
    ? ACCESS_STATUS.rejected
    : ACCESS_STATUS.inReview;

  // Map outcome to HubSpot format (capitalized)
  const quizOutcome = QUIZ_OUTCOMES[outcome];

  return {
    properties: {
      firstname: name,
      email: email,
      phone: phone,
      lead_soource: LEAD_SOURCE.website,
      location: location,
      intent: getAnswerText("q2", answers.q2 || ""),
      availability: getAnswerText("q3", answers.q3 || ""),
      investment: getAnswerText("q4", answers.q4 || ""),
      timeline: getAnswerText("q5", answers.q5 || ""),
      quiz_outcome: quizOutcome,
      user_status: USER_STATUS.noInfo,
      access_to_ailo_unlimited: accessToAiloUnlimited,
    },
  };
}

/**
 * Get full answer text for database storage
 */
export function getFullAnswerText(question: "q2" | "q3" | "q4" | "q5", code: string): string {
  return getAnswerText(question, code);
}

/**
 * Get location text for database storage
 */
export function getLocationText(q1Answer: string): string {
  const locationMap: Record<string, string> = {
    A: "South Florida (Palm Beach, Broward, Miami-Dade)",
    B: "Florida (outside South Florida)",
    C: "U.S. (outside Florida)",
    D: "Outside the U.S.",
  };
  return locationMap[q1Answer] || "";
}
