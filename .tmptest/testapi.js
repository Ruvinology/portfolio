process.env.GITHUB_USER = 'mandini';
const r = require('./apicopy.js')._resolveRepo;
const cases = [
  [{ github: 'https://github.com/yourusername/repo' }, null,                  'placeholder ignored'],
  [{ github: 'https://github.com/ruvin/sales-forecast' }, 'ruvin/sales-forecast', 'parsed from url'],
  [{ github: 'https://github.com/ruvin/proj.git' }, 'ruvin/proj',             '.git stripped'],
  [{ repo: 'owner/name' }, 'owner/name',                                       'explicit full'],
  [{ repo: 'justname' }, 'mandini/justname',                                   'prefixed w/ GITHUB_USER'],
  [{}, null,                                                                   'no source'],
  [{ github: 'not a url' }, null,                                              'unparseable'],
];
let fail = 0;
for (const [input, want, label] of cases) {
  const got = r(input);
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(24)} -> ${JSON.stringify(got)}`);
}
console.log(fail ? `\n${fail} FAILED` : '\nall resolveRepo cases pass');
