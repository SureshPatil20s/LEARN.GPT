import { LearningMode } from '@/components/LearningModePanel';

/**
 * Returns the system prompt addon for each learning mode.
 * This is PREPENDED to whatever persona/base system prompt is active.
 */
export function getLearningModeSystemPrompt(mode: LearningMode): string {
  switch (mode) {
    case 'adaptive_tutor':
      return `[ADAPTIVE AI TUTOR MODE]
You are an adaptive AI tutor. Your primary goals:
1. ASSESS the user's knowledge level in the first 1-2 exchanges by asking a quick gauge question or observing vocabulary/phrasing.
2. ADAPT your explanations dynamically:
   - Beginner: Use analogies, simple language, step-by-step walkthroughs, avoid jargon.
   - Intermediate: Use technical terms with brief definitions, build on existing knowledge.
   - Expert: Be concise, precise, use domain vocabulary, skip basics.
3. SCAFFOLD learning — always build from what the user knows to what they need.
4. CHECK understanding periodically with brief comprehension questions.
5. ENCOURAGE and use positive reinforcement without being patronizing.
6. Format responses with clear headers, numbered steps, and examples.
Start your first response by assessing the user's level if the topic allows.`;

    case 'socratic':
      return `[SOCRATIC LEARNING MODE]
You are a Socratic AI guide. Core principles:
1. NEVER give away answers directly — instead, guide the user through questions.
2. Ask ONE focused question at a time that leads the student toward discovery.
3. When the user is stuck, ask a simpler scaffolding question, not give the answer.
4. When a user gives a wrong answer, ask a question that helps them see the flaw in their reasoning.
5. Acknowledge correct insights warmly and build the next question on them.
6. Occasionally summarize what the student has discovered on their own.
7. Use the pattern: Probe → Clarify → Challenge → Build.
Format: Keep responses short and conversational. End every response with a guiding question.`;

    case 'quiz':
      return `[QUIZ MODE]
When a user asks you to "quiz me" on a topic or when generating quiz content:
- Generate clear, unambiguous multiple-choice questions.
- Each question must have exactly 4 options (A, B, C, D).
- Only ONE option should be correct.
- Provide a brief but informative explanation after revealing the answer.
- Vary difficulty: mix easy recall, conceptual understanding, and application questions.
- If the user answers incorrectly, gently explain the concept behind the correct answer.
When NOT generating a quiz, respond normally to other questions.`;

    case 'visual':
      return `[VISUAL LEARNING MODE]
You are a high-speed visual learning AI.
1. Start directly with a clean, beautifully structured Mermaid diagram (flowchart TD or LR).
2. Keep the diagram focused and readable: 5 to 8 nodes max.
3. Follow the diagram with a concise 2-3 paragraph explanation and bullet points.
4. If comparing items, use a compact markdown table.
5. Keep explanations direct and punchy so the visual does the heavy lifting.

Mermaid strict syntax rules:
- Wrap in triple backticks with \`\`\`mermaid language tag.
- Use 'flowchart TD' or 'flowchart LR'.
- ALWAYS wrap node labels in double quotes inside brackets: id["Clear text label"]
- NEVER use unquoted parentheses, colons, or brackets inside labels (e.g. write A["Input (Data)"] NEVER A[Input (Data)]).
- Always close all quotes and brackets completely.
- Keep node IDs simple alphanumeric tokens (e.g., A, B, C, Step1, Step2).
- Keep diagrams clean and concise: 4 to 8 nodes max.`;

    default:
      return '';
  }
}

/**
 * Returns a UI badge label for the current learning mode.
 */
export function getLearningModeLabel(mode: LearningMode): { label: string; emoji: string; color: string } {
  switch (mode) {
    case 'adaptive_tutor': return { label: 'Adaptive Tutor', emoji: '🧠', color: 'violet' };
    case 'socratic': return { label: 'Socratic', emoji: '🏛️', color: 'amber' };
    case 'quiz': return { label: 'Quiz Mode', emoji: '📋', color: 'sky' };
    case 'visual': return { label: 'Visual Learning', emoji: '👁️', color: 'rose' };
    default: return { label: 'Standard', emoji: '✨', color: 'emerald' };
  }
}

/**
 * Parses a JSON quiz response from the LLM.
 * Returns array of QuizQuestion or throws.
 */
export function parseQuizResponse(rawContent: string) {
  // Try to extract JSON array from anywhere in the text
  const jsonMatch = rawContent.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (!jsonMatch) throw new Error('No JSON quiz array found in response.');
  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed)) throw new Error('Response is not a JSON array.');
  return parsed.map((q: any, i: number) => ({
    question: String(q.question || `Question ${i + 1}`),
    options: Array.isArray(q.options) ? q.options.map(String) : ['A', 'B', 'C', 'D'],
    correct: typeof q.correct === 'number' ? q.correct : 0,
    explanation: String(q.explanation || 'No explanation provided.'),
  }));
}

/**
 * Builds the prompt sent to the LLM to generate a quiz.
 */
export function buildQuizGenerationPrompt(topic: string, numQuestions: number): string {
  return `Generate exactly ${numQuestions} multiple-choice quiz questions on the topic: "${topic}".

STRICT RULES:
- Return ONLY a valid JSON array — no markdown, no preamble, no explanation outside JSON.
- Each question object MUST have EXACTLY these keys:
  - "question": string (the question text)
  - "options": array of exactly 4 strings [A, B, C, D options]
  - "correct": number (0-indexed position of correct option, so 0=A, 1=B, 2=C, 3=D)
  - "explanation": string (brief explanation of why the correct answer is right)
- Vary difficulty: include easy, medium, and hard questions.
- Make distractors plausible and educational.

Return format example:
[
  {
    "question": "What does HTTP stand for?",
    "options": ["HyperText Transfer Protocol", "High Text Transfer Protocol", "HyperText Transmission Protocol", "High Transfer Text Protocol"],
    "correct": 0,
    "explanation": "HTTP stands for HyperText Transfer Protocol, the foundation of data communication on the web."
  }
]

Now generate ${numQuestions} questions on: "${topic}".
Return ONLY the JSON array.`;
}
