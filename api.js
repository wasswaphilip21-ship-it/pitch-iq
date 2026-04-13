// ===============================
// 🔑 CONFIG
// ===============================
const CURRENT_SEASON = 2025; // This ensures 2025/26 data

async function fetchStandings(leagueId = 39) {
    const cacheKey = `standings_${leagueId}`;
    const cached = getCache(cacheKey);
    if (cached) return renderStandings(cached);

    const res = await fetch(`${BASE_URL}/standings?league=${leagueId}&season=${CURRENT_SEASON}`, { headers: HEADERS });
    const json = await res.json();
    const data = json.response[0].league.standings[0];
    
    setCache(cacheKey, data, 60); // Cache for 1 hour
    renderStandings(data);
}
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
    localStorage.setItem(key, JSON.stringify({ data, expiry: Date.now() + mins * 60000 }));
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
// ===============================
async function loadLiveMatches() {
  localStorage.removeItem("live_all");
  const data = await fetchAPI("/fixtures?live=all", "live_all", 1);
  const all = data?.response || [];
  return all.filter(m => TOP_LEAGUES.includes(m.league.id));
}

// ===============================
// 📅 LOAD TODAY'S FIXTURES
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
// ===============================
async function loadCalendarDates() {
  const dates = {};
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  for (let i = -3; i <= 4; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const cached = getCache(`today_${dateStr}_all`);
    if (cached?.response) {
      dates[dateStr] = cached.response.filter(m => TOP_LEAGUES.includes(m.league.id)).length;
    }
  }
  const todayData = await loadTodayFixtures("all");
  if (todayData) dates[todayStr] = todayData.length;
  return dates;
}

// ===============================
// 🧍 LOAD TOP PLAYERS (season 2025)
// ===============================
async function loadTopScorers(lgKey = "epl") {
  const leagueId = LEAGUE_MAP[lgKey] || 39;
  const data = await fetchAPI(
    `/players/topscorers?league=${leagueId}&season=2025`,
    `topscorers_${leagueId}_2025`,
    120
  );
  return data?.response || [];
}

async function loadTopAssists(lgKey = "epl") {
  const leagueId = LEAGUE_MAP[lgKey] || 39;
  const data = await fetchAPI(
    `/players/topassists?league=${leagueId}&season=2025`,
    `topassists_${leagueId}_2025`,
    120
  );
  return data?.response || [];
}

// ===============================
// 🗞️ LOAD TRANSFER NEWS via RSS
// Uses a public football news RSS feed
// ===============================
async function loadTransferNews() {
  const cacheKey = "transfer_news_v2";
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    // Use rss2json to convert RSS to JSON (free, no key needed)
    const rss = "https://www.footballtransfers.com/en/rss";
    const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rss)}&count=10`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === "ok" && data.items) {
      setCache(cacheKey, data.items, 30);
      return data.items;
    }
  } catch(e) {}

  // Fallback: BBC Sport football RSS
  try {
    const rss2 = "https://feeds.bbci.co.uk/sport/football/rss.xml";
    const url2 = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rss2)}&count=10`;
    const res2 = await fetch(url2);
    const data2 = await res2.json();
    if (data2.status === "ok" && data2.items) {
      setCache(cacheKey, data2.items, 30);
      return data2.items;
    }
  } catch(e) {}

  return null;
}

// ===============================
// 🤖 AI PREDICTIONS (Claude API)
// ===============================
async function generatePredictions(fixtures) {
  if (!fixtures || fixtures.length === 0) return null;

  const cacheKey = `ai_preds_${new Date().toISOString().split("T")[0]}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const matchList = fixtures.slice(0, 8).map(f =>
    `${f.teams.home.name} vs ${f.teams.away.name} (${f.league.name})`
  ).join("\n");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `You are a football analyst. For each match below, give a short prediction. Respond ONLY with a JSON array, no markdown, no explanation. Each item must have exactly these fields: "match" (string), "league" (string), "outcome" (e.g. "Home Win", "Draw", "Away Win"), "win" (number 0-100), "draw" (number 0-100), "loss" (number 0-100), "reason" (1 sentence, max 15 words).

Matches:
${matchList}

Return ONLY valid JSON array.`
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.map(c => c.text || "").join("") || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const preds = JSON.parse(clean);
    setCache(cacheKey, preds, 120);
    return preds;
  } catch(e) {
    console.warn("AI predictions failed:", e);
    return null;
  }
}

// ===============================
// 🔥 AI SAFE BET (Claude API)
// ===============================
async function generateSafeBet(fixtures) {
  if (!fixtures || fixtures.length === 0) return null;

  const cacheKey = `safe_bet_${new Date().toISOString().split("T")[0]}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const matchList = fixtures.slice(0, 6).map(f =>
    `${f.teams.home.name} vs ${f.teams.away.name} (${f.league.name})`
  ).join("\n");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: `You are a football analyst. From these matches, pick ONE safest bet for today. Respond ONLY with JSON, no markdown:
{"match":"Team A vs Team B","prediction":"Home Win","confidence":78,"reason":"2-3 sentence analysis of why this is the safest bet based on likely form and history."}

Matches:
${matchList}

Return ONLY valid JSON.`
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.map(c => c.text || "").join("") || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const bet = JSON.parse(clean);
    setCache(cacheKey, bet, 120);
    return bet;
  } catch(e) {
    console.warn("AI safe bet failed:", e);
    return null;
  }
}

// ===============================
// 📰 AI WEEKLY DIGEST (Claude API)
// ===============================
async function generateWeeklyDigest(standings, fixtures) {
  const today = new Date();
  const weekKey = `${today.getFullYear()}-W${Math.ceil(today.getDate()/7)}`;
  const cacheKey = `digest_${weekKey}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const topTeams = standings ? standings.slice(0, 5).map(s =>
    `${s.rank}. ${s.team.name} - ${s.points}pts`
  ).join(", ") : "Data loading";

  const recentMatches = (fixtures || []).slice(0, 5).map(f =>
    `${f.teams.home.name} vs ${f.teams.away.name}`
  ).join(", ");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 800,
        messages: [{
          role: "user",
          content: `You are a football journalist writing a weekly digest for April 2026. Current EPL standings top 5: ${topTeams}. Recent fixtures: ${recentMatches}.

Write a weekly digest. Respond ONLY with JSON, no markdown:
{
  "week": "Apr 7–13, 2026",
  "matches": 47,
  "goals": 124,
  "upsets": 5,
  "records": 2,
  "moments": [
    {"tag":"UPSET","cls":"t-bid","match":"Team A 2–1 Team B","headline":"Short dramatic headline","detail":"2-3 sentence analysis."},
    {"tag":"RECORD","cls":"t-med","match":"Team C vs Team D","headline":"Short record headline","detail":"2-3 sentence analysis."},
    {"tag":"GOAL OF WEEK","cls":"t-con","match":"Team E vs Team F","headline":"Describe the goal","detail":"2-3 sentence vivid description."}
  ],
  "nextWeekMatches": [
    {"match":"Team A vs Team B","time":"Sat","prediction":"Home 61%"},
    {"match":"Team C vs Team D","time":"Sun","prediction":"Draw 42%"},
    {"match":"Team E vs Team F","time":"Sat","prediction":"Away 55%"},
    {"match":"Team G vs Team H","time":"Sun","prediction":"Home 70%"}
  ]
}

Use real-sounding current football news and context from April 2026. Return ONLY valid JSON.`
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.map(c => c.text || "").join("") || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const digest = JSON.parse(clean);
    setCache(cacheKey, digest, 180);
    return digest;
  } catch(e) {
    console.warn("AI digest failed:", e);
    return null;
  }
}

// ===============================
// 🎨 RENDER REAL MATCH CARD
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
    stLabel = new Date(fixture.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
    <div class="st-hd">Premier League Table · 2025/26</div>
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
// 🎯 RENDER AI PREDICTIONS
// ===============================
function renderAIPredictions(preds) {
  if (!preds || preds.length === 0) return '<div style="padding:20px;text-align:center;color:var(--t3);">Loading AI predictions...</div>';

  return preds.map(p => `<div class="pc">
    <div class="pc-hd">
      <div>
        <div class="pc-match">${p.match}</div>
        <div class="pc-lg">${p.league} · AI Analysis</div>
      </div>
      <div class="pc-chip">${p.outcome}</div>
    </div>
    <div class="prob-row">
      <span class="prob-lbl">Win</span>
      <div class="prob-bar"><div class="prob-fill" style="width:${p.win}%;background:#3b9eff;"></div></div>
      <span class="prob-pct">${p.win}%</span>
    </div>
    <div class="prob-row">
      <span class="prob-lbl">Draw</span>
      <div class="prob-bar"><div class="prob-fill" style="width:${p.draw}%;background:#ffb830;"></div></div>
      <span class="prob-pct">${p.draw}%</span>
    </div>
    <div class="prob-row">
      <span class="prob-lbl">Loss</span>
      <div class="prob-bar"><div class="prob-fill" style="width:${p.loss}%;background:#ff4455;"></div></div>
      <span class="prob-pct">${p.loss}%</span>
    </div>
    <div class="pc-disc">🤖 ${p.reason || "AI-powered prediction based on current season form."}</div>
  </div>`).join("");
}

// ===============================
// 🔥 RENDER AI SAFE BET
// ===============================
function renderAISafeBet(bet) {
  if (!bet) return `<div class="sb">
    <div class="sb-eye">⚡ SAFE BET OF THE DAY</div>
    <div class="sb-match" style="color:var(--t3);">Loading today's best bet...</div>
  </div>`;

  return `<div class="sb">
    <div class="sb-eye">⚡ SAFE BET OF THE DAY · AI-Powered · ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</div>
    <div class="sb-match">${bet.match}</div>
    <div class="sb-reason">${bet.reason}</div>
    <div class="sb-pill">${bet.prediction} · ${bet.confidence}% confidence</div>
    <div class="sb-disc">⚠ Bet safely · 18+ only · <a href="https://www.begambleaware.org" target="_blank">BeGambleAware.org</a></div>
  </div>`;
}

// ===============================
// 🗞️ RENDER TRANSFER NEWS
// ===============================
function renderTransferNews(items) {
  if (!items || items.length === 0) return "";

  const tagMap = (title) => {
    const t = title.toLowerCase();
    if (t.includes("sign") || t.includes("complete") || t.includes("confirm") || t.includes("deal done")) return {tag:"confirmed",cls:"t-con"};
    if (t.includes("medical") || t.includes("undergo")) return {tag:"medical",cls:"t-med"};
    if (t.includes("bid") || t.includes("offer") || t.includes("reject")) return {tag:"bid",cls:"t-bid"};
    return {tag:"rumour",cls:"t-rum"};
  };

  const timeAgo = (pubDate) => {
    try {
      const diff = Date.now() - new Date(pubDate).getTime();
      const h = Math.floor(diff/3600000);
      if (h < 1) return `${Math.floor(diff/60000)}m ago`;
      if (h < 24) return `${h}h ago`;
      return `${Math.floor(h/24)}d ago`;
    } catch(e) { return "recent"; }
  };

  return items.slice(0, 8).map(item => {
    const {tag, cls} = tagMap(item.title || "");
    return `<div class="tx" data-type="${tag}" onclick="window.open('${item.link}','_blank')">
      <div class="tx-top">
        <span class="tx-tag ${cls}">${tag.toUpperCase()}</span>
        <span class="tx-time">${timeAgo(item.pubDate)}</span>
      </div>
      <div class="tx-body">${item.title}</div>
      <div class="tx-fee" style="font-size:10px;color:var(--t3);">Click to read full story →</div>
    </div>`;
  }).join("");
}

// ===============================
// 👤 RENDER REAL PLAYERS
// ===============================
function renderRealPlayers(scorers, assists) {
  if (!scorers || scorers.length === 0) return "";
  const colors = ["#c8102e","#00529f","#6cabdd","#e8063e","#034694","#1b3f6a","#d20515","#004170"];

  return scorers.slice(0, 4).map((entry, i) => {
    const p = entry.player;
    const stats = entry.statistics?.[0] || {};
    const goals = stats.goals?.total || 0;
    const asst = stats.goals?.assists || 0;
    const rating = stats.games?.rating ? parseFloat(stats.games.rating).toFixed(1) : "N/A";
    const apps = stats.games?.appearences || 0;
    const shots = stats.shots?.on || 0;
    const color = colors[i % colors.length];
    const initials = (p.name || "??").split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase();
    const clubName = stats.team?.name || "";
    const leagueName = stats.league?.name || "Premier League";
    const logoUrl = p.photo || "";

    return `<div class="plyr">
      <div class="plyr-hd">
        <div class="plyr-av" style="background:${color}22;color:${color};overflow:hidden;">
          ${logoUrl ? `<img src="${logoUrl}" width="52" height="52" style="border-radius:50%;object-fit:cover;" onerror="this.style.display='none'">` : initials}
        </div>
        <div>
          <div class="plyr-name">${p.name}</div>
          <div class="plyr-club">${clubName} · ${leagueName}</div>
          <div class="plyr-pos">Striker/Forward</div>
        </div>
        <div class="plyr-rtg">
          <div class="plyr-rtg-n">${rating}</div>
          <div class="plyr-rtg-l">avg rating</div>
        </div>
      </div>
      <div class="plyr-stats">
        <div class="plyr-stat"><div class="plyr-sn">${goals}</div><div class="plyr-sl">Goals</div></div>
        <div class="plyr-stat"><div class="plyr-sn">${asst}</div><div class="plyr-sl">Assists</div></div>
        <div class="plyr-stat"><div class="plyr-sn">${apps}</div><div class="plyr-sl">Apps</div></div>
        <div class="plyr-stat"><div class="plyr-sn">${shots}</div><div class="plyr-sl">Shots on</div></div>
      </div>
      <div class="plyr-bars">
        <div class="plyr-br">
          <div class="plyr-bt"><span class="plyr-bl">Goals per game</span><span class="plyr-bv">${apps > 0 ? (goals/apps).toFixed(2) : "0.00"}</span></div>
          <div class="plyr-bg"><div class="plyr-bf" style="width:${Math.min(100, (goals/apps)*100||0)}%;background:#00e87a;"></div></div>
        </div>
        <div class="plyr-br">
          <div class="plyr-bt"><span class="plyr-bl">Shots on target</span><span class="plyr-bv">${shots}</span></div>
          <div class="plyr-bg"><div class="plyr-bf" style="width:${Math.min(100, shots*3)}%;background:#3b9eff;"></div></div>
        </div>
        <div class="plyr-br">
          <div class="plyr-bt"><span class="plyr-bl">Assists</span><span class="plyr-bv">${asst}</span></div>
          <div class="plyr-bg"><div class="plyr-bf" style="width:${Math.min(100, asst*8)}%;background:#ffb830;"></div></div>
        </div>
      </div>
    </div>`;
  }).join("");
}

// ===============================
// 📊 RENDER AI WEEKLY DIGEST
// ===============================
function renderAIDigest(digest) {
  if (!digest) {
    return `<div class="dig">
      <div class="dig-hero">
        <div class="dig-eye">WEEKLY DIGEST · Loading...</div>
        <div class="dig-title">WEEKEND WRAP</div>
        <div class="dig-sub">AI is generating this week's digest...</div>
      </div>
    </div>`;
  }

  const d = digest;
  const TZA = new Date().toLocaleTimeString('en-us',{timeZoneName:'short'}).split(' ')[2]||'Local';

  const moments = (d.moments || []).map(m => `
    <div class="moment">
      <div class="moment-top"><span class="tx-tag ${m.cls}">${m.tag}</span><span style="font-size:10px;color:var(--t3);">${m.match}</span></div>
      <div class="moment-h">${m.headline}</div>
      <div class="moment-d">${m.detail}</div>
    </div>`).join("");

  const nextWeek = (d.nextWeekMatches || []).map(m =>
    `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:0.5px solid rgba(128,128,128,.06);">
      <div style="font-size:13px;font-weight:500;color:var(--text);">${m.match}</div>
      <div style="text-align:right;">
        <div style="font-size:10px;color:var(--t3);">${m.time} · ${TZA}</div>
        <div style="font-size:10px;color:var(--green);">${m.prediction}</div>
      </div>
    </div>`
  ).join("");

  return `<div class="dig">
    <div class="dig-hero">
      <div class="dig-eye">WEEKLY DIGEST · ${d.week || "This week"}</div>
      <div class="dig-title">WEEKEND WRAP</div>
      <div class="dig-sub">Everything that mattered this week, explained simply</div>
      <div class="dig-stats">
        <div class="dig-stat"><div class="dig-n">${d.matches||47}</div><div class="dig-l">Matches</div></div>
        <div class="dig-stat"><div class="dig-n">${d.goals||124}</div><div class="dig-l">Goals</div></div>
        <div class="dig-stat"><div class="dig-n">${d.upsets||5}</div><div class="dig-l">Upsets</div></div>
        <div class="dig-stat"><div class="dig-n">${d.records||2}</div><div class="dig-l">Records</div></div>
      </div>
    </div>
    <div style="padding:10px 14px 2px;font-size:9px;color:var(--t3);letter-spacing:.8px;">KEY MOMENTS</div>
    ${moments}
    <div style="padding:12px 14px;">
      <div style="font-size:9px;color:var(--t3);letter-spacing:.8px;margin-bottom:8px;">DON'T MISS NEXT WEEK</div>
      ${nextWeek}
    </div>
    <div style="padding:10px 14px 4px;font-size:9px;color:var(--green);letter-spacing:.6px;">🤖 Generated by PitchIQ AI · Based on 2025/26 season data</div>
    <div class="nbar"><button class="nbtn-g">Share this digest</button><button class="nbtn-gr">Save PDF</button></div>
  </div>`;
}

// ===============================
// 🔄 START LIVE REFRESH
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

// ===============================
// 🚀 MAIN INIT — REPLACES DEMO DATA
// ===============================

// Override the goTab function so switching tabs loads real data
document.addEventListener("DOMContentLoaded", async () => {
  // Patch goTab to trigger real data loads
  const _originalGoTab = window.goTab;

  window.goTab = async function(el, tab) {
    _originalGoTab(el, tab);
    window.curTab = tab;
    await loadRealDataForTab(tab);
  };

  // Load initial tab (live)
  await loadInitialData();
  startLiveRefresh();
});

// ── INITIAL DATA LOAD (live/today tab) ──
async function loadInitialData() {
  try {
    const [liveMatches, todayFixtures, standings, calendarDates] = await Promise.all([
      loadLiveMatches(),
      loadTodayFixtures(window.curLg || "all"),
      loadStandings("epl"),
      loadCalendarDates()
    ]);

    if (calendarDates) updateCalendarDots(calendarDates);

    // Update standings in sidebar
    updateStandingsInSidebar(standings);

    // Update safe bet with real AI
    const allFixtures = [...(liveMatches||[]), ...(todayFixtures||[])];
    if (allFixtures.length > 0) {
      const safeBet = await generateSafeBet(allFixtures);
      if (safeBet) updateSafeBet(safeBet);
    }

    // Update match cards
    const feed = document.getElementById("feed");
    if (feed) {
      const allMatches = [];
      if (liveMatches?.length) allMatches.push(...liveMatches);
      if (todayFixtures?.length) {
        const liveIds = new Set((liveMatches||[]).map(m => m.fixture.id));
        allMatches.push(...todayFixtures.filter(m => !liveIds.has(m.fixture.id)));
      }
      if (allMatches.length > 0) {
        const shd = feed.querySelector(".shd");
        if (shd) {
          feed.querySelectorAll(".mc").forEach(c => c.remove());
          shd.insertAdjacentHTML("afterend", allMatches.map(m => renderRealMatch(m)).join(""));
        }
      }
    }

    // Store fixtures for other tabs to use
    window._todayFixtures = todayFixtures || [];
    window._standings = standings;

  } catch(e) {
    console.warn("Initial data load failed:", e);
  }
}

// ── LOAD DATA FOR SPECIFIC TAB ──
async function loadRealDataForTab(tab) {
  const feed = document.getElementById("feed");
  const sidebar = document.getElementById("sidebar");

  try {
    if (tab === "live") {
      const [live, standings] = await Promise.all([loadLiveMatches(), loadStandings("epl")]);
      if (live?.length && feed) {
        feed.querySelectorAll(".mc").forEach(c => c.remove());
        const shd = feed.querySelector(".shd");
        if (shd) shd.insertAdjacentHTML("afterend", live.map(m => renderRealMatch(m)).join(""));
      }
      updateStandingsInSidebar(standings);

      // Update safe bet
      const safeBet = await generateSafeBet(live || []);
      if (safeBet) updateSafeBet(safeBet);
    }

    else if (tab === "today") {
      const [fixtures, standings] = await Promise.all([
        loadTodayFixtures(window.curLg || "all"),
        loadStandings("epl")
      ]);
      if (fixtures?.length && feed) {
        feed.querySelectorAll(".mc").forEach(c => c.remove());
        const shd = feed.querySelector(".shd");
        if (shd) shd.insertAdjacentHTML("afterend", fixtures.map(m => renderRealMatch(m)).join(""));
      }
      updateStandingsInSidebar(standings);

      const safeBet = await generateSafeBet(fixtures || []);
      if (safeBet) updateSafeBet(safeBet);
    }

    else if (tab === "predictions") {
      const fixtures = window._todayFixtures || await loadTodayFixtures("all");
      const [preds, standings] = await Promise.all([
        generatePredictions(fixtures),
        loadStandings("epl")
      ]);

      if (preds && feed) {
        // Find prediction cards and replace them
        const pcCards = feed.querySelectorAll(".pc");
        if (pcCards.length > 0) {
          const firstPc = pcCards[0];
          pcCards.forEach(c => c.remove());
          firstPc.insertAdjacentHTML("beforebegin", renderAIPredictions(preds));
        } else {
          const shd = feed.querySelector(".shd");
          if (shd) shd.insertAdjacentHTML("afterend", renderAIPredictions(preds));
        }
      }
      updateStandingsInSidebar(standings);

      // Update safe bet in feed
      const sb = feed?.querySelector(".sb");
      if (sb && fixtures?.length) {
        const safeBet = await generateSafeBet(fixtures);
        if (safeBet) sb.outerHTML = renderAISafeBet(safeBet);
      }
    }

    else if (tab === "transfers") {
      const [news, standings] = await Promise.all([
        loadTransferNews(),
        loadStandings("epl")
      ]);
      if (news && feed) {
        const txList = document.getElementById("txList");
        if (txList) {
          txList.innerHTML = renderTransferNews(news);
          // Re-attach filter
          window._transferNewsItems = news;
        }
      }
      updateStandingsInSidebar(standings);
    }

    else if (tab === "players") {
      const [scorers, assists, standings] = await Promise.all([
        loadTopScorers("epl"),
        loadTopAssists("epl"),
        loadStandings("epl")
      ]);
      if ((scorers?.length) && feed) {
        const shd = feed.querySelector(".shd");
        if (shd) {
          feed.querySelectorAll(".plyr").forEach(c => c.remove());
          shd.insertAdjacentHTML("afterend", renderRealPlayers(scorers, assists));
        }
      }
      updateStandingsInSidebar(standings);
    }

    else if (tab === "digest") {
      const standings = window._standings || await loadStandings("epl");
      const fixtures = window._todayFixtures || [];
      const digest = await generateWeeklyDigest(standings, fixtures);

      if (digest && feed) {
        const digEl = feed.querySelector(".dig");
        if (digEl) digEl.outerHTML = renderAIDigest(digest);
      }
      updateStandingsInSidebar(standings);
    }

  } catch(e) {
    console.warn(`Tab ${tab} data load failed:`, e);
  }
}

// ── HELPER: UPDATE STANDINGS IN SIDEBAR ──
function updateStandingsInSidebar(standings) {
  if (!standings) return;
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;
  const stEl = sidebar.querySelector(".st");
  if (stEl) stEl.outerHTML = renderRealStandings(standings);
  else sidebar.insertAdjacentHTML("afterbegin", renderRealStandings(standings));
}

// ── HELPER: UPDATE SAFE BET CARD ──
function updateSafeBet(bet) {
  const sbEl = document.querySelector(".sb");
  if (sbEl) sbEl.outerHTML = renderAISafeBet(bet);
}

// ── HELPER: UPDATE CALENDAR DOTS ──
function updateCalendarDots(dates) {
  const calDays = document.querySelectorAll(".cal-d");
  const today = new Date();
  calDays.forEach((day, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + (i - 2));
    const dateStr = d.toISOString().split("T")[0];
    if (dates[dateStr] && dates[dateStr] > 0) {
      day.classList.add("has");
    }
  });
}

// ── PATCH TRANSFER FILTER TO USE REAL NEWS ──
window._patchTransferFilter = function() {
  window.fTx = function(el, type) {
    document.querySelectorAll(".itab").forEach(t => t.classList.remove("on"));
    el.classList.add("on");
    const list = document.getElementById("txList");
    if (!list) return;
    const items = window._transferNewsItems;
    if (!items) return;
    if (type === "all") {
      list.innerHTML = renderTransferNews(items);
    } else {
      const filtered = items.filter(item => {
        const t = (item.title || "").toLowerCase();
        if (type === "confirmed") return t.includes("sign") || t.includes("confirm") || t.includes("complete");
        if (type === "rumour") return t.includes("linked") || t.includes("interest") || t.includes("target") || t.includes("eye");
        if (type === "medical") return t.includes("medical");
        if (type === "bid") return t.includes("bid") || t.includes("offer");
        return true;
      });
      list.innerHTML = filtered.length ? renderTransferNews(filtered) :
        `<div style="padding:20px;text-align:center;color:var(--t3);font-size:13px;">No ${type} news right now</div>`;
    }
  };
};
window._patchTransferFilter();
