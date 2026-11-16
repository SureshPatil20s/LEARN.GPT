export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  provider: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface RagSource {
  document_id: string;
  filename: string;
  chunk_index: number;
  page_number?: number | null;
  snippet: string;
  score: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  sources?: RagSource[];
  feedback?: 'like' | 'dislike' | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  model: string;
  system_prompt?: string | null;
  persona_id?: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface Persona {
  id: string;
  user_id?: string | null;
  name: string;
  avatar: string;
  description?: string | null;
  system_prompt: string;
  is_builtin: boolean;
  created_at?: string;
}

export interface PromptTemplate {
  id: string;
  user_id?: string | null;
  title: string;
  category: string;
  description?: string | null;
  template: string;
  variables: string[];
  is_builtin: boolean;
  created_at?: string;
}

export interface DocumentItem {
  id: string;
  user_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  chunk_count: number;
  created_at: string;
}

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  description: string;
  is_default?: boolean;
}

export interface MemoryItem {
  id: string;
  user_id: string;
  content: string;
  category: string;
  is_active: boolean;
  created_at: string;
}

export interface AppSettings {
  use_rag: boolean;
  use_web_search: boolean;
  use_memory: boolean;
  temperature: number;
  max_tokens: number;
  default_model: string;
  custom_system_prompt: string;
  show_interviewer: boolean;
}

export interface InterviewTurn {
  id: string;
  session_id: string;
  sequence_number: number;
  main_question_index: number;
  follow_up_index: number;
  turn_type: string;
  question_text: string;
  coding_starter_code?: string | null;
  coding_test_specs?: string | null;
  candidate_answer?: string | null;
  candidate_code?: string | null;
  coding_execution_result?: string | null;
  assessment_data?: string | null;
  score_awarded?: number | null;
  status: string;
  asked_at: string;
  answered_at?: string | null;
}

export interface InterviewEvaluation {
  id: string;
  session_id: string;
  rubric_version: string;
  status: string;
  overall_score: number;
  dimension_scores?: {
    technical_accuracy?: number;
    communication_clarity?: number;
    problem_solving?: number;
    depth_of_knowledge?: number;
    [key: string]: any;
  };
  summary_verdict: string;
  peer_band?: string;
  hire_recommendation?: string;
  evidence_by_category?: {
    strong_answers?: string[];
    weak_answers?: string[];
    peer_band?: string;
    hire_recommendation?: string;
    [key: string]: any;
  };
  key_strengths?: string[];
  knowledge_gaps?: string[];
  study_roadmap?: Array<{
    topic: string;
    priority: string;
    action_item: string;
    review_in_days?: number;
  }>;
  teach_after_feedback?: Array<{
    question_number: number;
    question_topic: string;
    candidate_attempt_review: string;
    ideal_model_answer: string;
    key_concepts?: string[];
    common_mistakes?: string[];
  }>;
  full_report_markdown: string;
  generated_at: string;
}

export interface InterviewSession {
  id: string;
  user_id: string;
  interview_type: string;
  subject_role: string;
  experience_level: string;
  difficulty: string;
  total_main_questions: number;
  max_follow_ups_per_question: number;
  allocated_time_min: number;
  language: string;
  interaction_mode: string;
  resume_document_id?: string | null;
  status: string;
  ended_reason?: string | null;
  main_questions_asked: number;
  main_questions_answered: number;
  total_follow_ups_asked: number;
  current_sequence_number: number;
  version: number;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  current_turn?: InterviewTurn | null;
  turns?: InterviewTurn[];
  evaluation?: InterviewEvaluation | null;
}

export interface InterviewConfig {
  interview_type: string;
  subject_role: string;
  experience_level?: string;
  difficulty?: string;
  total_main_questions?: number;
  max_follow_ups_per_question?: number;
  allocated_time_min?: number;
  language?: string;
  interaction_mode?: string;
  resume_document_id?: string | null;
}

export interface TurnAnswerResponse {
  session_id: string;
  session_status: string;
  main_questions_answered: number;
  total_main_questions: number;
  next_turn?: InterviewTurn | null;
  is_completed: boolean;
  evaluation?: InterviewEvaluation | null;
}

export interface TestCaseResult {
  test_index: number;
  input_data: string;
  expected_output: string;
  actual_output?: string | null;
  passed: boolean;
  execution_time_ms: number;
  error?: string | null;
}

export interface CodingExecutionResponse {
  status: 'success' | 'error' | 'security_violation' | 'timeout';
  language: string;
  total_tests: number;
  passed_tests: number;
  all_passed: boolean;
  total_execution_time_ms: number;
  output?: string | null;
  error_message?: string | null;
  test_results: TestCaseResult[];
}




