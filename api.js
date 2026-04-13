const API_KEY = "35f0bfdd839466bf99892dc805c57b94";
const BASE_URL = "https://v3.football.api-sports.io";
const CURRENT_SEASON = 2025; 

const LEAGUE_MAP = {
    epl: 39, laliga: 140, seriea: 135, bundesliga: 78
};

async function fetchMatches(leagueKey = 'epl') {
    const leagueId = LEAGUE_MAP[leagueKey];
    const container = document.getElementById('matches-container');
    container.innerHTML = '<div style="text-align:center; padding:20px;">Updating Matches...</div>';

    try {
        const today = new Date().toISOString().split('T')[0];
        const res = await fetch(`${BASE_URL}/fixtures?date=${today}&league=${leagueId}&season=${CURRENT_SEASON}`, {
            headers: { "x-apisports-key": API_KEY }
        });
        const data = await res.json();
        renderMatches(data.response);
    } catch (err) {
        container.innerHTML = "Error loading matches.";
    }
}

function renderMatches(matches) {
    const container = document.getElementById('matches-container');
    if (!matches || matches.length === 0) {
        container.innerHTML = '<div class="card">No matches scheduled for today in this league.</div>';
        return;
    }

    container.innerHTML = matches.map(m => `
        <div class="card">
            <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--green); margin-bottom:10px;">
                <span>${m.fixture.status.long}</span>
                <span>${m.league.name}</span>
            </div>
            <div style="display:flex; justify-content:space-around; align-items:center;">
                <div style="text-align:center; width:30%;">
                    <img src="${m.teams.home.logo}" width="40"><br>
                    <span style="font-size:14px;">${m.teams.home.name}</span>
                </div>
                <div style="font-size:24px; font-weight:bold;">
                    ${m.goals.home ?? 0} : ${m.goals.away ?? 0}
                </div>
                <div style="text-align:center; width:30%;">
                    <img src="${m.teams.away.logo}" width="40"><br>
                    <span style="font-size:14px;">${m.teams.away.name}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    fetchMatches('epl');
});
