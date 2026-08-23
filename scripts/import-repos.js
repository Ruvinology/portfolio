#!/usr/bin/env node
/**
 * Generates data/projects.json from your public GitHub repositories.
 *
 *   node scripts/import-repos.js              # uses GITHUB_USER from .env
 *   node scripts/import-repos.js Ruvinology   # or pass the username directly
 *   node scripts/import-repos.js --all        # include forks and archived repos
 *
 * The existing projects.json is backed up to projects.json.bak first.
 * Categories and icons are guessed from repo names, topics and language --
 * treat them as a starting point and correct them by hand afterwards.
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const args     = process.argv.slice(2);
const includeAll = args.includes('--all');
const user     = args.find(a => !a.startsWith('--')) || process.env.GITHUB_USER;
const token    = process.env.GITHUB_TOKEN || '';

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT      = path.join(DATA_DIR, 'projects.json');

if (!user) {
  console.error('No username. Add GITHUB_USER to .env or pass it as an argument:');
  console.error('  node scripts/import-repos.js Ruvinology');
  process.exit(1);
}

// ── Category guessing ───────────────────────────────────────
// Ordered most-specific first; the first match wins.
const RULES = [
  ['nlp', /nlp|text|sentiment|bert|llm|language|token|spacy|chatbot|summar/],
  ['dl',  /deep|cnn|rnn|lstm|neural|torch|tensorflow|transformer|vision|gan|yolo/],
  ['viz', /viz|visual|dashboard|plot|chart|tableau|powerbi|streamlit|d3/],
  ['ml',  /\bml\b|model|predict|classif|regress|forecast|sklearn|xgboost|churn|recommend|cluster/],
  ['eda', /eda|analysis|analytics|explor|dataset|scrap|clean|pipeline|etl/],
];

const ICONS = {
  ml:  ['🤖', 'rgba(6,182,212,0.15)'],
  eda: ['📊', 'rgba(124,58,237,0.15)'],
  nlp: ['🧠', 'rgba(245,158,11,0.15)'],
  viz: ['📈', 'rgba(124,58,237,0.15)'],
  dl:  ['⚡', 'rgba(245,158,11,0.15)'],
};

const TAG_COLORS = {
  Python: 'violet', R: 'violet', SQL: 'violet', Java: 'violet',
  'Jupyter Notebook': 'cyan', HTML: 'cyan', CSS: 'cyan', JavaScript: 'cyan',
};

function guessCategories(repo) {
  const haystack = [repo.name, repo.description || '', ...(repo.topics || [])]
    .join(' ').toLowerCase();
  const hits = RULES.filter(([, re]) => re.test(haystack)).map(([cat]) => cat);
  return hits.length ? [...new Set(hits)].slice(0, 2) : ['eda'];
}

function titleCase(name) {
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bMl\b/g, 'ML').replace(/\bEda\b/g, 'EDA')
    .replace(/\bNlp\b/g, 'NLP').replace(/\bApi\b/g, 'API');
}

async function gh(endpoint) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ruvin-portfolio-import',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com${endpoint}`, { headers });
  if (res.status === 403) {
    throw new Error('rate limited by GitHub — add GITHUB_TOKEN to .env and retry');
  }
  if (res.status === 404) throw new Error(`user "${user}" not found`);
  if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
  return res.json();
}

(async () => {
  if (typeof fetch !== 'function') {
    console.error('Node 18+ required (needs global fetch). You have ' + process.version);
    process.exit(1);
  }

  console.log(`Fetching repositories for ${user}...`);
  const repos = await gh(`/users/${user}/repos?per_page=100&sort=pushed`);

  const kept = repos.filter(r => includeAll || (!r.fork && !r.archived));
  if (!kept.length) {
    console.error('No repositories matched. Try --all to include forks and archived repos.');
    process.exit(1);
  }

  const projects = kept.map((r, i) => {
    const categories = guessCategories(r);
    const [icon, iconBg] = ICONS[categories[0]] || ICONS.eda;
    const tags = [];
    if (r.language) tags.push({ label: r.language, color: TAG_COLORS[r.language] || 'violet' });
    (r.topics || []).slice(0, 2).forEach(t => tags.push({ label: titleCase(t), color: 'cyan' }));

    return {
      id: i + 1,
      icon,
      iconBg,
      title: titleCase(r.name),
      description: r.description || 'TODO: one line on the problem, your approach, and the result.',
      categories,
      tags,
      github: r.html_url,
      demo: r.homepage || '',
    };
  });

  if (fs.existsSync(OUT)) {
    fs.copyFileSync(OUT, OUT + '.bak');
    console.log('Backed up existing projects.json -> projects.json.bak');
  }
  fs.writeFileSync(OUT, JSON.stringify(projects, null, 2) + '\n');

  console.log(`\nWrote ${projects.length} projects to data/projects.json\n`);
  projects.forEach(p => console.log(`  ${p.title.padEnd(34)} [${p.categories.join(', ')}]`));
  console.log('\nNext: open data/projects.json and fix the titles, descriptions and');
  console.log('categories. The guesses are rough — the descriptions especially.');
})().catch(err => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
