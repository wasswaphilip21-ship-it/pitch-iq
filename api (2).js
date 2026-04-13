// ===============================
// 🔑 CONFIG
// ===============================
const API_KEY = "35f0bfdd839466bf99892dc805c57b94";
const BASE_URL = "https://v3.football.api-sports.io";
const HEADERS = { "x-apisports-key": API_KEY };

// ===============================
// 🏆 TOP LEAGUES
// ===============================
const TOP_LEAGUES = [39, 140, 135, 78, 61, 2, 3, 848, 253, 307];

const LEAGUE_MAP = {
  epl: 39, laliga: 140, seriea: 135, bundesliga: 78,
  ligue1: 61, ucl: 2, uel: 3, all: null
};

// ===============================
// ⚡ CACHE
// ===============================
function setCache(key, data, mins) {
  try {
    localStorage.setItem(key, JSON.stringify({
      data, expiry: Date.now() + mins * 60000
    }));
  } catch(e) {}
}

function getCache(key) {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    const p = JSON.parse(item);
    if (Date.now() > p.expiry) { localStorage.removeItem(key); return null; }
    return p.data;
  } catch(e) { return null; }
}

// ===============================
// 🌍 FETCH HELPER
// ===============================
async function fetchAPI(endpoint, cacheKey, cacheMins = 10) {
  const cached = getCache(cacheKey);
  if (cached) return cached;
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, { headers: HEADERS });
    const data = await res.json();
    if (data?.errors && Object.keys(data.errors).length > 0) {
      console.warn("API errors:", data.errors);
      return null;
    }
    setCache(cacheKey, data, cacheMins);
    return data;
  } catch(err) {
    console.error("API ERROR:", err);
    return null;
  }
}

// ===============================
// ⚽ LOAD LIVE MATCHES
// Called by: index.html integration script
// ===============================
async function loadLiveMatches() {
  localStorage.removeItem("live_all"); // always fresh
  const data = await fetchAPI("/fixtures?live=all", "live_all", 1);
  const all = data?.response || [];
  return all.filter(m => TOP_LEAGUES.includes(m.league.id));
}

// ===============================
// 📅 LOAD TODAY'S FIXTURES
// Called by: index.html integration script
// ===============================
async function loadTodayFixtures(lgKey = "all") {
  const today = new Date().toISOString().split("T")[0];
  const leagueId = lgKey && LEAGUE_MAP[lgKey];
  const endpoint = leagueId
    ? `/fixtures?date=${today}&league=${leagueId}&season=2025`
    : `/fixtures?date=${today}`;
  const cacheKey = `today_${today}_${lgKey || "all"}`;
  const data = await fetchAPI(endpoint, cacheKey, 10);
  const all = data?.response || [];
  return leagueId ? all : all.filter(m => TOP_LEAGUES.includes(m.league.id));
}

// ===============================
// 📊 LOAD STANDINGS
// Called by: index.html integration script
// ===============================
async function loadStandings(lgKey = "epl") {
  const leagueId = LEAGUE_MAP[lgKey] || 39;
  const data = await fetchAPI(
    `/standings?league=${leagueId}&season=2025`,
    `standings_${leagueId}_2025`,
    60
  );
  return data?.response?.[0]?.league?.standings?.[0] || null;
}

// ===============================
// 📆 LOAD CALENDAR DATES
// Called by: index.html integration script
// Returns: { "YYYY-MM-DD": matchCount }
// ===============================
async function loadCalendarDates() {
  const dates = {};
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // Check cache for surrounding days (no extra API calls)
  for (let i = -3; i <= 4; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const cached = getCache(`today_${dateStr}_all`);
    if (cached?.response) {
      dates[dateStr] = cached.response.filter(m =>
        TOP_LEAGUES.includes(m.league.id)
      ).length;
    }
  }

  // Always fetch today fresh
  const todayData = await loadTodayFixtures("all");
  if (todayData) dates[todayStr] = todayData.length;

  return dates;
}

// ===============================
// 🎨 RENDER REAL MATCH CARD
// Called by: index.html integration script
// Returns HTML string matching .mc structure
// ===============================
function renderRealMatch(match) {
  const { fixture, league, teams, goals } = match;
  const status = fixture.status.short;
  const elapsed = fixture.status.elapsed;

  let stClass = "up", stLabel = "";

  if (["1H","2H","ET","LIVE"].includes(status)) {
    stClass = "lv";
    stLabel = elapsed ? `${elapsed}'` : "LIVE";
  } else if (status === "HT") {
    stClass = "lv"; stLabel = "HT";
  } else if (["FT","AET","PEN"].includes(status)) {
    stClass = "ft"; stLabel = "FT";
  } else if (status === "NS") {
    stClass = "up";
    stLabel = new Date(fixture.date).toLocaleTimeString([], {
      hour: "2-digit", minute: "2-digit"
    });
  } else if (status === "PST") {
    stClass = "ft"; stLabel = "PST";
  } else {
    stClass = "up"; stLabel = status || "--";
  }

  const isLive = stClass === "lv";
  const isFT = stClass === "ft";
  const showScore = isLive || isFT;

  const homeScore = showScore && goals.home !== null ? goals.home : "–";
  const awayScore = showScore && goals.away !== null ? goals.away : "–";

  const logo = (url, name) => url
    ? `<img src="${url}" width="20" height="20" style="border-radius:50%;object-fit:contain;" onerror="this.style.display='none'">`
    : `<div style="width:20px;height:20px;border-radius:50%;background:rgba(128,128,128,.2);display:flex;align-items:center;justify-content:center;font-size:8px;color:var(--t3);">${(name||"?").slice(0,2)}</div>`;

  return `<div class="mc">
    <div class="mc-lg">
      <div class="mc-lg-dot" style="background:#1b3f6a;"></div>
      ${league.name} · ${league.country}
    </div>
    <div class="mc-row">
      <div class="mc-min ${stClass}">${stLabel}</div>
      <div class="mc-teams">
        <div class="mc-team">${logo(teams.home.logo, teams.home.name)}<span class="mc-tname">${teams.home.name}</span></div>
        <div class="mc-team">${logo(teams.away.logo, teams.away.name)}<span class="mc-tname">${teams.away.name}</span></div>
      </div>
      <div class="mc-s">
        <div class="mc-score">${homeScore}</div>
        <div class="mc-score">${awayScore}</div>
      </div>
      <div class="mc-right">
        ${isLive ? '<div class="mc-pred">LIVE</div>' : ""}
        <div class="mc-chev">›</div>
      </div>
    </div>
  </div>`;
}

// ===============================
// 📊 RENDER REAL STANDINGS
// Called by: index.html integration script
// Returns HTML string matching .st structure
// ===============================
function renderRealStandings(standings) {
  if (!standings || standings.length === 0) return "";

  const rows = standings.slice(0, 6).map((entry, i) => {
    const form = (entry.form || "").slice(-5).split("").map(f => {
      const cls = f === "W" ? "sf-w" : f === "D" ? "sf-d" : "sf-l";
      return `<div class="sf ${cls}">${f}</div>`;
    }).join("");

    const logoEl = entry.team?.logo
      ? `<img src="${entry.team.logo}" width="16" height="16" style="border-radius:50%;object-fit:contain;flex-shrink:0;" onerror="this.style.display='none'">`
      : `<div class="st-dot" style="background:#888;"></div>`;

    return `<div class="st-row${i < 2 ? " hl" : ""}">
      <div class="st-pos">${entry.rank}</div>
      ${logoEl}
      <div class="st-name">${entry.team?.name || "–"}</div>
      <div class="st-num">${entry.all?.played || 0}</div>
      <div class="st-num">${entry.goalsDiff >= 0 ? "+" : ""}${entry.goalsDiff}</div>
      <div class="st-pts">${entry.points}</div>
      <div class="st-form">${form}</div>
    </div>`;
  }).join("");

  return `<div class="st">
    <div class="st-hd">Premier League Table</div>
    <div style="display:flex;padding:4px 14px;border-bottom:0.5px solid var(--border);">
      <div style="min-width:18px;"></div>
      <div style="flex:1;font-size:9px;color:var(--t3);padding-left:4px;">Club</div>
      <div style="min-width:22px;text-align:center;font-size:9px;color:var(--t3);">P</div>
      <div style="min-width:22px;text-align:center;font-size:9px;color:var(--t3);">GD</div>
      <div style="min-width:22px;text-align:center;font-size:9px;color:var(--t3);">Pts</div>
      <div style="min-width:58px;text-align:center;font-size:9px;color:var(--t3);">Form</div>
    </div>
    ${rows}
    <div class="st-foot">View full table →</div>
  </div>`;
}

// ===============================
// 🔄 START LIVE REFRESH
// Called by: index.html integration script
// ===============================
function startLiveRefresh() {
  setInterval(async () => {
    const tab = window.curTab;
    if (tab !== "live" && tab !== "today") return;

    const live = await loadLiveMatches();
    const feed = document.getElementById("feed");
    if (!feed || !live || live.length === 0) return;

    feed.querySelectorAll(".mc").forEach(c => c.remove());
    const shd = feed.querySelector(".shd");
    if (shd) shd.insertAdjacentHTML("afterend", live.map(m => renderRealMatch(m)).join(""));
  }, 60000);
}
