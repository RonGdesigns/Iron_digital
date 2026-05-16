require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────
app.use(express.json());
app.use(cors({
  origin: [
    'https://irondigitalmi.com',
    'http://127.0.0.1:5500',  // Live Server dev
    'http://localhost:5500',
    'http://localhost:3000',
  ]
}));

// ── Nodemailer Transport ──────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  connectionTimeout: 10000,  // fail after 10s if can't connect
  greetingTimeout:   10000,
  socketTimeout:     15000,
});

// ── Helpers ───────────────────────────────────────────────
const TRACK_LABELS = {
  website: 'Professional Website',
  system: 'Business Systems / Automation',
};

const ANSWER_LABELS = {
  startup:              'Brand-New Launch',
  redesign:             'Rebuilding Established Site',
  startup_mvp:          'Rapid MVP (3-4 Weeks)',
  startup_full:         'Full Custom Architecture (8+ Weeks)',
  redesign_conversion:  'Traffic Comes, Nobody Converts',
  redesign_tech:        'Slow / Broken / Can\'t Update',
  content_ready:        'Fully Loaded (Assets Ready)',
  content_needed:       'Creation Needed (Iron Digital Handles)',
  data_silos:           'Disconnected Data Silos',
  pipeline_gaps:        'Pipeline Tracking Gaps',
  client_support:       'Client Support & Onboarding',
  silos_finance:        'Sales → Accounting',
  silos_inventory:      'E-commerce → Fulfillment',
  pipeline_capture:     'Initial Capture & Routing',
  pipeline_nurture:     'Follow-up & Nurturing',
  support_status:       'Endless Status Updates',
  support_approvals:    'Onboarding & Approvals',
  integration_low:      'Standalone (0-1 Integrations)',
  integration_mid:      'Core Stack (2-3 Integrations)',
  integration_high:     'Enterprise (4+ Integrations)',
};

const SCORE_TIER = (score) => {
  if (score >= 60) return '🔥 HIGH-VALUE LEAD';
  if (score >= 35) return '⚡ WARM LEAD';
  return '📋 COLD LEAD';
};

const TIMELINE_LABELS = {
  immediate:    'ASAP — Expedited Build',
  '1_3_months': '1–3 Months (Standard)',
  'q3_q4':      'Later This Year (Planning)',
};

const BUDGET_LABELS = {
  under_5k: 'Under $5,000',
  '5k_15k': '$5,000 – $15,000',
  '15k_plus': '$15,000+',
};

// ── POST /send ────────────────────────────────────────────
app.post('/send', async (req, res) => {
  const {
    first_name, last_name, email, company_name,
    timeline, budget, track, answers, lead_score,
  } = req.body;

  // Basic server-side validation
  if (!first_name || !last_name || !email || !company_name) {
    return res.status(400).json({ ok: false, error: 'Missing required fields.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Invalid email address.' });
  }

  const parsedAnswers = (() => {
    try { return JSON.parse(answers); } catch { return []; }
  })();

  const score = parseInt(lead_score, 10) || 0;
  const tier  = SCORE_TIER(score);

  const answersHtml = parsedAnswers
    .map(a => `<li><strong>${ANSWER_LABELS[a] || a}</strong></li>`)
    .join('');

  const html = `
    <div style="font-family:'Segoe UI',sans-serif;max-width:620px;margin:0 auto;background:#070e1a;color:#e6f1ff;padding:0;border:1px solid #1a365d;">

      <!-- Header -->
      <div style="background:#112240;padding:28px 36px;border-bottom:3px solid #00d4ff;">
        <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#8892b0;margin-bottom:6px;">Iron Digital MI · Lead Engine</div>
        <div style="font-size:24px;font-weight:800;color:#fff;">New Lead Captured</div>
        <div style="margin-top:10px;display:inline-block;background:#00d4ff;color:#000;font-size:11px;font-weight:700;letter-spacing:0.1em;padding:4px 12px;">${tier}</div>
      </div>

      <!-- Score Bar -->
      <div style="padding:24px 36px;background:#0d1b34;border-bottom:1px solid #1a365d;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:#8892b0;margin-bottom:8px;">Opportunity Signal Score</div>
        <div style="background:#112240;height:6px;border-radius:0;">
          <div style="background:#00d4ff;height:6px;width:${Math.min(score, 100)}%;"></div>
        </div>
        <div style="font-size:12px;color:#8892b0;margin-top:6px;">${score} / 100</div>
      </div>

      <!-- Contact Info -->
      <div style="padding:28px 36px;border-bottom:1px solid #1a365d;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:#00d4ff;margin-bottom:16px;">Contact Details</div>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#8892b0;font-size:12px;width:140px;">Name</td><td style="font-weight:600;">${first_name} ${last_name}</td></tr>
          <tr><td style="padding:6px 0;color:#8892b0;font-size:12px;">Email</td><td><a href="mailto:${email}" style="color:#00d4ff;">${email}</a></td></tr>
          <tr><td style="padding:6px 0;color:#8892b0;font-size:12px;">Company</td><td style="font-weight:600;">${company_name}</td></tr>
          <tr><td style="padding:6px 0;color:#8892b0;font-size:12px;">Timeline</td><td>${TIMELINE_LABELS[timeline] || timeline}</td></tr>
          <tr><td style="padding:6px 0;color:#8892b0;font-size:12px;">Budget</td><td>${BUDGET_LABELS[budget] || budget}</td></tr>
        </table>
      </div>

      <!-- Funnel Path -->
      <div style="padding:28px 36px;border-bottom:1px solid #1a365d;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:#00d4ff;margin-bottom:16px;">Discovery Path</div>
        <div style="margin-bottom:10px;font-size:12px;color:#8892b0;">Primary Track: <strong style="color:#e6f1ff;">${TRACK_LABELS[track] || track}</strong></div>
        <ul style="margin:0;padding-left:20px;color:#e6f1ff;font-size:14px;line-height:2;">
          ${answersHtml}
        </ul>
      </div>

      <!-- Footer -->
      <div style="padding:20px 36px;background:#050a13;font-size:11px;color:#4a5d7c;text-align:center;">
        Iron Digital MI · Detroit, Michigan · irondigitalmi.com
      </div>
    </div>
  `;

  const mailOptions = {
    from: `"Iron Digital Lead Engine" <${process.env.GMAIL_USER}>`,
    to: process.env.NOTIFY_EMAIL || process.env.GMAIL_USER,
    replyTo: email,
    subject: `[${tier}] ${company_name} — ${TRACK_LABELS[track] || track} · Score: ${score}`,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Lead sent: ${company_name} (${email}) — Score: ${score}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Mail error:', err.message);
    res.status(500).json({ ok: false, error: 'Email delivery failed.' });
  }
});

// ── POST /send-project ───────────────────────────────────
const PLAN_LABELS = {
  landing:  'Landing Page Special ($100)',
  starter:  'Starter Build ($1,000)',
  standard: 'Standard Subscription ($99/mo)',
  growth:   'Growth Subscription ($199/mo)',
  premium:  'Premium Subscription ($399/mo)',
  custom:   'Custom Software / Workflow Build',
};

app.post('/send-project', async (req, res) => {
  const { name, email, phone, 'project-type': projectType, 'business-desc': businessDesc } = req.body;

  if (!name || !email || !projectType) {
    return res.status(400).json({ ok: false, error: 'Missing required fields.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Invalid email address.' });
  }

  const planLabel = PLAN_LABELS[projectType] || projectType;

  const html = `
    <div style="font-family:'Segoe UI',sans-serif;max-width:620px;margin:0 auto;background:#070e1a;color:#e6f1ff;padding:0;border:1px solid #1a365d;">

      <!-- Header -->
      <div style="background:#112240;padding:28px 36px;border-bottom:3px solid #00d4ff;">
        <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#8892b0;margin-bottom:6px;">Iron Digital MI · Project Request</div>
        <div style="font-size:24px;font-weight:800;color:#fff;">New Project Submission</div>
        <div style="margin-top:10px;display:inline-block;background:#00d4ff;color:#000;font-size:11px;font-weight:700;letter-spacing:0.1em;padding:4px 12px;">${planLabel}</div>
      </div>

      <!-- Contact Info -->
      <div style="padding:28px 36px;border-bottom:1px solid #1a365d;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:#00d4ff;margin-bottom:16px;">Contact Details</div>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#8892b0;font-size:12px;width:140px;">Name</td><td style="font-weight:600;">${name}</td></tr>
          <tr><td style="padding:6px 0;color:#8892b0;font-size:12px;">Email</td><td><a href="mailto:${email}" style="color:#00d4ff;">${email}</a></td></tr>
          <tr><td style="padding:6px 0;color:#8892b0;font-size:12px;">Phone</td><td style="font-weight:600;">${phone || '—'}</td></tr>
          <tr><td style="padding:6px 0;color:#8892b0;font-size:12px;">Selected Plan</td><td style="font-weight:700;color:#00d4ff;">${planLabel}</td></tr>
        </table>
      </div>

      <!-- Business Description -->
      <div style="padding:28px 36px;border-bottom:1px solid #1a365d;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:#00d4ff;margin-bottom:12px;">Business Description & Goals</div>
        <div style="font-size:14px;color:#e6f1ff;line-height:1.7;white-space:pre-wrap;">${businessDesc || '—'}</div>
      </div>

      <!-- Footer -->
      <div style="padding:20px 36px;background:#050a13;font-size:11px;color:#4a5d7c;text-align:center;">
        Iron Digital MI · Detroit, Michigan · irondigitalmi.com
      </div>
    </div>
  `;

  const mailOptions = {
    from: `"Iron Digital Project Intake" <${process.env.GMAIL_USER}>`,
    to: process.env.NOTIFY_EMAIL || process.env.GMAIL_USER,
    replyTo: email,
    subject: `[PROJECT] ${name} — ${planLabel}`,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Project request sent: ${name} (${email}) — ${planLabel}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Mail error:', err.message);
    res.status(500).json({ ok: false, error: 'Email delivery failed.' });
  }
});

// ── Health Check ──────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Iron Digital Lead Server running on port ${PORT}`);
});
