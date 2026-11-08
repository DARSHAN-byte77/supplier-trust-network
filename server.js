const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    initDatabase();
  }
});

// Default initial suppliers list
const defaultSuppliers = [
  { name: 'Apex Cotton Mill', location: 'Gujarat', rating: 4.8, otif: 96, certification: 'ISO 9001 (Quality)', trustScore: 97, status: 'Verified' },
  { name: 'Deccan Fiber Corp', location: 'Telangana', rating: 4.5, otif: 91, certification: 'GOTS Organic', trustScore: 89, status: 'Verified' },
  { name: 'Kaveri Spinning Ltd', location: 'Karnataka', rating: 4.2, otif: 88, certification: 'ISO 9001 (Quality)', trustScore: 84, status: 'Verified' },
  { name: 'Vardhman Textiles', location: 'Punjab', rating: 4.9, otif: 98, certification: 'Fair Trade Certified', trustScore: 98, status: 'Verified' }
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, () => {
    // Check if table is empty
    db.get('SELECT COUNT(*) as count FROM suppliers', (err, row) => {
      if (row && row.count === 0) {
        console.log('Seeding initial supplier data into SQLite...');
        const stmt = db.prepare(`
          INSERT INTO suppliers (name, location, rating, otif, certification, trustScore, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        defaultSuppliers.forEach((s) => {
          stmt.run(s.name, s.location, s.rating, s.otif, s.certification, s.trustScore, s.status);
        });
        stmt.finalize();
        console.log('Initial suppliers successfully seeded.');
      }
    });
  });
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// GET Endpoint: Return suppliers list
app.get('/api/suppliers', (req, res) => {
  db.all('SELECT * FROM suppliers ORDER BY id DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Shared Add Supplier Handler
function addSupplierHandler(req, res) {
  const body = req.body;
  const name = body.name || body.supplierName || body['Supplier Name'];
  const location = body.location || body.Location || 'Karnataka';
  const rating = parseFloat(body.rating || body['Rating (1-5)'] || 4.5);
  const otif = parseFloat(body.otif || body['OTIF % (0-100)'] || 92);
  const certification = body.certification || body.cert || body['Cert: ISO 9001 (Quality)'] || 'ISO 9001 (Quality)';

  if (!name) {
    return res.status(400).json({ error: 'Supplier Name is required' });
  }

  const certBonus = (certification.includes('9001') || certification.includes('Quality') || certification.includes('Organic')) ? 20 : 10;
  const trustScore = Math.min(100, Math.round((rating / 5 * 40) + (otif * 0.4) + certBonus));
  const status = 'Verified';

  const sql = `
    INSERT INTO suppliers (name, location, rating, otif, certification, trustScore, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(sql, [name, location, rating, otif, certification, trustScore, status], function(err) {
    if (err) {
      console.error('Database insert error:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }
    const newEntry = { id: this.lastID, name, location, rating, otif, certification, trustScore, status };
    console.log('Supplier added:', newEntry);
    res.status(201).json(newEntry);
  });
}

app.post('/api/suppliers', addSupplierHandler);
app.post('/api/add-supplier', addSupplierHandler);

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});