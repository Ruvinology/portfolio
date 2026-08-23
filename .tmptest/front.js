
    // ══ Preloader ══ (added — delete this block + its markup and CSS to revert)
    // Progress is driven by real load milestones, not a fake timer. A slow creep
    // keeps it from ever looking frozen, and a hard cap guarantees it always exits.
    // Failsafe: whatever else happens, the page is usable after 6s. Guards against
    // the preloader script throwing and leaving the visitor on a locked overlay.
    setTimeout(function () {
      document.documentElement.classList.remove('is-loading');
      const stuck = document.getElementById('preloader');
      if (stuck) stuck.remove();
    }, 6000);

    (function initPreloader() {
      const root = document.documentElement;
      if (!root.classList.contains('is-loading')) return;   // skipped this session

      const el    = document.getElementById('preloader');
      const bar   = el.querySelector('.pl-bar');
      const pctEl = el.querySelector('.pl-pct');

      const CIRC   = 339.29;   // 2πr, matches stroke-dasharray
      const MAX_MS = 2400;     // never hold the visitor longer than this
      const STEP   = 25;       // four milestones × 25 = 100
      const t0     = performance.now();

      let target = 0, shown = 0, finished = false;
      const advance = () => { target = Math.min(target + STEP, 100); };

      // Milestone 1: webfonts ready (prevents a text-swap flash behind the curtain)
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(advance);
      else advance();
      // Milestone 2: all subresources loaded
      window.addEventListener('load', advance);
      // Milestones 3 & 4: the two API fetches (dispatched from loadProjects/loadCerts)
      document.addEventListener('rp:projects-loaded', advance);
      document.addEventListener('rp:certs-loaded', advance);

      function finish() {
        if (finished) return;
        finished = true;
        try { sessionStorage.setItem('rp-preloaded', '1'); } catch (e) {}
        setTimeout(() => {
          el.style.display = 'flex';       // keep it painted through the fade
          el.classList.add('is-done');
          root.classList.remove('is-loading');  // unlocks scroll, starts hero cascade
          setTimeout(() => el.remove(), 650);
        }, 280);                            // brief hold on 100% before lifting
      }

      requestAnimationFrame(function tick() {
        if (performance.now() - t0 > MAX_MS) target = 100;   // hard cap

        // Creep ahead of confirmed progress, but stall at 92 until genuinely done
        const ceiling = target >= 100 ? 100 : Math.min(target + 8, 92);
        shown += (ceiling - shown) * 0.08;
        if (target >= 100 && 100 - shown < 0.5) shown = 100;

        const v = Math.min(Math.round(shown), 100);
        pctEl.textContent = v + '%';
        bar.style.strokeDashoffset = CIRC * (1 - v / 100);

        if (v >= 100) { finish(); return; }
        requestAnimationFrame(tick);
      });
    })();

    // ══ Command palette ══ (added — delete this block + its markup and CSS to revert)
    (function initCmdK() {
      const root    = document.getElementById('cmdk');
      const input   = document.getElementById('cmdk-input');
      const list    = document.getElementById('cmdk-list');
      const openBtn = document.getElementById('cmdk-open');
      const isMac   = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

      document.getElementById('cmdk-key').textContent = isMac ? '⌘ K' : 'Ctrl K';

      const go = id => () => document.getElementById(id)
        .scrollIntoView({ behavior: PREFERS_REDUCED ? 'auto' : 'smooth' });

      const applyFilter = cat => () => {
        const btn = document.querySelector(`.filter-btn[data-filter="${cat}"]`);
        if (btn) btn.click();
        document.getElementById('projects').scrollIntoView({ behavior: PREFERS_REDUCED ? 'auto' : 'smooth' });
      };

      const open = url => () => window.open(url, '_blank', 'noopener');

      const COMMANDS = [
        { icon: '◆', label: 'About',            group: 'Go to', run: go('about') },
        { icon: '◆', label: 'Skills',           group: 'Go to', run: go('skills') },
        { icon: '◆', label: 'Projects',         group: 'Go to', run: go('projects') },
        { icon: '◆', label: 'Certifications',   group: 'Go to', run: go('certifications') },
        { icon: '◆', label: 'Contact',          group: 'Go to', run: go('contact') },

        { icon: '⁂', label: 'All projects',     group: 'Filter', run: applyFilter('all') },
        { icon: '⁂', label: 'Machine Learning', group: 'Filter', run: applyFilter('ml') },
        { icon: '⁂', label: 'EDA',              group: 'Filter', run: applyFilter('eda') },
        { icon: '⁂', label: 'NLP',              group: 'Filter', run: applyFilter('nlp') },
        { icon: '⁂', label: 'Data Viz',         group: 'Filter', run: applyFilter('viz') },
        { icon: '⁂', label: 'Deep Learning',    group: 'Filter', run: applyFilter('dl') },

        { icon: '⬡', label: 'GitHub',   group: 'Open', run: open('https://github.com/yourusername') },
        { icon: '⬡', label: 'LinkedIn', group: 'Open', run: open('https://linkedin.com/in/yourusername') },
        { icon: '⬡', label: 'Kaggle',   group: 'Open', run: open('https://kaggle.com/yourusername') },

        { icon: '⬇', label: 'Download CV', group: 'Action', run: () => document.querySelector('.nav-cv').click() },
        { icon: '✉', label: 'Send a message', group: 'Action', run: () => {
            document.getElementById('contact').scrollIntoView({ behavior: PREFERS_REDUCED ? 'auto' : 'smooth' });
            setTimeout(() => document.getElementById('name').focus(), PREFERS_REDUCED ? 0 : 600);
          } },
      ];

      let results = COMMANDS.slice();
      let active  = 0;
      let lastFocus = null;

      // Subsequence match, so "mlrn" still finds "Machine Learning"
      function score(query, text) {
        const q = query.toLowerCase(), t = text.toLowerCase();
        if (!q) return 0;
        if (t.startsWith(q)) return 3;
        if (t.includes(q))   return 2;
        let i = 0;
        for (const ch of t) if (ch === q[i]) i++;
        return i === q.length ? 1 : -1;
      }

      function render() {
        if (!results.length) {
          list.innerHTML = '<li class="cmdk-empty" role="presentation">No matching commands</li>';
          return;
        }
        list.innerHTML = results.map((cmd, i) => `
          <li role="option" id="cmdk-opt-${i}" data-i="${i}" aria-selected="${i === active}">
            <span class="ck-icon">${cmd.icon}</span>
            <span>${esc(cmd.label)}</span>
            <span class="ck-group">${esc(cmd.group)}</span>
          </li>`).join('');
        const sel = list.querySelector('[aria-selected="true"]');
        if (sel) sel.scrollIntoView({ block: 'nearest' });
        input.setAttribute('aria-activedescendant', results.length ? `cmdk-opt-${active}` : '');
      }

      function filter() {
        const q = input.value.trim();
        results = !q
          ? COMMANDS.slice()
          : COMMANDS
              .map(cmd => ({ cmd, s: Math.max(score(q, cmd.label), score(q, cmd.group)) }))
              .filter(r => r.s > 0)
              .sort((a, b) => b.s - a.s)
              .map(r => r.cmd);
        active = 0;
        render();
      }

      function openPalette() {
        lastFocus = document.activeElement;
        root.hidden = false;
        document.body.style.overflow = 'hidden';
        input.value = '';
        filter();
        input.focus();
      }

      function closePalette() {
        root.hidden = true;
        document.body.style.overflow = '';
        if (lastFocus && lastFocus.focus) lastFocus.focus();   // restore focus
      }

      function runActive() {
        const cmd = results[active];
        if (!cmd) return;
        closePalette();
        cmd.run();
      }

      // Global shortcut
      document.addEventListener('keydown', e => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          root.hidden ? openPalette() : closePalette();
        } else if (e.key === 'Escape' && !root.hidden) {
          closePalette();
        }
      });

      openBtn.addEventListener('click', openPalette);
      root.querySelector('[data-cmdk-close]').addEventListener('click', closePalette);
      input.addEventListener('input', filter);

      input.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown')      { e.preventDefault(); active = (active + 1) % Math.max(results.length, 1); render(); }
        else if (e.key === 'ArrowUp')   { e.preventDefault(); active = (active - 1 + results.length) % Math.max(results.length, 1); render(); }
        else if (e.key === 'Enter')     { e.preventDefault(); runActive(); }
        else if (e.key === 'Tab')       { e.preventDefault(); }   // keep focus inside the dialog
      });

      list.addEventListener('click', e => {
        const li = e.target.closest('li[data-i]');
        if (!li) return;
        active = Number(li.dataset.i);
        runActive();
      });

      list.addEventListener('mousemove', e => {
        const li = e.target.closest('li[data-i]');
        if (!li || Number(li.dataset.i) === active) return;
        active = Number(li.dataset.i);
        render();
      });
    })();

    // ══ Animations ══ (added — delete this block + the matching CSS block to revert)
    const PREFERS_REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const HAS_IO = 'IntersectionObserver' in window;

    const revealObserver = HAS_IO
      ? new IntersectionObserver((entries, obs) => {
          entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            el.classList.add('is-visible');
            obs.unobserve(el);             // reveal once, then stop watching
            // Once the reveal has played, strip the classes so the element's
            // own hover transition (transition: all) isn't overridden.
            const delay = parseFloat(el.style.transitionDelay) || 0;
            setTimeout(() => {
              el.classList.remove('reveal', 'is-visible');
              el.style.transitionDelay = '';
            }, 700 + delay);
          });
        }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' })
      : null;

    // Reveal a set of elements. `stagger` (ms) offsets each one in sequence.
    function reveal(elements, stagger = 0) {
      const els = Array.from(elements);
      if (PREFERS_REDUCED || !revealObserver) {
        els.forEach(el => el.classList.remove('reveal'));    // show immediately
        return;
      }
      els.forEach((el, i) => {
        if (stagger) el.style.transitionDelay = `${i * stagger}ms`;
        revealObserver.observe(el);
      });
    }

    // Count a stat from 0 up to its value, e.g. "10+" or "2nd"
    function countUp(el) {
      const raw = el.dataset.value || el.textContent.trim();
      el.dataset.value = raw;
      const match = raw.match(/^(\d+)(.*)$/);
      if (!match) return;                       // skip non-numeric stats like "∞"
      const target   = Number(match[1]);
      const suffix   = match[2];
      // Skip ordinals like "2nd" — counting would render "0nd", "1nd" mid-way
      if (/^[a-z]/i.test(suffix)) return;
      const duration = 1100;
      let startTime  = null;

      el.textContent = '0' + suffix;
      requestAnimationFrame(function step(now) {
        if (startTime === null) startTime = now;
        const p = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);   // ease-out cubic
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(step);
      });
    }

    function initCounters() {
      if (!HAS_IO || PREFERS_REDUCED) return;   // leave the static values in place
      const obs = new IntersectionObserver((entries, o) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          countUp(entry.target);
          o.unobserve(entry.target);
        });
      }, { threshold: 0.5 });
      document.querySelectorAll('.stat-number').forEach(el => obs.observe(el));
    }

    function initAnimations() {
      reveal(document.querySelectorAll('.reveal:not(.skill-tag)'));
      reveal(document.querySelectorAll('.skill-tag'), 40);   // staggered chips
      initCounters();
    }

    // ══ Live GitHub data ══ (added)
    // Escape anything coming back from the GitHub API before it touches innerHTML
    function esc(str) {
      return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    const LANG_COLORS = {
      'Python': '#7c3aed', 'Jupyter Notebook': '#06b6d4', 'R': '#f59e0b',
      'JavaScript': '#fbbf24', 'TypeScript': '#38bdf8', 'HTML': '#f87171',
      'CSS': '#60a5fa', 'Shell': '#a78bfa', 'SQL': '#34d399',
    };
    const FALLBACK_COLORS = ['#7c3aed', '#06b6d4', '#f59e0b', '#8888a8'];
    const langColor = (name, i) => LANG_COLORS[name] || FALLBACK_COLORS[i % FALLBACK_COLORS.length];

    function timeAgo(iso) {
      if (!iso) return '';                    // new Date(null) is epoch 0, not invalid
      const secs = (Date.now() - new Date(iso)) / 1000;
      if (!isFinite(secs) || secs < 0) return '';
      if (secs < 3600)   return `${Math.max(1, Math.round(secs / 60))}m ago`;
      if (secs < 86400)  return `${Math.round(secs / 3600)}h ago`;
      const days = Math.round(secs / 86400);
      if (days < 30)     return `${days}d ago`;
      const months = Math.round(days / 30);
      if (months < 12)   return `${months}mo ago`;
      return `${Math.round(months / 12)}y ago`;
    }

    // Live language bar + repo stats. Falls back to the static tags in
    // projects.json whenever GitHub data isn't available.
    function ghBlock(p) {
      const gh = p.gh;
      if (!gh || !gh.languages || !gh.languages.length) {
        return `
          <div class="project-tags">
            ${p.tags.map(t => `<span class="ptag ${t.color === 'cyan' ? 'cyan' : t.color === 'amber' ? 'amber' : ''}">${esc(t.label)}</span>`).join('')}
          </div>`;
      }
      const bar = gh.languages.map((l, i) =>
        `<span style="width:${l.pct}%;background:${langColor(l.label, i)}" title="${esc(l.label)} ${l.pct}%"></span>`
      ).join('');
      const legend = gh.languages.slice(0, 3).map((l, i) =>
        `<i style="color:${langColor(l.label, i)}">${esc(l.label)} ${l.pct}%</i>`
      ).join('');
      const updated = timeAgo(gh.pushedAt);

      return `
        <div class="lang-bar">${bar}</div>
        <div class="lang-legend">${legend}</div>
        <div class="gh-meta">
          <span class="gh-live">live</span>
          ${gh.stars ? `<span>★ ${gh.stars}</span>` : ''}
          ${gh.forks ? `<span>⑂ ${gh.forks}</span>` : ''}
          ${updated ? `<span>updated ${updated}</span>` : ''}
        </div>`;
    }

    // ── Render projects from API ────────────────────────────
    async function loadProjects() {
      const grid = document.getElementById('projects-grid');
      try {
        const res  = await fetch('/api/projects');
        const data = await res.json();
        grid.innerHTML = data.map((p, i) => `
          <div class="project-card reveal" data-category="${p.categories.join(' ')}">
            <div class="project-header">
              <div class="project-icon" style="background: ${p.iconBg}">${p.icon}</div>
              <span class="project-number">${String(i + 1).padStart(2, '0')}</span>
            </div>
            <div class="project-title">${p.title}</div>
            <p class="project-desc">${esc((p.gh && p.gh.description) || p.description)}</p>
            ${ghBlock(p)}
            <div class="project-links">
              ${p.github ? `<a href="${p.github}" target="_blank" rel="noopener" class="project-link">⬡ GitHub</a>` : ''}
              ${p.demo   ? `<a href="${p.demo}"   target="_blank" rel="noopener" class="project-link">↗ Live Demo</a>` : ''}
            </div>
          </div>
        `).join('');
        reveal(grid.querySelectorAll('.project-card'), 60);   // staggered cascade
        initFilter();
      } catch (e) {
        grid.innerHTML = '<p style="color:var(--muted)">Could not load projects.</p>';
      } finally {
        // Tell the preloader this milestone is done — even on failure, so a dead
        // API can never leave the visitor stuck behind the curtain.
        document.dispatchEvent(new Event('rp:projects-loaded'));
      }
    }

    // ── Render certs from API ──────────────────────────────
    async function loadCerts() {
      const grid = document.getElementById('certs-grid');
      try {
        const res  = await fetch('/api/certs');
        const data = await res.json();
        grid.innerHTML = data.map(c => `
          <a href="${c.url}" target="_blank" class="cert-card reveal">
            <div class="cert-icon">${c.icon}</div>
            <div class="cert-info">
              <div class="cert-name">${c.name}</div>
              <div class="cert-issuer">${c.issuer}</div>
              <div class="cert-date">${c.date}</div>
            </div>
            <span class="cert-badge">Verified</span>
          </a>
        `).join('');
        reveal(grid.querySelectorAll('.cert-card'), 60);      // staggered cascade
      } catch (e) {
        grid.innerHTML = '<p style="color:var(--muted)">Could not load certifications.</p>';
      } finally {
        document.dispatchEvent(new Event('rp:certs-loaded'));
      }
    }

    // ── Project filter ─────────────────────────────────────
    function initFilter() {
      const btns  = document.querySelectorAll('.filter-btn');
      const cards = document.querySelectorAll('.project-card');
      btns.forEach(btn => {
        btn.addEventListener('click', () => {
          btns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const f = btn.dataset.filter;
          cards.forEach(card => {
            const cats = card.dataset.category ? card.dataset.category.split(' ') : [];
            card.classList.toggle('hidden', f !== 'all' && !cats.includes(f));
          });
        });
      });
    }

    // ── Contact form ───────────────────────────────────────
    document.getElementById('contact-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn    = document.getElementById('submit-btn');
      const status = document.getElementById('form-status');
      btn.textContent = 'Sending...';
      btn.disabled = true;
      status.className = 'form-status';

      const body = {
        name:    document.getElementById('name').value,
        email:   document.getElementById('email').value,
        message: document.getElementById('message').value,
      };

      try {
        const res  = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (res.ok) {
          status.textContent = '✓ Message sent! I\'ll get back to you soon.';
          status.className   = 'form-status success';
          e.target.reset();
        } else {
          throw new Error(data.error);
        }
      } catch (err) {
        status.textContent = `✗ ${err.message || 'Something went wrong. Please try again.'}`;
        status.className   = 'form-status error';
      } finally {
        btn.textContent = '✉ Send Message';
        btn.disabled    = false;
      }
    });

    // ── Init ───────────────────────────────────────────────
    initAnimations();
    loadProjects();
    loadCerts();
  