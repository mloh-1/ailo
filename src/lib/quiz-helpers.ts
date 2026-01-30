// Quiz answer text mappings - used for database storage and future CRM integration

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

// CRM-related types for future integration
export interface QuizSubmissionData {
  name: string;
  email: string;
  phone: string;
  answers: {
    q1?: string; // Location
    q2?: string; // Intent
    q3?: string; // Availability
    q4?: string; // Investment
    q5?: string; // Timeline
  };
  outcome: "qualified" | "waitlist" | "not-ready";
}

// CRM contact properties that will be needed for any CRM integration
export interface CrmContactProperties {
  firstname: string;
  email: string;
  phone: string;
  lead_source: string;
  location: string;
  intent: string;
  availability: string;
  investment: string;
  timeline: string;
  quiz_outcome: string;
  user_status: string;
  access_status: string;
  call_status?: string;
}
