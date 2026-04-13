// ═══════════════════════════════════════════
// PITCHIQ — REAL API DATA ENGINE
// API-Football v3 · api-sports.io
// ═══════════════════════════════════════════

const API = {
  KEY: '35f0bfdd839466bf99892dc805c57b94',
  BASE: 'https://v3.football.api-sports.io',
  cache: {},

  async fetch(endpoint, ttl = 3600000) {
    const key = endpoint;
    const now = Date.now();
    if (this.cache[key] && now - this.cache[key].ts < ttl) {
      return this.cache[key].data;
    }
    try {
      const res = await fetch(`${this.BASE}${endpoint}`, {
        headers: {
          'x-apisports-key': this.KEY,
          'x-rapidapi-host': 'v3.football.api-sports.io'
        }
      });
      const data = await res.json();
      if (data.response) {
        this.cache[key] = { data, ts: now };
      }
      return data;
    } catch(e) {
      console.warn('API error:', e);
      return null;
    }
  },

  // LEAGUE IDs for API-Football
  LEAGUES: {
    epl: 39,
    laliga: 140,
    bundesliga: 78,
    seriea: 135,
    ligue1: 61,
    ucl: 2,
    wc: 1,
    afcon: 6
  },

  SEASON: 2024,

  // Get today's live matches
  async getLiveMatches() {
    return await this.fetch('/fixtures?live=all', 30000); // 30 sec cache for live
  },

  // Get today's fixtures
  async getTodayFixtures(leagueId = null) {
    const today = new Date().toISOString().split('T')[0];
    const endpoint = leagueId
      ? `/fixtures?date=${today}&league=${leagueId}&season=${this.SEASON}`
      : `/fixtures?date=${today}`;
    return await this.fetch(endpoint, 300000); // 5 min cache
  },

  // Get fixtures for a date range (calendar)
  async getFixturesByDate(date) {
    return await this.fetch(`/fixtures?date=${date}&season=${this.SEASON}`, 3600000);
  },

  // Get standings for a league
  async getStandings(leagueId = 39) {
    return await this.fetch(`/standings?league=${leagueId}&season=${this.SEASON}`, 86400000);
  },

  // Get lineups for a fixture
  async getLineups(fixtureId) {
    return await this.fetch(`/fixtures/lineups?fixture=${fixtureId}`, 3600000);
  },

  // Get fixture statistics
  async getStats(fixtureId) {
    return await this.fetch(`/fixtures/statistics?fixture=${fixtureId}`, 60000);
  },

  // Get top scorers
  async getTopScorers(leagueId = 39) {
    return await this.fetch(`/players/topscorers?league=${leagueId}&season=${this.SEASON}`, 86400000);
  },

  // Get team info (includes logo)
  async getTeam(teamId) {
    return await this.fetch(`/teams?id=${teamId}`, 86400000 * 7); // weekly cache
  },

  // Get players for a team
  async getPlayers(teamId) {
    return await this.fetch(`/players?team=${teamId}&season=${this.SEASON}`, 86400000);
  },

  // Get injuries
  async getInjuries(leagueId = 39) {
    return await this.fetch(`/injuries?league=${leagueId}&season=${this.SEASON}`, 3600000);
  },

  // Get predictions for a fixture
  async getPredictions(fixtureId) {
    return await this.fetch(`/predictions?fixture=${fixtureId}`, 3600000);
  },

  // Get odds for a fixture
  async getOdds(fixtureId) {
    return await this.fetch(`/odds?fixture=${fixtureId}`, 3600000);
  },

  // Get head to head
  async getH2H(team1, team2) {
    return await this.fetch(`/fixtures/headtohead?h2h=${team1}-${team2}`, 86400000);
  },

  // Get transfers
  async getTransfers(teamId) {
    return await this.fetch(`/transfers?team=${teamId}`, 3600000);
  },

  // Format match data from API response
  formatMatch(fixture) {
    const f = fixture.fixture;
    const teams = fixture.teams;
    const goals = fixture.goals;
    const score = fixture.score;
    const league = fixture.league;

    const isLive = ['1H','HT','2H','ET','BT','P','SUSP','INT','LIVE'].includes(f.status.short);
    const isFT = ['FT','AET','PEN'].includes(f.status.short);

    return {
      id: f.id,
      lg: league.name,
      lc: '#38003c',
      lgLogo: league.logo,
      st: isLive ? 'live' : isFT ? 'ft' : 'up',
      min: f.status.elapsed ? `${f.status.elapsed}'` : f.status.short,
      time: new Date(f.date).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),
      h: teams.home.name,
      hc: '#' + Math.floor(Math.random()*16777215).toString(16), // will use logo instead
      hLogo: teams.home.logo,
      ha: teams.home.name.slice(0,3).toUpperCase(),
      hId: teams.home.id,
      a: teams.away.name,
      ac: '#888',
      aLogo: teams.away.logo,
      aa: teams.away.name.slice(0,3).toUpperCase(),
      aId: teams.away.id,
      hs: goals.home,
      as_: goals.away,
      fixtureId: f.id,
      venue: f.venue?.name,
      referee: f.referee
    };
  }
};

// ═══════════════════════════════════════════
// REAL DATA LOADERS — called by main app
// ═══════════════════════════════════════════

async function loadLiveMatches() {
  const data = await API.getLiveMatches();
  if (!data || !data.response) return null;
  return data.response.map(f => API.formatMatch(f));
}

async function loadTodayFixtures(leagueKey) {
  const leagueId = leagueKey && leagueKey !== 'all' ? API.LEAGUES[leagueKey] : null;
  const data = await API.getTodayFixtures(leagueId);
  if (!data || !data.response) return null;
  return data.response.map(f => API.formatMatch(f));
}

async function loadStandings(leagueKey = 'epl') {
  const leagueId = API.LEAGUES[leagueKey] || 39;
  const data = await API.getStandings(leagueId);
  if (!data || !data.response || !data.response[0]) return null;

  const standings = data.response[0].league.standings[0];
  return standings.map(s => ({
    pos: s.rank,
    n: s.team.name,
    logo: s.team.logo,
    c: '#888',
    p: s.all.played,
    gd: (s.goalsDiff > 0 ? '+' : '') + s.goalsDiff,
    pts: s.points,
    f: s.form ? s.form.split('').slice(-5) : []
  }));
}

async function loadLineups(fixtureId) {
  const data = await API.getLineups(fixtureId);
  if (!data || !data.response) return null;
  return data.response;
}

async function loadFixtureStats(fixtureId) {
  const data = await API.getStats(fixtureId);
  if (!data || !data.response) return null;
  return data.response;
}

async function loadCalendarDates() {
  // Get fixtures for next 7 days to populate calendar
  const dates = [];
  const today = new Date();
  const results = {};

  for (let i = -2; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    dates.push(dateStr);
  }

  // Batch check which dates have fixtures (use 1 call)
  const data = await API.fetch(`/fixtures?season=${API.SEASON}&from=${dates[0]}&to=${dates[dates.length-1]}`, 3600000);
  if (data && data.response) {
    data.response.forEach(f => {
      const d = f.fixture.date.split('T')[0];
      results[d] = (results[d] || 0) + 1;
    });
  }

  return results;
}

async function loadTopScorers() {
  const data = await API.getTopScorers(39); // EPL
  if (!data || !data.response) return null;
  return data.response.slice(0, 10).map(p => ({
    name: p.player.name,
    photo: p.player.photo,
    team: p.statistics[0].team.name,
    teamLogo: p.statistics[0].team.logo,
    goals: p.statistics[0].goals.total,
    assists: p.statistics[0].goals.assists,
    rating: p.statistics[0].games.rating
  }));
}

// ═══════════════════════════════════════════
// RENDER WITH REAL LOGOS
// ═══════════════════════════════════════════

function renderTeamBadge(logoUrl, name, color, size = 22) {
  if (logoUrl) {
    return `<img src="${logoUrl}" alt="${name}" style="width:${size}px;height:${size}px;object-fit:contain;border-radius:50%;" onerror="this.outerHTML='<div style=\'width:${size}px;height:${size}px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:${Math.floor(size*0.4)}px;font-weight:700;color:#fff;\'>${name.slice(0,2).toUpperCase()}</div>'">`; 
  }
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:${Math.floor(size*0.4)}px;font-weight:700;color:#fff;">${name.slice(0,2).toUpperCase()}</div>`;
}

function renderRealMatch(m) {
  const isLv = m.st === 'live', isFT = m.st === 'ft';
  const sc = isLv ? 'lv' : isFT ? 'ft' : 'up';
  const st = isLv ? m.min : isFT ? 'FT' : m.time;
  const s1 = m.hs != null ? m.hs : '–';
  const s2 = m.as_ != null ? m.as_ : '–';

  return `<div class="mc" onclick="openMatch(${m.id})">
    <div class="mc-lg">
      ${m.lgLogo ? `<img src="${m.lgLogo}" style="width:14px;height:14px;object-fit:contain;border-radius:2px;">` : `<div class="mc-lg-dot" style="background:#38003c;"></div>`}
      ${m.lg}
    </div>
    <div class="mc-row">
      <div class="mc-min ${sc}">${st}</div>
      <div class="mc-teams">
        <div class="mc-team">${renderTeamBadge(m.hLogo, m.h, '#c8102e')}<span class="mc-tname">${m.h}</span></div>
        <div class="mc-team">${renderTeamBadge(m.aLogo, m.a, '#034694')}<span class="mc-tname${isFT && m.hs > m.as_ ? ' dim' : ''}">${m.a}</span></div>
      </div>
      <div class="mc-s">
        <div class="mc-score">${s1}</div>
        <div class="mc-score${isFT && m.as_ < m.hs ? ' dim' : ''}">${s2}</div>
      </div>
      <div class="mc-right"><div class="mc-chev">›</div></div>
    </div>
  </div>`;
}

function renderRealStandings(standings) {
  if (!standings) return '';
  return `<div class="st">
    <div class="st-hd">Premier League Table</div>
    <div style="display:flex;padding:4px 14px;border-bottom:0.5px solid var(--border);">
      <div style="min-width:18px;"></div>
      <div style="flex:1;font-size:9px;color:var(--t3);padding-left:8px;">Club</div>
      <div style="min-width:22px;text-align:center;font-size:9px;color:var(--t3);">P</div>
      <div style="min-width:22px;text-align:center;font-size:9px;color:var(--t3);">GD</div>
      <div style="min-width:22px;text-align:center;font-size:9px;color:var(--t3);">Pts</div>
      <div style="min-width:58px;text-align:center;font-size:9px;color:var(--t3);">Form</div>
    </div>
    ${standings.map((s, i) => `<div class="st-row${i < 4 ? ' hl' : ''}">
      <div class="st-pos">${s.pos}</div>
      ${s.logo ? `<img src="${s.logo}" style="width:14px;height:14px;object-fit:contain;flex-shrink:0;">` : `<div class="st-dot" style="background:${s.c};"></div>`}
      <div class="st-name">${s.n}</div>
      <div class="st-num">${s.p}</div>
      <div class="st-num">${s.gd}</div>
      <div class="st-pts">${s.pts}</div>
      <div class="st-form">${(s.f || []).map(f => `<div class="sf sf-${f.toLowerCase()}">${f}</div>`).join('')}</div>
    </div>`).join('')}
    <div class="st-foot">View full table →</div>
  </div>`;
}

// ═══════════════════════════════════════════
// AUTO-REFRESH ENGINE
// ═══════════════════════════════════════════

let liveRefreshInterval = null;

function startLiveRefresh() {
  if (liveRefreshInterval) clearInterval(liveRefreshInterval);
  liveRefreshInterval = setInterval(async () => {
    const feed = document.getElementById('feed');
    if (!feed) return;
    // Only refresh if on live tab
    if (window.curTab !== 'live') return;
    await refreshLiveScores();
  }, 60000); // every 60 seconds
}

async function refreshLiveScores() {
  const matches = await loadLiveMatches();
  if (!matches || matches.length === 0) return;

  // Update scores in existing cards without full re-render
  matches.forEach(m => {
    const card = document.querySelector(`[data-fixture="${m.id}"]`);
    if (card) {
      const scores = card.querySelectorAll('.mc-score');
      if (scores[0]) scores[0].textContent = m.hs ?? '–';
      if (scores[1]) scores[1].textContent = m.as_ ?? '–';
      const minEl = card.querySelector('.mc-min');
      if (minEl) minEl.textContent = m.min || m.time;
    }
  });
}

function openMatch(fixtureId) {
  // Could expand to show match detail modal
  console.log('Opening match:', fixtureId);
}

console.log('PitchIQ API Engine loaded ✅');
