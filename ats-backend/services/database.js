/**
 * SQLite Database Service
 * Lưu trữ dữ liệu ứng viên vĩnh viễn vào file ats-database.db
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'ats-database.db');

let db;

function getDb() {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL'); // Tối ưu tốc độ ghi
        db.pragma('foreign_keys = ON');
        initTables();
        console.log(`✅ SQLite đã kết nối: ${DB_PATH}`);
    }
    return db;
}

/**
 * Tạo bảng nếu chưa có
 */
function initTables() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS candidates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL DEFAULT '',
            phone TEXT DEFAULT '',
            email TEXT DEFAULT '',
            position TEXT DEFAULT '',
            source TEXT DEFAULT '',
            status TEXT DEFAULT 'SCREENING',
            appliedDate TEXT DEFAULT '',
            cvLink TEXT DEFAULT '',
            yob TEXT DEFAULT '',
            outlookMsgId TEXT DEFAULT '',
            hrPerson TEXT DEFAULT '',
            cvStatus TEXT DEFAULT '',
            scrNote TEXT DEFAULT '',
            scrResult TEXT DEFAULT '',
            scrReason TEXT DEFAULT '',
            intTime TEXT DEFAULT '',
            intResult TEXT DEFAULT '',
            intReason TEXT DEFAULT '',
            offResult TEXT DEFAULT '',
            offReason TEXT DEFAULT '',
            onboardDate TEXT DEFAULT '',
            createdAt TEXT DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS scan_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            time TEXT NOT NULL,
            source TEXT NOT NULL,
            found INTEGER DEFAULT 0,
            added INTEGER DEFAULT 0,
            duplicates INTEGER DEFAULT 0
        );
    `);
}

// ============================================================
// Candidates CRUD
// ============================================================

function getAllCandidates() {
    return getDb().prepare('SELECT * FROM candidates ORDER BY createdAt DESC').all();
}

function getCandidatesByStatus(status) {
    return getDb().prepare('SELECT * FROM candidates WHERE status = ? ORDER BY createdAt DESC').all(status);
}

function getCandidateById(id) {
    return getDb().prepare('SELECT * FROM candidates WHERE id = ?').get(id);
}

function insertCandidate(candidate) {
    const stmt = getDb().prepare(`
        INSERT OR IGNORE INTO candidates (id, name, phone, email, position, source, status, appliedDate, cvLink, yob, outlookMsgId, hrPerson)
        VALUES (@id, @name, @phone, @email, @position, @source, @status, @appliedDate, @cvLink, @yob, @outlookMsgId, @hrPerson)
    `);
    return stmt.run({
        id: candidate.id || generateId(),
        name: candidate.name || '',
        phone: candidate.phone || '',
        email: candidate.email || '',
        position: candidate.position || '',
        source: candidate.source || '',
        status: candidate.status || 'SCREENING',
        appliedDate: candidate.appliedDate || '',
        cvLink: candidate.cvLink || '',
        yob: candidate.yob || '',
        outlookMsgId: candidate.outlookMsgId || '',
        hrPerson: candidate.hrPerson || ''
    });
}

function insertManyCandidates(candidates) {
    const stmt = getDb().prepare(`
        INSERT OR IGNORE INTO candidates (id, name, phone, email, position, source, status, appliedDate, cvLink, yob, outlookMsgId, hrPerson)
        VALUES (@id, @name, @phone, @email, @position, @source, @status, @appliedDate, @cvLink, @yob, @outlookMsgId, @hrPerson)
    `);

    const insertMany = getDb().transaction((items) => {
        let count = 0;
        for (const c of items) {
            const result = stmt.run({
                id: c.id || generateId(),
                name: c.name || '',
                phone: c.phone || '',
                email: c.email || '',
                position: c.position || '',
                source: c.source || '',
                status: c.status || 'SCREENING',
                appliedDate: c.appliedDate || '',
                cvLink: c.cvLink || '',
                yob: c.yob || '',
                outlookMsgId: c.outlookMsgId || '',
                hrPerson: c.hrPerson || ''
            });
            if (result.changes > 0) count++;
        }
        return count;
    });

    return insertMany(candidates);
}

function updateCandidate(id, fields) {
    const existing = getCandidateById(id);
    if (!existing) return null;

    const allowed = [
        'name', 'phone', 'email', 'position', 'source', 'status',
        'appliedDate', 'cvLink', 'yob', 'hrPerson', 'cvStatus',
        'scrNote', 'scrResult', 'scrReason',
        'intTime', 'intResult', 'intReason',
        'offResult', 'offReason', 'onboardDate'
    ];

    const updates = [];
    const values = {};
    for (const key of allowed) {
        if (fields[key] !== undefined) {
            updates.push(`${key} = @${key}`);
            values[key] = fields[key];
        }
    }

    if (updates.length === 0) return existing;

    values.id = id;
    getDb().prepare(`UPDATE candidates SET ${updates.join(', ')} WHERE id = @id`).run(values);
    return getCandidateById(id);
}

function deleteCandidate(id) {
    const result = getDb().prepare('DELETE FROM candidates WHERE id = ?').run(id);
    return result.changes > 0;
}

function candidateExistsByOutlookMsgId(msgId) {
    if (!msgId) return false;
    const row = getDb().prepare('SELECT id FROM candidates WHERE outlookMsgId = ?').get(msgId);
    return !!row;
}

// ============================================================
// Scan History
// ============================================================

function addScanHistory(entry) {
    getDb().prepare(`
        INSERT INTO scan_history (time, source, found, added, duplicates)
        VALUES (@time, @source, @found, @added, @duplicates)
    `).run({
        time: entry.time || new Date().toLocaleString('vi-VN'),
        source: entry.source || 'Unknown',
        found: entry.found || 0,
        added: entry.added || 0,
        duplicates: entry.duplicates || 0
    });
}

function getScanHistory(limit = 20) {
    return getDb().prepare('SELECT * FROM scan_history ORDER BY id DESC LIMIT ?').all(limit);
}

// ============================================================
// Utils
// ============================================================

function generateId() {
    return Math.random().toString(36).substring(2, 9);
}

function closeDb() {
    if (db) {
        db.close();
        db = null;
        console.log('🔒 SQLite đã đóng.');
    }
}

module.exports = {
    getAllCandidates,
    getCandidatesByStatus,
    getCandidateById,
    insertCandidate,
    insertManyCandidates,
    updateCandidate,
    deleteCandidate,
    candidateExistsByOutlookMsgId,
    addScanHistory,
    getScanHistory,
    closeDb
};
