require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const apiRouter     = require('./routes/api');
const contactRouter = require('./routes/contact');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ──────────────────────────────────────────────
app.use('/api', apiRouter);
app.use('/api/contact', contactRouter);

// ── Catch-all: serve index.html for any unknown route ──────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Portfolio running at http://localhost:${PORT}`);
});
