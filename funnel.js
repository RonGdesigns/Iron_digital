/* ══════════════════════════════════════════════════════
   1. MAGNETIC CURSOR
   ══════════════════════════════════════════════════════ */
(function initCursor() {
  const cursor = document.getElementById('custom-cursor');
  if (!cursor) return;

  const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (!mq.matches) { cursor.style.display = 'none'; return; }

  document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  });

  const hoverSel = 'button, a, input, label, select, [role="button"]';
  document.addEventListener('mouseover', (e) => {
    if (e.target.matches(hoverSel) || e.target.closest(hoverSel)) {
      cursor.classList.add('hovering');
    }
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.matches(hoverSel) || e.target.closest(hoverSel)) {
      cursor.classList.remove('hovering');
    }
  });
})();

/* ══════════════════════════════════════════════════════
   3. FUNNEL STATE MACHINE & PROGRESS
   ══════════════════════════════════════════════════════ */
const intentPayload = {
  track: null,
  answers: [],
  score: 0,
};

const TOTAL_STEPS = 5; // steps 0–4
let currentStepId = 'step-0';

function goToStep(targetId) {
  const current = document.getElementById(currentStepId);
  const target = document.getElementById(targetId);
  if (!target) return;

  if (current) {
    current.style.animation = 'fadeOut 0.28s cubic-bezier(0.25,1,0.5,1) both';
    setTimeout(() => {
      current.classList.remove('active');
      current.style.animation = '';
    }, 260);
  }

  setTimeout(() => {
    target.classList.add('active');
    target.style.animation = 'fadeUp 0.5s cubic-bezier(0.25,1,0.5,1) both';
    currentStepId = targetId;
    updateProgress(parseInt(target.dataset.step, 10));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (targetId === 'step-converge') renderScoreReveal();
  }, 250);
}

function updateProgress(stepNum) {
  // Endowed Progress Hack: Start the user at 15% completion to increase conversion
  const BASE_PROGRESS = 15;
  const pct = Math.round(BASE_PROGRESS + ((stepNum / (TOTAL_STEPS - 1)) * (100 - BASE_PROGRESS)));

  const fill = document.getElementById('progress-fill');
  const rail = document.getElementById('progress-rail');
  const label = document.getElementById('step-label');

  if (fill) fill.style.width = pct + '%';
  if (rail) rail.setAttribute('aria-valuenow', pct);
  if (label) label.textContent = stepNum >= (TOTAL_STEPS - 1) ? 'Complete ✓' : `Phase ${stepNum + 1} of ${TOTAL_STEPS}`;
}

function handleChoice(btn) {
  const nextStep = btn.dataset.next;
  const track = btn.dataset.track;
  const value = btn.dataset.value;
  const weight = parseInt(btn.dataset.weight || '0', 10);

  if (track) intentPayload.track = track;
  intentPayload.answers.push({ value, weight });
  intentPayload.score += weight;

  btn.style.transform = 'scale(0.97)';
  setTimeout(() => { btn.style.transform = ''; }, 120);
  setTimeout(() => goToStep(nextStep), 140);
}

/* ══════════════════════════════════════════════════════
   4. LEAD SCORING ENGINE
   ══════════════════════════════════════════════════════ */
const MAX_SCORE = 110;

function scoreTier(score) {
  if (score >= 65) return { label: '⬡ HIGH-INTENT — Priority routing active', cls: 'tier-high' };
  if (score >= 35) return { label: '◈ QUALIFIED LEAD — Nurture sequence queued', cls: 'tier-mid' };
  return { label: '◻ EARLY INQUIRY — Educational sequence queued', cls: 'tier-low' };
}

function renderScoreReveal() {
  const pct = Math.min(Math.round((intentPayload.score / MAX_SCORE) * 100), 100);
  const fill = document.getElementById('score-track-fill');
  const display = document.getElementById('score-display');
  const tierEl = document.getElementById('score-tier');

  setTimeout(() => {
    if (fill) fill.style.width = pct + '%';
    if (display) display.textContent = `Score: ${intentPayload.score} / ${MAX_SCORE} pts`;
    const tier = scoreTier(intentPayload.score);
    if (tierEl) { tierEl.textContent = tier.label; tierEl.className = 'score-tier ' + tier.cls; }
  }, 500);

  const tEl = document.getElementById('payload-track');
  const aEl = document.getElementById('payload-answers');
  const sEl = document.getElementById('payload-score');
  if (tEl) tEl.value = intentPayload.track || '';
  if (aEl) aEl.value = JSON.stringify(intentPayload.answers);
  if (sEl) sEl.value = intentPayload.score;
}

/* ══════════════════════════════════════════════════════
   5. FORM VALIDATION
   ══════════════════════════════════════════════════════ */
const VALIDATORS = {
  first_name: { regex: /^[A-Za-z '\-]{2,50}$/, msg: 'Enter a valid first name.' },
  last_name: { regex: /^[A-Za-z '\-]{2,50}$/, msg: 'Enter a valid last name.' },
  email: { regex: /^[^\s@]+@[^@\s]+\.[^@\s]{2,}$/, msg: 'Enter a valid corporate email.' },
  company_name: { regex: /^.{2,120}$/, msg: 'Enter your company name.' },
};

const ERR_IDS = {
  first_name: 'err-first', last_name: 'err-last',
  email: 'err-email', company_name: 'err-company',
};

function validateField(input) {
  // Skip validation for select fields, native 'required' handles it
  if (input.tagName === 'SELECT') return input.value !== "";

  const rule = VALIDATORS[input.name];
  const errEl = document.getElementById(ERR_IDS[input.name]);
  if (!rule) return true;

  const valid = rule.regex.test(input.value.trim());
  input.classList.toggle('is-invalid', !valid);
  if (errEl) errEl.textContent = valid ? '' : rule.msg;
  return valid;
}

/* ══════════════════════════════════════════════════════
   6. SUBMISSION
   ══════════════════════════════════════════════════════ */
function buildPayload(formData) {
  const params = new URLSearchParams(window.location.search);
  return {
    first_name: formData.get('first_name').trim(),
    last_name: formData.get('last_name').trim(),
    email: formData.get('email').trim().toLowerCase(),
    company_name: formData.get('company_name').trim(),
    timeline: formData.get('timeline'),
    budget: formData.get('budget'),
    track: intentPayload.track,
    answers: intentPayload.answers,
    lead_score: intentPayload.score,
    score_tier: intentPayload.score >= 65 ? 'HIGH' : intentPayload.score >= 35 ? 'MID' : 'LOW',
    submitted_at: new Date().toISOString(),
    source: 'iron-digital-discovery-funnel',
    referrer: document.referrer || 'direct'
  };
}

function buildDoneSummary() {
  const labels = {
    website: 'Track: Professional Website Architecture',
    system: 'Track: Business Operations System & Automation',
    startup: 'Phase: Brand-New Business Launch',
    redesign: 'Phase: Platform Redesign & Optimization',
    startup_mvp: 'Strategy: Rapid MVP Deployment (Speed to Market)',
    startup_full: 'Strategy: Full Custom Architecture',
    redesign_conversion: 'Fix Target: Low Conversion & High Bounce Rate',
    redesign_tech: 'Fix Target: Technical Debt & Slow Load Times',
    content_ready: 'Readiness: Content & Branding Ready to Deploy',
    content_needed: 'Readiness: Requires Iron Digital Brand/Copy Creation',
    data_silos: 'Friction: Disconnected Data Silos',
    pipeline_gaps: 'Friction: Pipeline & Lead Tracking Gaps',
    client_support: 'Friction: Client Portals & Support Loops',
    silos_finance: 'Resolution Focus: Automated Financial Sync (CRM to Accounting)',
    silos_inventory: 'Resolution Focus: Real-time Inventory & Fulfillment Routing',
    pipeline_capture: 'Resolution Focus: Zero-Latency Lead Capture & Routing',
    pipeline_nurture: 'Resolution Focus: Autonomous Follow-up Sequences',
    support_status: 'Resolution Focus: Self-Serve Client Status Dashboards',
    support_approvals: 'Resolution Focus: Automated Document & Onboarding Workflows',
    integration_low: 'API Scope: Standalone System (Low Complexity)',
    integration_mid: 'API Scope: Core Stack (2-3 Integrations)',
    integration_high: 'API Scope: Enterprise Data Routing (4+ Legacy Systems)'
  };
  return intentPayload.answers
    .filter(a => labels[a.value])
    .map(a => `<div class="done-summary-item">${labels[a.value]}</div>`)
    .join('') || '<div class="done-summary-item">Discovery complete — strategy is being compiled.</div>';
}

async function handleSubmit(e) {
  e.preventDefault();
  const form = document.getElementById('capture-form');
  let allValid = true;

  form.querySelectorAll('input[required], select[required]').forEach(inp => {
    if (!validateField(inp)) allValid = false;
  });

  if (!allValid) return;

  const btn = document.getElementById('btn-submit');
  const text = btn.querySelector('.btn-submit-text');
  btn.disabled = true;
  text.textContent = 'Assembling Blueprint…';

  const payload = buildPayload(new FormData(form));
  console.log('[Iron Digital MI] Lead Payload:', JSON.stringify(payload, null, 2));

  // ── Lead Server (Nodemailer) ─────────────────────────
  // In production, change this to your Railway/Render URL
  const SERVER_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001/send'
    : 'https://iron-digital-server.onrender.com/send';

  // Serialize answers array for the server
  const serverPayload = {
    ...payload,
    answers: JSON.stringify(payload.answers.map(a => a.value)),
  };

  try {
    const res = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serverPayload),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Server error');
    transitionToDone(payload);
  } catch (err) {
    console.error('[Iron Digital MI] Submit error:', err);
    // Still show done screen — don't block the user if email fails
    transitionToDone(payload);
    // Optionally surface a soft error:
    // text.textContent = 'Send failed — please try again';
    // btn.disabled = false;
  }
}

function transitionToDone(payload) {
  const summary = document.getElementById('done-summary');
  const msg = document.getElementById('done-message');
  const calBtn = document.getElementById('btn-calendar');

  if (summary) summary.innerHTML = buildDoneSummary();

  if (payload.score_tier === 'HIGH' || payload.budget === '15k_plus') {
    if (msg) msg.textContent =
      `We've flagged your file as a Priority Tier 1 engagement, ${payload.first_name}. ` +
      `A senior Iron Digital MI strategist will be in contact shortly. ` +
      `Don't wait — lock in your strategy call now.`;
    if (calBtn) calBtn.style.display = 'inline-flex';
  } else {
    if (calBtn) calBtn.style.display = 'none';
  }

  goToStep('step-done');
}

/* ══════════════════════════════════════════════════════
   7. RESET & INIT
   ══════════════════════════════════════════════════════ */
function resetFunnel() {
  intentPayload.track = null;
  intentPayload.answers = [];
  intentPayload.score = 0;

  const form = document.getElementById('capture-form');
  if (form) {
    form.reset();
    form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    form.querySelectorAll('.field-error').forEach(el => el.textContent = '');
  }

  const btn = document.getElementById('btn-submit');
  const text = btn?.querySelector('.btn-submit-text');
  if (btn) btn.disabled = false;
  if (text) text.textContent = 'Calculate My Strategy';

  const fill = document.getElementById('score-track-fill');
  if (fill) fill.style.width = '0%';

  goToStep('step-0');
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.choice-card').forEach(btn => {
    btn.addEventListener('click', () => handleChoice(btn));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleChoice(btn); }
    });
  });

  document.querySelectorAll('.field-input').forEach(input => {
    input.addEventListener('blur', () => validateField(input));
    input.addEventListener('input', () => { if (input.classList.contains('is-invalid')) validateField(input); });
  });

  const form = document.getElementById('capture-form');
  if (form) form.addEventListener('submit', handleSubmit);

  const restartBtn = document.getElementById('btn-restart');
  if (restartBtn) restartBtn.addEventListener('click', resetFunnel);

  updateProgress(0); // This will trigger the 15% endowed progress
});