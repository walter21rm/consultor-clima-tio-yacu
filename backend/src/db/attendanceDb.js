const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

let db;

function getDb() {
  if (db) return db;

  const target = process.env.TIOYACU_DB || path.join(__dirname, '..', '..', 'data', 'tioyacu.db');
  if (target !== ':memory:') {
    fs.mkdirSync(path.dirname(target), { recursive: true });
  }

  db = new DatabaseSync(target);
  db.exec(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_date TEXT NOT NULL UNIQUE,
      attendees INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  return db;
}

function listAttendance() {
  return getDb()
    .prepare(
      'SELECT visit_date AS date, attendees FROM attendance ORDER BY visit_date DESC'
    )
    .all();
}

function findAttendance(date) {
  return (
    getDb()
      .prepare(
        'SELECT visit_date AS date, attendees FROM attendance WHERE visit_date = ?'
      )
      .get(date) || null
  );
}

function saveAttendance(date, attendees) {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO attendance (visit_date, attendees, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(visit_date) DO UPDATE SET
         attendees = excluded.attendees,
         updated_at = excluded.updated_at`
    )
    .run(date, attendees, now, now);
  return findAttendance(date);
}

function clearAttendance() {
  getDb().exec('DELETE FROM attendance');
}

module.exports = {
  listAttendance,
  findAttendance,
  saveAttendance,
  clearAttendance,
};
