/* ===== מרכז פיקוד — App Logic ===== */

// ── State ──────────────────────────────────────────────
const State = {
  page: 'home',
  brainCat: 'business',
  leadFilter: 'all',
  familyCat: 'tasks',
  finTab: 'summary',
  finPeriod: 'month',
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

// ── BRAIN ──────────────────────────────────────────────
const BRAIN_CATS = [
  { key: 'business', label: '💼 עסק' },
  { key: 'home',     label: '🏠 בית' },
  { key: 'personal', label: '🙋 אישי' },
  { key: 'idea',     label: '💡 רעיונות' },
];

function renderBrain(el) {
  const cat   = State.brainCat;
  const tasks = DB.get('tasks').filter(t => t.section === 'brain' && t.category === cat);

  el.innerHTML = `
    <div class="sec-header"><div class="sec-title">מוח חיצוני</div></div>
    <div class="cat-tabs">
      ${BRAIN_CATS.map(c => `
        <button class="cat-tab ${c.key === cat ? 'active' : ''}"
          onclick="State.brainCat='${c.key}'; renderPage('brain')">${c.label}
          <span class="cat-count">${DB.get('tasks').filter(t=>t.section==='brain'&&t.category===c.key&&!t.done).length||''}</span>
        </button>
      `).join('')}
    </div>
    <div class="card">
      ${tasks.length
        ? tasks.map(t => taskItemHTML(t, true)).join('')
        : emptyHTML('📝', 'לחץ + להוסיף פריט')}
    </div>
  `;
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

function renderFinance(el) {
  const tab    = State.finTab    || 'summary';
  const period = State.finPeriod || 'month';

  el.innerHTML = `
    <div style="padding:0 16px 0">
      <div class="fin-period-bar">
        <button class="fin-period-btn ${period==='week'?'active':''}"
          onclick="State.finPeriod='week'; renderPage('finance')">השבוע</button>
        <button class="fin-period-btn ${period==='month'?'active':''}"
          onclick="State.finPeriod='month'; renderPage('finance')">החודש</button>
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
  const filtered = getFinPeriodData(all, period);

  if (tab === 'summary')       renderFinSummary(body, filtered, period);
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
      <div class="fin-hero-label">הוצאות ה${period==='week'?'שבוע':'חודש'}</div>
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
  return `
    <div class="fin-item">
      <div class="fin-icon" style="background:${bg};font-size:20px">${cat.emoji}</div>
      <div class="fin-info">
        <div class="fin-name">${esc(f.description)}</div>
        <div class="fin-date">${cat.name} · ${shortDate(f.date)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        <span style="font-size:16px;font-weight:700;color:${amtCl};direction:ltr">${isExp?'−':'+'}₪${f.amount.toLocaleString('he-IL')}</span>
        ${showDelete ? `<button onclick="deleteFinance('${f.id}')" style="background:none;border:none;color:#FF3B30;font-size:18px;cursor:pointer;padding:4px;line-height:1">🗑</button>` : ''}
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
  const defaultCat = State.page === 'brain' ? State.brainCat : 'business';

  openModal(`
    <div class="modal-title">➕ משימה / רעיון חדש</div>
    <div class="form-group">
      <label class="form-label">טקסט</label>
      <textarea class="form-textarea" id="new-task-text" placeholder="מה צריך לעשות?" rows="2"></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">קטגוריה</label>
      <div class="chip-row" id="cat-chips">
        ${[['business','💼 עסק'],['home','🏠 בית'],['personal','🙋 אישי'],['idea','💡 רעיון']].map(([k,l]) =>
          `<button class="chip ${k===defaultCat?'sel':''}" onclick="selectChip('cat-chips',this)" data-val="${k}">${l}</button>`
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
    <div class="form-group">
      <label class="form-label">סכום (₪)</label>
      <input class="form-input" id="fin-amount" type="number" inputmode="decimal" placeholder="0" dir="ltr">
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
  DB.add('finance', { description: desc, amount, type, category, date: todayStr(), isPaid: true });
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
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  navigate('home');
}

document.addEventListener('DOMContentLoaded', init);
