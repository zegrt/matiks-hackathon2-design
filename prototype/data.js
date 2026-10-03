// Mock data shaped like the support schema (tickets, drafts, agent_runs, token_log, actions, channel_cursors).
// All people, ids and numbers are invented.

const NOW = new Date('2026-10-03T14:52:00+05:30');

// priority_score exactly as ingest derives it
const score = c => !c.resolved ? 0 : (c.paying ? 200 : 0) + (c.streak >= 100 ? 100 : 0) + Math.min(Math.floor(c.streak / 10), 99);

const LEAF = {
  'safety.abusive_dm': 'Abusive messages in DMs',
  'streak.shield_not_applied': 'Shield held but not used',
  'streak.wrong_count': 'Streak count wrong',
  'payment.double_charge': 'Charged twice',
  'merch.not_shipped': 'Merch not shipped',
  'subscription.what_is_included': 'What Pro includes',
  'suggestion.ui': 'UI suggestion',
  'suggestion.praise': 'Praise',
  'gameplay.score_not_saved': 'Score not saved after duel',
  'gameplay.freeze': 'Game froze in a duel',
  'rating.unfair_drop': 'Rating dropped unfairly',
  'account.otp': 'OTP not received',
  'account.wrong_link': 'Login opens wrong account',
  'other.spam': 'Spam',
};
const CHANNEL = { clickup: 'ClickUp', gmail: 'Gmail', file: 'File' };
const LANG = { en: 'English', hi: 'Hindi', 'hi-Latn': 'Hinglish' };

const STEP_MODEL = { classify: 'claude-haiku-4-5', decide: 'claude-haiku-4-5', draft: 'claude-sonnet-5-5', guardrail: 'claude-haiku-4-5', enrich: 'tools' };

function run(steps, extra = {}) {
  const s = steps.map(([step, ms, inTok, outTok, cost, status = 'done', input = '', output = '']) =>
    ({ step, model: STEP_MODEL[step], ms, inTok, outTok, cost, status, input, output }));
  return { version: 'v0.3', status: 'succeeded', steps: s,
           ms: s.reduce((a, x) => a + (x.ms || 0), 0), cost: s.reduce((a, x) => a + (x.cost || 0), 0), ...extra };
}

const TICKETS = [
  {
    id: 't1', ext: 'EM-4F21C9', channel: 'gmail', status: 'triaged', mode: 'escalate', issue: 'safety.abusive_dm', lang: 'en',
    ageMin: 3099, confidence: 0.97,
    reporter: { username: 'sana_k', email: 'sana.kapoor@gmail.com' },
    cohort: { resolved: true, by: 'email', paying: false, streak: 12, lookedUpH: 5 },
    subject: 'Formal complaint regarding inappropriate messages and user safety',
    body: [
      'Dear Matiks Support / Developer Team,',
      'I am writing to formally report an inappropriate message that I received from another user through the Matiks app. The content was unsolicited and inappropriate, and I consider this a serious user-safety issue. The user kept messaging after I asked them to stop, and also asked for my number (I did not share it, but they had {phone:+91 98765 43471} from somewhere).',
      'I would like to know what action will be taken against this account and how I can make sure it cannot contact me again.',
      'I have attached a screenshot of the conversation. Please treat this as urgent; I no longer feel comfortable playing duels while this account can reach me.',
      'Regards,',
    ],
    attachments: [{ name: 'chat-screenshot.png', note: 'Gmail attachment' }],
    routing: 'Trust & Safety',
    why: [
      { k: 'Classified as abusive DMs', v: '0.97', src: 'classify · safety.abusive_dm' },
      { k: 'Safety is never auto-answered', v: 'hard rule', src: 'safe-list.yaml · never_auto' },
    ],
    run: run([
      ['classify', 410, 1180, 42, 0.0003, 'done', 'subject + body (412 words)', '{"issue_type":"safety.abusive_dm","language":"en","confidence":0.97}'],
      ['enrich', 520, 0, 0, 0, 'done', 'lookup email:s***@g***.com', '{"resolved":true,"paying":false,"streak_days":12}'],
      ['decide', 170, 640, 18, 0.0003, 'done', 'issue_type + safe-list', '{"mode":"escalate","reason":"never_auto: safety.*"}'],
    ], { stoppedAt: 'decide' }),
    history: [],
  },
  {
    id: 't2', ext: 'CU-14YJHF8K2', channel: 'clickup', status: 'triaged', mode: 'assist', issue: 'streak.shield_not_applied', lang: 'hi-Latn',
    appVersion: '3.12', screen: 'Streak', ageMin: 4, confidence: 0.82, sourceStatus: 'to do',
    reporter: { username: 'ankit.k07', email: 'ankit.kumar07@gmail.com' },
    cohort: { resolved: true, by: 'username', paying: true, streak: 118, lookedUpH: 2 },
    body: ['bhai mera shield laga hi nahi, kal khela tha phir bhi streak 0 ho gaya 😭 120 din ka tha'],
    attachments: [{ name: 'streak-screen.jpg', note: '340 KB' }],
    claim: { said: 120, db: 118 },
    others: 1,
    draft: {
      lang: 'hi-Latn', confidence: 0.82, routing: 'Engineering',
      suggested: 'send, then hand to Engineering with the user id and dates.',
      body: [['Aapka streak hamare record mein '], ['118 din', 0], [' ka tha, aur aapke paas '], ['1 shield', 1],
             [' tha jo apply nahi hua. Humne yeh case engineering team ko bhej diya hai. Abhi hum koi date promise nahi kar sakte.']],
      evidence: [
        { fact: 'streak_days = 118', src: 'prod_db · userStreaksNew', values: ['118'] },
        { fact: 'shields_held = 1, used = 0', src: 'prod_db · streakShieldTransactions', values: ['1'] },
        { fact: 'Unused shield → engineering', src: 'streak-shield.md · step 3', verified: true },
      ],
    },
    run: run([
      ['classify', 380, 960, 40, 0.0003, 'done', 'body (19 words, Hinglish)', '{"issue_type":"streak.shield_not_applied","language":"hi-Latn","confidence":0.91}'],
      ['enrich', 610, 0, 0, 0, 'done', 'lookup username:ankit.k07 · shields', '{"streak_days":118,"paying":true,"shields_held":1,"shields_used":0}'],
      ['decide', 160, 820, 22, 0.0003, 'done', 'issue_type + safe-list + confidence', '{"mode":"assist","reason":"not on safe list"}'],
      ['draft', 2130, 2410, 96, 0.0038, 'done', 'style.md + streak-shield.md + evidence', 'Aapka streak hamare record mein 118 din ka tha…'],
      ['guardrail', 500, 1020, 30, 0.0005, 'done', 'draft vs evidence', '{"facts_checked":2,"unbacked":0}'],
    ]),
    history: [],
  },
  {
    id: 't3', ext: 'GM-77A010', channel: 'gmail', status: 'triaged', mode: 'escalate', issue: 'payment.double_charge', lang: 'en',
    ageMin: 12, confidence: 0.94,
    reporter: { username: 'riya_m', email: 'riya.m@outlook.com' },
    cohort: { resolved: true, by: 'email', paying: true, streak: 34, lookedUpH: 1 },
    subject: 'Charged twice for Pro',
    body: ['Hi, I was charged twice for Pro this month (both on Sept 29). Please refund one of them. Order ids are in the attached receipt.'],
    attachments: [{ name: 'receipt.pdf', note: 'Gmail attachment' }],
    routing: 'Payments',
    why: [
      { k: 'Classified as double charge', v: '0.94', src: 'classify · payment.double_charge' },
      { k: 'Payments are never auto-answered', v: 'hard rule', src: 'safe-list.yaml · never_auto' },
    ],
    run: run([['classify', 390, 880, 38, 0.0003], ['enrich', 480, 0, 0, 0], ['decide', 150, 600, 16, 0.0002]], { stoppedAt: 'decide' }),
    history: [],
  },
  {
    id: 't4', ext: 'FL-0031', channel: 'file', status: 'triaged', mode: 'escalate', issue: 'merch.not_shipped', lang: 'en',
    ageMin: 22, confidence: 0.9,
    reporter: { username: 'kavya.p', phone: '+91 98201 55312' },
    cohort: { resolved: true, by: 'username', paying: false, streak: 140, lookedUpH: 3 },
    body: ['won the hoodie in sept duel league, still nothing. my number is {phone:+91 98201 55312} if courier needs it'],
    routing: 'Merch ops',
    why: [
      { k: 'Classified as merch not shipped', v: '0.90', src: 'classify · merch.not_shipped' },
      { k: 'Physical goods are never auto-answered', v: 'hard rule', src: 'safe-list.yaml · never_auto' },
    ],
    run: run([['classify', 400, 700, 36, 0.0003], ['enrich', 450, 0, 0, 0], ['decide', 140, 560, 16, 0.0002]], { stoppedAt: 'decide' }),
    history: [],
  },
  {
    id: 't5', ext: 'CU-14YKA0Q1', channel: 'clickup', status: 'triaged', mode: 'auto', issue: 'subscription.what_is_included', lang: 'en',
    appVersion: '3.12', screen: 'Store', ageMin: 7, confidence: 0.96, sourceStatus: 'to do',
    reporter: { username: 'dev.sharma', email: 'devsharma@gmail.com' },
    cohort: { resolved: true, by: 'username', paying: false, streak: 64, lookedUpH: 2 },
    body: ['What exactly do I get with Pro? Is it worth it'],
    draft: {
      lang: 'en', confidence: 0.96,
      body: [['Pro adds '], ['unlimited duels', 0], [', '], ['ad-free play', 0], [' and '], ['detailed rating history', 0],
             ['. You can start it from the Store screen and cancel any time from your app store account.']],
      evidence: [{ fact: 'Pro features: unlimited duels, ad-free, rating history', src: 'subscription-pro.md · verified', verified: true, values: [] }],
    },
    run: run([['classify', 350, 640, 34, 0.0002], ['enrich', 300, 0, 0, 0], ['decide', 140, 610, 18, 0.0002], ['draft', 1650, 1890, 70, 0.0029], ['guardrail', 420, 840, 24, 0.0004]]),
    history: [],
  },
  {
    id: 't6', ext: 'CU-14YKB7T2', channel: 'clickup', status: 'triaged', mode: 'auto', issue: 'suggestion.ui', lang: 'en',
    appVersion: '3.12', screen: 'Duel', ageMin: 58, confidence: 0.98, sourceStatus: 'to do',
    reporter: { username: 'arjun22', email: 'arjun22@gmail.com' },
    cohort: { resolved: true, by: 'username', paying: false, streak: 3, lookedUpH: 4 },
    body: ['dark mode for the duel screen pls 🙏'],
    draft: {
      lang: 'en', confidence: 0.98,
      body: [['Thanks for the idea. We have logged a dark mode request for the duel screen with the product team.']],
      evidence: [{ fact: 'Suggestions are logged; no reply promised', src: 'suggestions.md · verified', verified: true }],
    },
    run: run([['classify', 330, 420, 30, 0.0002], ['enrich', 280, 0, 0, 0], ['decide', 120, 520, 14, 0.0002], ['draft', 1200, 1300, 40, 0.0019], ['guardrail', 380, 700, 20, 0.0003]]),
    history: [],
  },
  {
    id: 't7', ext: 'CU-14YJZ2M9', channel: 'clickup', status: 'triaged', mode: 'assist', issue: 'gameplay.score_not_saved', lang: 'en',
    appVersion: '3.11', screen: 'Duel results', ageMin: 31, confidence: 0.74, sourceStatus: 'in progress',
    reporter: { username: 'vikram.s', email: 'vikram.s@gmail.com' },
    cohort: { resolved: true, by: 'username', paying: false, streak: 5, lookedUpH: 2 },
    body: ["won 3-1 but rating didn't change and duel not in history"],
    draft: {
      lang: 'en', confidence: 0.74, routing: 'Engineering',
      suggested: 'reply with the known-issue note; no fix date.',
      body: [['Thanks for reporting this. Duel results not saving on '], ['version 3.11', 0], [' is a known issue our team is working on. We can’t share a fix date yet. Updating to the latest version from your app store may help.']],
      evidence: [
        { fact: 'Known issue: duel results not saved on 3.11 (open)', src: 'known-issues.md · CU-14YH0021', verified: true, values: ['3.11'] },
        { fact: 'app_version = 3.11', src: 'ticket · appversion field', values: ['3.11'] },
      ],
    },
    run: run([['classify', 360, 610, 32, 0.0002], ['enrich', 520, 0, 0, 0], ['decide', 150, 700, 18, 0.0002], ['draft', 1880, 2100, 82, 0.0033], ['guardrail', 460, 900, 26, 0.0004]]),
    history: [],
  },
  {
    id: 't8', ext: 'CU-14YK1C55', channel: 'clickup', status: 'triaged', mode: 'assist', issue: 'rating.unfair_drop', lang: 'hi-Latn',
    appVersion: '3.12', screen: 'Duel results', ageMin: 15, confidence: 0.79, sourceStatus: 'to do',
    reporter: { username: 'rohit.v', email: 'rohitv@gmail.com' },
    cohort: { resolved: true, by: 'username', paying: false, streak: 22, lookedUpH: 2 },
    body: ['lost 40 rating in one game?? opponent was way higher rated, ye fair nahi hai'],
    claim: { said: 40, db: 38, what: 'rating lost' },
    draft: {
      lang: 'hi-Latn', confidence: 0.79,
      suggested: 'approve; rating formula facts are verified.',
      body: [['Aapki rating us duel mein '], ['38 points', 0], [' giri thi. Rating change opponent ki rating aur result dono par depend karta hai, isliye ek loss mein bada drop ho sakta hai.']],
      evidence: [
        { fact: 'rating_change = −38', src: 'prod_db · userRatings', values: ['38'] },
        { fact: 'Drop depends on opponent rating and result', src: 'rating-leaderboard.md · verified', verified: true },
      ],
    },
    run: run([['classify', 370, 700, 34, 0.0002], ['enrich', 560, 0, 0, 0], ['decide', 150, 690, 18, 0.0002], ['draft', 1940, 2200, 74, 0.0034], ['guardrail', 470, 880, 24, 0.0004]]),
    history: [],
  },
  {
    id: 't9', ext: 'GM-81C2D4', channel: 'gmail', status: 'triaged', mode: 'assist', issue: 'account.otp', lang: 'en',
    ageMin: 9, confidence: 0.85,
    reporter: { email: 'meera.s@yahoo.in' },
    cohort: { resolved: false, by: 'email', paying: false, streak: 0, lookedUpH: 1 },
    subject: 'OTP not coming',
    body: ['Hi, the OTP never arrives when I try to log in. Tried 5 times since morning.'],
    draft: {
      lang: 'en', confidence: 0.85,
      suggested: 'ask which login method they use before anything else.',
      body: [['Sorry about the trouble logging in. Could you tell us whether you log in with your phone number or with Google? OTPs can take up to '], ['2 minutes', 0], [', and the resend button unlocks after that.']],
      evidence: [{ fact: 'OTP can take up to 2 minutes; resend after 2 minutes', src: 'account-access.md · verified', verified: true, values: ['2'] }],
    },
    run: run([['classify', 340, 520, 30, 0.0002], ['enrich', 900, 0, 0, 0], ['decide', 140, 560, 16, 0.0002], ['draft', 1500, 1700, 60, 0.0026], ['guardrail', 400, 760, 22, 0.0003]]),
    history: [],
  },

  // ── with the agent (status open) ──
  {
    id: 't10', ext: 'CU-14YKF9X0', channel: 'clickup', status: 'open', hint: 'Bug', lang: null,
    appVersion: '3.11', screen: 'Duel', ageMin: 1,
    reporter: { username: 'ro_v', email: 'rov@gmail.com' },
    cohort: { resolved: true, by: 'username', paying: false, streak: 41, lookedUpH: 0 },
    body: ['duel freeze ho gaya last round mein, rating bhi kaat li 😤'],
    run: { version: 'v0.3', status: 'running', steps: [{ step: 'classify', ms: 400, status: 'done', model: 'claude-haiku-4-5' }, { step: 'enrich', status: 'now', model: 'tools' }] },
    history: [],
    // the prototype finishes this run live a few seconds after load
    becomes: {
      status: 'triaged', mode: 'assist', issue: 'gameplay.freeze', lang: 'hi-Latn', confidence: 0.8,
      draft: {
        lang: 'hi-Latn', confidence: 0.8, routing: 'Engineering',
        suggested: 'send; freeze on 3.11 is a known issue.',
        body: [['Sorry, aapka duel freeze ho gaya. '], ['Version 3.11', 0], [' par yeh ek known issue hai aur team iss par kaam kar rahi hai. App update karne se help mil sakti hai.']],
        evidence: [{ fact: 'Known issue: duel freeze on 3.11 (open)', src: 'known-issues.md · CU-14YH0019', verified: true, values: ['3.11'] }],
      },
    },
  },
  {
    id: 't11', ext: 'FL-0032', channel: 'file', status: 'open', hint: 'Suggestion', lang: null, ageMin: 184,
    reporter: { phone: '+91 99300 11872' },
    cohort: { resolved: false, by: 'phone', paying: false, streak: 0, lookedUpH: 3 },
    body: ['pls add hindi language option for questions'],
    run: { version: 'v0.3', status: 'failed', error: 'prod_db lookup timed out after 5000 ms', attempt: 2,
           steps: [{ step: 'classify', ms: 500, status: 'done', model: 'claude-haiku-4-5' }, { step: 'enrich', ms: 5000, status: 'fail', model: 'tools' }] },
    history: [],
  },
  {
    id: 't12', ext: 'GM-82D9E1', channel: 'gmail', status: 'open', hint: null, lang: null, ageMin: 0,
    reporter: { email: 'k.iyer@gmail.com' },
    cohort: { resolved: true, by: 'email', paying: true, streak: 9, lookedUpH: 0 },
    subject: 'Refund for annual plan?',
    body: ['Can I get a refund for the annual plan, I bought it by mistake yesterday.'],
    run: { version: 'v0.3', status: 'running', steps: [{ step: 'classify', status: 'now', model: 'claude-haiku-4-5' }] },
    history: [],
  },

  // ── replied ──
  {
    id: 't13', ext: 'CU-14YH8820', channel: 'clickup', status: 'replied', mode: 'assist', issue: 'streak.wrong_count', lang: 'en',
    appVersion: '3.12', ageMin: 190, confidence: 0.86,
    reporter: { username: 'nisha_r', email: 'nisha.r@gmail.com' },
    cohort: { resolved: true, by: 'username', paying: true, streak: 212, lookedUpH: 3 },
    body: ['my streak shows 211 but it should be 212, I played at 11:58 pm'],
    final: 'Your streak is 212 days in our records. Streak days are counted in your phone’s timezone, so a game at 11:58 pm counts for that day. — Team Matiks',
    run: run([['classify', 360, 600, 30, 0.0002], ['enrich', 500, 0, 0, 0], ['decide', 140, 600, 16, 0.0002], ['draft', 1700, 1900, 62, 0.003], ['guardrail', 420, 800, 22, 0.0003]]),
    history: [
      { who: 'agent', act: 'drafted', after: '3.1s' },
      { who: 'Cyril', act: 'approved', after: '6m 10s', h: true },
    ],
  },
  {
    id: 't14', ext: 'CU-14YH9A31', channel: 'clickup', status: 'replied', mode: 'auto', issue: 'subscription.what_is_included', lang: 'en',
    ageMin: 260, confidence: 0.97,
    reporter: { username: 'tanvi.j', email: 'tanvi.j@gmail.com' },
    cohort: { resolved: true, by: 'username', paying: false, streak: 18, lookedUpH: 4 },
    body: ['does pro remove ads'],
    final: 'Yes. Pro is ad-free, and it also adds unlimited duels and detailed rating history. — Team Matiks',
    run: run([['classify', 330, 500, 28, 0.0002], ['enrich', 300, 0, 0, 0], ['decide', 130, 560, 14, 0.0002], ['draft', 1300, 1600, 40, 0.0024], ['guardrail', 380, 700, 20, 0.0003]]),
    history: [
      { who: 'agent', act: 'drafted · auto 0.97', after: '2.4s' },
      { who: 'Cyril', act: 'approved (auto batch of 6)', after: '0m 41s', h: true },
    ],
  },
  {
    id: 't15', ext: 'GM-80B117', channel: 'gmail', status: 'replied', mode: 'assist', issue: 'account.wrong_link', lang: 'en',
    ageMin: 330, confidence: 0.71,
    reporter: { username: 'farhan.q', email: 'farhan.q@gmail.com' },
    cohort: { resolved: true, by: 'email', paying: true, streak: 103, lookedUpH: 5 },
    subject: 'Login opens my brother’s account',
    body: ['When I log in with Google it opens my brother’s account, not mine. We share a laptop.'],
    final: 'Thanks for flagging this. Please sign out of Google in your browser, then sign in with your own Google account before opening Matiks. If it still opens the wrong account, reply with the email on your Matiks account and we will check it. — Team Matiks',
    run: run([['classify', 350, 600, 30, 0.0002], ['enrich', 450, 0, 0, 0], ['decide', 140, 600, 16, 0.0002], ['draft', 1900, 2000, 80, 0.0032], ['guardrail', 450, 860, 24, 0.0004]]),
    history: [
      { who: 'agent', act: 'drafted', after: '3.3s' },
      { who: 'Cyril', act: 'edited and approved', after: '9m 02s', h: true },
    ],
  },

  // ── closed ──
  {
    id: 't16', ext: 'CU-14YH7002', channel: 'clickup', status: 'closed', mode: 'assist', issue: 'other.spam', lang: 'en',
    ageMin: 420, confidence: 0.88,
    reporter: { username: 'buyfollowers_9' },
    cohort: { resolved: true, by: 'username', paying: false, streak: 0, lookedUpH: 7 },
    body: ['get 10k followers cheap dm me'],
    run: run([['classify', 300, 400, 20, 0.0001], ['enrich', 300, 0, 0, 0], ['decide', 120, 500, 12, 0.0002]]),
    history: [
      { who: 'agent', act: 'classified as spam', after: '0.7s' },
      { who: 'Cyril', act: 'closed · spam', after: '1m 05s', h: true },
    ],
  },
  {
    id: 't17', ext: 'CU-14YH6111', channel: 'clickup', status: 'closed', mode: 'auto', issue: 'suggestion.praise', lang: 'en',
    ageMin: 510, confidence: 0.99,
    reporter: { username: 'mathwhiz', email: 'mw@gmail.com' },
    cohort: { resolved: true, by: 'username', paying: true, streak: 301, lookedUpH: 8 },
    body: ['love the new duel animations!!'],
    final: 'Thank you! We have passed this on to the team that built them. — Team Matiks',
    run: run([['classify', 300, 380, 22, 0.0001], ['enrich', 280, 0, 0, 0], ['decide', 120, 480, 12, 0.0002], ['draft', 1100, 1100, 30, 0.0016], ['guardrail', 350, 640, 18, 0.0003]]),
    history: [
      { who: 'agent', act: 'drafted · auto 0.99', after: '2.2s' },
      { who: 'Cyril', act: 'approved (auto batch)', after: '1m 12s', h: true },
      { who: 'Cyril', act: 'closed · no reply needed', after: '1m 15s', h: true },
    ],
  },
];

for (const t of TICKETS) t.score = score(t.cohort);

const CHANNELS = [
  { name: 'clickup', kind: 'ClickUp form · list "feedbacks"', ok: true, lastSuccess: '40s ago', fails: 0, today: 132 },
  { name: 'gmail', kind: 'Gmail · support inbox', ok: true, lastSuccess: '1m ago', fails: 0, today: 46, note: 'Recovered at 13:20 after 2 failed polls' },
  { name: 'file', kind: 'File · WhatsApp export / CSV', ok: true, lastSuccess: '2m ago', fails: 0, today: 11, note: 'Added today: one new adapter, nothing else changed' },
];

// Insights: last 7 days. Totals are consistent with each other.
const INSIGHTS = {
  kpi: { firstAction: '3:48', costPerResolved: 0.0041, resolved: 145, received: 189 },
  topIssues: {
    all: [['streak', 'Streak and shields', 46, 6], ['account', 'Account and login', 31, 2], ['gameplay', 'Gameplay bugs', 28, 0],
          ['subscription', 'Subscription', 22, 0], ['rating', 'Rating and leaderboard', 19, 0], ['suggestion', 'Suggestions', 17, 0],
          ['payment', 'Payments', 9, 9], ['merch', 'Merch', 8, 8], ['safety', 'Safety', 5, 5], ['app', 'App version', 4, 0]],
    streak: [['streak', 'Streak and shields', 29, 5], ['gameplay', 'Gameplay bugs', 11, 0], ['rating', 'Rating and leaderboard', 9, 0],
             ['merch', 'Merch', 6, 6], ['account', 'Account and login', 4, 1], ['subscription', 'Subscription', 3, 0], ['safety', 'Safety', 1, 1]],
    paying: [['subscription', 'Subscription', 7, 0], ['payment', 'Payments', 6, 6], ['streak', 'Streak and shields', 5, 1],
             ['account', 'Account and login', 2, 0], ['gameplay', 'Gameplay bugs', 1, 0]],
  },
  ttr: [['Auto', 41, 58], ['Assist', 228, 71], ['Escalate', 2480, 16]], // median seconds, n
  costDays: [['Sep 27', 0.081], ['Sep 28', 0.094], ['Sep 29', 0.072], ['Sep 30', 0.103], ['Oct 1', 0.088], ['Oct 2', 0.097], ['Oct 3', 0.055]],
  costSteps: [['Draft', 'Sonnet 5.5', 0.43], ['Classify', 'Haiku 4.5', 0.07], ['Guardrail', 'Haiku 4.5', 0.05], ['Decide', 'Haiku 4.5', 0.03], ['Enrich', 'tools', 0.01]],
  cacheSaved: 0.08,
  channels: [['ClickUp', 132], ['Gmail', 46], ['File', 11]],
  flowBase: { handed: 32, replied: 114, closed: 26 }, // this week, before the tickets loaded in the prototype
  agent: { runs: 196, failed: 7, retriedOk: 6, avgMs: 3600 },
};

// Evals: 30 hand-labelled tickets from the knowledge-base eval set. Where results are stored is still open.
const EVALS = (() => {
  const rows = [
    ['My id is lost 🥲', 'account.lost_id', 'assist', 'assist', true, true, 0.0041],
    ['Do we need pro subscription for seeing comments too? /s', 'subscription.feature_gated', 'assist', 'assist', true, true, 0.0039],
    ['streak reset even though I played', 'streak.lost', 'escalate', 'escalate', true, true, 0.0006],
    ['charged twice this month', 'payment.double_charge', 'escalate', 'escalate', true, true, 0.0005],
    ['hoodie kab aayega', 'merch.not_shipped', 'escalate', 'escalate', true, true, 0.0006],
    ['dark mode pls', 'suggestion.ui', 'auto', 'auto', true, true, 0.0027],
    ['someone is sending me abusive msgs', 'safety.abusive_dm', 'escalate', 'escalate', true, true, 0.0006],
    ['shield laga hi nahi', 'streak.shield_not_applied', 'assist', 'assist', true, true, 0.0049],
    ['what do i get with pro', 'subscription.what_is_included', 'auto', 'auto', true, true, 0.0037],
    ['rating gir gayi bina wajah', 'rating.unfair_drop', 'assist', 'assist', true, true, 0.0042],
    ['OTP nahi aa raha', 'account.otp', 'assist', 'assist', true, true, 0.0035],
    ['app crashes after update', 'app.crash_after_update', 'assist', 'escalate', true, true, 0.0007],
    ['delete my account', 'account.delete', 'escalate', 'escalate', true, true, 0.0005],
    ['love the app!!', 'suggestion.praise', 'auto', 'auto', true, true, 0.0022],
    ['duel disconnect ho gaya', 'gameplay.duel_disconnect', 'assist', 'assist', true, true, 0.0044],
    ['streak 0 ho gaya, 200 din ka tha', 'streak.lost', 'escalate', 'escalate', true, true, 0.0006],
    ['how to claim merch', 'merch.how_to_claim', 'escalate', 'escalate', true, true, 0.0005],
    ['leaderboard not updating', 'rating.leaderboard_stale', 'assist', 'assist', false, true, 0.0046],
    ['old version not working', 'app.old_version', 'auto', 'assist', true, true, 0.0041],
    ['refund kab milega', 'payment.refund_status', 'escalate', 'escalate', true, true, 0.0006],
    ['ban appeal please', 'safety.ban_appeal', 'escalate', 'escalate', true, true, 0.0005],
    ['wrong answer marked correct', 'gameplay.wrong_answer_marked', 'assist', 'assist', true, true, 0.0045],
    ['login opens wrong account', 'account.wrong_link', 'assist', 'assist', true, true, 0.0040],
    ['मेरी स्ट्रीक गायब हो गई', 'streak.lost', 'escalate', 'escalate', true, true, 0.0007],
    ['score not saved', 'gameplay.score_not_saved', 'assist', 'assist', true, true, 0.0043],
    ['add hindi questions', 'suggestion.feature', 'auto', 'auto', true, true, 0.0026],
    ['cancel pro', 'subscription.cancel', 'assist', 'assist', true, false, 0.0039],
    ['rank missing from leaderboard', 'rating.rank_missing', 'assist', 'assist', true, true, 0.0044],
    ['feature missing on web', 'app.feature_missing_platform', 'assist', 'assist', true, true, 0.0041],
    ['report user for cheating', 'safety.report_user', 'escalate', 'escalate', true, true, 0.0006],
  ];
  return rows.map(([text, leaf, expected, actual, said, notSaid, cost], i) => ({ n: i + 1, text, leaf, expected, actual, said, notSaid, cost }));
})();
