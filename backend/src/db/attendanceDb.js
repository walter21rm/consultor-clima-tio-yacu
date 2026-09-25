const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { OFFICIAL_2025, SOURCE } = require('../data/officialVisitors');

let db;

function getDb() {
  if (db) return db;

  const target = process.env.TIOYACU_DB || path.join(__dirname, '..', '..', 'data', 'tioyacu.db');
  if (target !== ':memory:') {
    fs.mkdirSync(path.dirname(target), { recursive: true });
  }

  db = new DatabaseSync(target);
  db.exec(`
    CREATE TABLE IF NOT EXISTS monthly_visitors (
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      visitors INTEGER NOT NULL,
      source TEXT NOT NULL,
      PRIMARY KEY (year, month)
    )
  `);

  const insert = db.prepare(
    `INSERT INTO monthly_visitors (year, month, visitors, source)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(year, month) DO UPDATE SET visitors = excluded.visitors, source = excluded.source`
  );
  for (const row of OFFICIAL_2025) {
    insert.run(2025, row.month, row.visitors, SOURCE);
  }

  return db;
}

function findOfficialMonth(month) {
  return (
    getDb()
      .prepare(
        'SELECT year, month, visitors, source FROM monthly_visitors WHERE month = ? ORDER BY year DESC LIMIT 1'
      )
      .get(month) || null
  );
}

module.exports = { findOfficialMonth, SOURCE };
