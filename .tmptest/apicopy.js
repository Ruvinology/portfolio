const express = require('express');
const path    = require('path');
const fs      = require('fs');
const router  = express.Router();

// ── GitHub integration ──────────────────────────────────────
// Repo stats are fetched server-side and cached in memory. GitHub allows only
// 60 unauthenticated requests per hour per IP, so without caching a handful of
// page loads would exhaust the quota. With a token that rises to 5,000/hour.
const GH_USER   = process.env.GITHUB_USER  || '';
const GH_TOKEN  = process.env.GITHUB_TOKEN || '';
const CACHE_TTL = 60 * 60 * 1000;   // 1 hour for successful lookups
const FAIL_TTL  =  5 * 60 * 1000;   // 5 minutes before retrying a failure

const cache = new Map();            // "owner/name" -> { data, expires }

// Helper: read a JSON data file
function readData(filename) {
  const filePath = path.join(__dirname, '..', 'data', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// Work out "owner/name" from either an explicit `repo` field or the github URL
function resolveRepo(project) {
  if (project.repo) {
    return project.repo.includes('/')
      ? project.repo
      : (GH_USER ? `${GH_USER}/${project.repo}` : null);
  }
  const match = /github\.com\/([^/]+)\/([^/?#]+)/.exec(project.github || '');
  if (!match) return null;
  const owner = match[1];
  const name  = match[2].replace(/\.git$/, '');
  // Ignore the untouched placeholder values shipped in projects.json
  if (owner === 'yourusername' || name === 'repo') return null;
  return `${owner}/${name}`;
}

async function ghFetch(endpoint) {
  if (typeof fetch !== 'function') {
    throw new Error('global fetch unavailable - Node 18+ required');
  }
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ruvin-portfolio',
  };
  if (GH_TOKEN) headers.Authorization = `Bearer ${GH_TOKEN}`;

  const res = await fetch(`https://api.github.com${endpoint}`, { headers });
  if (!res.ok) throw new Error(`GitHub responded ${res.status} for ${endpoint}`);
  return res.json();
}

async function getRepoStats(fullName) {
  if (!fullName) return null;

  const cached = cache.get(fullName);
  if (cached && cached.expires > Date.now()) return cached.data;

  try {
    const [meta, langBytes] = await Promise.all([
      ghFetch(`/repos/${fullName}`),
      ghFetch(`/repos/${fullName}/languages`),
    ]);

    const total = Object.values(langBytes).reduce((a, b) => a + b, 0) || 1;
    const languages = Object.entries(langBytes)
      .map(([label, bytes]) => ({ label, pct: Math.round((bytes / total) * 1000) / 10 }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 4);

    const data = {
      fullName,
      url:         meta.html_url,
      description: meta.description,
      stars:       meta.stargazers_count,
      forks:       meta.forks_count,
      pushedAt:    meta.pushed_at,
      languages,
    };

    cache.set(fullName, { data, expires: Date.now() + CACHE_TTL });
    return data;
  } catch (err) {
    console.warn(`[github] ${fullName}: ${err.message}`);
    // Prefer stale data over no data - a rate limit shouldn't blank the cards
    if (cached && cached.data) {
      cached.expires = Date.now() + FAIL_TTL;
      return cached.data;
    }
    cache.set(fullName, { data: null, expires: Date.now() + FAIL_TTL });
    return null;
  }
}

// GET /api/projects
router.get('/projects', async (req, res) => {
  try {
    const projects = readData('projects.json');
    const { category } = req.query;

    // Optional filter: /api/projects?category=ml
    const list = (category && category !== 'all')
      ? projects.filter(p => p.categories.includes(category))
      : projects;

    // Enrich each project with live GitHub data (null if unavailable)
    const enriched = await Promise.all(
      list.map(async p => ({ ...p, gh: await getRepoStats(resolveRepo(p)) }))
    );

    res.json(enriched);
  } catch (err) {
    console.error('[api] projects:', err.message);
    res.status(500).json({ error: 'Could not load projects' });
  }
});

// GET /api/certs
router.get('/certs', (req, res) => {
  try {
    res.json(readData('certs.json'));
  } catch (err) {
    res.status(500).json({ error: 'Could not load certifications' });
  }
});

// GET /api/github-status - quick way to check the integration is working
router.get('/github-status', (req, res) => {
  res.json({
    authenticated: Boolean(GH_TOKEN),
    defaultUser:   GH_USER || null,
    cached:        Array.from(cache.keys()),
  });
});

module.exports = router;
module.exports._resolveRepo = resolveRepo;
