// Mode switching and persistence
(function initModeSwitch() {
  const buttons = Array.from(document.querySelectorAll('.mode-btn'));
  const panes = {
    normal: document.getElementById('pane-normal'),
    scientific: document.getElementById('pane-scientific'),
    bmi: document.getElementById('pane-bmi'),
    age: document.getElementById('pane-age'),
    currency: document.getElementById('pane-currency')
  };

  function setMode(mode) {
    Object.keys(panes).forEach(key => {
      panes[key].classList.toggle('hidden', key !== mode);
    });
    buttons.forEach(btn => btn.setAttribute('aria-selected', String(btn.dataset.mode === mode)));
    localStorage.setItem('calc-mode', mode);
  }

  const saved = localStorage.getItem('calc-mode');
  setMode(saved && panes[saved] ? saved : 'normal');

  buttons.forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
})();

// Utility
const TIME_ZONE = 'Asia/Kolkata';

function getZonedParts(date, timeZone, opts) {
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: !!(opts && opts.hour12)
  });
  const parts = dtf.formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    period: map.dayPeriod || ''
  };
}

function getZonedTodayDate(timeZone) {
  const p = getZonedParts(new Date(), timeZone);
  return new Date(p.year, p.month - 1, p.day);
}

// Real-time IST clock
(function clockIST() {
  const clockEl = document.getElementById('clock');
  if (!clockEl) return;
  function render() {
    const p = getZonedParts(new Date(), TIME_ZONE, { hour12: true });
    const dd = String(p.day).padStart(2, '0');
    const mm = String(p.month).padStart(2, '0');
    const hh = String(p.hour).padStart(2, '0');
    const mi = String(p.minute).padStart(2, '0');
    const ss = String(p.second).padStart(2, '0');
    const period = (p.period || '').toUpperCase();
    clockEl.textContent = `${dd}-${mm}-${p.year} ${hh}:${mi}:${ss} ${period} IST`;
  }
  render();
  setInterval(render, 1000);
})();

function clampNumber(value) {
  if (!isFinite(value)) return NaN;
  return Math.abs(value) > 1e15 ? Number(value.toPrecision(15)) : value;
}

function safeEval(expression) {
  // Evaluate a strictly numeric expression
  // Only digits, operators, parentheses, dot, and Math functions mapped below
  const allowed = /^[0-9+\-*/%^().,\s]*$/;
  if (!allowed.test(expression)) throw new Error('Invalid characters');
  // Replace ^ with ** for exponentiation
  const expr = expression.replace(/\^/g, '**');
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${expr});`)();
}

// Normal calculator
(function normalCalc() {
  const display = document.getElementById('normal-display');
  const container = document.getElementById('pane-normal');
  let current = '';

  function update(val) { current = val; display.value = current; }
  function append(token) { update(current + token); }

  function compute() {
    if (!current) return;
    try {
      const prepared = current.replace(/÷/g, '/').replace(/×/g, '*');
      // Percent: replace "a%b" -> "(a*(b/100))" when b follows %
      const pct = prepared.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
      const result = clampNumber(safeEval(pct));
      if (Number.isNaN(result)) throw new Error('Invalid');
      update(String(result));
    } catch (_) {
      update('Error');
      setTimeout(() => update(''), 800);
    }
  }

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.key');
    if (!btn) return;
    const key = btn.dataset.key;
    if (key === 'C') return update('');
    if (key === '⌫') return update(current.slice(0, -1));
    if (key === '=') return compute();
    if (key === '÷') return append('/');
    if (key === '×') return append('*');
    return append(key);
  });
})();

// Scientific calculator
(function scientificCalc() {
  const display = document.getElementById('sci-display');
  const container = document.getElementById('pane-scientific');
  let expr = '';

  function update(v) { expr = v; display.value = expr; }
  function append(t) { update(expr + t); }

  function factorial(n) {
    if (n < 0 || !Number.isInteger(n)) return NaN;
    let acc = 1;
    for (let i = 2; i <= n; i++) acc *= i;
    return acc;
  }

  function toJsExpression(src) {
    let s = src;
    s = s.replace(/÷/g, '/').replace(/×/g, '*');
    s = s.replace(/√/g, 'Math.sqrt');
    s = s.replace(/sin\(/g, 'Math.sin(')
         .replace(/cos\(/g, 'Math.cos(')
         .replace(/tan\(/g, 'Math.tan(')
         .replace(/log\(/g, 'Math.log10(')
         .replace(/ln\(/g, 'Math.log(');
    s = s.replace(/(\d+(?:\.\d+)?)!\b/g, (_, a) => `factorial(${a})`);
    s = s.replace(/\^/g, '**');
    return s;
  }

  function compute() {
    if (!expr) return;
    try {
      const js = toJsExpression(expr);
      // eslint-disable-next-line no-new-func
      const result = clampNumber(Function('factorial', `"use strict"; return (${js});`)(factorial));
      if (Number.isNaN(result)) throw new Error('Invalid');
      update(String(result));
    } catch (_) {
      update('Error');
      setTimeout(() => update(''), 800);
    }
  }

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.key');
    if (!btn) return;
    const key = btn.dataset.key;
    if (key === 'C') return update('');
    if (key === '⌫') return update(expr.slice(0, -1));
    if (key === '=') return compute();
    if (key === 'x^y' || key === '^') return append('^');
    if (key === '√') return append('√(');
    if (['sin','cos','tan','log','ln'].includes(key)) return append(`${key}(`);
    return append(key);
  });
})();

// BMI calculator
(function bmiCalc() {
  const systemEl = document.getElementById('bmi-system');
  const weightEl = document.getElementById('bmi-weight');
  const heightEl = document.getElementById('bmi-height');
  const resultEl = document.getElementById('bmi-result');
  const btn = document.getElementById('bmi-calc');
  const clr = document.getElementById('bmi-clear');

  function classify(bmi) {
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal weight';
    if (bmi < 30) return 'Overweight';
    return 'Obesity';
  }

  function compute() {
    const system = systemEl.value;
    const w = parseFloat(weightEl.value);
    const h = parseFloat(heightEl.value);
    if (!(w > 0) || !(h > 0)) {
      resultEl.textContent = 'Enter valid weight and height.';
      return;
    }
    let kg = w;
    let m = h / 100;
    if (system === 'imperial') {
      kg = w * 0.45359237; // lb to kg
      m = (h * 2.54) / 100; // in to m
    }
    const bmi = clampNumber(kg / (m * m));
    resultEl.textContent = `BMI: ${bmi.toFixed(1)} (${classify(bmi)})`;
  }

  btn.addEventListener('click', compute);
  clr.addEventListener('click', () => {
    weightEl.value = '';
    heightEl.value = '';
    resultEl.textContent = '';
  });
})();

// Age calculator
(function ageCalc() {
  const dobEl = document.getElementById('age-dob');
  const resultEl = document.getElementById('age-result');
  const btn = document.getElementById('age-calc');
  const clr = document.getElementById('age-clear');

  function compute() {
    const value = dobEl.value;
    if (!value) { resultEl.textContent = 'Select a valid date.'; return; }
    // Strict parser: prefer dd/mm/yyyy to avoid locale ambiguity; allow yyyy-mm-dd
    let dob;
    const slash = value.match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/);
    const dash = value.match(/^\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*$/);
    if (slash) {
      const d = Number(slash[1]);
      const m = Number(slash[2]);
      const y = Number(slash[3]);
      if (m < 1 || m > 12 || d < 1 || d > 31) { resultEl.textContent = 'Enter in dd/mm/yyyy.'; return; }
      dob = new Date(y, m - 1, d);
    } else if (dash) {
      const y = Number(dash[1]);
      const m = Number(dash[2]);
      const d = Number(dash[3]);
      dob = new Date(y, m - 1, d);
    } else {
      resultEl.textContent = 'Enter DOB as dd/mm/yyyy.'; return;
    }
    // Today as date-only using Asia/Kolkata timezone
    const now = getZonedTodayDate(TIME_ZONE);
    if (dob > now) { resultEl.textContent = 'Date is in the future.'; return; }

    let years = now.getFullYear() - dob.getFullYear();
    let months = now.getMonth() - dob.getMonth();
    let days = now.getDate() - dob.getDate();

    if (days < 0) {
      const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      days += prevMonth.getDate();
      months -= 1;
    }
    if (months < 0) {
      months += 12;
      years -= 1;
    }
    // Output only age; computation uses real-time IST date from the live clock helpers
    resultEl.textContent = `${years} years, ${months} months, ${days} days`;
  }

  btn.addEventListener('click', compute);
  clr.addEventListener('click', () => { dobEl.value = ''; resultEl.textContent = ''; });
})();

// Currency calculator (offline presets + custom rate)
(function currencyCalc() {
  const amountEl = document.getElementById('fx-amount');
  const fromEl = document.getElementById('fx-from');
  const toEl = document.getElementById('fx-to');
  const rateEl = document.getElementById('fx-rate');
  const presetEl = document.getElementById('fx-preset');
  const resultEl = document.getElementById('fx-result');
  const convertBtn = document.getElementById('fx-convert');
  const swapBtn = document.getElementById('fx-swap');

  const currencies = ['USD','EUR','GBP','JPY','INR','AUD','CAD'];
  const presets = {
    'USD->EUR': 0.92,
    'EUR->USD': 1.09,
    'USD->INR': 83.0,
    'INR->USD': 0.012,
    'USD->JPY': 150,
    'JPY->USD': 0.0067,
    'GBP->EUR': 1.15,
    'EUR->GBP': 0.87
  };

  function populate() {
    currencies.forEach(c => {
      const o1 = document.createElement('option'); o1.value = c; o1.textContent = c; fromEl.appendChild(o1);
      const o2 = document.createElement('option'); o2.value = c; o2.textContent = c; toEl.appendChild(o2);
    });
    fromEl.value = 'USD';
    toEl.value = 'EUR';
    const none = document.createElement('option');
    none.value = ''; none.textContent = '— None —'; presetEl.appendChild(none);
    Object.keys(presets).forEach(k => {
      const opt = document.createElement('option');
      opt.value = k; opt.textContent = `${k} (${presets[k]})`;
      presetEl.appendChild(opt);
    });
  }

  function compute() {
    const amount = parseFloat(amountEl.value);
    const from = fromEl.value;
    const to = toEl.value;
    if (!(amount >= 0)) { resultEl.textContent = 'Enter a valid amount.'; return; }
    if (from === to) { resultEl.textContent = `${amount.toFixed(2)} ${to}`; return; }

    let rate = parseFloat(rateEl.value);
    if (!(rate > 0)) {
      const key = `${from}->${to}`;
      if (presetEl.value && presets[presetEl.value] && presetEl.value === key) {
        rate = presets[key];
      } else if (presets[key]) {
        rate = presets[key];
      }
    }

    if (!(rate > 0)) { resultEl.textContent = 'Provide a valid rate or choose a preset.'; return; }
    const converted = amount * rate;
    resultEl.textContent = `${amount.toFixed(2)} ${from} → ${converted.toFixed(2)} ${to} @ ${rate}`;
  }

  function swap() {
    const f = fromEl.value; const t = toEl.value;
    fromEl.value = t; toEl.value = f; compute();
  }

  populate();
  convertBtn.addEventListener('click', compute);
  swapBtn.addEventListener('click', swap);
})();


