// ===============================
// 🔑 CONFIG
// ===============================
const API_KEY = "35f0bfdd839466bf99892dc805c57b94";
const BASE_URL = "https://v3.football.api-sports.io";
const HEADERS = {
    "x-apisports-key": API_KEY
};

// ===============================
// 🏆 TOP LEAGUES FILTER
// ===============================
const TOP_LEAGUES = [
    39,   // EPL
    140,  // La Liga
    135,  // Serie A
    78,   // Bundesliga
    61,   // Ligue 1
    2,    // UEFA Champions League
    3,    // UEFA Europa League
    848,  // UEFA Conference League
    253,  // MLS
    307,  // Saudi Pro League
];

// ===============================
// ⚡ SIMPLE CACHE SYSTEM
// ===============================
function setCache(key, data, expiryMinutes) {
    const item = {
        data: data,
        expiry: Date.now() + expiryMinutes * 60 * 1000
    };
    try {
        localStorage.setItem(key, JSON.stringify(item));
    } catch(e) {
        // Storage full — ignore
    }
}

function getCache(key) {
    try {
        const item = localStorage.getItem(key);
        if (!item) return null;
        const parsed = JSON.parse(item);
        if (Date.now() > parsed.expiry) {
            localStorage.removeItem(key);
            return null;
        }
        return parsed.data;
    } catch(e) {
        return null;
    }
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
        if (data?.errors && Object.keys(data.errors).length > 0) {
            console.warn("API returned errors:", data.errors);
        }
        setCache(cacheKey, data, cacheMinutes);
        return data;
    } catch (err) {
        console.error("API ERROR:", err);
        return null;
    }
}

// ===============================
// ⚽ GET LIVE MATCHES (checked first)
// ===============================
async function getLiveMatches() {
    const data = await fetchAPI(
        `/fixtures?live=all`,
        "live_matches",
        1 // cache only 1 min — live data changes fast
    );
    const all = data?.response || [];
    // Filter to top leagues only
    return all.filter(m => TOP_LEAGUES.includes(m.league.id));
}

// ===============================
// 📅 GET TODAY'S MATCHES (fallback)
// ===============================
async function getTodayMatches() {
    const today = new Date().toISOString().split("T")[0];
    const data = await fetchAPI(
        `/fixtures?date=${today}`,
        `today_matches_${today}`,
        10
    );
    const all = data?.response || [];
    // Filter to top leagues only
    return all.filter(m => TOP_LEAGUES.includes(m.league.id));
}

// ===============================
// 📅 GET UPCOMING MATCHES (final fallback)
// ===============================
async function getUpcomingMatches() {
    const data = await fetchAPI(
        `/fixtures?next=10`,
        "upcoming_matches",
        30
    );
    const all = data?.response || [];
    return all.filter(m => TOP_LEAGUES.includes(m.league.id));
}

// ===============================
// 📊 GET STANDINGS — FIXED season=2025
// ===============================
async function getStandings(leagueId = 39) {
    const data = await fetchAPI(
        `/standings?league=${leagueId}&season=2025`,
        `standings_${leagueId}_2025`,
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
// 🎨 FORMAT MATCH STATUS
// ===============================
function formatStatus(fixture) {
    const status = fixture.status.short;
    const elapsed = fixture.status.elapsed;

    switch(status) {
        case "1H":
        case "2H":
        case "ET":
            return `<span class="status live">🔴 ${elapsed}'</span>`;
        case "HT":
            return `<span class="status live">🔴 HT</span>`;
        case "FT":
            return `<span class="status ft">FT</span>`;
        case "NS": {
            // Show kickoff time in local timezone
            const time = new Date(fixture.date).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
            });
            return `<span class="status upcoming">${time}</span>`;
        }
        case "PST":
            return `<span class="status postponed">Postponed</span>`;
        case "CANC":
            return `<span class="status postponed">Cancelled</span>`;
        default:
            return `<span class="status">${status}</span>`;
    }
}

// ===============================
// 🎯 RENDER MATCHES TO PAGE
// ===============================
async function loadMatches() {
    const container = document.getElementById("matches");
    if (!container) return;

    container.innerHTML = `<p class="loading-text">Loading matches...</p>`;

    // 1️⃣ Try live matches first
    let matches = await getLiveMatches();
    let mode = "live";

    // 2️⃣ Fall back to today's matches
    if (!matches || matches.length === 0) {
        matches = await getTodayMatches();
        mode = "today";
    }

    // 3️⃣ Fall back to upcoming
    if (!matches || matches.length === 0) {
        matches = await getUpcomingMatches();
        mode = "upcoming";
    }

    if (!matches || matches.length === 0) {
        container.innerHTML = `<p class="no-matches">No matches found right now. Check back soon!</p>`;
        return;
    }

    // Group matches by league
    const byLeague = {};
    matches.forEach(match => {
        const leagueKey = match.league.id;
        if (!byLeague[leagueKey]) {
            byLeague[leagueKey] = {
                info: match.league,
                matches: []
            };
        }
        byLeague[leagueKey].matches.push(match);
    });

    container.innerHTML = "";

    // Add a mode banner
    const banner = document.createElement("div");
    banner.className = "mode-banner";
    if (mode === "live") {
        banner.innerHTML = `🔴 Live Now`;
    } else if (mode === "today") {
        banner.innerHTML = `📅 Today's Matches`;
    } else {
        banner.innerHTML = `⏳ Upcoming Matches`;
    }
    container.appendChild(banner);

    // Render league groups
    Object.values(byLeague).forEach(league => {
        const leagueBlock = document.createElement("div");
        leagueBlock.className = "league-block";

        leagueBlock.innerHTML = `
            <div class="league-header">
                <img src="${league.info.logo}" width="20" height="20" alt="">
                <span>${league.info.name}</span>
                <span class="league-country">${league.info.country}</span>
            </div>
        `;

        league.matches.forEach(match => {
            const home = match.teams.home;
            const away = match.teams.away;
            const goals = match.goals;
            const status = formatStatus(match.fixture);

            const card = document.createElement("div");
            card.className = "match-card";
            card.innerHTML = `
                <div class="team home-team">
                    <img src="${home.logo}" width="22" height="22" alt="${home.name}">
                    <span>${home.name}</span>
                </div>
                <div class="match-center">
                    <div class="score">
                        ${goals.home ?? "-"} : ${goals.away ?? "-"}
                    </div>
                    ${status}
                </div>
                <div class="team away-team">
                    <span>${away.name}</span>
                    <img src="${away.logo}" width="22" height="22" alt="${away.name}">
                </div>
            `;
            leagueBlock.appendChild(card);
        });

        container.appendChild(leagueBlock);
    });
}

// ===============================
// 🔄 AUTO REFRESH
// ===============================
function startLiveUpdates() {
    loadMatches();
    // Refresh every 60s if live, every 5 mins otherwise
    setInterval(() => {
        // Clear live cache so we always get fresh live data
        localStorage.removeItem("live_matches");
        loadMatches();
    }, 60000);
}

// ===============================
// 🚀 INIT
// ===============================
document.addEventListener("DOMContentLoaded", () => {
    startLiveUpdates();
});
