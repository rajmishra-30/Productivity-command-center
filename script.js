// ===================== UTILITIES =====================
const $ = id => document.getElementById(id);
const qs = sel => document.querySelector(sel);
const qsa = sel => document.querySelectorAll(sel);

function saveLS(key, val) {
  try { localStorage.setItem('nexus_' + key, JSON.stringify(val)); } catch(e) {}
}

function loadLS(key, def) {
  try {
    const d = localStorage.getItem('nexus_' + key);
    return d ? JSON.parse(d) : def;
  } catch(e) { return def; }
}

let toastTimer;
function showToast(msg, icon = '✅') {
  $('toast-icon').textContent = icon;
  $('toast-msg').textContent = msg;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2600);
}


// ===================== LIVE CLOCK =====================
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  $('clock-time').textContent = `${h}:${m}:${s}`;
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  $('clock-date').textContent = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
}
setInterval(updateClock, 1000);
updateClock();


// ===================== FOCUS TIMER =====================
let timerState = {
  total: 1500,
  remaining: 1500,
  running: false,
  mode: 'pomodoro',
  session: 1,
  totalSessions: 4,
  completedToday: 0,
  focusMinutesToday: 0
};

const MODES = { pomodoro: 1500, short: 300, long: 900 };
const COLORS = { pomodoro: '#7c6ff7', short: '#5eead4', long: '#f472b6' };

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateTimerUI() {
  $('timer-display').textContent = formatTime(timerState.remaining);
  const pct = timerState.remaining / timerState.total;
  const circum = 2 * Math.PI * 90;
  $('ring').style.strokeDashoffset = circum * (1 - pct);
  $('ring').style.stroke = timerState.running ? (COLORS[timerState.mode] || '#7c6ff7') : '#7c6ff7';
  $('session-num').textContent = timerState.session;
  $('session-total').textContent = timerState.totalSessions;
  $('timer-state-label').textContent = timerState.running
    ? 'FOCUS'
    : (timerState.remaining === timerState.total ? 'READY' : 'PAUSED');
  $('timer-btn').textContent = timerState.running
    ? '⏸ PAUSE'
    : (timerState.remaining < timerState.total ? '▶ RESUME' : '▶ START');
  updateStatsUI();
}

let timerInterval;

function startTimer() {
  timerState.running = true;
  timerInterval = setInterval(() => {
    timerState.remaining--;
    updateTimerUI();
    saveLS('timerState', timerState);

    if (timerState.remaining <= 0) {
      clearInterval(timerInterval);
      timerState.running = false;
      timerState.completedToday++;
      timerState.focusMinutesToday += Math.floor(timerState.total / 60);

      if (timerState.session < timerState.totalSessions) timerState.session++;
      else timerState.session = 1;

      timerState.remaining = timerState.total;
      updateTimerUI();
      showToast('🎉 Session complete! Take a break.', '🎉');
      addWeeklySession();
      saveLS('timerState', timerState);
    }
  }, 1000);
}

function pauseTimer() {
  timerState.running = false;
  clearInterval(timerInterval);
  updateTimerUI();
}

$('timer-btn').addEventListener('click', () => {
  if (timerState.running) pauseTimer();
  else startTimer();
});

$('timer-reset').addEventListener('click', () => {
  pauseTimer();
  timerState.remaining = timerState.total;
  timerState.running = false;
  updateTimerUI();
});

qsa('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    pauseTimer();
    qsa('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const mode = btn.dataset.mode;
    timerState.mode = mode;

    if (mode === 'custom') {
      const mins = parseInt(prompt('Enter focus duration in minutes:', '45')) || 25;
      timerState.total = Math.min(Math.max(mins * 60, 60), 7200);
    } else {
      timerState.total = MODES[mode];
    }

    timerState.remaining = timerState.total;
    $('session-mode-label').textContent = mode.toUpperCase();
    updateTimerUI();
    saveLS('timerState', timerState);
  });
});


// ===================== AMBIENT SOUNDS =====================
let audioCtx = null;
let ambientNodes = {};
let activeSound = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function createNoise(type) {
  const ctx = getAudioCtx();
  const bufSize = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);

  if (type === 'rain') {
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const filt = ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 800; filt.Q.value = 0.3;
    const gain = ctx.createGain(); gain.gain.value = 0.18;
    src.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
    src.start();
    return { src, gain };
  }

  if (type === 'forest') {
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 400;
    const gain = ctx.createGain(); gain.gain.value = 0.08;
    src.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
    src.start();
    return { src, gain };
  }

  if (type === 'cafe') {
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3 + Math.sin(i / 200) * 0.05;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const filt = ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 1200; filt.Q.value = 0.8;
    const gain = ctx.createGain(); gain.gain.value = 0.12;
    src.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
    src.start();
    return { src, gain };
  }

  if (type === 'waves') {
    const osc = ctx.createOscillator(); osc.frequency.value = 0.15; osc.type = 'sine';
    const modGain = ctx.createGain(); modGain.gain.value = 0.6;
    const noiseS = ctx.createBufferSource(); noiseS.buffer = buf; noiseS.loop = true;
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 600;
    const gain = ctx.createGain(); gain.gain.value = 0.15;
    osc.connect(modGain);
    noiseS.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
    osc.start(); noiseS.start();
    return { src: noiseS, gain, extra: osc };
  }
}

qsa('.ambient-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const sound = btn.dataset.sound;

    if (btn.classList.contains('playing')) {
      if (ambientNodes[sound]) {
        try {
          ambientNodes[sound].src.stop();
          if (ambientNodes[sound].extra) ambientNodes[sound].extra.stop();
        } catch(e) {}
        delete ambientNodes[sound];
      }
      btn.classList.remove('playing');
      activeSound = null;
    } else {
      // Stop any currently playing sound
      qsa('.ambient-btn.playing').forEach(b => {
        const s = b.dataset.sound;
        if (ambientNodes[s]) {
          try {
            ambientNodes[s].src.stop();
            if (ambientNodes[s].extra) ambientNodes[s].extra.stop();
          } catch(e) {}
          delete ambientNodes[s];
        }
        b.classList.remove('playing');
      });

      try {
        ambientNodes[sound] = createNoise(sound);
        btn.classList.add('playing');
        activeSound = sound;
        showToast(`Playing ambient: ${sound}`, '🎵');
      } catch(e) {
        showToast('Audio requires a user interaction first.', '⚠️');
      }
    }
  });
});


// ===================== TASK MANAGER =====================
let tasks = loadLS('tasks', []);
let activeFilter = 'all';

function renderTasks() {
  const list = $('tasks-list');
  const filtered = activeFilter === 'all' ? tasks : tasks.filter(t => t.priority === activeFilter);

  if (tasks.length === 0) {
    list.innerHTML = '<div class="empty-tasks" id="empty-state"><span class="big">🎯</span>Add your first task above!</div>';
    $('progress-wrap').style.display = 'none';
    updateTaskCounts();
    return;
  }

  $('progress-wrap').style.display = 'block';
  list.innerHTML = filtered.map(t => `
    <div class="task-item ${t.done ? 'done' : ''}" data-id="${t.id}">
      <div class="task-check" onclick="toggleTask('${t.id}')">${t.done ? '✓' : ''}</div>
      <div class="task-priority-dot dot-${t.priority}"></div>
      <span class="task-text">${escHtml(t.text)}</span>
      <button class="task-delete" onclick="deleteTask('${t.id}')" title="Delete">✕</button>
    </div>
  `).join('');

  updateTaskCounts();
}

function escHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function addTask() {
  const input = $('task-input');
  const text = input.value.trim();
  if (!text) { input.focus(); return; }
  const priority = $('task-priority').value;
  tasks.unshift({ id: Date.now().toString(), text, priority, done: false, createdAt: Date.now() });
  saveLS('tasks', tasks);
  renderTasks();
  input.value = '';
  input.focus();
  showToast('Task added!', '✅');
}

function toggleTask(id) {
  const t = tasks.find(t => t.id === id);
  if (t) {
    t.done = !t.done;
    saveLS('tasks', tasks);
    renderTasks();
    if (t.done) {
      updateStatsUI();
      showToast('Task complete! 🎉', '🎉');
    }
  }
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveLS('tasks', tasks);
  renderTasks();
}

function updateTaskCounts() {
  const done = tasks.filter(t => t.done).length;
  const left = tasks.filter(t => !t.done).length;
  $('done-count').textContent = done;
  $('left-count').textContent = left;
  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  $('progress-pct').textContent = pct + '%';
  $('progress-fill').style.width = pct + '%';
  $('stat-tasks').textContent = done;
}

$('add-task-btn').addEventListener('click', addTask);
$('task-input').addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
$('clear-done').addEventListener('click', () => {
  tasks = tasks.filter(t => !t.done);
  saveLS('tasks', tasks);
  renderTasks();
  showToast('Cleared completed tasks', '🗑️');
});

qsa('.tag').forEach(tag => {
  tag.addEventListener('click', () => {
    qsa('.tag').forEach(t => t.classList.remove('active'));
    tag.classList.add('active');
    activeFilter = tag.dataset.filter;
    renderTasks();
  });
});


// ===================== STATS & CHART =====================
function updateStatsUI() {
  $('stat-focus').textContent = timerState.completedToday;
  const hrs = timerState.focusMinutesToday;
  $('stat-time').textContent = hrs >= 60 ? `${(hrs / 60).toFixed(1)}h` : `${hrs}m`;
  $('stat-tasks').textContent = tasks.filter(t => t.done).length;

  const weekly = loadLS('weekly', getDefaultWeekly());
  const totalSess = weekly.reduce((a, b) => a + b, 0);
  const totalHrs = Math.floor(totalSess * (timerState.total / 60) / 60);
  $('ms-sessions').textContent = totalSess;
  $('ms-focushrs').textContent = totalHrs + 'h';
  $('ms-tasks').textContent = tasks.filter(t => t.done).length;

  const streak = loadLS('streak', 0);
  $('ms-streak').textContent = streak;
  $('streak-count').textContent = streak;
}

function getDefaultWeekly() {
  return [2, 3, 1, 4, 2, 3, timerState.completedToday];
}

function addWeeklySession() {
  let weekly = loadLS('weekly', getDefaultWeekly());
  weekly[6] = (weekly[6] || 0) + 1;
  let streak = loadLS('streak', 0);
  streak++;
  saveLS('streak', streak);
  saveLS('weekly', weekly);
  renderChart(weekly);
  updateStatsUI();
}

function renderChart(weekly) {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const colors = ['#7c6ff7', '#7c6ff7', '#7c6ff7', '#7c6ff7', '#7c6ff7', '#5eead4', '#f472b6'];
  const max = Math.max(...weekly, 1);
  const chart = $('bar-chart');
  chart.innerHTML = weekly.map((val, i) => {
    const h = Math.round((val / max) * 70) + 4;
    return `<div class="bar-col">
      <div class="bar" style="height:${h}px;background:${colors[i]};opacity:${i === 6 ? 1 : 0.6}" data-val="${val} sessions"></div>
      <span class="bar-label">${labels[i]}</span>
    </div>`;
  }).join('');
}


// ===================== QUICK NOTES =====================
const notesTA = $('notes-ta');
notesTA.value = loadLS('notes', '');
$('char-count').textContent = notesTA.value.length;

notesTA.addEventListener('input', () => {
  $('char-count').textContent = notesTA.value.length;
  saveLS('notes', notesTA.value);
  $('save-note').textContent = '✓ Saved';
});


// ===================== HABIT TRACKER =====================
const HABITS = [
  { id: 'exercise', name: '💪 Exercise' },
  { id: 'water',    name: '💧 Drink Water' },
  { id: 'read',     name: '📚 Read' },
  { id: 'meditate', name: '🧘 Meditate' },
];

function renderHabits() {
  const habitData = loadLS('habits', {});
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  $('habits-body').innerHTML = HABITS.map(h => {
    const hd = habitData[h.id] || {};
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      return { key, label: dayLabels[d.getDay()], done: !!hd[key] };
    });
    const streak = days.filter(d => d.done).length;

    return `<div class="habit-row">
      <span class="habit-name">${h.name}</span>
      <div class="habit-days">
        ${days.map(d => `
          <div class="habit-day ${d.done ? 'done' : ''}"
            onclick="toggleHabit('${h.id}','${d.key}')"
            title="${d.key}">${d.label}
          </div>`).join('')}
      </div>
      <span class="habit-streak">${streak > 0 ? '🔥' + streak : ''}</span>
    </div>`;
  }).join('');
}

function toggleHabit(habitId, dateKey) {
  const habitData = loadLS('habits', {});
  if (!habitData[habitId]) habitData[habitId] = {};
  habitData[habitId][dateKey] = !habitData[habitId][dateKey];
  saveLS('habits', habitData);
  renderHabits();
  if (habitData[habitId][dateKey]) showToast('Habit checked! Keep going 🔥', '🔥');
}


// ===================== INITIALIZE =====================
// Restore saved timer state (only if not mid-run)
const savedTimer = loadLS('timerState', null);
if (savedTimer && !savedTimer.running) {
  timerState = { ...timerState, ...savedTimer };
}

// Initial render
const weekly = loadLS('weekly', getDefaultWeekly());
renderChart(weekly);
updateTimerUI();
renderTasks();
renderHabits();
updateStatsUI();

// Animate chart bars on load
setTimeout(() => {
  qsa('.bar').forEach((b, i) => {
    const targetH = b.style.height;
    b.style.opacity = '0';
    b.style.height = '4px';
    setTimeout(() => {
      b.style.transition = 'height 0.6s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s';
      b.style.opacity = i === 6 ? '1' : '0.6';
      b.style.height = targetH;
    }, i * 80);
  });
}, 300);

// Welcome message
setTimeout(() => showToast("Welcome to NEXUS. Let's get focused! 🚀", '🚀'), 800);
