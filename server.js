const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();

// Middleware for parsing JSON & form data, and serving static frontend files
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Initialize SQLite Database
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    initDatabase();
  }
});

// Create table and populate initial seed data if empty
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
    // Seed initial data from suppliers.json if table is empty
    db.get('SELECT COUNT(*) as count FROM suppliers', (err, row) => {
      if (row && row.count === 0) {
        const suppliersJsonPath = path.join(__dirname, 'suppliers.json');
        if (fs.existsSync(suppliersJsonPath)) {
          try {
            const initialData = JSON.parse(fs.readFileSync(suppliersJsonPath, 'utf8'));
            const stmt = db.prepare(`
              INSERT INTO suppliers (name, location, rating, otif, certification, trustScore, status)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            initialData.forEach((s) => {
              const rating = parseFloat(s.rating || s.Rating || 4.0);
              const otif = parseFloat(s.otif || s.OTIF || 90);
              const cert = s.certification || s.Cert || 'ISO 9001';
              const trustScore = Math.round((rating / 5 * 40) + (otif * 0.4) + 20);
              stmt.run(
                s.name || s.supplierName || 'Sample Supplier',
                s.location || 'India',
                rating,
                otif,
                cert,
                s.trustScore || trustScore,
                s.status || 'Verified'
              );
            });
            stmt.finalize();
            console.log('Initial suppliers loaded into SQLite database.');
          } catch (e) {
            console.error('Error seeding suppliers.json:', e);
          }
        }
      }
    });
  });
}

// Serve main frontend HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// GET Endpoint: Fetch all suppliers
app.get('/api/suppliers', (req, res) => {
  db.all('SELECT * FROM suppliers ORDER BY id DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Shared handler for adding suppliers
function addSupplierHandler(req, res) {
  const body = req.body;
  const name = body.name || body.supplierName || body['Supplier Name'];
  const location = body.location || body.Location || 'Global';
  const rating = parseFloat(body.rating || body['Rating (1-5)'] || 4.0);
  const otif = parseFloat(body.otif || body['OTIF % (0-100)'] || 90);
  const certification = body.certification || body.cert || body['Cert: ISO 9001 (Quality)'] || 'ISO 9001';

  if (!name) {
    return res.status(400).json({ error: 'Supplier Name is required' });
  }

  // Calculate Trust Engine Score: Rating (40%) + OTIF (40%) + Certification (20%)
  const certBonus = (certification.includes('9001') || certification.includes('Quality')) ? 20 : 10;
  const trustScore = Math.round((rating / 5 * 40) + (otif * 0.4) + certBonus);
  const status = 'Verified';

  const sql = `
    INSERT INTO suppliers (name, location, rating, otif, certification, trustScore, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(sql, [name, location, rating, otif, certification, trustScore, status], function(err) {
    if (err) {
      console.error('Error inserting supplier:', err.message);
      return res.status(500).json({ error: 'Database insertion error' });
    }
    const createdSupplier = {
      id: this.lastID,
      name,
      location,
      rating,
      otif,
      certification,
      trustScore,
      status
    };
    console.log('Supplier added:', createdSupplier);
    res.status(201).json(createdSupplier);
  });
}

// POST Endpoints: Listen for form submissions from button click
app.post('/api/suppliers', addSupplierHandler);
app.post('/api/add-supplier', addSupplierHandler);

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Dynamic Port and Host Binding
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});