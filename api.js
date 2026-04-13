// ===============================
// 🔑 UPDATED CONFIG FOR 2025/26
// ===============================
const CURRENT_SEASON = 2025; // API-Sports uses 2025 for the 25/26 season
const API_KEY = "35f0bfdd839466bf99892dc805c57b94";

// Update your fetch calls to use ${CURRENT_SEASON}
async function fetchMatches(date = null, leagueId = null) {
    const d = date || new Date().toISOString().split('T')[0];
    const url = `${BASE_URL}/fixtures?date=${d}${leagueId ? `&league=${leagueId}` : ''}&season=${CURRENT_SEASON}`;
    // ... rest of your fetch code
}

// Fix the Calendar highlights
function updateCalendar(dates) {
  const calDays = document.querySelectorAll(".cal-d");
  const today = new Date();
  calDays.forEach((day, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + (i - 2)); // Centers "Today"
    const dateStr = d.toISOString().split("T")[0];
    day.setAttribute('data-date', dateStr);
    if (dates[dateStr]) day.classList.add("has");
  });
}
