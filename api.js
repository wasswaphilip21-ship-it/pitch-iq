// ===============================
// 🔑 CORE CONFIG - 2025/26 SEASON
// ===============================
const API_KEY = "35f0bfdd839466bf99892dc805c57b94";
const BASE_URL = "https://v3.football.api-sports.io";
const CURRENT_SEASON = 2025; // This gets the current 25/26 live data
const HEADERS = { "x-apisports-key": API_KEY };

const LEAGUE_MAP = {
  epl: 39, laliga: 140, seriea: 135, bundesliga: 78,
  ligue1: 61, ucl: 2, uel: 3, all: null
};

// ===============================
// 🚀 DATA FETCHING
// ===============================

async function fetchMatches(date = null, leagueId = null) {
    const d = date || new Date().toISOString().split('T')[0];
    // Force the 2025 season in the URL
    let url = `${BASE_URL}/fixtures?date=${d}&season=${CURRENT_SEASON}`;
    if (leagueId) url += `&league=${leagueId}`;

    try {
        const res = await fetch(url, { headers: HEADERS });
        const json = await res.json();
        renderMatches(json.response || []);
    } catch (err) {
        console.error("Match fetch failed", err);
    }
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    fetchMatches(); // Loads today's matches for current season
    // Update the calendar dates relative to today
    if(window.updateCalendar) updateCalendar({}); 
});

// [Rest of your rendering functions like renderMatches, renderStandings, etc.]
