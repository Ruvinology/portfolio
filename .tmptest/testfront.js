// Re-declare the pure helpers exactly as they appear in index.html
const src = require('fs').readFileSync('./front.js','utf8');

function grab(name, kind) {
  const re = new RegExp(kind === 'fn'
    ? `function ${name}\\([\\s\\S]*?\\n    \\}`
    : `const ${name} = [\\s\\S]*?;\\n`, 'm');
  const m = re.exec(src);
  if (!m) throw new Error('could not extract ' + name);
  return m[0];
}

eval(grab('esc','fn'));
eval(grab('timeAgo','fn'));

let fail = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok?'PASS':'FAIL'}  ${label.padEnd(34)} -> ${JSON.stringify(got)}`);
};

// esc: the XSS guard on GitHub-sourced strings
check('esc script tag',   esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
check('esc quotes',       esc(`"a'b"`), '&quot;a&#39;b&quot;');
check('esc ampersand',    esc('a & b'), 'a &amp; b');
check('esc null',         esc(null), '');
check('esc undefined',    esc(undefined), '');

// timeAgo: relative last-updated stamps
const now = Date.now();
check('timeAgo 5 min',    timeAgo(new Date(now - 5*60e3).toISOString()), '5m ago');
check('timeAgo 3 hours',  timeAgo(new Date(now - 3*3600e3).toISOString()), '3h ago');
check('timeAgo 3 days',   timeAgo(new Date(now - 3*86400e3).toISOString()), '3d ago');
check('timeAgo 60 days',  timeAgo(new Date(now - 60*86400e3).toISOString()), '2mo ago');
check('timeAgo 2 years',  timeAgo(new Date(now - 730*86400e3).toISOString()), '2y ago');
check('timeAgo invalid',  timeAgo(null), '');
check('timeAgo undefined',timeAgo(undefined), '');

console.log(fail ? `\n${fail} FAILED` : '\nall frontend helper cases pass');
