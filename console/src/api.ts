// The console's only door to the backend. Components never fetch; they go through the store,
// and the store goes through `api`. Swapping the mock for `support-api` touches this file only.
import { CHANNELS, EVALS, INSIGHTS, STEP_MODEL, T10_DONE, TICKETS } from './data/mock';
import type { ActionKind, ChannelHealth, EvalRow, Insights, Step, Ticket } from './types';

export interface ActionPayload { action: ActionKind; draftId?: string; body?: string }

export interface SupportApi {
  tickets(): Promise<Ticket[]>;
  channels(): Promise<ChannelHealth[]>;
  insights(): Promise<Insights>;
  evals(): Promise<EvalRow[]>;
  /** Writes one `actions` row. Always dry-run: nothing is sent to a user. */
  recordAction(ticketId: string, p: ActionPayload, actor: string): Promise<void>;
  /** Live ticket updates (SSE in the real API). Returns an unsubscribe function. */
  subscribe(onTicket: (t: Ticket) => void): () => void;
}

const clone = <T,>(x: T): T => structuredClone(x);

const mockApi: SupportApi = {
  tickets: async () => clone(TICKETS),
  channels: async () => clone(CHANNELS),
  insights: async () => clone(INSIGHTS),
  evals: async () => clone(EVALS),
  recordAction: async () => { /* ponytail: mock keeps no server state; real API: POST /api/v1/tickets/:id/actions with X-Actor */ },
  subscribe(onTicket) {
    // Replays the agent finishing t10, the way SSE events would arrive.
    let t = clone(TICKETS.find(x => x.id === 't10')!);
    const stepIn = (name: string | null, ms: number) => {
      const steps: Step[] = t.run.steps.map(s => s.status === 'now' ? { ...s, status: 'done' as const, ms } : s);
      if (name) steps.push({ step: name, status: 'now', model: STEP_MODEL[name] });
      t = { ...t, run: { ...t.run, steps } };
      onTicket(t);
    };
    const timers = [
      setTimeout(() => stepIn('decide', 540), 2500),
      setTimeout(() => stepIn('draft', 160), 4000),
      setTimeout(() => stepIn('guardrail', 2050), 6500),
      setTimeout(() => {
        const steps = t.run.steps.map(s => ({ ...s, status: 'done' as const, ms: s.status === 'now' ? 460 : s.ms,
          cost: s.step === 'draft' ? 0.0031 : s.model === 'tools' ? 0 : 0.0002 }));
        onTicket({ ...t, ...clone(T10_DONE), isNew: true, run: { version: 'v0.3', status: 'succeeded', steps, ms: 3610, cost: 0.0037 } });
      }, 8000),
    ];
    return () => timers.forEach(clearTimeout);
  },
};

export const api: SupportApi = mockApi;
