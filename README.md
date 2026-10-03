# Matiks hackathon 2 — support console design

UI/UX design for the React console of the Matiks AI support agent (hackathon, 3 Oct 2026). The console sits on top of the Go `support-api`. It shows a priority queue of tickets, each with an AI draft, its evidence, confidence and cost, and lets a person approve, edit, reject or escalate. Everything runs in dry-run, so approving only marks state and nothing is ever sent.

Open `index.html` in a browser for the current design. Every name, ticket and number in the mockups is invented sample data.

## Files

| File | What it is |
|---|---|
| `index.html` | **Current design (Dispatch v4).** Queue, ticket detail and the user panel, plus the user panel for two non-streak tickets |
| `explorations/01-visual-directions.html` | Three starting directions: Dispatch (picked), Proof, Numeral |
| `explorations/02-dispatch-v2.html` | Dispatch with big numbers taken from Numeral. Rejected because the hierarchy was scattered |
| `explorations/03-dispatch-v3.html` | The hierarchy fix that v4 builds on |

## Design rules

- **Layout follows the work.** Three columns: pick a ticket → read and approve the draft → check why it's safe to send.
- **One focal point.** The draft is the only raised panel and Approve is the only solid button.
- **Color means state, nothing else.** Red = escalate. Amber = data warning (for example, the user's claim doesn't match the DB). Green = verified or auto-resolved. Everything else is grayscale.
- **Each font has one job.** JetBrains Mono for IDs, times, source paths and key hints. Condensed Archivo for numbers and section labels. Regular Archivo for everything people read.
- **The user panel never changes shape.** It shows streak, paying and merch order (what the prod DB returns) in the same place on every ticket. A value is bright only when it puts the user in a priority group (100+ day streak, paying).
- **Every claim is cited.** Each sentence in the draft links to an evidence row: a DB field or a knowledge-base fact.
- **Keyboard first.** A approve, E edit, R reject, X escalate, J / K next and previous.
- **Accessibility floor.** Text is at least 11px, and secondary text has at least 4.5:1 contrast.

## Open items

- The Dashboard screen (top issues for all users, 100+ streak users and paying users).
- Long messages and email threads in the ticket view.
- Data shapes and metric definitions are waiting on the backend team (API contract, statuses, time-to-resolution, cost).
