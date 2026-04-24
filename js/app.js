/* ===== מרכז פיקוד — App Logic ===== */

// ── Google Calendar cache (loaded from Firestore on init) ──
let _gcalEvents = [];

// ── State ──────────────────────────────────────────────
const State = {
  page: 'home',
  brainCat: 'business',
  leadFilter: 'all',
  familyCat: 'tasks',
  finTab: 'summary',
  finPeriod: 'month',
  finNavMonth: new Date().toISOString().slice(0, 7),
};

// ── Date Helpers ───────────────────────────────────────
const DAYS   = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function todayStr() { return new Date().toISOString().split('T')[0]; }

function heDay() {
  const d = new Date();
  return `יום ${DAYS[d.getDay()]}, ${d.getDate()} ב${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth()+1}`;
}

function fmtReminder(task) {
  if (!task.dueDate) return null;
  const d = new Date(task.dueDate);
  const t = task.reminderTime || '';
  return `${d.getDate()} ב${MONTHS[d.getMonth()]}${t ? ' · ' + t : ''}`;
}

// ── Toast ──────────────────────────────────────────────
function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:calc(var(--nav-h) + var(--safe-bottom) + 80px);right:50%;transform:translateX(50%);background:#1C1C1E;color:#fff;padding:10px 20px;border-radius:20px;font-size:14px;z-index:1000;transition:opacity 0.3s;white-space:nowrap;pointer-events:none';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._tid);
  t._tid = setTimeout(() => { t.style.opacity = '0'; }, 2200);
}

// ── Page Configs ───────────────────────────────────────
const PAGE_CFG = {
  home:     { title: 'דף הבית',      fabColor: 'var(--c-home)',     btnColor: 'var(--c-home)' },
  brain:    { title: 'מוח חיצוני',   fabColor: 'var(--c-brain)',    btnColor: 'var(--c-brain)' },
  finance:  { title: 'כספים',         fabColor: 'var(--c-finance)',  btnColor: 'var(--c-finance)' },
  crossfit: { title: 'CrossFit BUX',  fabColor: 'var(--c-crossfit)', btnColor: 'var(--c-crossfit)' },
  family:   { title: 'בית ומשפחה',   fabColor: 'var(--c-family)',   btnColor: 'var(--c-family)' },
};

// ── Navigation ─────────────────────────────────────────
function navigate(page) {
  document.getElementById('page-' + State.page).classList.add('hidden');
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

  State.page = page;
  const cfg = PAGE_CFG[page];
  document.getElementById('page-' + page).classList.remove('hidden');
  document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');
  document.getElementById('header-title').textContent = cfg.title;
  document.getElementById('fab').style.setProperty('--fab-color', cfg.fabColor);
  document.documentElement.style.setProperty('--active-color', cfg.fabColor);

  renderPage(page);
}

function renderPage(page) {
  const el = document.getElementById('page-' + page);
  switch (page) {
    case 'home':     renderHome(el);     break;
    case 'brain':    renderBrain(el);    break;
    case 'finance':  renderFinance(el);  break;
    case 'crossfit': renderCrossfit(el); break;
    case 'family':   renderFamily(el);   break;
  }
}

// ── HOME — מח ראשי ─────────────────────────────────────
function renderHome(el) {
  const tasks   = DB.get('tasks');
  const finance = DB.get('finance');
  const leads   = DB.get('leads');
  const month   = new Date().toISOString().slice(0,7);

  const openTasks    = tasks.filter(t => !t.done);
  const urgentTasks  = openTasks.filter(t => t.priority === 'high');
  const upcoming     = openTasks.filter(t => t.dueDate).sort((a,b) => a.dueDate.localeCompare(b.dueDate));
  const newLeads     = leads.filter(l => l.status === 'new');
  const monthFin     = finance.filter(f => f.date?.startsWith(month));
  const monthExp     = monthFin.filter(f => f.type==='expense').reduce((s,f) => s+f.amount, 0);
  const monthInc     = monthFin.filter(f => f.type==='income').reduce((s,f)  => s+f.amount, 0);
  const balance      = monthInc - monthExp;

  const insights = generateInsights({ tasks, finance, leads, month, openTasks, urgentTasks, upcoming, newLeads, monthExp, monthInc, balance, monthFin });

  el.innerHTML = `
    <div class="greeting">
      <div class="greeting-name">${getGreeting()}, גל 👋</div>
      <div class="greeting-sub">${heDay()}</div>
    </div>

    <!-- Calm button -->
    <button class="calm-home-btn" onclick="openCalmTool()">
      <span style="font-size:28px">🌊</span>
      <div>
        <div style="font-size:15px;font-weight:700">הרגעה מהירה</div>
        <div style="font-size:12px;opacity:.75">נשימות · עיגון · שחרור</div>
      </div>
      <span style="font-size:20px;opacity:.6">›</span>
    </button>

    <!-- AI Insights -->
    <div class="card" style="margin-bottom:12px">
      <div class="card-label" style="margin-bottom:12px">💡 המח אומר</div>
      ${insights.map(i => `
        <div class="insight-row insight-${i.type}" onclick="${i.nav||''}">
          <span class="insight-icon">${i.icon}</span>
          <span class="insight-text">${i.text}</span>
          ${i.nav ? '<span style="color:var(--text-3);font-size:16px">›</span>' : ''}
        </div>
      `).join('')}
    </div>

    <!-- Finance snapshot by context -->
    <div class="card" style="margin-bottom:12px" onclick="navigate('finance')">
      <div class="card-label" style="margin-bottom:10px">💰 כספים החודש</div>
      ${renderFinContextMini(monthFin)}
    </div>

    <!-- Upcoming reminders -->
    ${upcoming.length ? `
    <div class="card" style="margin-bottom:12px">
      <div class="card-label">🔔 תזכורות קרובות</div>
      ${upcoming.slice(0,3).map(t => `
        <div class="task-item ${t.done?'done':''}">
          <div class="task-check ${t.done?'checked':''}" onclick="toggleTask('${t.id}','tasks')"></div>
          <div class="task-body">
            <div class="task-text">${esc(t.text)}</div>
            <div class="task-meta">📅 ${fmtReminder(t)}</div>
          </div>
          <button class="action-mini" onclick="event.stopPropagation();exportToCalendar('${t.id}')">📅</button>
        </div>
      `).join('')}
    </div>` : ''}

    <!-- Calendar widget -->
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div class="card-label" style="margin-bottom:0">📅 יומן — שבוע קרוב</div>
        <div style="display:flex;gap:10px;align-items:center">
          <button id="gcal-refresh-btn" onclick="refreshGcal()" style="background:none;border:none;font-size:16px;cursor:pointer;padding:0;line-height:1;opacity:0.7" title="רענן יומן">🔄</button>
          <button onclick="openCalendar()" style="background:none;border:none;font-size:13px;color:var(--c-home);font-weight:600;cursor:pointer;padding:0">פתח יומן ›</button>
        </div>
      </div>
      ${renderUpcomingCalendar(tasks)}
    </div>

    <!-- Open tasks -->
    ${openTasks.length ? `
    <div class="card" style="margin-bottom:12px">
      <div class="card-label">📋 משימות פתוחות (${openTasks.length})</div>
      ${openTasks.slice(0,4).map(t => taskItemHTML(t, true)).join('')}
    </div>` : `
    <div class="card" style="margin-bottom:12px;text-align:center;padding:24px">
      <div style="font-size:36px">✅</div>
      <div style="color:var(--text-3);margin-top:6px">כל המשימות הושלמו!</div>
    </div>`}
  `;
}

function generateInsights({ tasks, finance, leads, month, openTasks, urgentTasks, upcoming, newLeads, monthExp, monthInc, balance, monthFin }) {
  const ins = [];
  const now = new Date();

  // Finance
  if (monthExp > 0) {
    const byCat = {};
    monthFin.filter(f=>f.type==='expense').forEach(f => { byCat[f.category]=(byCat[f.category]||0)+f.amount; });
    const top = Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0];
    const topCat = top ? finCatById(top[0]) : null;
    ins.push({ icon:'💸', text:`הוצאת ₪${monthExp.toLocaleString('he-IL')} החודש${topCat?` — הכי הרבה על ${topCat.emoji} ${topCat.name}`:''}`, type:'neutral', nav:`navigate('finance')` });
  }
  if (monthInc > 0) {
    ins.push({ icon: balance>=0?'📈':'📉', text:`מאזן חודשי: ${balance>=0?'+':''}₪${balance.toLocaleString('he-IL')}`, type: balance>=0?'good':'warning', nav:`navigate('finance')` });
  }

  // Tasks
  if (urgentTasks.length > 0) {
    ins.push({ icon:'🔴', text:`${urgentTasks.length} משימות דחופות ממתינות לטיפול`, type:'urgent', nav:`navigate('brain')` });
  } else if (openTasks.length === 0) {
    ins.push({ icon:'✅', text:'אין משימות פתוחות — כל הכבוד!', type:'good' });
  }

  // Due soon (3 days)
  const dueSoon = upcoming.filter(t => { const d=(new Date(t.dueDate)-now)/(864e5); return d>=0&&d<=3; });
  if (dueSoon.length) ins.push({ icon:'⏰', text:`${dueSoon.length} תזכורות בשלושת הימים הקרובים`, type:'warning', nav:`navigate('brain')` });

  // Leads
  if (newLeads.length > 0) {
    ins.push({ icon:'👤', text:`${newLeads.length} לידים חדשים ב-BUX מחכים לטיפול`, type:'action', nav:`navigate('crossfit')` });
  }

  // If nothing to show
  if (ins.length === 0) ins.push({ icon:'😊', text:'הכל נראה מצוין! הוסף נתונים כדי לקבל תובנות', type:'neutral' });

  return ins;
}

// Finance context mini view for home screen
const FIN_CONTEXTS = [
  { id:'home_ctx',     label:'🏠 בית',       color:'#FF2D55', cats:['grocery','home','care','pets','holidays','superfarma','health','personal','superfarma'] },
  { id:'personal_ctx', label:'🙋 אישי',      color:'#007AFF', cats:['food_out','coffee','clothes','fun','transport'] },
  { id:'business_ctx', label:'💼 עסק',        color:'#5856D6', cats:['business'] },
  { id:'crossfit_ctx', label:'🏋️ BUX',        color:'#FF9500', cats:['crossfit'] },
];

function renderFinContextMini(monthFin) {
  const expenses = monthFin.filter(f => f.type === 'expense');
  const totalExp = expenses.reduce((s,f) => s+f.amount, 0);
  if (totalExp === 0) return `<div style="color:var(--text-3);font-size:13px;text-align:center;padding:8px">אין הוצאות החודש — לחץ להוסיף</div>`;

  return FIN_CONTEXTS.map(ctx => {
    const ctxTotal = expenses.filter(f => ctx.cats.includes(f.category)).reduce((s,f) => s+f.amount, 0);
    if (ctxTotal === 0) return '';
    const pct = totalExp > 0 ? (ctxTotal / totalExp) * 100 : 0;
    return `
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
          <span style="font-weight:500">${ctx.label}</span>
          <span style="font-weight:700;color:${ctx.color}">₪${ctxTotal.toLocaleString('he-IL')}</span>
        </div>
        <div style="height:6px;background:#E5E5EA;border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${Math.min(pct,100)}%;background:${ctx.color};border-radius:3px;transition:width .4s"></div>
        </div>
      </div>`;
  }).join('');
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'בוקר טוב';
  if (h < 17) return 'צהריים טובים';
  if (h < 21) return 'ערב טוב';
  return 'לילה טוב';
}

// ── CALM TOOL — כלי הרגעה ─────────────────────────────
function openCalmTool() {
  openModal(`
    <div class="modal-title">🌊 הרגעה מהירה</div>
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:14px;color:var(--text-3);margin-bottom:14px">כמה עז התחושה עכשיו?</div>
      <div class="calm-intensity-row" id="int-row">
        ${[1,2,3,4,5,6,7,8,9,10].map(n => {
          const color = n<=3?'#34C759':n<=6?'#FF9500':'#FF3B30';
          return `<button class="calm-int-btn" data-val="${n}" style="--ic:${color}"
            onclick="selectIntensity(${n})">${n}</button>`;
        }).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-3);margin-top:4px;padding:0 4px">
        <span>רגוע</span><span>בינוני</span><span>עצים</span>
      </div>
    </div>
    <div id="calm-tool-area"></div>
  `);
}

function selectIntensity(n) {
  document.querySelectorAll('.calm-int-btn').forEach(b =>
    b.classList.toggle('sel', parseInt(b.dataset.val) === n));
  const area = document.getElementById('calm-tool-area');
  if (!area) return;

  let tools = '';
  if (n >= 7) {
    tools = `
      <div style="text-align:center;font-size:13px;color:var(--text-3);margin-bottom:12px">כעס עצים — בוא ננשום ביחד</div>
      <div class="calm-tools-grid">
        ${calmCard('🫁','נשימת קופסה','4·4·4·4',"startBreathing('box')")}
        ${calmCard('😮‍💨','4-7-8','מרגיע עצבים',"startBreathing('478')")}
        ${calmCard('🌍','5-4-3-2-1','עיגון חושי','startGrounding()')}
        ${calmCard('🚶','הרחק את עצמך','2 דקות לבד','quickTip("הרחק")')}
      </div>`;
  } else if (n >= 4) {
    tools = `
      <div style="text-align:center;font-size:13px;color:var(--text-3);margin-bottom:12px">בוא נחזיר אותך לרגע הנוכחי</div>
      <div class="calm-tools-grid">
        ${calmCard('🌍','5-4-3-2-1','עיגון חושי','startGrounding()')}
        ${calmCard('🫁','נשימה','4-4-4-4',"startBreathing('box')")}
        ${calmCard('💧','שתה מים','פעולה פשוטה','quickTip("מים")')}
        ${calmCard('✍️','שחרר בכתיבה','יומן רגשי','openCalmJournal()')}
      </div>`;
  } else {
    tools = `
      <div style="text-align:center;font-size:13px;color:var(--text-3);margin-bottom:12px">כעס קל — בוא נבין מה קרה</div>
      <div class="calm-tools-grid">
        ${calmCard('✍️','שחרר בכתיבה','יומן רגשי','openCalmJournal()')}
        ${calmCard('🌍','עיגון','5-4-3-2-1','startGrounding()')}
        ${calmCard('🫁','נשימה','הרגע','startBreathing(\'box\')')}
        ${calmCard('📊','דפוסים','היסטוריה','openCalmHistory()')}
      </div>`;
  }

  area.innerHTML = tools + `
    <button class="btn-secondary" style="margin-top:14px" onclick="openCalmJournal(${n})">
      ✍️ תעד מה קרה (${n}/10)
    </button>`;
}

function calmCard(emoji, name, desc, action) {
  return `
    <button class="calm-tool-card" onclick="${action}">
      <span style="font-size:32px">${emoji}</span>
      <span class="calm-tool-name">${name}</span>
      <span class="calm-tool-desc">${desc}</span>
    </button>`;
}

function quickTip(type) {
  const tips = {
    'הרחק': { icon:'🚶', title:'הרחק את עצמך', body:'לך לחדר אחר, צא החוצה לכמה דקות.\nמרחק פיזי = מרחק רגשי.\nחזור כשאתה מוכן.' },
    'מים':  { icon:'💧', title:'שתה מים', body:'קום, שפוך כוס מים קרים.\nשתה לאט — זה מפעיל את הפאראסימפטתי\nומוריד את רמת הקורטיזול.' },
  };
  const t = tips[type];
  if (!t) return;
  document.getElementById('modal-content').innerHTML = `
    <div style="text-align:center;padding:16px 0">
      <div style="font-size:56px;margin-bottom:12px">${t.icon}</div>
      <div style="font-size:20px;font-weight:700;margin-bottom:12px">${t.title}</div>
      <div style="font-size:15px;color:var(--text-2);line-height:1.8;white-space:pre-line;margin-bottom:24px">${t.body}</div>
      <button class="btn-primary" onclick="openCalmJournal()">✍️ תעד אחר כך</button>
      <button class="btn-secondary" style="margin-top:8px" onclick="closeModal()">סגור</button>
    </div>`;
}

// ── Breathing Exercise ─────────────────────────────────
let _breathTimer = null;

const BREATH_PATTERNS = {
  box:  { name:'נשימת קופסה', color:'#007AFF', rounds:4,
          phases:[['שאיפה','inhale',4],['עצירה','hold',4],['נשיפה','exhale',4],['עצירה','hold',4]] },
  '478':{ name:'4-7-8',       color:'#5856D6', rounds:3,
          phases:[['שאיפה','inhale',4],['עצירה','hold',7],['נשיפה','exhale',8]] },
};

function startBreathing(type) {
  const p = BREATH_PATTERNS[type];
  clearTimeout(_breathTimer);
  openModal(`
    <div style="text-align:center">
      <div class="modal-title">${p.name}</div>
      <div class="calm-breath-wrap">
        <div class="calm-breath-circle" id="breath-circle" style="--bc:${p.color}"></div>
        <div class="calm-breath-center">
          <div id="breath-phase" style="font-size:16px;font-weight:700;color:${p.color}">מוכן?</div>
          <div id="breath-count" style="font-size:44px;font-weight:900;color:${p.color}">3</div>
        </div>
      </div>
      <div id="breath-round" style="font-size:13px;color:var(--text-3);margin-top:8px">סיבוב 0 / ${p.rounds}</div>
      <button class="btn-secondary" style="margin-top:16px" onclick="stopBreathing()">עצור</button>
    </div>
  `);
  runBreathCycle(p, 0, 0, 0, true);
}

function runBreathCycle(p, round, phaseIdx, count, countdown) {
  if (!document.getElementById('breath-circle')) return;
  const circle   = document.getElementById('breath-circle');
  const phaseEl  = document.getElementById('breath-phase');
  const countEl  = document.getElementById('breath-count');
  const roundEl  = document.getElementById('breath-round');

  if (countdown > 0) {
    countEl.textContent = countdown;
    _breathTimer = setTimeout(() => runBreathCycle(p, round, phaseIdx, count, countdown - 1), 1000);
    return;
  }

  const [phaseName, phaseType, duration] = p.phases[phaseIdx];
  if (count === 0) {
    phaseEl.textContent = phaseName;
    if (phaseType === 'inhale') {
      circle.style.transition = `transform ${duration}s ease-in-out`;
      circle.style.transform  = 'scale(1.45)';
    } else if (phaseType === 'exhale') {
      circle.style.transition = `transform ${duration}s ease-in-out`;
      circle.style.transform  = 'scale(0.75)';
    }
    roundEl.textContent = `סיבוב ${round + 1} / ${p.rounds}`;
  }
  countEl.textContent = duration - count;

  let nextCount = count + 1;
  let nextPhase = phaseIdx;
  let nextRound = round;

  if (nextCount >= duration) {
    nextCount = 0;
    nextPhase++;
    if (nextPhase >= p.phases.length) {
      nextPhase = 0;
      nextRound++;
      if (nextRound >= p.rounds) { stopBreathing(); return; }
    }
  }
  _breathTimer = setTimeout(() => runBreathCycle(p, nextRound, nextPhase, nextCount, 0), 1000);
}

function stopBreathing() {
  clearTimeout(_breathTimer);
  document.getElementById('modal-content').innerHTML = `
    <div style="text-align:center;padding:24px 0">
      <div style="font-size:64px;margin-bottom:16px">😌</div>
      <div style="font-size:22px;font-weight:700;margin-bottom:8px">מעולה!</div>
      <div style="font-size:14px;color:var(--text-3);margin-bottom:24px">איך אתה מרגיש עכשיו?</div>
      <button class="btn-primary" onclick="openCalmJournal()">✍️ תעד את החוויה</button>
      <button class="btn-secondary" style="margin-top:8px" onclick="closeModal()">סגור</button>
    </div>`;
}

// ── Grounding 5-4-3-2-1 ────────────────────────────────
const GROUND_STEPS = [
  { n:5, emoji:'👁️', sense:'ראייה',  instruction:'מצא 5 דברים שאתה רואה עכשיו' },
  { n:4, emoji:'🤚', sense:'מגע',    instruction:'מצא 4 דברים שאתה יכול לגעת בהם' },
  { n:3, emoji:'👂', sense:'שמיעה',  instruction:'הקשב ל-3 צלילים שאתה שומע' },
  { n:2, emoji:'👃', sense:'ריח',    instruction:'שים לב ל-2 ריחות סביבך' },
  { n:1, emoji:'👅', sense:'טעם',    instruction:'הרגש טעם אחד בפה שלך' },
];

function startGrounding() { showGroundStep(0); }

function showGroundStep(idx) {
  if (idx >= GROUND_STEPS.length) {
    document.getElementById('modal-content').innerHTML = `
      <div style="text-align:center;padding:24px 0">
        <div style="font-size:64px;margin-bottom:16px">🌱</div>
        <div style="font-size:22px;font-weight:700;margin-bottom:8px">עשית את זה!</div>
        <div style="font-size:14px;color:var(--text-3);margin-bottom:24px">אתה מחובר לרגע הנוכחי</div>
        <button class="btn-primary" onclick="openCalmJournal()">✍️ תעד את החוויה</button>
        <button class="btn-secondary" style="margin-top:8px" onclick="closeModal()">סיום</button>
      </div>`;
    return;
  }
  const s = GROUND_STEPS[idx];
  document.getElementById('modal-content').innerHTML = `
    <div style="text-align:center">
      <div style="font-size:13px;color:var(--text-3);margin-bottom:6px">${idx+1} / ${GROUND_STEPS.length}</div>
      <div style="font-size:56px;margin-bottom:4px">${s.emoji}</div>
      <div style="font-size:56px;font-weight:900;color:var(--c-brain);line-height:1;margin-bottom:8px">${s.n}</div>
      <div style="font-size:17px;font-weight:600;margin-bottom:20px">${s.instruction}</div>
      <div class="calm-ground-checks" id="ground-checks">
        ${Array.from({length:s.n},(_,i) =>
          `<button class="calm-ground-check" onclick="checkGround(this,${s.n})">${s.emoji}</button>`
        ).join('')}
      </div>
      <button class="btn-primary" id="ground-next" style="margin-top:20px;display:none"
        onclick="showGroundStep(${idx+1})">${idx+1<GROUND_STEPS.length?'הבא ›':'סיום ✅'}</button>
      <button class="btn-secondary" style="margin-top:8px" onclick="showGroundStep(${idx+1})">דלג</button>
    </div>`;
}

function checkGround(btn, total) {
  btn.classList.add('done');
  btn.disabled = true;
  const done = document.querySelectorAll('.calm-ground-check.done').length;
  if (done >= total) {
    const next = document.getElementById('ground-next');
    if (next) next.style.display = 'block';
  }
}

// ── Calm Journal ───────────────────────────────────────
function openCalmJournal(intensity) {
  openModal(`
    <div class="modal-title">✍️ מה קרה?</div>
    <div class="form-group">
      <label class="form-label">מה גרם לתחושה?</label>
      <textarea class="form-textarea" id="calm-trigger" placeholder="תאר בקצרה מה קרה..." rows="2"></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">איפה הרגשת את זה בגוף?</label>
      <div class="chip-row" id="body-chips">
        ${['❤️ לב','🤰 בטן','🧠 ראש','💪 שרירים','😮‍💨 נשימה','🔥 חום'].map(b =>
          `<button class="chip" onclick="this.classList.toggle('sel')" data-val="${b}">${b}</button>`
        ).join('')}
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">מה עשית?</label>
      <div class="chip-row" id="action-chips">
        ${['נשמתי','התרחקתי','דיברתי','שתקתי','פרצתי','ספרתי לאחור'].map(a =>
          `<button class="chip" onclick="this.classList.toggle('sel')" data-val="${a}">${a}</button>`
        ).join('')}
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">לפעם הבאה — מה יעזור יותר?</label>
      <textarea class="form-textarea" id="calm-lesson" placeholder="תובנה קצרה..." rows="2"></textarea>
    </div>
    <button class="btn-primary" style="--btn-color:#5856D6" onclick="saveCalmEntry(${intensity||5})">💾 שמור</button>
  `);
}

function saveCalmEntry(intensity) {
  const trigger = document.getElementById('calm-trigger')?.value.trim() || '';
  const lesson  = document.getElementById('calm-lesson')?.value.trim()  || '';
  const body    = [...document.querySelectorAll('#body-chips .sel')].map(b => b.dataset.val);
  const actions = [...document.querySelectorAll('#action-chips .sel')].map(b => b.dataset.val);
  DB.add('calm_log', { intensity, trigger, lesson, body, actions, date: todayStr() });
  closeModal();
  showToast('✅ נרשם — כל הכבוד על העבודה הפנימית 💪');
}

function openCalmHistory() {
  const log = DB.get('calm_log');
  if (!log.length) {
    openModal(`<div class="modal-title">📊 היסטוריה</div>
      <div style="text-align:center;padding:30px;color:var(--text-3)">אין רשומות עדיין</div>`);
    return;
  }
  const avg = (log.reduce((s,e) => s+(e.intensity||0),0)/log.length).toFixed(1);
  openModal(`
    <div class="modal-title">📊 דפוסי כעס</div>
    <div style="display:flex;gap:12px;margin-bottom:20px">
      <div class="stat-card" style="flex:1;text-align:center;padding:12px">
        <div class="stat-value">${log.length}</div>
        <div class="stat-label">פעמים נרשמו</div>
      </div>
      <div class="stat-card" style="flex:1;text-align:center;padding:12px">
        <div class="stat-value">${avg}</div>
        <div class="stat-label">עוצמה ממוצעת</div>
      </div>
    </div>
    <div style="max-height:55vh;overflow-y:auto">
      ${log.slice(0,20).map(e => `
        <div style="padding:12px;border-bottom:1px solid var(--sep)">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:13px;color:var(--text-3)">${e.date||''}</span>
            <span style="font-size:13px;font-weight:700;color:${(e.intensity||0)>=7?'#FF3B30':(e.intensity||0)>=4?'#FF9500':'#34C759'}">${e.intensity||'?'}/10</span>
          </div>
          ${e.trigger ? `<div style="font-size:14px;margin-bottom:4px">${esc(e.trigger)}</div>` : ''}
          ${e.lesson  ? `<div style="font-size:12px;color:var(--c-brain)">💡 ${esc(e.lesson)}</div>` : ''}
        </div>`).join('')}
    </div>
  `);
}

// ── Calendar helpers ───────────────────────────────────
function refreshGcal() {
  const btn = document.getElementById('gcal-refresh-btn');
  if (btn) {
    btn.style.animation = 'spin 0.8s linear infinite';
    btn.style.display = 'inline-block';
  }
  if (typeof loadGcalEvents === 'function') {
    loadGcalEvents(evts => {
      _gcalEvents = evts || [];
      renderPage('home');
      showToast('📅 יומן עודכן!');
    });
  }
}

function openCalendar() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) {
    // Try native iOS calendar
    window.location.href = 'calshow://';
    setTimeout(() => window.open('https://calendar.google.com/calendar/r', '_blank'), 600);
  } else {
    window.open('https://calendar.google.com/calendar/r', '_blank');
  }
}

function renderUpcomingCalendar(tasks) {
  const today = todayStr();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 14);
  const futureStr = futureDate.toISOString().split('T')[0];

  // ── Task-based items ──────────────────────────────────
  const taskItems = tasks
    .filter(t => !t.done && t.dueDate && t.dueDate >= today && t.dueDate <= futureStr)
    .map(t => ({
      date: t.dueDate,
      time: t.reminderTime || '',
      title: t.text,
      type: 'task',
      priority: t.priority,
      category: t.category,
    }));

  // ── Google Calendar items ─────────────────────────────
  const gcalItems = _gcalEvents
    .filter(e => e.date && e.date >= today && e.date <= futureStr)
    .map(e => ({
      date: e.date,
      time: e.time || '',
      endTime: e.endTime || '',
      title: e.title,
      type: 'gcal',
    }));

  // ── Merge & sort by date then time ───────────────────
  const all = [...taskItems, ...gcalItems]
    .sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return (a.time || '99:99').localeCompare(b.time || '99:99');
    });

  if (!all.length) {
    return `<div style="font-size:13px;color:var(--text-3);text-align:center;padding:8px 0">
      אין אירועים בשבועיים הקרובים
      <div style="margin-top:6px;font-size:12px">אירועי יומן גוגל יופיעו כאן אוטומטית</div>
    </div>`;
  }

  // Group by date
  const byDate = {};
  all.forEach(item => {
    if (!byDate[item.date]) byDate[item.date] = [];
    byDate[item.date].push(item);
  });

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  return Object.entries(byDate).map(([date, items]) => {
    const d = new Date(date + 'T00:00:00');
    const isToday    = date === today;
    const isTomorrow = date === tomorrowStr;
    const label = isToday ? '⭐ היום' : isTomorrow ? '📌 מחר' : `${DAYS[d.getDay()]}, ${d.getDate()} ב${MONTHS[d.getMonth()]}`;
    const labelColor = isToday ? 'var(--c-home)' : isTomorrow ? '#FF9500' : 'var(--text-3)';
    return `
      <div style="margin-bottom:10px">
        <div style="font-size:11px;font-weight:700;color:${labelColor};margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px">${label}</div>
        ${items.map(item => {
          if (item.type === 'gcal') {
            const timeStr = item.time ? `${item.time}${item.endTime ? '–'+item.endTime : ''}` : '';
            return `
            <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--sep)">
              <span style="font-size:13px;flex-shrink:0">📅</span>
              <div style="font-size:13px;flex:1;line-height:1.3">${esc(item.title)}</div>
              ${timeStr ? `<span style="font-size:11px;color:var(--text-3);direction:ltr">${timeStr}</span>` : ''}
            </div>`;
          } else {
            const pri = PRIORITY_CFG[item.priority];
            const area = BRAIN_AREAS.find(a => a.key === item.category);
            return `
            <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--sep)">
              <div style="width:8px;height:8px;border-radius:50%;background:${pri?.color||'var(--text-3)'};flex-shrink:0"></div>
              <div style="font-size:13px;flex:1;line-height:1.3">${esc(item.title)}</div>
              ${item.time ? `<span style="font-size:11px;color:var(--text-3)">${item.time}</span>` : ''}
              ${area ? `<span style="font-size:11px;color:${area.color}">${area.emoji}</span>` : ''}
            </div>`;
          }
        }).join('')}
      </div>`;
  }).join('');
}

// ── BRAIN — Things 3 inspired ─────────────────────────
const BRAIN_AREAS = [
  { key: 'today',    label: 'היום',    emoji: '⭐', color: '#FF9500' },
  { key: 'business', label: 'עסק',     emoji: '💼', color: '#5856D6' },
  { key: 'home',     label: 'בית',     emoji: '🏠', color: '#FF2D55' },
  { key: 'personal', label: 'אישי',    emoji: '👤', color: '#007AFF' },
  { key: 'idea',     label: 'רעיונות', emoji: '💡', color: '#34C759' },
];

const PRIORITY_CFG = {
  high:   { color: '#FF3B30', label: 'דחוף',  dot: '🔴' },
  medium: { color: '#FF9500', label: 'בינוני', dot: '🟡' },
  low:    { color: '#34C759', label: 'נמוך',   dot: '🟢' },
};

function getTodayTasks(allTasks) {
  const today = todayStr();
  return allTasks
    .filter(t => !t.done && (
      (t.dueDate && t.dueDate <= today) ||          // פגה תוקף / היום
      (t.priority === 'high' && !t.dueDate)         // דחוף ללא תאריך
    ))
    .sort((a,b) => {
      const po = { high:0, medium:1, low:2 };
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return (po[a.priority]??3) - (po[b.priority]??3);
    });
}

function renderBrain(el) {
  const area     = State.brainCat || 'today';
  const allTasks = DB.get('tasks');

  // Count per area
  const counts = {};
  BRAIN_AREAS.forEach(a => {
    if (a.key === 'today') counts[a.key] = getTodayTasks(allTasks).length;
    else counts[a.key] = allTasks.filter(t => !t.done && t.category === a.key).length;
  });

  const areaCfg = BRAIN_AREAS.find(a => a.key === area) || BRAIN_AREAS[0];

  // Tasks to show
  let tasks;
  if (area === 'today') {
    tasks = getTodayTasks(allTasks);
  } else {
    tasks = allTasks.filter(t => t.category === area)
      .sort((a,b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        const po = {high:0, medium:1, low:2};
        return (po[a.priority]??3) - (po[b.priority]??3);
      });
  }

  const done   = tasks.filter(t => t.done);
  const open   = tasks.filter(t => !t.done);

  el.innerHTML = `
    <!-- Area tabs — horizontal scroll -->
    <div class="brain-tabs-wrap">
      <div class="brain-tabs">
        ${BRAIN_AREAS.map(a => `
          <button class="brain-tab ${a.key===area?'active':''}"
            style="${a.key===area?`--tab-color:${a.color}`:'color:var(--text-3)'}"
            onclick="State.brainCat='${a.key}'; renderPage('brain')">
            <span class="brain-tab-emoji">${a.emoji}</span>
            <span class="brain-tab-label">${a.label}</span>
            ${counts[a.key] ? `<span class="brain-tab-count" style="${a.key===area?`background:${a.color}`:'background:var(--text-3)'}">${counts[a.key]}</span>` : ''}
          </button>
        `).join('')}
      </div>
    </div>

    <!-- Area header -->
    <div class="brain-area-header">
      <span style="font-size:28px">${areaCfg.emoji}</span>
      <div>
        <div class="brain-area-title">${areaCfg.label}</div>
        <div class="brain-area-sub">${open.length} פתוחות${done.length ? ` · ${done.length} הושלמו` : ''}</div>
      </div>
    </div>

    <!-- Open tasks -->
    <div class="brain-list">
      ${open.length
        ? open.map(t => brainTaskHTML(t, areaCfg.color, area==='today')).join('')
        : `<div class="brain-empty">
             <div style="font-size:44px;margin-bottom:10px">${area==='today'?'✅':'📝'}</div>
             <div style="font-weight:600;font-size:16px;margin-bottom:4px">${area==='today'?'אין משימות להיום':'האזור ריק'}</div>
             <div style="font-size:14px;color:var(--text-3)">${area==='today'?'כל הכבוד, אתה מסודר!':'לחץ + כדי להוסיף'}</div>
           </div>`}
    </div>

    <!-- Completed (collapsed) -->
    ${done.length ? `
    <details class="brain-done-section">
      <summary>✅ הושלמו (${done.length})</summary>
      <div class="brain-list" style="margin-top:8px;opacity:.65">
        ${done.map(t => brainTaskHTML(t, areaCfg.color, false)).join('')}
      </div>
    </details>` : ''}
  `;
}

function brainTaskHTML(t, areaColor, showArea = false) {
  const pri   = PRIORITY_CFG[t.priority];
  const isOverdue = t.dueDate && t.dueDate < todayStr() && !t.done;
  const areaInfo  = BRAIN_AREAS.find(a => a.key === t.category);
  return `
    <div class="brain-task ${t.done?'done':''}" onclick="toggleTask('${t.id}')">
      ${pri ? `<div class="brain-priority-bar" style="background:${pri.color}"></div>` : '<div class="brain-priority-bar" style="background:transparent"></div>'}
      <div class="brain-check ${t.done?'checked':''}" style="--chk:${areaColor}"
        onclick="event.stopPropagation();toggleTask('${t.id}')">
        ${t.done ? `<svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4L4 7.5L10 1" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>` : ''}
      </div>
      <div class="brain-task-body">
        <div class="brain-task-text">${esc(t.text)}</div>
        <div class="brain-task-meta">
          ${showArea && areaInfo ? `<span style="color:${areaInfo.color}">${areaInfo.emoji} ${areaInfo.label}</span>` : ''}
          ${t.dueDate ? `<span style="color:${isOverdue?'#FF3B30':'var(--text-3)'}">📅 ${fmtReminder(t)}</span>` : ''}
          ${pri && !t.done ? `<span style="color:${pri.color};font-size:11px">${pri.dot} ${pri.label}</span>` : ''}
        </div>
      </div>
      <div class="brain-task-actions" onclick="event.stopPropagation()">
        <button class="action-mini" onclick="openEditTask('${t.id}')">✏️</button>
        ${t.dueDate ? `<button class="action-mini" onclick="exportToCalendar('${t.id}')">📅</button>` : ''}
        <button class="del-btn" onclick="deleteTask('${t.id}')">×</button>
      </div>
    </div>`;
}

// ── FINANCE ────────────────────────────────────────────
const FIN_EXP_CATS = [
  { id: 'food_out',   emoji: '🍔', name: 'אוכל בחוץ' },
  { id: 'coffee',     emoji: '☕', name: 'קפה' },
  { id: 'transport',  emoji: '🚗', name: 'תחבורה' },
  { id: 'grocery',    emoji: '🛒', name: 'סופר' },
  { id: 'clothes',    emoji: '👕', name: 'בגדים' },
  { id: 'health',     emoji: '🏥', name: 'בריאות' },
  { id: 'fun',        emoji: '🎭', name: 'שונות' },
  { id: 'pets',       emoji: '🐕', name: 'בעלי חיים' },
  { id: 'holidays',   emoji: '🎊', name: 'חגים' },
  { id: 'care',       emoji: '💆', name: 'טיפוח' },
  { id: 'superfarma', emoji: '💊', name: 'סופר פארם' },
  { id: 'business',   emoji: '💼', name: 'עסק' },
  { id: 'crossfit',   emoji: '🏋️', name: 'CrossFit' },
  { id: 'home',       emoji: '🏠', name: 'בית' },
  { id: 'personal',   emoji: '🙋', name: 'אישי' },
];

const FIN_INC_CATS = [
  { id: 'crossfit_inc', emoji: '🏋️', name: 'CrossFit BUX' },
  { id: 'print_inc',    emoji: '🖨️', name: 'בית דפוס' },
  { id: 'salary',       emoji: '💰', name: 'משכורת' },
  { id: 'other_inc',    emoji: '📈', name: 'אחר' },
];

function finCatById(id) {
  return FIN_EXP_CATS.find(c => c.id === id)
      || FIN_INC_CATS.find(c => c.id === id)
      || { emoji: '💳', name: id || 'כללי' };
}

function getFinPeriodData(all, period) {
  const now = new Date();
  if (period === 'week') {
    const weekAgo = new Date(now - 7*24*60*60*1000).toISOString().split('T')[0];
    return all.filter(f => f.date >= weekAgo);
  }
  const month = now.toISOString().slice(0,7);
  return all.filter(f => f.date && f.date.startsWith(month));
}

function finNavPrev() {
  const [y, m] = State.finNavMonth.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  State.finNavMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  renderPage('finance');
}

function finNavNext() {
  const [y, m] = State.finNavMonth.split('-').map(Number);
  const d = new Date(y, m, 1);
  State.finNavMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  renderPage('finance');
}

function renderFinance(el) {
  const tab = State.finTab || 'summary';
  if (!State.finNavMonth) State.finNavMonth = new Date().toISOString().slice(0,7);
  const navMonth = State.finNavMonth;
  const [year, month] = navMonth.split('-').map(Number);
  const monthLabel = `${MONTHS[month-1]} ${year}`;
  const isCurrentMonth = navMonth === new Date().toISOString().slice(0,7);

  el.innerHTML = `
    <div style="padding:0 16px 0">
      <div class="fin-month-nav">
        <button class="fin-nav-arrow" onclick="finNavPrev()">‹</button>
        <div class="fin-month-label">${monthLabel}</div>
        <button class="fin-nav-arrow" onclick="finNavNext()" ${isCurrentMonth ? 'disabled style="opacity:.3"' : ''}>›</button>
      </div>
      <div class="fin-tab-bar">
        <button class="fin-tab-btn ${tab==='summary'?'active':''}"
          onclick="State.finTab='summary'; renderPage('finance')">📊 סיכום</button>
        <button class="fin-tab-btn ${tab==='expenses'?'active':''}"
          onclick="State.finTab='expenses'; renderPage('finance')">💸 הוצאות</button>
        <button class="fin-tab-btn ${tab==='income'?'active':''}"
          onclick="State.finTab='income'; renderPage('finance')">💵 הכנסות</button>
      </div>
    </div>
    <div id="fin-body"></div>
  `;

  const body     = document.getElementById('fin-body');
  const all      = DB.get('finance');
  const filtered = all.filter(f => f.date && f.date.startsWith(navMonth));

  if (tab === 'summary')       renderFinSummary(body, filtered, navMonth);
  else if (tab === 'expenses') renderFinTransactions(body, filtered.filter(f => f.type==='expense'), 'expense');
  else                         renderFinTransactions(body, filtered.filter(f => f.type==='income'),  'income');
}

function renderFinSummary(el, data, period) {
  const budgets  = DB.getObj('fin_budgets', {});
  const expenses = data.filter(f => f.type === 'expense');
  const incomes  = data.filter(f => f.type === 'income');
  const totalExp = expenses.reduce((s,f) => s+f.amount, 0);
  const totalInc = incomes.reduce((s,f)  => s+f.amount, 0);
  const balance  = totalInc - totalExp;
  const circ     = 188.5;

  // Build by-category map
  const byCat = {};
  expenses.forEach(f => { const c = f.category||'personal'; byCat[c] = (byCat[c]||0)+f.amount; });

  // Context sections — each has its own donut grid
  const ctxSections = FIN_CONTEXTS.map(ctx => {
    const ctxCats  = Object.keys(byCat).filter(id => ctx.cats.includes(id));
    if (!ctxCats.length) return '';
    const ctxTotal = ctxCats.reduce((s,id) => s+(byCat[id]||0), 0);

    const circles = ctxCats.map(catId => {
      const spent  = byCat[catId];
      const cat    = finCatById(catId);
      const budget = budgets[catId] || 0;
      const pct    = budget > 0 ? spent / budget : 0;
      const color  = budget === 0 ? ctx.color
                   : pct < 0.5   ? '#34C759'
                   : pct < 0.8   ? '#FF9500' : '#FF3B30';
      const dash   = budget > 0 ? Math.min(pct,1)*circ : circ*0.22;
      return `
        <div class="fin-cat-circle" onclick="openBudgetEdit('${catId}')">
          <div class="fin-donut-wrap">
            <svg width="72" height="72" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r="30" fill="none" stroke="#E5E5EA" stroke-width="7"/>
              <circle cx="36" cy="36" r="30" fill="none" stroke="${color}" stroke-width="7"
                stroke-dasharray="${dash} ${circ}" stroke-linecap="round" transform="rotate(-90 36 36)"/>
            </svg>
            <div class="fin-donut-center">${cat.emoji}</div>
          </div>
          <div class="fin-cat-name">${cat.name}</div>
          <div class="fin-cat-spent" style="color:${color}">₪${spent.toLocaleString('he-IL')}${budget?`<br><small>/ ₪${budget.toLocaleString('he-IL')}</small>`:''}</div>
        </div>`;
    }).join('');

    return `
      <div class="card" style="margin:0 16px 12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="font-size:15px;font-weight:700">${ctx.label}</div>
          <div style="font-size:18px;font-weight:800;color:${ctx.color}">₪${ctxTotal.toLocaleString('he-IL')}</div>
        </div>
        <div class="fin-circles-grid">${circles}</div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="fin-hero">
      <div class="fin-hero-amount">₪${totalExp.toLocaleString('he-IL')}</div>
      <div class="fin-hero-label">הוצאות החודש</div>
      <div class="fin-hero-mini">
        <span style="color:#34C759">+₪${totalInc.toLocaleString('he-IL')} הכנסות</span>
        <span style="color:${balance>=0?'#34C759':'#FF3B30'};font-weight:600">${balance>=0?'+':''}₪${balance.toLocaleString('he-IL')} מאזן</span>
      </div>
    </div>

    <div style="padding:0 16px 4px;display:flex;justify-content:flex-end">
      <button onclick="openBudgetManager()" style="background:none;border:none;font-size:13px;color:var(--c-finance);font-weight:600;cursor:pointer">🎯 ערוך תקציב</button>
    </div>

    ${ctxSections || `
    <div class="card" style="margin:0 16px 12px;text-align:center;padding:24px 20px">
      <div style="font-size:32px;margin-bottom:8px">💰</div>
      <div style="color:var(--text-3);font-size:14px">הוסף הוצאות כדי לראות סיכום לפי קטגוריה</div>
    </div>`}

    ${incomes.length ? `
    <div class="card" style="margin:0 16px 16px">
      <div class="card-label">💵 הכנסות אחרונות</div>
      ${incomes.slice(0,3).map(f => finRowHTML(f, false)).join('')}
    </div>` : ''}
  `;
}

function renderFinTransactions(el, list, type) {
  const total = list.reduce((s,f) => s+f.amount, 0);
  const isExp = type === 'expense';
  const color = isExp ? '#FF3B30' : '#34C759';

  el.innerHTML = `
    <div class="fin-total-banner" style="background:${color}">
      <span class="fin-total-label">${isExp ? 'סה"כ הוצאות' : 'סה"כ הכנסות'}</span>
      <span class="fin-total-num">₪${total.toLocaleString('he-IL')}</span>
    </div>
    <div class="card" style="margin:0 16px 16px">
      ${list.length
        ? list.map(f => finRowHTML(f, true)).join('')
        : emptyHTML(isExp ? '💸' : '💵', isExp ? 'אין הוצאות בתקופה זו' : 'אין הכנסות בתקופה זו')}
    </div>
  `;
}

function finRowHTML(f, showDelete = false) {
  const cat   = finCatById(f.category);
  const isExp = f.type === 'expense';
  const bg    = isExp ? '#FF3B3015' : '#34C75915';
  const amtCl = isExp ? '#FF3B30'   : '#34C759';
  const fmtDate = f.date ? (() => {
    const d = new Date(f.date + 'T00:00:00');
    return `${d.getDate()} ב${MONTHS[d.getMonth()]}`;
  })() : '';
  return `
    <div class="fin-item">
      <div class="fin-icon" style="background:${bg};font-size:20px">${cat.emoji}</div>
      <div class="fin-info">
        <div class="fin-name">${esc(f.description)}</div>
        <div class="fin-date">${cat.name}${fmtDate ? ' · ' + fmtDate : ''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:2px;flex-shrink:0">
        <span style="font-size:15px;font-weight:700;color:${amtCl};direction:ltr">${isExp?'−':'+'}₪${f.amount.toLocaleString('he-IL')}</span>
        ${showDelete ? `
          <button onclick="event.stopPropagation();openEditFinance('${f.id}')" style="background:none;border:none;color:#007AFF;font-size:15px;cursor:pointer;padding:4px 3px">✏️</button>
          <button onclick="event.stopPropagation();deleteFinance('${f.id}')" style="background:none;border:none;color:#FF3B30;font-size:18px;cursor:pointer;padding:4px 2px;line-height:1">🗑</button>
        ` : ''}
      </div>
    </div>`;
}

// Legacy wrapper used on home page
function finItemHTML(f) {
  return finRowHTML(f, false);
}

function deleteFinance(id) {
  if (!confirm('למחוק את העסקה?')) return;
  DB.remove('finance', id);
  renderPage(State.page);
  showToast('🗑 נמחק');
}

function markPaid(id) {
  DB.update('finance', id, { isPaid: true });
  renderPage(State.page);
  showToast('✅ סומן כשולם');
}

function openBudgetManager() {
  const budgets = DB.getObj('fin_budgets', {});
  const rows = FIN_EXP_CATS.map(cat => `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <span style="font-size:22px;width:32px;text-align:center">${cat.emoji}</span>
      <span style="flex:1;font-size:14px">${cat.name}</span>
      <input type="number" inputmode="numeric" dir="ltr"
        style="width:90px;padding:7px;border:1.5px solid var(--sep);border-radius:8px;font-size:14px;text-align:center;background:var(--bg)"
        placeholder="ללא" value="${budgets[cat.id] || ''}"
        onchange="updateBudget('${cat.id}',this.value)">
    </div>`).join('');
  openModal(`
    <div class="modal-title">🎯 תקציב חודשי לקטגוריות</div>
    <p style="font-size:13px;color:var(--text-3);margin-bottom:16px">הכנס סכום חודשי לכל קטגוריה (ריק = ללא מגבלה)</p>
    <div style="max-height:55vh;overflow-y:auto">${rows}</div>
    <button class="btn-primary" style="margin-top:16px" onclick="closeModal();renderPage('finance')">✅ סגור ושמור</button>
  `);
}

function updateBudget(catId, val) {
  const budgets = DB.getObj('fin_budgets', {});
  const n = parseFloat(val);
  if (n > 0) budgets[catId] = n; else delete budgets[catId];
  localStorage.setItem('fin_budgets', JSON.stringify(budgets));
}

function openBudgetEdit(catId) {
  const budgets = DB.getObj('fin_budgets', {});
  const cat = finCatById(catId);
  openModal(`
    <div class="modal-title">${cat.emoji} ${cat.name}</div>
    <div class="form-group">
      <label class="form-label">תקציב חודשי (₪)</label>
      <input class="form-input" id="budget-input" type="number" inputmode="numeric"
        dir="ltr" placeholder="0 = ללא מגבלה" value="${budgets[catId] || ''}">
    </div>
    <button class="btn-primary" onclick="saveBudgetEdit('${catId}')">שמור</button>
  `);
  setTimeout(() => document.getElementById('budget-input')?.focus(), 150);
}

function saveBudgetEdit(catId) {
  const val = parseFloat(document.getElementById('budget-input').value);
  const budgets = DB.getObj('fin_budgets', {});
  if (val > 0) budgets[catId] = val; else delete budgets[catId];
  localStorage.setItem('fin_budgets', JSON.stringify(budgets));
  closeModal();
  renderPage('finance');
}

// ── CROSSFIT ───────────────────────────────────────────
const LEAD_STATUSES = [
  { key: 'all',       label: 'הכל' },
  { key: 'new',       label: '🔵 חדשים' },
  { key: 'contacted', label: '🟡 פנייה' },
  { key: 'trial',     label: '🟣 ניסיון' },
  { key: 'member',    label: '🟢 חברים' },
  { key: 'lost',      label: '🔴 אבוד' },
];

const STATUS_LABELS = { new:'חדש', contacted:'פנייה', trial:'ניסיון', member:'חבר', lost:'אבוד' };

function renderCrossfit(el) {
  const leads  = DB.get('leads');
  const tasks  = DB.get('tasks').filter(t => t.section === 'crossfit' && !t.done);
  const filter = State.leadFilter;
  const shown  = filter === 'all' ? leads : leads.filter(l => l.status === filter);
  const arbox  = DB.getObj('arbox_settings', {});
  const members = leads.filter(l => l.status === 'member').length;
  const trials  = leads.filter(l => l.status === 'trial').length;

  el.innerHTML = `
    <div class="sec-header" style="display:flex;justify-content:space-between;align-items:center">
      <div class="sec-title">CrossFit BUX</div>
      ${arbox.url ? `<button onclick="openArbox()" style="background:none;border:1.5px solid var(--sep);border-radius:20px;padding:5px 12px;font-size:13px;color:var(--text-2);cursor:pointer">🏅 Arbox</button>` : ''}
    </div>

    <!-- Stats bar -->
    <div style="display:flex;gap:10px;padding:0 16px 12px">
      <div class="stat-card" style="flex:1;padding:14px 10px">
        <div class="stat-icon">🟢</div>
        <div class="stat-value">${members}</div>
        <div class="stat-label">חברים</div>
      </div>
      <div class="stat-card" style="flex:1;padding:14px 10px">
        <div class="stat-icon">🟣</div>
        <div class="stat-value">${trials}</div>
        <div class="stat-label">ניסיון</div>
      </div>
      <div class="stat-card" style="flex:1;padding:14px 10px">
        <div class="stat-icon">🔵</div>
        <div class="stat-value">${leads.filter(l=>l.status==='new').length}</div>
        <div class="stat-label">לידים</div>
      </div>
    </div>

    ${tasks.length ? `
    <div class="card">
      <div class="card-label">🔥 משימות צוות</div>
      ${tasks.map(t => taskItemHTML(t, true)).join('')}
    </div>` : ''}

    <div class="card">
      <div class="card-label">לידים · ${leads.length} סה"כ</div>
      <div class="pipeline-bar">
        ${LEAD_STATUSES.map(s => `
          <button class="pipe-btn ${State.leadFilter===s.key?'active':''}"
            onclick="State.leadFilter='${s.key}'; renderPage('crossfit')">${s.label}</button>
        `).join('')}
      </div>
      ${shown.length ? shown.map(l => leadItemHTML(l)).join('')
        : emptyHTML('🏋️', 'אין לידים בסטטוס זה')}
    </div>
  `;
}

function leadItemHTML(l) {
  const initials = l.name.split(' ').map(w=>w[0]).join('').slice(0,2);
  return `
    <div class="lead-item">
      <div class="lead-avatar" onclick="openLeadModal('${l.id}')">${initials}</div>
      <div class="lead-info" onclick="openLeadModal('${l.id}')">
        <div class="lead-name">${esc(l.name)}</div>
        <div class="lead-phone">${esc(l.phone)}</div>
      </div>
      <span class="lead-status s-${l.status}" onclick="openLeadModal('${l.id}')">${STATUS_LABELS[l.status]||l.status}</span>
      <button class="action-mini" onclick="shareLead('${l.id}')">📤</button>
    </div>
  `;
}

function openLeadModal(id) {
  const lead = DB.get('leads').find(l => l.id === id);
  if (!lead) return;
  const opts = Object.entries(STATUS_LABELS).map(([k,v]) =>
    `<option value="${k}" ${lead.status===k?'selected':''}>${v}</option>`).join('');

  openModal(`
    <div class="modal-title">✏️ ליד — ${esc(lead.name)}</div>
    <div class="form-group">
      <label class="form-label">שם</label>
      <input class="form-input" id="lead-name" value="${esc(lead.name)}">
    </div>
    <div class="form-group">
      <label class="form-label">טלפון</label>
      <input class="form-input" id="lead-phone" type="tel" value="${esc(lead.phone)}" dir="ltr">
    </div>
    <div class="form-group">
      <label class="form-label">סטטוס</label>
      <select class="form-select" id="lead-status">${opts}</select>
    </div>
    <div class="form-group">
      <label class="form-label">הערות</label>
      <textarea class="form-textarea" id="lead-notes">${esc(lead.notes||'')}</textarea>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn-primary" style="--btn-color:var(--c-crossfit)" onclick="saveLead('${id}')">שמור</button>
      <button class="btn-primary" style="--btn-color:#FF3B30;flex:0.45" onclick="deleteLead('${id}')">מחק</button>
      <button class="btn-primary" style="--btn-color:#007AFF;flex:0.45" onclick="shareLead('${id}');closeModal()">📤</button>
    </div>
  `);
}

function saveLead(id) {
  DB.update('leads', id, {
    name:   document.getElementById('lead-name').value.trim(),
    phone:  document.getElementById('lead-phone').value.trim(),
    status: document.getElementById('lead-status').value,
    notes:  document.getElementById('lead-notes').value.trim(),
  });
  closeModal();
  renderPage('crossfit');
}

function deleteLead(id) {
  if (!confirm('למחוק את הליד?')) return;
  DB.remove('leads', id);
  closeModal();
  renderPage('crossfit');
}

// ── FAMILY ─────────────────────────────────────────────
const FAMILY_CATS = [
  { key: 'tasks',     label: '✅ משימות' },
  { key: 'shopping',  label: '🛒 קניות' },
  { key: 'reminders', label: '🔔 תזכורות' },
];

function renderFamily(el) {
  const cat   = State.familyCat;
  const tasks = DB.get('tasks').filter(t => t.section === 'family' && t.category === cat);

  el.innerHTML = `
    <div class="sec-header"><div class="sec-title">בית ומשפחה</div></div>
    <div class="cat-tabs">
      ${FAMILY_CATS.map(c => `
        <button class="cat-tab ${c.key===cat?'active':''}"
          onclick="State.familyCat='${c.key}'; renderPage('family')">${c.label}
          <span class="cat-count">${DB.get('tasks').filter(t=>t.section==='family'&&t.category===c.key&&!t.done).length||''}</span>
        </button>
      `).join('')}
    </div>
    <div class="card">
      ${tasks.length
        ? tasks.map(t => checkItemHTML(t)).join('')
        : emptyHTML('🏡', 'לחץ + להוסיף פריט')}
    </div>
  `;
}

function checkItemHTML(t) {
  return `
    <div class="check-item">
      <div class="check-box ${t.done?'checked':''}" onclick="toggleTask('${t.id}','tasks')"></div>
      <span class="check-text ${t.done?'done':''}">${esc(t.text)}</span>
      ${t.dueDate ? `<span style="font-size:11px;color:var(--text-3)">📅${shortDate(t.dueDate)}</span>` : ''}
      <button class="action-mini" onclick="shareTask('${t.id}')">📤</button>
      <button class="del-btn" onclick="deleteTask('${t.id}')">×</button>
    </div>
  `;
}

// ── Shared task helpers ────────────────────────────────
function taskItemHTML(t, withActions = false) {
  const pClass = { high:'badge-high', medium:'badge-medium', low:'badge-low' }[t.priority] || '';
  const pLabel = { high:'דחוף', medium:'בינוני', low:'נמוך' }[t.priority] || '';
  return `
    <div class="task-item ${t.done?'done':''}">
      <div class="task-check ${t.done?'checked':''}" onclick="toggleTask('${t.id}','tasks')"></div>
      <div class="task-body" onclick="toggleTask('${t.id}','tasks')">
        <div class="task-text">${esc(t.text)}</div>
        <div class="task-meta">
          ${catLabel(t.category)}
          ${t.dueDate ? ` · 📅 ${fmtReminder(t)}` : ''}
        </div>
      </div>
      ${pLabel ? `<span class="task-badge ${pClass}">${pLabel}</span>` : ''}
      ${withActions ? `
        ${t.dueDate ? `<button class="action-mini" onclick="event.stopPropagation();exportToCalendar('${t.id}')" title="ייצא ליומן">📅</button>` : ''}
        <button class="action-mini" onclick="event.stopPropagation();shareTask('${t.id}')" title="שתף">📤</button>
        <button class="del-btn" onclick="event.stopPropagation();deleteTask('${t.id}')">×</button>
      ` : ''}
    </div>
  `;
}

function catLabel(cat) {
  return {
    business:'💼 עסק', home:'🏠 בית', personal:'🙋 אישי', idea:'💡 רעיון',
    crossfit:'🏋️ CrossFit', family:'👨‍👩‍👧 משפחה',
    tasks:'✅ משימה', shopping:'🛒 קניות', reminders:'🔔 תזכורת'
  }[cat] || '';
}

function toggleTask(id) {
  DB.toggle('tasks', id, 'done');
  renderPage(State.page);
}

function deleteTask(id) {
  DB.remove('tasks', id);
  renderPage(State.page);
}

// ── Edit Task ──────────────────────────────────────────
function openEditTask(id) {
  const t = DB.get('tasks').find(x => x.id === id);
  if (!t) return;
  openModal(`
    <div class="modal-title">✏️ עריכת משימה</div>
    <div class="form-group">
      <label class="form-label">טקסט</label>
      <textarea class="form-textarea" id="edit-task-text">${esc(t.text)}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">אזור</label>
      <div class="brain-area-pick-grid" id="edit-cat-chips">
        ${[['business','💼','עסק'],['home','🏠','בית'],['personal','👤','אישי'],['idea','💡','רעיון']].map(([k,e,l]) =>
          `<button class="brain-area-pick ${k===t.category?'sel':''}"
            onclick="document.querySelectorAll('#edit-cat-chips .brain-area-pick').forEach(b=>b.classList.remove('sel'));this.classList.add('sel')"
            data-val="${k}"><span style="font-size:22px">${e}</span><span>${l}</span></button>`
        ).join('')}
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">עדיפות</label>
      <div class="chip-row" id="edit-pri-chips">
        ${[['high','🔴 דחוף'],['medium','🟡 בינוני'],['low','🟢 נמוך']].map(([k,l]) =>
          `<button class="chip ${k===t.priority?'sel':''}"
            onclick="document.querySelectorAll('#edit-pri-chips .chip').forEach(b=>b.classList.remove('sel'));this.classList.add('sel')"
            data-val="${k}">${l}</button>`
        ).join('')}
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">תאריך יעד</label>
        <input class="form-input" id="edit-task-date" type="date" value="${t.dueDate||''}">
      </div>
      <div class="form-group">
        <label class="form-label">שעה</label>
        <input class="form-input" id="edit-task-time" type="time" value="${t.reminderTime||'09:00'}">
      </div>
    </div>
    <button class="btn-primary" onclick="saveEditTask('${id}')">✅ שמור</button>
  `);
  setTimeout(() => document.getElementById('edit-task-text')?.focus(), 150);
}

function saveEditTask(id) {
  const text = document.getElementById('edit-task-text').value.trim();
  if (!text) { showToast('נא להזין טקסט'); return; }
  const cat  = document.querySelector('#edit-cat-chips .sel')?.dataset.val;
  const pri  = document.querySelector('#edit-pri-chips .sel')?.dataset.val;
  const dueDate     = document.getElementById('edit-task-date').value || null;
  const reminderTime = document.getElementById('edit-task-time').value || null;
  DB.update('tasks', id, { text, category: cat, priority: pri, dueDate, reminderTime });
  closeModal();
  renderPage(State.page);
  showToast('✅ משימה עודכנה');
}

// ── Edit Finance ───────────────────────────────────────
function openEditFinance(id) {
  const f = DB.get('finance').find(x => x.id === id);
  if (!f) return;
  const cats = f.type === 'expense' ? FIN_EXP_CATS : FIN_INC_CATS;
  openModal(`
    <div class="modal-title">✏️ עריכת עסקה</div>
    <div class="form-group">
      <label class="form-label">תיאור</label>
      <input class="form-input" id="edit-fin-desc" value="${esc(f.description)}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">סכום (₪)</label>
        <input class="form-input" id="edit-fin-amount" type="number" inputmode="decimal" value="${f.amount}" dir="ltr">
      </div>
      <div class="form-group">
        <label class="form-label">תאריך</label>
        <input class="form-input" id="edit-fin-date" type="date" value="${f.date||todayStr()}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">קטגוריה</label>
      <div class="fin-cat-pick-grid" id="edit-fin-cats">
        ${cats.map(c => `
          <button class="fin-cat-pick ${c.id===f.category?'sel':''}" data-val="${c.id}"
            onclick="document.querySelectorAll('#edit-fin-cats .fin-cat-pick').forEach(b=>b.classList.remove('sel'));this.classList.add('sel')">
            <span style="font-size:20px">${c.emoji}</span><span>${c.name}</span>
          </button>`).join('')}
      </div>
    </div>
    <button class="btn-primary" onclick="saveEditFinance('${id}')">✅ שמור</button>
  `);
  setTimeout(() => document.getElementById('edit-fin-desc')?.focus(), 150);
}

function saveEditFinance(id) {
  const desc   = document.getElementById('edit-fin-desc').value.trim();
  const amount = parseFloat(document.getElementById('edit-fin-amount').value);
  if (!desc || !amount) { showToast('נא למלא תיאור וסכום'); return; }
  const category = document.querySelector('#edit-fin-cats .sel')?.dataset.val;
  const date     = document.getElementById('edit-fin-date').value || todayStr();
  DB.update('finance', id, { description: desc, amount, category, date });
  closeModal();
  renderPage(State.page);
  showToast('✅ עסקה עודכנה');
}

function emptyHTML(icon, text) {
  return `<div class="empty"><div class="empty-icon">${icon}</div><div class="empty-text">${text}</div></div>`;
}

function esc(str = '') {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Share ──────────────────────────────────────────────
async function shareItem(title, text) {
  try {
    if (navigator.share) {
      await navigator.share({ title, text });
    } else {
      await navigator.clipboard.writeText(text);
      showToast('📋 הועתק ללוח!');
    }
  } catch(e) {
    if (e.name !== 'AbortError') {
      try {
        await navigator.clipboard.writeText(text);
        showToast('📋 הועתק ללוח!');
      } catch { showToast('לא ניתן לשתף'); }
    }
  }
}

function shareTask(id) {
  const task = DB.get('tasks').find(t => t.id === id);
  if (!task) return;
  const reminder = task.dueDate ? `\n📅 תאריך: ${fmtReminder(task)}` : '';
  shareItem('משימה ממרכז הפיקוד', `📋 ${task.text}${reminder}`);
}

function shareFinance(id) {
  const f = DB.get('finance').find(x => x.id === id);
  if (!f) return;
  const sign = f.type === 'expense' ? '−' : '+';
  shareItem('פרטי עסקה', `💳 ${f.description}\n${sign}₪${f.amount.toLocaleString('he-IL')}\nסטטוס: ${f.isPaid?'שולם':'טרם שולם'}`);
}

function shareLead(id) {
  const l = DB.get('leads').find(x => x.id === id);
  if (!l) return;
  shareItem('פרטי ליד — CrossFit BUX', `🏋️ ${l.name}\n📞 ${l.phone}\nסטטוס: ${STATUS_LABELS[l.status]||l.status}${l.notes?'\n'+l.notes:''}`);
}

// ── Calendar Export (.ics) ─────────────────────────────
function exportToCalendar(taskId) {
  const task = DB.get('tasks').find(t => t.id === taskId);
  if (!task) return;

  const dt = task.dueDate
    ? task.dueDate.replace(/-/g,'') + 'T' + (task.reminderTime||'09:00').replace(':','') + '00'
    : new Date().toISOString().replace(/[-:.]/g,'').slice(0,15);

  const stamp = new Date().toISOString().replace(/[-:.]/g,'').slice(0,15) + 'Z';
  const safeText = task.text.replace(/,/g,'\\,').replace(/\n/g,'\\n');

  // Organizer + invitees
  const settings  = DB.getObj('app_settings', {});
  const myEmail   = settings.myEmail || '';
  const myName    = settings.myName  || 'גל';
  const invited   = task.invitedEmails || [];
  const hasInvite = invited.length > 0 && myEmail;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Command Center//HE',
    hasInvite ? 'METHOD:REQUEST' : 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${task.id}@command-center`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${dt}`,
    `DTEND:${dt}`,
    `SUMMARY:${safeText}`,
    `DESCRIPTION:📋 ${safeText}`,
  ];

  if (myEmail) lines.push(`ORGANIZER;CN=${myName}:mailto:${myEmail}`);
  invited.forEach(email => {
    const contacts = DB.getObj('contacts', {});
    const contact  = Object.values(contacts).find(c => c.email === email);
    const name     = contact?.name || email;
    lines.push(`ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${name}:mailto:${email}`);
  });

  lines.push(
    'BEGIN:VALARM','ACTION:DISPLAY',
    `DESCRIPTION:🔔 ${safeText}`,
    'TRIGGER:PT0S','END:VALARM',
    'BEGIN:VALARM','ACTION:DISPLAY',
    `DESCRIPTION:⏰ בעוד 10 דקות: ${safeText}`,
    'TRIGGER:-PT10M','END:VALARM',
    'END:VEVENT','END:VCALENDAR'
  );

  const ics = lines.join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'reminder.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('📅 תזכורת נשמרה ביומן!');
}

// ── Arbox Integration ──────────────────────────────────
function openArboxSettings() {
  const s = DB.getObj('arbox_settings', {});
  openModal(`
    <div class="modal-title">🏅 הגדרות Arbox</div>
    <p style="font-size:14px;color:var(--text-3);margin-bottom:16px">חבר את חשבון Arbox שלך כדי לפתוח אותו ישירות ולשתף קישורים</p>
    <div class="form-group">
      <label class="form-label">כתובת ה-URL של חדר הכושר שלך</label>
      <input class="form-input" id="arbox-url" placeholder="https://app.arboxapp.com/..." value="${esc(s.url||'')}" dir="ltr">
      <small style="color:var(--text-3);font-size:12px">לדוגמה: הכנס את ה-URL של לוח הניהול שלך</small>
    </div>
    <div class="form-group">
      <label class="form-label">שם החדר (לשיתוף)</label>
      <input class="form-input" id="arbox-name" placeholder="CrossFit BUX" value="${esc(s.name||'CrossFit BUX')}">
    </div>
    <div class="form-group">
      <label class="form-label">קישור הצטרפות ללקוחות</label>
      <input class="form-input" id="arbox-join" placeholder="קישור לדף ההצטרפות" value="${esc(s.joinUrl||'')}" dir="ltr">
    </div>
    <button class="btn-primary" style="--btn-color:var(--c-crossfit)" onclick="saveArboxSettings()">שמור</button>
    <p style="font-size:12px;color:var(--text-3);margin-top:12px;text-align:center">
      API מלא (ייבוא חברים אוטומטי) — בשלב הבא 🚀
    </p>
  `);
}

function saveArboxSettings() {
  DB.set('arbox_settings', {
    url:     document.getElementById('arbox-url').value.trim(),
    name:    document.getElementById('arbox-name').value.trim(),
    joinUrl: document.getElementById('arbox-join').value.trim(),
  });
  closeModal();
  renderPage('crossfit');
  showToast('✅ הגדרות Arbox נשמרו');
}

function openArbox() {
  const s = DB.getObj('arbox_settings', {});
  if (s.url) window.open(s.url, '_blank');
  else openArboxSettings();
}

function shareArboxLink() {
  const s = DB.getObj('arbox_settings', {});
  const url = s.joinUrl || s.url || '';
  if (!url) { openArboxSettings(); return; }
  shareItem(`הצטרף ל-${s.name||'CrossFit BUX'}`, `🏋️ הצטרף ל-${s.name||'CrossFit BUX'}!\n${url}`);
}

// ── Modal ──────────────────────────────────────────────
function openModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

// ── FAB → Context-aware add ────────────────────────────
function openAddForm() {
  const cfg = PAGE_CFG[State.page];
  document.documentElement.style.setProperty('--btn-color', cfg.btnColor);
  document.documentElement.style.setProperty('--chip-color', cfg.btnColor);

  switch (State.page) {
    case 'home':
    case 'brain':    openAddTask();     break;
    case 'finance':  openAddFinance();  break;
    case 'crossfit': openAddCrossfit(); break;
    case 'family':   openAddFamily();   break;
  }
}

// ── Add Task Form ──────────────────────────────────────
function openAddTask() {
  const cur = State.brainCat || 'business';
  const defaultCat = (cur === 'today') ? 'business' : cur;

  openModal(`
    <div class="modal-title">➕ משימה חדשה</div>
    <div class="form-group">
      <label class="form-label">מה צריך לעשות?</label>
      <textarea class="form-textarea" id="new-task-text" placeholder="תאר את המשימה..." rows="2"></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">אזור</label>
      <div class="brain-area-pick-grid" id="cat-chips">
        ${[['business','💼','עסק'],['home','🏠','בית'],['personal','👤','אישי'],['idea','💡','רעיון']].map(([k,e,l]) =>
          `<button class="brain-area-pick ${k===defaultCat?'sel':''}" onclick="selectChip('cat-chips',this)" data-val="${k}">
            <span style="font-size:22px">${e}</span><span>${l}</span>
          </button>`
        ).join('')}
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">עדיפות</label>
      <div class="chip-row" id="pri-chips">
        ${[['high','🔴 דחוף'],['medium','🟡 בינוני'],['low','🟢 נמוך']].map(([k,l]) =>
          `<button class="chip ${k==='medium'?'sel':''}" onclick="selectChip('pri-chips',this)" data-val="${k}">${l}</button>`
        ).join('')}
      </div>
    </div>

    <!-- Reminder Toggle -->
    <div style="margin-bottom:14px">
      <button class="chip" id="reminder-toggle-btn" onclick="toggleReminderFields()">🔔 הוסף תזכורת ביומן</button>
    </div>
    <div id="reminder-fields" style="display:none">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">תאריך</label>
          <input class="form-input" id="new-task-date" type="date" value="${todayStr()}">
        </div>
        <div class="form-group">
          <label class="form-label">שעה</label>
          <input class="form-input" id="new-task-time" type="time" value="09:00">
        </div>
      </div>
    </div>

    <button class="btn-primary" onclick="saveTask()">שמור</button>
  `);
  setTimeout(() => document.getElementById('new-task-text')?.focus(), 150);
}

function toggleReminderFields() {
  const el = document.getElementById('reminder-fields');
  const btn = document.getElementById('reminder-toggle-btn');
  const show = el.style.display === 'none';
  el.style.display = show ? 'block' : 'none';
  btn.classList.toggle('sel', show);
}

function selectChip(groupId, btn) {
  document.querySelectorAll(`#${groupId} .chip`).forEach(c => c.classList.remove('sel'));
  btn.classList.add('sel');
}

function saveTask() {
  const text = document.getElementById('new-task-text').value.trim();
  if (!text) { showToast('נא להזין טקסט'); return; }
  const cat = document.querySelector('#cat-chips .sel')?.dataset.val || 'business';
  const pri = document.querySelector('#pri-chips .sel')?.dataset.val || 'medium';
  const showReminder = document.getElementById('reminder-fields').style.display !== 'none';
  const dueDate     = showReminder ? document.getElementById('new-task-date').value : null;
  const reminderTime = showReminder ? document.getElementById('new-task-time').value : null;

  const task = DB.add('tasks', {
    text, category: cat, priority: pri, done: false, section: 'brain', dueDate, reminderTime
  });

  closeModal();
  if (showReminder && dueDate) {
    exportToCalendar(task.id);
  }
  renderPage(State.page);
}

// ── Add Finance Form ───────────────────────────────────
function openAddFinance() {
  const defaultType = (State.finTab === 'income') ? 'income' : 'expense';
  openModal(`
    <div class="modal-title">💳 עסקה חדשה</div>
    <div class="chip-row" id="fin-type-chips" style="margin-bottom:16px">
      <button class="chip ${defaultType==='expense'?'sel':''}"
        onclick="selectChip('fin-type-chips',this);renderFinCatPicker()" data-val="expense">💸 הוצאה</button>
      <button class="chip ${defaultType==='income'?'sel':''}"
        onclick="selectChip('fin-type-chips',this);renderFinCatPicker()" data-val="income">💵 הכנסה</button>
    </div>
    <div class="form-group">
      <label class="form-label">תיאור</label>
      <input class="form-input" id="fin-desc" placeholder="לדוגמה: קפה בוקר">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">סכום (₪)</label>
        <input class="form-input" id="fin-amount" type="number" inputmode="decimal" placeholder="0" dir="ltr">
      </div>
      <div class="form-group">
        <label class="form-label">תאריך</label>
        <input class="form-input" id="fin-date" type="date" value="${todayStr()}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">קטגוריה</label>
      <div id="fin-cat-picker" class="fin-cat-pick-grid"></div>
    </div>
    <button class="btn-primary" onclick="saveFinance()">שמור ✅</button>
  `);
  setTimeout(() => { renderFinCatPicker(); document.getElementById('fin-desc')?.focus(); }, 120);
}

function renderFinCatPicker() {
  const type = document.querySelector('#fin-type-chips .sel')?.dataset.val || 'expense';
  const cats = type === 'expense' ? FIN_EXP_CATS : FIN_INC_CATS;
  const grid = document.getElementById('fin-cat-picker');
  if (!grid) return;
  grid.innerHTML = cats.map((c, i) => `
    <button class="fin-cat-pick ${i===0?'sel':''}" data-val="${c.id}"
      onclick="document.querySelectorAll('.fin-cat-pick').forEach(b=>b.classList.remove('sel'));this.classList.add('sel')">
      <span style="font-size:22px">${c.emoji}</span>
      <span>${c.name}</span>
    </button>`).join('');
}

function saveFinance() {
  const desc   = document.getElementById('fin-desc').value.trim();
  const amount = parseFloat(document.getElementById('fin-amount').value);
  if (!desc || !amount) { showToast('נא למלא תיאור וסכום'); return; }
  const type     = document.querySelector('#fin-type-chips .sel')?.dataset.val || 'expense';
  const category = document.querySelector('.fin-cat-pick.sel')?.dataset.val || (type==='expense' ? 'personal' : 'other_inc');
  const date     = document.getElementById('fin-date')?.value || todayStr();
  DB.add('finance', { description: desc, amount, type, category, date, isPaid: true });
  closeModal();
  renderPage('finance');
  showToast('✅ נשמר!');
}

// ── Add CrossFit Form ──────────────────────────────────
function openAddCrossfit() {
  openModal(`
    <div class="modal-title">🏋️ הוסף ל-BUX</div>
    <div class="chip-row" id="cf-type-chips">
      <button class="chip sel" onclick="selectChip('cf-type-chips',this);toggleCFForm()" data-val="lead">👤 ליד חדש</button>
      <button class="chip" onclick="selectChip('cf-type-chips',this);toggleCFForm()" data-val="task">✅ משימת צוות</button>
    </div>
    <div id="cf-lead-form">
      <div class="form-group">
        <label class="form-label">שם מלא</label>
        <input class="form-input" id="cf-name" placeholder="שם הליד">
      </div>
      <div class="form-group">
        <label class="form-label">טלפון</label>
        <input class="form-input" id="cf-phone" type="tel" placeholder="05x-xxxxxxx" dir="ltr">
      </div>
      <div class="form-group">
        <label class="form-label">מאיפה הגיע?</label>
        <input class="form-input" id="cf-notes" placeholder="אינסטגרם / חבר / מודעה...">
      </div>
    </div>
    <div id="cf-task-form" style="display:none">
      <div class="form-group">
        <label class="form-label">תיאור המשימה</label>
        <input class="form-input" id="cf-task-text" placeholder="מה צריך לעשות?">
      </div>
      <div class="form-group">
        <label class="form-label">עדיפות</label>
        <div class="chip-row" id="cf-pri-chips">
          <button class="chip" onclick="selectChip('cf-pri-chips',this)" data-val="high">🔴 דחוף</button>
          <button class="chip sel" onclick="selectChip('cf-pri-chips',this)" data-val="medium">🟡 בינוני</button>
          <button class="chip" onclick="selectChip('cf-pri-chips',this)" data-val="low">🟢 נמוך</button>
        </div>
      </div>
    </div>
    <button class="btn-primary" style="--btn-color:var(--c-crossfit)" onclick="saveCFItem()">שמור</button>
  `);
  setTimeout(() => document.getElementById('cf-name')?.focus(), 150);
}

function toggleCFForm() {
  const type = document.querySelector('#cf-type-chips .sel')?.dataset.val;
  document.getElementById('cf-lead-form').style.display = type === 'lead' ? 'block' : 'none';
  document.getElementById('cf-task-form').style.display = type === 'task' ? 'block' : 'none';
}

function saveCFItem() {
  const type = document.querySelector('#cf-type-chips .sel')?.dataset.val;
  if (type === 'lead') {
    const name = document.getElementById('cf-name').value.trim();
    if (!name) { showToast('נא להזין שם'); return; }
    DB.add('leads', {
      name,
      phone: document.getElementById('cf-phone').value.trim(),
      notes: document.getElementById('cf-notes').value.trim(),
      status: 'new',
    });
  } else {
    const text = document.getElementById('cf-task-text').value.trim();
    if (!text) { showToast('נא להזין משימה'); return; }
    const priority = document.querySelector('#cf-pri-chips .sel')?.dataset.val || 'medium';
    DB.add('tasks', { text, category: 'crossfit', priority, done: false, section: 'crossfit' });
  }
  closeModal();
  renderPage('crossfit');
}

// ── Add Family Form ────────────────────────────────────
function openAddFamily() {
  const cat = State.familyCat;
  const placeholders = { tasks:'מה לעשות?', shopping:'מה לקנות?', reminders:'מה לזכור?' };
  const showDate = cat === 'reminders';
  const contacts = DB.getObj('contacts', {});
  const partners = Object.values(contacts);

  openModal(`
    <div class="modal-title">${FAMILY_CATS.find(c=>c.key===cat)?.label || '🏡 הוסף'}</div>
    <div class="form-group">
      <label class="form-label">פריט</label>
      <input class="form-input" id="fam-text" placeholder="${placeholders[cat]||''}">
    </div>
    ${showDate ? `
    <div class="form-group">
      <label class="form-label">📅 מתי?</label>
      <div class="form-row">
        <div class="form-group">
          <input class="form-input" id="fam-date" type="date" value="${todayStr()}">
        </div>
        <div class="form-group">
          <input class="form-input" id="fam-time" type="time" value="09:00">
        </div>
      </div>
    </div>
    ${partners.length ? `
    <div class="form-group">
      <label class="form-label">📨 הזמן גם...</label>
      <div class="chip-row" id="invite-chips">
        ${partners.map(p =>
          `<button class="chip" onclick="selectChipMulti(this)" data-email="${esc(p.email)}">${esc(p.name)}</button>`
        ).join('')}
      </div>
    </div>` : `
    <div style="font-size:12px;color:var(--text-3);margin-bottom:12px">
      💡 <span style="cursor:pointer;text-decoration:underline" onclick="closeModal();openSettings()">הוסף אנשי קשר בהגדרות</span> כדי להזמין לאירועים
    </div>`}` : ''}
    <button class="btn-primary" style="--btn-color:var(--c-family)" onclick="saveFamily()">שמור</button>
  `);
  setTimeout(() => document.getElementById('fam-text')?.focus(), 150);
}

function selectChipMulti(btn) {
  btn.classList.toggle('sel');
}

function saveFamily() {
  const text = document.getElementById('fam-text').value.trim();
  if (!text) { showToast('נא להזין טקסט'); return; }
  const cat = State.familyCat;
  const dateEl = document.getElementById('fam-date');
  const timeEl = document.getElementById('fam-time');
  const dueDate = dateEl?.value || null;
  const reminderTime = timeEl?.value || null;

  // Collect invited emails
  const invitedEmails = [...document.querySelectorAll('#invite-chips .sel')]
    .map(b => b.dataset.email).filter(Boolean);

  const task = DB.add('tasks', {
    text, category: cat, priority: 'medium', done: false,
    section: 'family', dueDate, reminderTime, invitedEmails
  });
  closeModal();

  if (cat === 'reminders' && dueDate) {
    exportToCalendar(task.id);
  }
  renderPage('family');
}

// ── Settings ───────────────────────────────────────────
function openSettings() {
  const s        = DB.getObj('app_settings', {});
  const contacts = DB.getObj('contacts', {});
  const wsCode   = typeof getWsCode === 'function' ? getWsCode() : '—';

  openModal(`
    <div class="modal-title">⚙️ הגדרות</div>

    <!-- My details -->
    <div class="card-label">👤 הפרטים שלי</div>
    <div class="form-group">
      <label class="form-label">שם</label>
      <input class="form-input" id="set-myname" value="${esc(s.myName||'גל')}" placeholder="גל">
    </div>
    <div class="form-group">
      <label class="form-label">אימייל (לשליחת הזמנות יומן)</label>
      <input class="form-input" id="set-myemail" value="${esc(s.myEmail||'')}" placeholder="you@gmail.com" dir="ltr" type="email">
    </div>

    <div class="divider"></div>

    <!-- Contacts -->
    <div class="card-label">👨‍👩‍👧 אנשי קשר (לשיתוף תזכורות)</div>
    <div id="contacts-list">
      ${Object.values(contacts).map(c => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="flex:1;font-size:14px">${esc(c.name)} · <span dir="ltr">${esc(c.email)}</span></span>
          <button class="del-btn" onclick="deleteContact('${esc(c.id)}')">×</button>
        </div>
      `).join('') || '<div style="font-size:13px;color:var(--text-3);margin-bottom:10px">אין אנשי קשר עדיין</div>'}
    </div>
    <div style="display:flex;gap:8px;margin-bottom:4px">
      <input class="form-input" id="new-contact-name" placeholder="שם" style="flex:0.8">
      <input class="form-input" id="new-contact-email" placeholder="אימייל" dir="ltr" type="email">
    </div>
    <button class="btn-primary" style="--btn-color:var(--c-family);margin-bottom:14px"
            onclick="addContact()">+ הוסף איש קשר</button>

    <div class="divider"></div>

    <!-- Sharing with partner -->
    <div class="card-label">🔗 שיתוף האפליקציה עם רחל</div>
    <div style="background:var(--bg);border-radius:12px;padding:14px;margin-bottom:14px">
      <div style="font-size:14px;margin-bottom:10px">
        שתף את הקישור הבא עם רחל. כשתלחץ עליו, האפליקציה תיפתח אצלה כבר מחוברת לאותם נתונים שלך.
      </div>
      <div style="font-family:monospace;font-size:12px;background:white;padding:10px;border-radius:8px;word-break:break-all;direction:ltr;margin-bottom:10px" id="share-link-display">
        טוען...
      </div>
      <button class="btn-primary" style="--btn-color:var(--c-family)" onclick="shareAppLink()">📤 שלח לרחל בוואטסאפ</button>
    </div>

    <div class="divider"></div>

    <!-- Reset -->
    <div class="card-label">🗑️ ניהול נתונים</div>
    <button class="btn-primary" style="--btn-color:#FF3B30" onclick="resetAllData()">
      🗑️ מחק נתוני דמו והתחל מחדש
    </button>
    <p style="font-size:11px;color:var(--text-3);margin-top:8px;text-align:center">
      פעולה זו תמחק את כל הנתונים הנוכחיים ותתחיל דף חלק
    </p>

    <div class="divider"></div>
    <button class="btn-primary" style="--btn-color:var(--c-home)" onclick="saveAppSettings()">✅ שמור הגדרות</button>
  `);

  // Show share link
  const tunnel = window.location.origin + window.location.pathname;
  const link   = tunnel + '?join=' + wsCode;
  const el = document.getElementById('share-link-display');
  if (el) el.textContent = link;
}

function saveAppSettings() {
  DB.set('app_settings', {
    myName:  document.getElementById('set-myname')?.value.trim()  || 'גל',
    myEmail: document.getElementById('set-myemail')?.value.trim() || '',
  });
  closeModal();
  showToast('✅ הגדרות נשמרו');
}

function addContact() {
  const name  = document.getElementById('new-contact-name')?.value.trim();
  const email = document.getElementById('new-contact-email')?.value.trim();
  if (!name || !email) { showToast('נא למלא שם ואימייל'); return; }
  const contacts = DB.getObj('contacts', {});
  const id = Date.now().toString(36);
  contacts[id] = { id, name, email };
  DB.set('contacts', contacts);
  openSettings(); // refresh
}

function deleteContact(id) {
  const contacts = DB.getObj('contacts', {});
  delete contacts[id];
  DB.set('contacts', contacts);
  openSettings(); // refresh
}

function shareAppLink() {
  const wsCode = typeof getWsCode === 'function' ? getWsCode() : '';
  const link   = window.location.origin + window.location.pathname + '?join=' + wsCode;
  const msg    = `היי רחל 😊\nהורידי את האפליקציה שלנו לניהול הבית:\n${link}\n\nפשוט לחצי על הקישור ותוסיפי למסך הבית!`;
  if (navigator.share) {
    navigator.share({ title: 'מרכז פיקוד משפחתי', text: msg });
  } else {
    navigator.clipboard?.writeText(msg);
    showToast('📋 הקישור הועתק!');
  }
}

function resetAllData() {
  if (!confirm('למחוק את כל הנתונים ולהתחיל דף חלק?\nלא ניתן לשחזר!')) return;
  const keep = {
    _wsCode:       localStorage.getItem('_wsCode'),
    _notif_enabled:localStorage.getItem('_notif_enabled'),
    _deviceId:     localStorage.getItem('_deviceId'),
    app_settings:  localStorage.getItem('app_settings'),
    contacts:      localStorage.getItem('contacts'),
    arbox_settings:localStorage.getItem('arbox_settings'),
  };
  localStorage.clear();
  Object.entries(keep).forEach(([k,v]) => { if (v) localStorage.setItem(k, v); });
  localStorage.setItem('_seeded', '1');
  localStorage.setItem('_clean_start', '1');
  closeModal();
  showToast('✅ נתונים נוקו!');
  setTimeout(() => location.reload(), 800);
}

// ── Auto-join from URL ──────────────────────────────────
(function checkJoinParam() {
  const params = new URLSearchParams(window.location.search);
  const join   = params.get('join');
  if (!join) return;
  // Remove param from URL without reload
  const clean = window.location.pathname;
  window.history.replaceState({}, '', clean);
  // Auto-join after a short delay (so app finishes loading)
  setTimeout(() => {
    if (typeof getWsCode === 'function' && getWsCode() !== join.toUpperCase()) {
      if (confirm(`מצאנו הזמנה לסביבה "${join.toUpperCase()}"\nמתחבר?`)) {
        localStorage.setItem('_wsCode', join.toUpperCase());
        location.reload();
      }
    }
  }, 1500);
})();

// ── Init ───────────────────────────────────────────────
function init() {
  document.getElementById('header-date').textContent = (() => {
    const d = new Date();
    return `${d.getDate()} ב${MONTHS[d.getMonth()]}`;
  })();

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  document.getElementById('fab').addEventListener('click', openAddForm);
  document.getElementById('modal-backdrop').addEventListener('click', closeModal);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(reg => {
      // גרסה חדשה ממתינה — הצג באנר
      const showUpdateBanner = () => {
        if (document.getElementById('update-banner')) return;
        const banner = document.createElement('div');
        banner.id = 'update-banner';
        banner.innerHTML = `
          <span>🔄 גרסה חדשה זמינה!</span>
          <button onclick="applyUpdate()">עדכן עכשיו</button>
        `;
        document.body.appendChild(banner);
      };

      if (reg.waiting) showUpdateBanner();
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner();
          }
        });
      });

      // אחרי שה-SW החדש תפס שליטה — רענן
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) { refreshing = true; location.reload(); }
      });
    }).catch(() => {});
  }

  // Load Google Calendar events and re-render home if on home page
  if (typeof loadGcalEvents === 'function') {
    loadGcalEvents(evts => {
      _gcalEvents = evts || [];
      if (State.page === 'home') renderPage('home');
    });
  }

  navigate('home');
}

function applyUpdate() {
  navigator.serviceWorker.ready.then(reg => {
    if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
  });
}

document.addEventListener('DOMContentLoaded', init);
