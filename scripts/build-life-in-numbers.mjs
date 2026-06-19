/**
 * Builds docs/data/life-in-numbers.json for the "My Life in Numbers"
 * dashboard on the About Me page. Run by .github/workflows/life-in-numbers.yml.
 *
 * Secrets/inputs come from environment variables (never hardcode keys here):
 *   GH_USER, LASTFM_USER, STEAMID, PSN_USER - public identifiers (set in the workflow)
 *   LASTFM_API_KEY, STEAM_API_KEY  - secrets (set in repo Actions secrets)
 *   GITHUB_TOKEN                   - provided automatically by Actions
 *
 * Notes on what each source can actually provide:
 *   - GitHub: commit counts by date range via the Search API (any range).
 *   - Last.fm: scrobble counts by date range via getRecentTracks from/to (any range).
 *   - Steam: only TOTAL hours + last-2-weeks. Arbitrary ranges are derived by
 *     diffing daily snapshots we accumulate over time, so 7d/30d/... stay null
 *     until enough history exists. "All Time" (total hours) is available immediately.
 *   - PSN: scraped from PSNProfiles public profile. Returns all-time totals only
 *     (platinum count + total trophies). No range filtering available.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';

const GH_USER = process.env.GH_USER || 'aaronpolar';
const LASTFM_USER = process.env.LASTFM_USER || 'ralop8';
const STEAMID = process.env.STEAMID || '76561198139249206';
const PSN_USER = process.env.PSN_USER || 'ralop8';
const LASTFM_KEY = process.env.LASTFM_API_KEY;
const STEAM_KEY = process.env.STEAM_API_KEY;
const GH_TOKEN = process.env.GITHUB_TOKEN;

const OUT = 'docs/data/life-in-numbers.json';
const RANGES = ['7d', '30d', '90d', '180d', 'ytd', 'all'];
const now = new Date();

function startOf(range) {
  const d = new Date(now);
  if (range === '7d') d.setDate(d.getDate() - 7);
  else if (range === '30d') d.setDate(d.getDate() - 30);
  else if (range === '90d') d.setDate(d.getDate() - 90);
  else if (range === '180d') d.setDate(d.getDate() - 180);
  else if (range === 'ytd') return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  else if (range === 'all') return null;
  return d;
}

async function githubCommits(since) {
  let q = `author:${GH_USER}`;
  if (since) q += ` committer-date:>=${since.toISOString().slice(0, 10)}`;
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'life-in-numbers' };
  if (GH_TOKEN) headers.Authorization = `Bearer ${GH_TOKEN}`;
  const res = await fetch(
    `https://api.github.com/search/commits?q=${encodeURIComponent(q)}&per_page=1`,
    { headers }
  );
  if (!res.ok) throw new Error('github ' + res.status);
  const j = await res.json();
  return j.total_count ?? null;
}

async function lastfmScrobbles(since) {
  if (!LASTFM_KEY) return null;
  let url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(LASTFM_USER)}&api_key=${LASTFM_KEY}&format=json&limit=1&to=${Math.floor(now.getTime() / 1000)}`;
  if (since) url += `&from=${Math.floor(since.getTime() / 1000)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('lastfm ' + res.status);
  const j = await res.json();
  const total = j && j.recenttracks && j.recenttracks['@attr'] && j.recenttracks['@attr'].total;
  return total != null ? Number(total) : null;
}

async function psnTrophies(username) {
  const res = await fetch(`https://psnprofiles.com/${encodeURIComponent(username)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });
  if (!res.ok) throw new Error('psnprofiles HTTP ' + res.status);
  const html = await res.text();

  function pick(pattern) {
    const m = html.match(pattern);
    return m ? parseInt(m[1].replace(/,/g, ''), 10) : null;
  }

  // PSNProfiles renders trophy counts in a <ul class="stats"> block.
  // Each <li> has a trophy type class followed by a <b> count.
  const platinum =
    pick(/trophy-s platinum[\s\S]{1,300}<b>([\d,]+)<\/b>/i) ||
    pick(/class="[^"]*platinum[^"]*"[\s\S]{1,300}<b>([\d,]+)<\/b>/i) ||
    pick(/<b>([\d,]+)<\/b>[^<]*<\/p>[^<]*<p[^>]*>\s*Platinum/i);

  // "Total" is sometimes its own stat; fall back to summing the four types.
  let total =
    pick(/trophy-s total[\s\S]{1,300}<b>([\d,]+)<\/b>/i) ||
    pick(/<b>([\d,]+)<\/b>[^<]*<\/p>[^<]*<p[^>]*>\s*Total/i);

  if (total === null) {
    const gold   = pick(/trophy-s gold[\s\S]{1,300}<b>([\d,]+)<\/b>/i);
    const silver = pick(/trophy-s silver[\s\S]{1,300}<b>([\d,]+)<\/b>/i);
    const bronze = pick(/trophy-s bronze[\s\S]{1,300}<b>([\d,]+)<\/b>/i);
    if (platinum !== null && gold !== null && silver !== null && bronze !== null) {
      total = platinum + gold + silver + bronze;
    }
  }

  console.log(`PSN ${username}: platinum=${platinum} total=${total}`);
  return { platinum, total };
}

async function steamTotals() {
  if (!STEAM_KEY) return null;
  const res = await fetch(
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_KEY}&steamid=${STEAMID}&include_played_free_games=1&format=json`
  );
  if (!res.ok) throw new Error('steam ' + res.status);
  const j = await res.json();
  const games = (j && j.response && j.response.games) || [];
  let total = 0, two = 0;
  for (const g of games) { total += g.playtime_forever || 0; two += g.playtime_2weeks || 0; }
  return { total, two };
}

// Carry forward Steam snapshot history.
let prev = {};
if (existsSync(OUT)) { try { prev = JSON.parse(readFileSync(OUT, 'utf8')); } catch (e) {} }
const steamHistory = Array.isArray(prev.steamHistory) ? prev.steamHistory : [];

const out = {
  updated: now.toISOString(),
  metrics: { github: { ranges: {} }, lastfm: { ranges: {} }, steam: { ranges: {} }, psn: {} },
  steamHistory
};

for (const r of RANGES) {
  const since = startOf(r);
  try { out.metrics.github.ranges[r] = await githubCommits(since); }
  catch (e) { out.metrics.github.ranges[r] = null; console.error('github', r, e.message); }
  try { out.metrics.lastfm.ranges[r] = await lastfmScrobbles(since); }
  catch (e) { out.metrics.lastfm.ranges[r] = null; console.error('lastfm', r, e.message); }
}

try {
  const s = await steamTotals();
  if (s) {
    const today = now.toISOString().slice(0, 10);
    const existing = steamHistory.find((h) => h.date === today);
    if (existing) existing.totalMinutes = s.total;
    else steamHistory.push({ date: today, totalMinutes: s.total });
    while (steamHistory.length > 400) steamHistory.shift();
    out.steamHistory = steamHistory;

    out.metrics.steam.twoWeekHours = Math.round((s.two / 60) * 10) / 10;
    out.metrics.steam.ranges.all = Math.round(s.total / 60);
    for (const r of ['7d', '30d', '90d', '180d', 'ytd']) {
      const since = startOf(r);
      const baseline = steamHistory
        .filter((h) => new Date(h.date) <= since)
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      out.metrics.steam.ranges[r] = baseline
        ? Math.max(0, Math.round((s.total - baseline.totalMinutes) / 60))
        : null;
    }
  }
} catch (e) {
  console.error('steam', e.message);
  out.metrics.steam.ranges.all = null;
}

try {
  const psn = await psnTrophies(PSN_USER);
  out.metrics.psn = { platinum: psn.platinum, total: psn.total };
} catch (e) {
  console.error('psn', e.message);
  out.metrics.psn = { platinum: null, total: null };
}

mkdirSync('docs/data', { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log('Wrote', OUT);
