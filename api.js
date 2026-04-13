// ===============================
// 🔑 CONFIG
// ===============================
const API_KEY = "35f0bfdd839466bf99892dc805c57b94";
const BASE_URL = "https://v3.football.api-sports.io";

const HEADERS = {
    "x-apisports-key": API_KEY
};

// ===============================
// ⚡ SIMPLE CACHE SYSTEM
// ===============================
function setCache(key, data, expiryMinutes) {
    const item = {
        data: data,
        expiry: Date.now() + expiryMinutes * 60 * 1000
    };
    localStorage.setItem(key, JSON.stringify(item));
}

function getCache(key) {
    const item = localStorage.getItem(key);
    if (!item) return null;

    const parsed = JSON.parse(item);
    if (Date.now() > parsed.expiry) {
        localStorage.removeItem(key);
        return null;
    }

    return parsed.data;
}

// ===============================
// 🌍 FETCH HELPER
// ===============================
async function fetchAPI(endpoint, cacheKey, cacheMinutes = 10) {
    const cached = getCache(cacheKey);
    if (cached) return cached;

    try {
        const res = await fetch(`${BASE_URL}${endpoint}`, {
            method: "GET",
            headers: HEADERS
        });

        const data = await res.json();
        setCache(cacheKey, data, cacheMinutes);

        return data;
    } catch (err) {
        console.error("API ERROR:", err);
        return null;
    }
}

// ===============================
// ⚽ GET TODAY MATCHES
// ===============================
async function getTodayMatches() {
    const today = new Date().toISOString().split("T")[0];

    const data = await fetchAPI(
        `/fixtures?date=${today}`,
        "today_matches",
        10 // cache 10 mins
    );

    return data?.response || [];
}

// ===============================
// 📊 GET STANDINGS
// ===============================
async function getStandings(leagueId = 39) { // EPL default
    const data = await fetchAPI(
        `/standings?league=${leagueId}&season=2024`,
        `standings_${leagueId}`,
        60 // cache 1 hour
    );

    return data?.response || [];
}

// ===============================
// 🧍 GET LINEUPS
// ===============================
async function getLineups(fixtureId) {
    const data = await fetchAPI(
        `/fixtures/lineups?fixture=${fixtureId}`,
        `lineups_${fixtureId}`,
        60
    );

    return data?.response || [];
}

// ===============================
// 🎯 RENDER MATCHES TO PAGE
// ===============================
async function loadMatches() {
    const container = document.getElementById("matches");

    if (!container) return;

    container.innerHTML = "Loading matches...";

    const matches = await getTodayMatches();

    if (!matches || matches.length === 0) {
        container.innerHTML = "No matches today.";
        return;
    }

    container.innerHTML = "";

    matches.forEach(match => {
        const home = match.teams.home;
        const away = match.teams.away;
        const goals = match.goals;

        const el = document.createElement("div");
        el.className = "match-card";

        el.innerHTML = `
            <div class="team">
                <img src="${home.logo}" width="24">
                ${home.name}
            </div>

            <div class="score">
                ${goals.home ?? 0} - ${goals.away ?? 0}
            </div>

            <div class="team">
                <img src="${away.logo}" width="24">
                ${away.name}
            </div>
        `;

        container.appendChild(el);
    });
}

// ===============================
// 🔄 AUTO REFRESH LIVE MATCHES
// ===============================
function startLiveUpdates() {
    loadMatches();
    setInterval(loadMatches, 60000); // every 60s
}

// ===============================
// 🚀 INIT
// ===============================
document.addEventListener("DOMContentLoaded", () => {
    startLiveUpdates();
});