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
    // Tier calculation hidden from user (sent in payload only)
    const tier = scoreTier(intentPayload.score);
    if (tierEl) { tierEl.style.display = 'none'; }
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
  phone: { regex: /^[\d\s\(\)\-\+]{7,20}$/, msg: 'Enter a valid phone number.' },
};

const ERR_IDS = {
  first_name: 'err-first', last_name: 'err-last',
  email: 'err-email', company_name: 'err-company',
  phone: 'err-phone',
};

function validateField(input) {
  if (input.tagName === 'SELECT') {
    const valid = input.value !== "";
    input.classList.toggle('is-invalid', !valid);
    const errEl = document.getElementById(`err-${input.name}`);
    if (errEl) errEl.textContent = valid ? '' : 'Please select an option.';
    return valid;
  }
  if (input.tagName === 'TEXTAREA') return true;

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
    phone: formData.get('phone') ? formData.get('phone').trim() : '',
    company_name: formData.get('company_name').trim(),
    timeline: formData.get('timeline'),
    budget: formData.get('budget'),
    additional_info: formData.get('additional_info') ? formData.get('additional_info').trim() : '',
    track: intentPayload.track,
    answers: intentPayload.answers,
    lead_score: intentPayload.score,
    score_tier: intentPayload.score >= 65 ? 'HIGH' : intentPayload.score >= 35 ? 'MID' : 'LOW',
    submitted_at: new Date().toISOString(),
    source: 'iron-digital-discovery-funnel',
    referrer: document.referrer || 'direct'
  };
}

const PATH_LABELS = {
  website: 'Track: Professional Website Architecture',
  system: 'Track: Business Operations System & Automation',
  
  // Website Branch
  a1_leadgen: 'Objective: Service & Lead Generation',
  a1_ecomm: 'Objective: E-Commerce & Retail',
  a1_saas: 'Objective: Web Application / SaaS',
  a1_authority: 'Objective: Brand Authority & Portfolio',
  
  a2_leadgen_bounce: 'Friction: High Traffic, Low Conversion',
  a2_leadgen_quality: 'Friction: Low Quality Leads',
  a2_leadgen_zero: 'Friction: Starting from Zero',
  
  a2_ecomm_abandon: 'Friction: Abandoned Carts / Poor CR',
  a2_ecomm_sync: 'Friction: Inventory & Fulfillment Sync',
  a2_ecomm_zero: 'Friction: Brand New Store',
  
  a2_saas_mvp: 'Phase: Rapid MVP for Funding/Users',
  a2_saas_scale: 'Phase: Scaling & Refactoring Existing App',
  
  a2_auth_investors: 'Audience: Investors & Stakeholders',
  a2_auth_b2b: 'Audience: Enterprise B2B Clients',
  
  a3_leadgen_crm_yes: 'Integration: Connect to Existing CRM',
  a3_leadgen_crm_no: 'Integration: Standalone Lead Routing',
  
  a3_ecomm_shopify: 'Platform: Shopify',
  a3_ecomm_woo: 'Platform: WooCommerce / WordPress',
  a3_ecomm_custom: 'Platform: Custom / Headless Commerce',
  
  a3_saas_design_yes: 'Readiness: UI/UX Designs Ready',
  a3_saas_design_no: 'Readiness: Requires UI/UX Design',
  
  a3_assets_ready: 'Readiness: Content & Branding Ready',
  a3_assets_needed: 'Readiness: Requires Copy/Brand Creation',
  
  // Systems Branch
  b1_team: 'Operational State: Scaling an Existing Team',
  b1_solo: 'Operational State: Solo Operator / Fractional',
  b1_product: 'Operational State: Building a New Software Product',
  
  b2_team_silos: 'Bottleneck: Disconnected Data Silos',
  b2_team_support: 'Bottleneck: Client Support & Onboarding',
  
  b2_solo_leads: 'Bottleneck: Lead Generation & Follow-up',
  b2_solo_admin: 'Bottleneck: Fulfillment & Admin',
  
  b2_product_concept: 'Phase: Conceptual Idea',
  b2_product_mvp: 'Phase: MVP / Prototype Built',
  
  b3_scope_low: 'API Scope: Standalone Tool (Low Complexity)',
  b3_scope_high: 'API Scope: Complex Integrations (4+ APIs)'
};

function buildDoneSummary() {
  
  return intentPayload.answers
    .filter(a => PATH_LABELS[a.value])
    .map(a => `<div class="done-summary-item">${PATH_LABELS[a.value]}</div>`)
    .join('') || '<div class="done-summary-item">Discovery complete — strategy is being compiled.</div>';
}

async function handleSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
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
    answers: JSON.stringify(payload.answers.map(a => PATH_LABELS[a.value] || a.value)),
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s max
    const res = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serverPayload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
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

  if (msg) msg.textContent =
      `Your blueprint has been securely transmitted, ${payload.first_name}. ` +
      `An Iron Digital MI strategist will review your architecture shortly. ` +
      `To expedite the process, lock in your strategy call now.`;
  if (calBtn) calBtn.style.display = 'inline-flex';

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
  // Form submission is now handled directly via onsubmit in the HTML

  const restartBtn = document.getElementById('btn-restart');
  if (restartBtn) restartBtn.addEventListener('click', resetFunnel);

  updateProgress(0); // This will trigger the 15% endowed progress
});