const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Database connection error:', err.message);
  else {
    console.log('Connected to SQLite database.');
    initDatabase();
  }
});

// Initial seed suppliers matching target layout
const defaultSuppliers = [
  { name: 'Darshan', location: 'Tumkur', rating: 5.0, otif: 100, certification: 'ISO 9001', trustScore: 100, status: 'Pending Verification ⚡', txHash: '0x843ac74a0bb5288' },
  { name: 'Vardhman Textiles', location: 'Punjab', rating: 4.9, otif: 98, certification: 'ISO 9001', trustScore: 98, status: 'Pending Verification ⚡', txHash: '0x71b9e29a10fc33d1' },
  { name: 'Apex Cotton Mill', location: 'Gujarat', rating: 4.8, otif: 96, certification: 'ISO 9001', trustScore: 97, status: 'Pending Verification ⚡', txHash: '0x9043ac74a0bb5288' },
  { name: 'Deccan Fiber Corp', location: 'Telangana', rating: 4.5, otif: 91, certification: 'ISO 9001', trustScore: 92, status: 'Pending Verification ⚡', txHash: '0x32a19b48c0df11e5' },
  { name: 'Kaveri Spinning Ltd', location: 'Karnataka', rating: 4.2, otif: 88, certification: 'ISO 9001', trustScore: 89, status: 'Pending Verification ⚡', txHash: '0x15f8a02d4e8c9b3a' }
];

function initDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      location TEXT,
      rating REAL,
      otif REAL,
      certification TEXT,
      trustScore REAL,
      status TEXT,
      txHash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, () => {
    db.get('SELECT COUNT(*) as count FROM suppliers', (err, row) => {
      if (row && row.count === 0) {
        const stmt = db.prepare(`
          INSERT INTO suppliers (name, location, rating, otif, certification, trustScore, status, txHash)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        defaultSuppliers.forEach((s) => {
          stmt.run(s.name, s.location, s.rating, s.otif, s.certification, s.trustScore, s.status, s.txHash);
        });
        stmt.finalize();
      }
    });
  });
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/api/suppliers', (req, res) => {
  db.all('SELECT * FROM suppliers ORDER BY trustScore DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

function addSupplierHandler(req, res) {
  const body = req.body;
  const name = body.name || body.supplierName;
  const location = body.location || 'India';
  const rating = parseFloat(body.rating || 4.5);
  const otif = parseFloat(body.otif || 95);
  const certification = body.certification || 'ISO 9001';

  if (!name) return res.status(400).json({ error: 'Supplier Name required' });

  const certBonus = (certification.includes('9001') || certification.includes('Quality') || certification.includes('ISO')) ? 20 : 10;
  const trustScore = Math.min(100, Math.round((rating / 5 * 40) + (otif * 0.4) + certBonus));
  const status = 'Pending Verification ⚡';
  const txHash = '0x' + Math.random().toString(16).substr(2, 14);

  const sql = `
    INSERT INTO suppliers (name, location, rating, otif, certification, trustScore, status, txHash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(sql, [name, location, rating, otif, certification, trustScore, status, txHash], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, name, location, rating, otif, certification, trustScore, status, txHash });
  });
}

app.post('/api/suppliers', addSupplierHandler);
app.post('/api/add-supplier', addSupplierHandler);

app.delete('/api/suppliers/:id', (req, res) => {
  db.run('DELETE FROM suppliers WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Deleted successfully' });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server listening on port ${PORT}`));