const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();

// Middleware for parsing JSON requests and serving static frontend files
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Initialize SQLite Database connection
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at database.sqlite');
  }
});

// Serve main frontend dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API Route: Get Supplier Trust Network Data
app.get('/api/suppliers', (req, res) => {
  db.all('SELECT * FROM suppliers', [], (err, rows) => {
    if (err || !rows || rows.length === 0) {
      // Fallback to suppliers.json if database table is empty or uninitialized
      const suppliersJsonPath = path.join(__dirname, 'suppliers.json');
      if (fs.existsSync(suppliersJsonPath)) {
        try {
          const data = fs.readFileSync(suppliersJsonPath, 'utf8');
          return res.json(JSON.parse(data));
        } catch (parseErr) {
          return res.status(500).json({ error: 'Error reading suppliers.json file' });
        }
      }
      return res.status(500).json({ error: 'No supplier data available' });
    }
    res.json(rows);
  });
});

// Health check endpoint for Render health checks
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Dynamic Port and Host Binding required for Render deployment
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is listening on port ${PORT}`);
});