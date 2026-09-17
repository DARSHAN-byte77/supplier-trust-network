const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

let db;

// Initialize SQLite Database and Table
(async () => {
  db = await open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      rating REAL DEFAULT 4.0,
      verified INTEGER DEFAULT 0,
      location TEXT DEFAULT 'Unspecified'
    )
  `);

  const count = await db.get('SELECT COUNT(*) as count FROM suppliers');
  if (count.count === 0) {
    await db.run('INSERT INTO suppliers (name, rating, verified, location) VALUES (?, ?, ?, ?)', ['Apex Logistics', 4.8, 1, 'Bangalore']);
    await db.run('INSERT INTO suppliers (name, rating, verified, location) VALUES (?, ?, ?, ?)', ['Global Freight Co', 4.2, 0, 'Mumbai']);
  }
})();

function calculateTrustScore(rating, verified) {
  const ratingScore = (rating / 5) * 60;
  const verificationScore = verified ? 40 : 10;
  return Math.round(ratingScore + verificationScore);
}

// GET: Retrieve all suppliers
app.get('/api/suppliers', async (req, res) => {
  const suppliers = await db.all('SELECT * FROM suppliers');
  const result = suppliers.map(s => ({
    ...s,
    verified: Boolean(s.verified),
    trustScore: calculateTrustScore(s.rating, s.verified)
  }));
  res.json(result);
});

// GET: Summary Statistics
app.get('/api/stats', async (req, res) => {
  const suppliers = await db.all('SELECT * FROM suppliers');
  if (suppliers.length === 0) {
    return res.json({ total: 0, verifiedCount: 0, avgTrust: 0 });
  }

  const total = suppliers.length;
  const verifiedCount = suppliers.filter(s => s.verified).length;
  const totalTrust = suppliers.reduce((acc, s) => acc + calculateTrustScore(s.rating, s.verified), 0);
  const avgTrust = Math.round(totalTrust / total);

  res.json({ total, verifiedCount, avgTrust });
});

// POST: Add new supplier
app.post('/api/suppliers', async (req, res) => {
  const { name, rating, location } = req.body;
  if (!name) return res.status(400).json({ error: "Supplier name required" });

  const parsedRating = parseFloat(rating) || 4.0;
  const result = await db.run(
    'INSERT INTO suppliers (name, rating, verified, location) VALUES (?, ?, 0, ?)',
    [name, parsedRating, location || "Unspecified"]
  );

  res.status(201).json({
    id: result.lastID,
    name,
    rating: parsedRating,
    verified: false,
    location: location || "Unspecified",
    trustScore: calculateTrustScore(parsedRating, 0)
  });
});

// PATCH: Toggle verification
app.patch('/api/suppliers/:id/toggle', async (req, res) => {
  const id = parseInt(req.params.id);
  const supplier = await db.get('SELECT * FROM suppliers WHERE id = ?', [id]);
  if (!supplier) return res.status(404).json({ error: "Supplier not found" });

  const newStatus = supplier.verified ? 0 : 1;
  await db.run('UPDATE suppliers SET verified = ? WHERE id = ?', [newStatus, id]);

  res.json({
    ...supplier,
    verified: Boolean(newStatus),
    trustScore: calculateTrustScore(supplier.rating, newStatus)
  });
});

// DELETE: Remove supplier
app.delete('/api/suppliers/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  await db.run('DELETE FROM suppliers WHERE id = ?', [id]);
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});