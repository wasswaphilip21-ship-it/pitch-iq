// ===============================
// PITCHIQ — API ENGINE v4
// Fixed CORS + season 2025 + live data
// ===============================

const API_KEY = "35f0bfdd839466bf99892dc805c57b94";

// ── Use AllSports proxy to avoid CORS issues ──
// Direct API calls from browser to api-sports.io are blocked by CORS.
// We use a CORS-friendly proxy wrapper.
const BASE_URL = "https://v3.football.api-sports.io";
const HEADERS = {
  "x-apisports-key": API_KEY,
  "x-rapidapi-host": "v3.football.api-sports.io"
};

const TOP_LEAGUES = [39, 140, 135, 78, 61, 2, 3, 848];
const LEAGUE_MAP = {
  epl: 39, laliga: 140, seriea: 135, bundesliga: 78,
  ligue1: 61, ucl: 2, uel: 3, wc: 1, afcon: 6, all: null
};
const SEASON = 2024; // 2024 = the 2024/25 season (current in API)

// ===============================
// CACHE (localStorage)
// ===============================
function setCache(key, data, mins) {
  try { localStorage.setItem(key, JSON.stringify({ data, expiry: Date.now() + mins * 60000 })); } catch(e) {}
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
// FETCH WITH CORS FIX
// Uses allorigins proxy to bypass GitHub Pages CORS block
// ===============================
async function fetchAPI(endpoint, cacheKey, cacheMins = 10) {
  const cached = getCache(cacheKey);
  if (cached) return cached;

  // Try direct first (works on localhost/custom domain)
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, { headers: HEADERS });
    if (res.ok) {
      const data = await res.json();
      if (data?.response !== undefined) {
        setCache(cacheKey, data, cacheMins);
        return data;
      }
    }
  } catch(e) {
    console.log("Direct API blocked (CORS), trying proxy...");
  }

  // Fallback: CORS proxy
  try {
    const proxied = `https://api.allorigins.win/get?url=${encodeURIComponent(`${BASE_URL}${endpoint}`)}`;
    const res2 = await fetch(proxied, {
      headers: { "x-apisports-key": API_KEY }
    });
    if (res2.ok) {
      const wrapper = await res2.json();
      // allorigins returns {contents: "...json string..."}
      const data = JSON.parse(wrapper.contents);
      if (data?.response !== undefined) {
        setCache(cacheKey, data, cacheMins);
        return data;
      }
    }
  } catch(e2) {
    console.log("Proxy also failed, trying RapidAPI gateway...");
  }

  // Second fallback: RapidAPI public gateway
  try {
    const res3 = await fetch(`https://api-football-v1.p.rapidapi.com/v3${endpoint}`, {
      headers: {
        "x-rapidapi-key": API_KEY,
        "x-rapidapi-host": "api-football-v1.p.rapidapi.com"
      }
    });
    if (res3.ok) {
      const data3 = await res3.json();
      if (data3?.response !== undefined) {
        setCache(cacheKey, data3, cacheMins);
        return data3;
      }
    }
  } catch(e3) {}

  console.warn("All API routes failed for:", endpoint);
  return null;
}

// ===============================
// LOAD LIVE MATCHES
// ===============================
async function loadLiveMatches() {
  localStorage.removeItem("live_all_v4");
  const data = await fetchAPI("/fixtures?live=all", "live_all_v4", 1);
  const all = data?.response || [];
  return all.filter(m => TOP_LEAGUES.includes(m.league?.id));
}

// ===============================
// LOAD TODAY + UPCOMING
// If no matches today, get next 10 upcoming
// ===============================
async function loadTodayFixtures(lgKey = "all") {
  const today = new Date().toISOString().split("T")[0];
  const leagueId = lgKey && lgKey !== "all" ? LEAGUE_MAP[lgKey] : null;

  // Try today's fixtures first
  const endpoint = leagueId
    ? `/fixtures?date=${today}&league=${leagueId}&season=${SEASON}`
    : `/fixtures?date=${today}`;
  const cacheKey = `today_${today}_${lgKey || "all"}_v4`;
  const data = await fetchAPI(endpoint, cacheKey, 10);
  let matches = data?.response || [];
  if (leagueId) {
    matches = matches;
  } else {
    matches = matches.filter(m => TOP_LEAGUES.includes(m.league?.id));
  }

  // If no matches today, get upcoming
  if (matches.length === 0) {
    const upEndpoint = leagueId
      ? `/fixtures?next=15&league=${leagueId}&season=${SEASON}`
      : `/fixtures?next=20`;
    const upCache = `upcoming_${lgKey || "all"}_v4`;
    const upData = await fetchAPI(upEndpoint, upCache, 30);
    const upcoming = upData?.response || [];
    matches = leagueId ? upcoming : upcoming.filter(m => TOP_LEAGUES.includes(m.league?.id));
  }

  return matches;
}

// ===============================
// LOAD STANDINGS
// ===============================
async function loadStandings(lgKey = "epl") {
  const leagueId = LEAGUE_MAP[lgKey] || 39;
  const data = await fetchAPI(
    `/standings?league=${leagueId}&season=${SEASON}`,
    `standings_${leagueId}_${SEASON}_v4`,
    120
  );
  return data?.response?.[0]?.league?.standings?.[0] || null;
}

// ===============================
// LOAD TOP SCORERS
// ===============================
async function loadTopScorers(lgKey = "epl") {
  const leagueId = LEAGUE_MAP[lgKey] || 39;
  const data = await fetchAPI(
    `/players/topscorers?league=${leagueId}&season=${SEASON}`,
    `topscorers_${leagueId}_${SEASON}_v4`,
    180
  );
  return data?.response || [];
}

async function loadTopAssists(lgKey = "epl") {
  const leagueId = LEAGUE_MAP[lgKey] || 39;
  const data = await fetchAPI(
    `/players/topassists?league=${leagueId}&season=${SEASON}`,
    `topassists_${leagueId}_${SEASON}_v4`,
    180
  );
  return data?.response || [];
}

// ===============================
// LOAD TRANSFER NEWS (RSS — no key needed)
// ===============================
async function loadTransferNews() {
  const cacheKey = "transfer_news_v4";
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const feeds = [
    "https://www.footballtransfers.com/en/rss",
    "https://feeds.bbci.co.uk/sport/football/rss.xml",
    "https://www.skysports.com/rss/12040"
  ];

  for (const rss of feeds) {
    try {
      const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rss)}&count=12`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === "ok" && data.items?.length > 0) {
        setCache(cacheKey, data.items, 30);
        return data.items;
      }
    } catch(e) {}
  }
  return null;
}

// ===============================
// CALENDAR — which days have matches
// ===============================
async function loadCalendarDates() {
  const dates = {};
  const today = new Date();
  for (let i = -3; i <= 5; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const cached = getCache(`today_${dateStr}_all_v4`);
    if (cached?.response) {
      dates[dateStr] = cached.response.filter(m => TOP_LEAGUES.includes(m.league?.id)).length;
    }
  }
  return dates;
}

// ===============================
// FORM-BASED PREDICTIONS (no AI key needed)
// Uses standings form to calculate win probability
// ===============================
function calcFormPrediction(homeTeamName, awayTeamName, standings) {
  if (!standings) return { win: 45, draw: 28, loss: 27, reason: "Based on current season form." };

  const findTeam = (name) => standings.find(s =>
    s.team?.name?.toLowerCase().includes(name.toLowerCase().split(" ")[0]) ||
    name.toLowerCase().includes(s.team?.name?.toLowerCase().split(" ")[0])
  );

  const home = findTeam(homeTeamName);
  const away = findTeam(awayTeamName);

  if (!home || !away) return { win: 45, draw: 28, loss: 27, reason: "Based on current season form." };

  const homeForm = (home.form || "").slice(-5).split("").reduce((acc, f) => acc + (f === "W" ? 3 : f === "D" ? 1 : 0), 0);
  const awayForm = (away.form || "").slice(-5).split("").reduce((acc, f) => acc + (f === "W" ? 3 : f === "D" ? 1 : 0), 0);
  const homePts = home.points || 0;
  const awayPts = away.points || 0;

  const homeScore = (homeForm * 0.4) + (homePts * 0.3) + 5; // home advantage
  const awayScore = (awayForm * 0.4) + (awayPts * 0.3);
  const total = homeScore + awayScore + 8;

  const win = Math.round((homeScore / total) * 100);
  const loss = Math.round((awayScore / total) * 100);
  const draw = 100 - win - loss;

  const formStr = (f) => (f || "").slice(-5);
  const reason = `${homeTeamName} (${formStr(home.form)}) vs ${awayTeamName} (${formStr(away.form)}) — based on form and points.`;

  return { win: Math.max(win, 10), draw: Math.max(draw, 10), loss: Math.max(loss, 10), reason };
}

function generateFormPredictions(fixtures, standings) {
  if (!fixtures || fixtures.length === 0) return [];
  return fixtures.slice(0, 8).map(f => {
    const pred = calcFormPrediction(f.teams.home.name, f.teams.away.name, standings);
    const outcome = pred.win > pred.loss && pred.win > pred.draw ? "Home Win"
      : pred.loss > pred.win && pred.loss > pred.draw ? "Away Win" : "Draw";
    return {
      match: `${f.teams.home.name} vs ${f.teams.away.name}`,
      league: f.league?.name || "Football",
      outcome,
      win: pred.win,
      draw: pred.draw,
      loss: pred.loss,
      reason: pred.reason
    };
  });
}

function pickSafeBet(fixtures, standings) {
  const preds = generateFormPredictions(fixtures, standings);
  if (!preds.length) return null;
  // Pick the one with highest confidence
  const best = preds.reduce((a, b) => {
    const confA = Math.max(a.win, a.draw, a.loss);
    const confB = Math.max(b.win, b.draw, b.loss);
    return confA > confB ? a : b;
  });
  const conf = Math.max(best.win, best.draw, best.loss);
  return {
    match: best.match,
    prediction: best.outcome,
    confidence: conf,
    reason: best.reason
  };
}

// ===============================
// RENDER: MATCH CARD with real logo
// ===============================
function renderRealMatch(match) {
  const { fixture, league, teams, goals } = match;
  const status = fixture.status.short;
  const elapsed = fixture.status.elapsed;

  let stClass = "up", stLabel = "";
  if (["1H","2H","ET","LIVE"].includes(status)) {
    stClass = "lv"; stLabel = elapsed ? `${elapsed}'` : "LIVE";
  } else if (status === "HT") {
    stClass = "lv"; stLabel = "HT";
  } else if (["FT","AET","PEN"].includes(status)) {
    stClass = "ft"; stLabel = "FT";
  } else if (status === "NS") {
    stClass = "up";
    stLabel = new Date(fixture.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else {
    stClass = "up"; stLabel = status || "--";
  }

  const isLive = stClass === "lv";
  const isFT = stClass === "ft";
  const showScore = isLive || isFT;
  const homeScore = showScore && goals?.home !== null ? goals.home : "–";
  const awayScore = showScore && goals?.away !== null ? goals.away : "–";

  const logo = (url, name) => url
    ? `<img src="${url}" width="22" height="22" style="border-radius:50%;object-fit:contain;flex-shrink:0;" onerror="this.outerHTML='<div style=\\'width:22px;height:22px;border-radius:50%;background:rgba(128,128,128,.2);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:var(--t2);\\'>${(name||'?').slice(0,2).toUpperCase()}</div>'">`
    : `<div style="width:22px;height:22px;border-radius:50%;background:rgba(128,128,128,.2);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:var(--t2);">${(name||"?").slice(0,2).toUpperCase()}</div>`;

  const lgLogo = league?.logo
    ? `<img src="${league.logo}" width="13" height="13" style="object-fit:contain;border-radius:2px;">`
    : `<div class="mc-lg-dot" style="background:#1b3f6a;"></div>`;

  return `<div class="mc" data-fixture="${fixture.id}">
    <div class="mc-lg">${lgLogo} ${league?.name || "Football"} · ${league?.country || ""}</div>
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
// RENDER: STANDINGS with real logos
// ===============================
function renderRealStandings(standings, title) {
  if (!standings || standings.length === 0) return "";
  const rows = standings.slice(0, 8).map((entry, i) => {
    const form = (entry.form || "").slice(-5).split("").map(f => {
      const cls = f === "W" ? "sf-w" : f === "D" ? "sf-d" : "sf-l";
      return `<div class="sf ${cls}">${f}</div>`;
    }).join("");
    const logoEl = entry.team?.logo
      ? `<img src="${entry.team.logo}" width="14" height="14" style="border-radius:50%;object-fit:contain;flex-shrink:0;" onerror="this.style.display='none'">`
      : `<div class="st-dot" style="background:#888;"></div>`;
    const gd = entry.goalsDiff >= 0 ? `+${entry.goalsDiff}` : `${entry.goalsDiff}`;
    return `<div class="st-row${i < 4 ? " hl" : ""}">
      <div class="st-pos">${entry.rank}</div>
      ${logoEl}
      <div class="st-name">${entry.team?.name || "–"}</div>
      <div class="st-num">${entry.all?.played || 0}</div>
      <div class="st-num">${gd}</div>
      <div class="st-pts">${entry.points}</div>
      <div class="st-form">${form}</div>
    </div>`;
  }).join("");

  return `<div class="st">
    <div class="st-hd">${title || "Premier League · 2024/25"}</div>
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
// RENDER: PREDICTIONS
// ===============================
function renderFormPredictions(preds) {
  if (!preds || preds.length === 0) return '<div style="padding:20px;text-align:center;color:var(--t3);">Loading predictions...</div>';
  return preds.map(p => `<div class="pc">
    <div class="pc-hd">
      <div><div class="pc-match">${p.match}</div><div class="pc-lg">${p.league} · Form-based analysis</div></div>
      <div class="pc-chip">${p.outcome}</div>
    </div>
    <div class="prob-row"><span class="prob-lbl">Win</span><div class="prob-bar"><div class="prob-fill" style="width:${p.win}%;background:#3b9eff;"></div></div><span class="prob-pct">${p.win}%</span></div>
    <div class="prob-row"><span class="prob-lbl">Draw</span><div class="prob-bar"><div class="prob-fill" style="width:${p.draw}%;background:#ffb830;"></div></div><span class="prob-pct">${p.draw}%</span></div>
    <div class="prob-row"><span class="prob-lbl">Loss</span><div class="prob-bar"><div class="prob-fill" style="width:${p.loss}%;background:#ff4455;"></div></div><span class="prob-pct">${p.loss}%</span></div>
    <div class="pc-disc">📊 ${p.reason}</div>
  </div>`).join("");
}

// ===============================
// RENDER: SAFE BET
// ===============================
function renderSafeBetCard(bet) {
  const TZA = new Date().toLocaleTimeString("en-us",{timeZoneName:"short"}).split(" ")[2] || "Local";
  if (!bet) return "";
  return `<div class="sb">
    <div class="sb-eye">⚡ SAFE BET OF THE DAY · Updated ${new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})} ${TZA}</div>
    <div class="sb-match">${bet.match}</div>
    <div class="sb-reason">${bet.reason}</div>
    <div class="sb-pill">${bet.prediction} · ${bet.confidence}% confidence</div>
    <div class="sb-disc">⚠ Bet safely · 18+ only · <a href="https://www.begambleaware.org" target="_blank">BeGambleAware.org</a></div>
  </div>`;
}

// ===============================
// RENDER: TRANSFER NEWS
// ===============================
function renderTransferNews(items) {
  if (!items || items.length === 0) return '<div style="padding:20px;text-align:center;color:var(--t3);">Loading transfer news...</div>';
  const tagMap = (title) => {
    const t = (title || "").toLowerCase();
    if (t.includes("sign") || t.includes("complete") || t.includes("confirm")) return {tag:"confirmed",cls:"t-con"};
    if (t.includes("medical")) return {tag:"medical",cls:"t-med"};
    if (t.includes("bid") || t.includes("offer") || t.includes("reject")) return {tag:"bid",cls:"t-bid"};
    return {tag:"rumour",cls:"t-rum"};
  };
  const timeAgo = (d) => {
    try {
      const diff = Date.now() - new Date(d).getTime();
      const h = Math.floor(diff/3600000);
      return h < 1 ? `${Math.floor(diff/60000)}m ago` : h < 24 ? `${h}h ago` : `${Math.floor(h/24)}d ago`;
    } catch(e) { return "recent"; }
  };
  return items.slice(0,10).map(item => {
    const {tag,cls} = tagMap(item.title);
    return `<div class="tx" data-type="${tag}" onclick="window.open('${item.link}','_blank')" style="cursor:pointer;">
      <div class="tx-top"><span class="tx-tag ${cls}">${tag.toUpperCase()}</span><span class="tx-time">${timeAgo(item.pubDate)}</span></div>
      <div class="tx-body">${item.title}</div>
      <div class="tx-fee" style="font-size:10px;color:var(--t3);">Click to read full story →</div>
    </div>`;
  }).join("");
}

// ===============================
// RENDER: REAL PLAYERS (top scorers)
// ===============================
function renderRealPlayers(scorers) {
  if (!scorers || scorers.length === 0) return '<div style="padding:20px;text-align:center;color:var(--t3);">Loading player data...</div>';
  const colors = ["#c8102e","#00529f","#6cabdd","#e8063e","#034694","#1b3f6a","#d20515","#004170"];
  return scorers.slice(0,5).map((entry,i) => {
    const p = entry.player;
    const stats = entry.statistics?.[0] || {};
    const goals = stats.goals?.total || 0;
    const asst = stats.goals?.assists || 0;
    const rating = stats.games?.rating ? parseFloat(stats.games.rating).toFixed(1) : "–";
    const apps = stats.games?.appearences || 0;
    const shots = stats.shots?.on || 0;
    const color = colors[i % colors.length];
    const initials = (p.name||"??").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
    return `<div class="plyr">
      <div class="plyr-hd">
        <div class="plyr-av" style="background:${color}22;color:${color};overflow:hidden;padding:0;">
          ${p.photo ? `<img src="${p.photo}" width="52" height="52" style="border-radius:50%;object-fit:cover;" onerror="this.outerHTML='${initials}'">` : initials}
        </div>
        <div>
          <div class="plyr-name">${p.name}</div>
          <div class="plyr-club">${stats.team?.name || ""} · ${stats.league?.name || "EPL"}</div>
          <div class="plyr-pos">${stats.games?.position || "Forward"}</div>
        </div>
        <div class="plyr-rtg"><div class="plyr-rtg-n">${rating}</div><div class="plyr-rtg-l">avg rating</div></div>
      </div>
      <div class="plyr-stats">
        <div class="plyr-stat"><div class="plyr-sn">${goals}</div><div class="plyr-sl">Goals</div></div>
        <div class="plyr-stat"><div class="plyr-sn">${asst}</div><div class="plyr-sl">Assists</div></div>
        <div class="plyr-stat"><div class="plyr-sn">${apps}</div><div class="plyr-sl">Apps</div></div>
        <div class="plyr-stat"><div class="plyr-sn">${shots}</div><div class="plyr-sl">Shots on</div></div>
      </div>
      <div class="plyr-bars">
        <div class="plyr-br"><div class="plyr-bt"><span class="plyr-bl">Goals/game</span><span class="plyr-bv">${apps>0?(goals/apps).toFixed(2):"0.00"}</span></div><div class="plyr-bg"><div class="plyr-bf" style="width:${Math.min(100,(goals/Math.max(apps,1))*100)}%;background:#00e87a;"></div></div></div>
        <div class="plyr-br"><div class="plyr-bt"><span class="plyr-bl">Shots on target</span><span class="plyr-bv">${shots}</span></div><div class="plyr-bg"><div class="plyr-bf" style="width:${Math.min(100,shots*3)}%;background:#3b9eff;"></div></div></div>
        <div class="plyr-br"><div class="plyr-bt"><span class="plyr-bl">Assists</span><span class="plyr-bv">${asst}</span></div><div class="plyr-bg"><div class="plyr-bf" style="width:${Math.min(100,asst*8)}%;background:#ffb830;"></div></div></div>
      </div>
    </div>`;
  }).join("");
}

// ===============================
// SPINNER — loading state
// ===============================
function showSpinner(containerId) {
  const el = document.getElementById(containerId) || document.getElementById("feed");
  if (!el) return;
  el.insertAdjacentHTML("afterbegin", `
    <div id="piq-spinner" style="display:flex;align-items:center;justify-content:center;gap:10px;padding:24px;background:var(--card);border:0.5px solid var(--border);border-radius:var(--r);margin-bottom:8px;">
      <div style="width:18px;height:18px;border:2px solid var(--green);border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite;"></div>
      <div style="font-size:13px;color:var(--t2);">Searching for live data...</div>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg);}}</style>`);
}
function hideSpinner() {
  const s = document.getElementById("piq-spinner");
  if (s) s.remove();
}

// ===============================
// UPDATE HELPERS
// ===============================
function updateMatchesInFeed(matches) {
  const feed = document.getElementById("feed");
  if (!feed) return;
  feed.querySelectorAll(".mc").forEach(c => c.remove());
  const shd = feed.querySelector(".shd");
  if (!shd) return;
  if (matches && matches.length > 0) {
    shd.insertAdjacentHTML("afterend", matches.map(m => renderRealMatch(m)).join(""));
  } else {
    shd.insertAdjacentHTML("afterend", `
      <div style="padding:24px;text-align:center;color:var(--t3);background:var(--card);border:0.5px solid var(--border);border-radius:var(--r);margin-bottom:8px;">
        <div style="font-size:28px;margin-bottom:8px;">⚽</div>
        <div style="font-size:13px;font-weight:500;color:var(--t2);margin-bottom:4px;">No matches live right now</div>
        <div style="font-size:12px;">Showing upcoming fixtures below</div>
      </div>`);
  }
}

function updateStandingsInSidebar(standings, title) {
  if (!standings) return;
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;
  const stEl = sidebar.querySelector(".st");
  const html = renderRealStandings(standings, title);
  if (stEl) stEl.outerHTML = html;
  else sidebar.insertAdjacentHTML("afterbegin", html);
}

function updateSafeBetInFeed(bet) {
  const sbEl = document.querySelector(".sb");
  if (sbEl && bet) sbEl.outerHTML = renderSafeBetCard(bet);
}

function updateCalendarDots(dates) {
  const calDays = document.querySelectorAll(".cal-d");
  const today = new Date();
  calDays.forEach((day, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + (i - 2));
    const dateStr = d.toISOString().split("T")[0];
    if (dates[dateStr] > 0) day.classList.add("has");
  });
}

// ===============================
// LOAD DATA FOR EACH TAB
// ===============================
async function loadTabData(tab) {
  const feed = document.getElementById("feed");
  showSpinner();

  try {
    if (tab === "live" || tab === "today") {
      const [live, today, standings, calDates] = await Promise.all([
        loadLiveMatches(),
        loadTodayFixtures(window.curLg || "all"),
        loadStandings("epl"),
        loadCalendarDates()
      ]);

      hideSpinner();
      updateCalendarDots(calDates);
      updateStandingsInSidebar(standings, "Premier League · 2024/25");

      // Merge live + today, deduplicate
      const liveIds = new Set((live||[]).map(m => m.fixture.id));
      const allMatches = [...(live||[]), ...(today||[]).filter(m => !liveIds.has(m.fixture.id))];

      updateMatchesInFeed(allMatches);
      window._fixtures = allMatches;
      window._standings = standings;

      // Safe bet from form analysis
      if (allMatches.length > 0) {
        const bet = pickSafeBet(allMatches, standings);
        if (bet) updateSafeBetInFeed(bet);
      }
    }

    else if (tab === "predictions") {
      const fixtures = window._fixtures || await loadTodayFixtures("all");
      const standings = window._standings || await loadStandings("epl");
      hideSpinner();

      const preds = generateFormPredictions(fixtures, standings);
      if (feed) {
        feed.querySelectorAll(".pc").forEach(c => c.remove());
        const shd = feed.querySelector(".shd");
        if (shd) shd.insertAdjacentHTML("afterend", renderFormPredictions(preds));
      }

      const bet = pickSafeBet(fixtures, standings);
      if (bet) updateSafeBetInFeed(bet);
      updateStandingsInSidebar(standings);
    }

    else if (tab === "transfers") {
      const [news, standings] = await Promise.all([loadTransferNews(), loadStandings("epl")]);
      hideSpinner();
      if (news) {
        const txList = document.getElementById("txList");
        if (txList) { txList.innerHTML = renderTransferNews(news); window._txNews = news; }
      }
      updateStandingsInSidebar(standings);
    }

    else if (tab === "players" || tab === "fantasy") {
      const [scorers, standings] = await Promise.all([loadTopScorers("epl"), loadStandings("epl")]);
      hideSpinner();
      if (scorers?.length && feed) {
        feed.querySelectorAll(".plyr, .fan").forEach(c => c.remove());
        const shd = feed.querySelector(".shd");
        if (shd) shd.insertAdjacentHTML("afterend", renderRealPlayers(scorers));
      }
      updateStandingsInSidebar(standings);
    }

    else if (tab === "lineups") {
      hideSpinner();
      updateStandingsInSidebar(window._standings);
    }

    else {
      hideSpinner();
    }

  } catch(e) {
    hideSpinner();
    console.warn("Tab data load error:", e);
  }
}

// ===============================
// PATCH TRANSFER FILTER
// ===============================
window.fTx = function(el, type) {
  document.querySelectorAll(".itab").forEach(t => t.classList.remove("on"));
  el.classList.add("on");
  const list = document.getElementById("txList");
  if (!list || !window._txNews) return;
  if (type === "all") { list.innerHTML = renderTransferNews(window._txNews); return; }
  const filtered = window._txNews.filter(item => {
    const t = (item.title||"").toLowerCase();
    if (type === "confirmed") return t.includes("sign")||t.includes("confirm")||t.includes("complete");
    if (type === "rumour") return t.includes("linked")||t.includes("interest")||t.includes("target");
    if (type === "medical") return t.includes("medical");
    if (type === "bid") return t.includes("bid")||t.includes("offer");
    return true;
  });
  list.innerHTML = filtered.length ? renderTransferNews(filtered)
    : `<div style="padding:20px;text-align:center;color:var(--t3);">No ${type} news right now</div>`;
};

// ===============================
// LIVE REFRESH (every 60 seconds)
// ===============================
function startLiveRefresh() {
  setInterval(async () => {
    if (window.curTab !== "live" && window.curTab !== "today") return;
    const live = await loadLiveMatches();
    if (live?.length > 0) updateMatchesInFeed(live);
  }, 60000);
}

// ===============================
// MAIN INIT
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  // Patch goTab to load real data on tab switch
  const _orig = window.goTab;
  window.goTab = async function(el, tab) {
    _orig(el, tab);
    window.curTab = tab;
    await loadTabData(tab);
  };

  // Load initial data
  loadTabData("live");
  startLiveRefresh();

  console.log("PitchIQ API Engine v4 ✅ — API key active, season 2024/25");
});
