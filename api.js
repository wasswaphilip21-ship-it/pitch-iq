const API_KEY = "35f0bfdd839466bf99892dc805c57b94";
const BASE_URL = "https://v3.football.api-sports.io";
const HEADERS = { "x-apisports-key": API_KEY };
const SEASON = 2025; // Locked to current season

const LEAGUE_MAP = {
  epl: 39, laliga: 140, seriea: 135, bundesliga: 78
};

async function fetchAPI(endpoint) {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, { headers: HEADERS });
    return await res.json();
  } catch(err) {
    console.error("API ERROR:", err);
    return null;
  }
}

async function loadTodayFixtures(lgKey = "epl") {
  const today = new Date().toISOString().split("T")[0];
  const leagueId = LEAGUE_MAP[lgKey] || 39;
  const data = await fetchAPI(`/fixtures?date=${today}&league=${leagueId}&season=${SEASON}`);
  return data?.response || [];
}

async function generatePredictions(fixtures) {
  if (!fixtures || fixtures.length === 0) return null;

  // This uses a mock return for now to prevent "Claude API" errors 
  // until you hook up your own backend proxy.
  return fixtures.slice(0, 5).map(f => ({
    match: `${f.teams.home.name} vs ${f.teams.away.name}`,
    outcome: Math.random() > 0.5 ? "Home Win" : "Away Win",
    win: Math.floor(Math.random() * 40) + 40,
    reason: "Based on recent goal conversion and defensive stability in 2025."
  }));
}

// Export functions to window so index.html can see them
window.loadTodayFixtures = loadTodayFixtures;
window.generatePredictions = generatePredictions;
