// Domain types, named after the `support` schema (tickets, drafts, agent_runs, token_log, actions, channel_cursors).

export type Channel = 'clickup' | 'gmail' | 'file';
export type Status = 'open' | 'triaged' | 'replied' | 'closed';
export type Mode = 'auto' | 'assist' | 'escalate';
export type Lang = 'en' | 'hi' | 'hi-Latn';

export interface Reporter { username?: string; email?: string; phone?: string }

/** tickets.cohort_* — resolved=false means "unknown", never "not paying". */
export interface Cohort {
  resolved: boolean;
  by: 'username' | 'email' | 'phone';
  paying: boolean;
  streak: number;
  lookedUpH: number;
}

/** One item of drafts.evidence. `values` are the literal strings that may appear in the draft. */
export interface Evidence { fact: string; src: string; values?: string[]; verified?: boolean }

/** A draft body split into runs; the second element points at the evidence item that backs the run. */
export type DraftSeg = [text: string, evidence?: number];

export interface Draft {
  lang: Lang;
  confidence: number;
  body: DraftSeg[];
  evidence: Evidence[];
  suggested?: string;
  routing?: string;
}

export type StepStatus = 'done' | 'now' | 'fail';

/** One agent_runs.trace step joined with its token_log rows. */
export interface Step {
  step: string;
  model: string;
  ms?: number;
  inTok?: number;
  outTok?: number;
  cost?: number;
  status: StepStatus;
  input?: string;
  output?: string;
}

export interface Run {
  version: string;
  status: 'running' | 'succeeded' | 'failed';
  steps: Step[];
  ms?: number;
  cost?: number;
  stoppedAt?: string;
  error?: string;
  attempt?: number;
}

export interface Why { k: string; v: string; src: string }
export interface HistoryItem { who: string; act: string; after: string; h?: boolean; body?: string }
export interface Note { by: string; text: string }
export interface Attachment { name: string; note: string }

export interface Ticket {
  id: string;
  ext: string;
  channel: Channel;
  status: Status;
  mode?: Mode;
  issue?: string;
  hint?: string | null;
  lang?: Lang | null;
  appVersion?: string;
  screen?: string;
  sourceStatus?: string;
  /** minutes since source_created_at */
  ageMin: number;
  confidence?: number;
  reporter: Reporter;
  cohort: Cohort;
  /** tickets.priority_score */
  score: number;
  subject?: string;
  body: string[];
  attachments?: Attachment[];
  claim?: { said: number; db: number; what?: string };
  others?: number;
  draft?: Draft;
  routing?: string;
  why?: Why[];
  run: Run;
  history: HistoryItem[];
  final?: string;
  notes?: Note[];
  rejected?: { by: string; reason: string } | null;
  handedOff?: { to: string; by: string; text?: string } | null;
  closedReason?: string;
  isNew?: boolean;
}

export interface ChannelHealth {
  name: Channel;
  kind: string;
  ok: boolean;
  lastSuccess: string;
  fails: number;
  today: number;
  note?: string;
}

export interface EvalRow {
  n: number;
  text: string;
  leaf: string;
  expected: Mode;
  actual: Mode;
  said: boolean;
  notSaid: boolean;
  cost: number;
}

/** [category id, label, total tickets, escalated] */
export type IssueRow = [string, string, number, number];

export interface Insights {
  kpi: { firstAction: string; costPerResolved: number };
  topIssues: Record<'all' | 'streak' | 'paying', IssueRow[]>;
  /** [mode label, median seconds, n] */
  ttr: [string, number, number][];
  /** [day label, total USD] */
  costDays: [string, number][];
  /** [step, model, USD] */
  costSteps: [string, string, number][];
  cacheSaved: number;
  /** [channel label, tickets] */
  channels: [string, number][];
  /** weekly totals before the tickets currently loaded */
  flowBase: { handed: number; replied: number; closed: number };
  agent: { runs: number; failed: number; retriedOk: number; avgMs: number };
}

/** Values allowed in actions.action */
export type ActionKind = 'approve' | 'edit' | 'reject' | 'escalate' | 'close' | 'reopen' | 'note';
