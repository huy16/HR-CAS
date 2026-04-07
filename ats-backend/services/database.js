/**
 * Universal Database Service (PostgreSQL & SQLite)
 * - Tự động dùng PostgreSQL nếu có biến môi trường DATABASE_URL (Cho Render Production)
 * - Fallback về SQLite nếu chạy ở máy local
 */

const { Pool } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');

// Điền chuỗi kết nối Supabase của bạn vào dấu nháy đơn dưới đây (nhớ thay đổi [YOUR-PASSWORD] thành mật khẩu thực tế)
const SUPABASE_URL = 'postgresql://postgres:Phattrienbenvung@db.sypgzmdysgiiuuwtcacj.supabase.co:5432/postgres';

let isPostgres = false;

let pgPool;
let sqliteDb;

async function initDb() {
    const connectionUri = SUPABASE_URL !== '' && !SUPABASE_URL.includes('[YOUR-PASSWORD]') ? SUPABASE_URL : process.env.DATABASE_URL;
    isPostgres = !!connectionUri;
    
    // Đóng db cũ nếu đang bật
    if (pgPool) { pgPool.end(); pgPool = null; }
    if (sqliteDb) { sqliteDb.close(); sqliteDb = null; }

    if (isPostgres) {
        pgPool = new Pool({
            connectionString: connectionUri,
            ssl: { rejectUnauthorized: false } // Bắt buộc cho Render Postgres
        });
        
        await pgPool.query(`
            CREATE TABLE IF NOT EXISTS candidates (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL DEFAULT '',
                phone VARCHAR(255) DEFAULT '',
                email VARCHAR(255) DEFAULT '',
                position VARCHAR(255) DEFAULT '',
                source VARCHAR(255) DEFAULT '',
                status VARCHAR(50) DEFAULT 'SCREENING',
                "appliedDate" VARCHAR(255) DEFAULT '',
                "cvLink" VARCHAR(1000) DEFAULT '',
                yob VARCHAR(50) DEFAULT '',
                "outlookMsgId" VARCHAR(255) DEFAULT '',
                "hrPerson" VARCHAR(255) DEFAULT '',
                "cvStatus" VARCHAR(255) DEFAULT '',
                "scrNote" TEXT DEFAULT '',
                "scrResult" VARCHAR(255) DEFAULT '',
                "scrReason" TEXT DEFAULT '',
                "intTime" VARCHAR(255) DEFAULT '',
                "intResult" VARCHAR(255) DEFAULT '',
                "intReason" TEXT DEFAULT '',
                "offResult" VARCHAR(255) DEFAULT '',
                "offReason" TEXT DEFAULT '',
                "onboardDate" VARCHAR(255) DEFAULT '',
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS scan_history (
                id SERIAL PRIMARY KEY,
                time VARCHAR(255) NOT NULL,
                source VARCHAR(255) NOT NULL,
                found INTEGER DEFAULT 0,
                added INTEGER DEFAULT 0,
                duplicates INTEGER DEFAULT 0
            );
        `);
        console.log('✅ PostgreSQL đã kết nối thành công!');
    } else {
        const DB_PATH = path.join(__dirname, '..', 'ats-database.db');
        sqliteDb = new Database(DB_PATH);
        sqliteDb.pragma('journal_mode = WAL');
        
        sqliteDb.exec(`
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
        console.log('✅ SQLite đã kết nối (Chế độ Local)');
    }
}

async function getAllCandidates() {
    if (isPostgres) {
        const res = await pgPool.query('SELECT * FROM candidates ORDER BY "createdAt" DESC');
        return res.rows;
    } else {
        return sqliteDb.prepare('SELECT * FROM candidates ORDER BY createdAt DESC').all();
    }
}

async function insertManyCandidates(candidates) {
    if (candidates.length === 0) return 0;
    let added = 0;
    
    if (isPostgres) {
        const query = `
            INSERT INTO candidates (id, name, phone, email, position, source, status, "appliedDate", "cvLink", yob, "outlookMsgId", "hrPerson")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (id) DO NOTHING
        `;
        for (const c of candidates) {
            const res = await pgPool.query(query, [
                c.id || generateId(), c.name || '', c.phone || '', c.email || '', c.position || '', 
                c.source || '', c.status || 'SCREENING', c.appliedDate || '', c.cvLink || '', 
                c.yob || '', c.outlookMsgId || '', c.hrPerson || ''
            ]);
            if (res.rowCount > 0) added++;
        }
    } else {
        const stmt = sqliteDb.prepare(`
            INSERT OR IGNORE INTO candidates (id, name, phone, email, position, source, status, appliedDate, cvLink, yob, outlookMsgId, hrPerson)
            VALUES (@id, @name, @phone, @email, @position, @source, @status, @appliedDate, @cvLink, @yob, @outlookMsgId, @hrPerson)
        `);
        const insertMany = sqliteDb.transaction((items) => {
            let count = 0;
            for (const c of items) {
                const res = stmt.run({
                    id: c.id || generateId(), name: c.name || '', phone: c.phone || '', email: c.email || '',
                    position: c.position || '', source: c.source || '', status: c.status || 'SCREENING',
                    appliedDate: c.appliedDate || '', cvLink: c.cvLink || '', yob: c.yob || '',
                    outlookMsgId: c.outlookMsgId || '', hrPerson: c.hrPerson || ''
                });
                if (res.changes > 0) count++;
            }
            return count;
        });
        added = insertMany(candidates);
    }
    return added;
}

async function candidateExistsByOutlookMsgId(msgId) {
    if (!msgId) return false;
    if (isPostgres) {
        const res = await pgPool.query('SELECT id FROM candidates WHERE "outlookMsgId" = $1', [msgId]);
        return res.rows.length > 0;
    } else {
        const row = sqliteDb.prepare('SELECT id FROM candidates WHERE outlookMsgId = ?').get(msgId);
        return !!row;
    }
}

async function updateCandidate(id, fields) {
    const allowed = [
        'name', 'phone', 'email', 'position', 'source', 'status',
        'appliedDate', 'cvLink', 'yob', 'hrPerson', 'cvStatus',
        'scrNote', 'scrResult', 'scrReason',
        'intTime', 'intResult', 'intReason',
        'offResult', 'offReason', 'onboardDate'
    ];
    
    if (isPostgres) {
        const updates = [];
        const values = [];
        let i = 1;
        for (const key of allowed) {
            if (fields[key] !== undefined) {
                updates.push(`"${key}" = $${i}`);
                values.push(fields[key]);
                i++;
            }
        }
        if (updates.length === 0) return null;
        values.push(id);
        const query = `UPDATE candidates SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`;
        const res = await pgPool.query(query, values);
        return res.rows[0];
    } else {
        const updates = [];
        const values = {};
        for (const key of allowed) {
            if (fields[key] !== undefined) {
                updates.push(`${key} = @${key}`);
                values[key] = fields[key];
            }
        }
        if (updates.length === 0) return null;
        values.id = id;
        sqliteDb.prepare(`UPDATE candidates SET ${updates.join(', ')} WHERE id = @id`).run(values);
        return sqliteDb.prepare('SELECT * FROM candidates WHERE id = ?').get(id);
    }
}

async function deleteCandidate(id) {
    if (isPostgres) {
        const res = await pgPool.query('DELETE FROM candidates WHERE id = $1', [id]);
        return res.rowCount > 0;
    } else {
        const res = sqliteDb.prepare('DELETE FROM candidates WHERE id = ?').run(id);
        return res.changes > 0;
    }
}

async function addScanHistory(entry) {
    const time = entry.time || new Date().toLocaleString('vi-VN');
    const source = entry.source || 'Unknown';
    const found = entry.found || 0;
    const added = entry.added || 0;
    const duplicates = entry.duplicates || 0;

    if (isPostgres) {
        await pgPool.query(`
            INSERT INTO scan_history (time, source, found, added, duplicates)
            VALUES ($1, $2, $3, $4, $5)
        `, [time, source, found, added, duplicates]);
    } else {
        sqliteDb.prepare(`
            INSERT INTO scan_history (time, source, found, added, duplicates)
            VALUES (@time, @source, @found, @added, @duplicates)
        `).run({ time, source, found, added, duplicates });
    }
}

async function getScanHistory(limit = 20) {
    if (isPostgres) {
        const res = await pgPool.query('SELECT * FROM scan_history ORDER BY id DESC LIMIT $1', [limit]);
        return res.rows;
    } else {
        return sqliteDb.prepare('SELECT * FROM scan_history ORDER BY id DESC LIMIT ?').all(limit);
    }
}

function generateId() {
    return Math.random().toString(36).substring(2, 9);
}

function closeDb() {
    if (isPostgres && pgPool) pgPool.end();
    if (!isPostgres && sqliteDb) sqliteDb.close();
    console.log('🔒 Database connection closed.');
}

module.exports = {
    initDb,
    getAllCandidates,
    insertManyCandidates,
    updateCandidate,
    deleteCandidate,
    candidateExistsByOutlookMsgId,
    addScanHistory,
    getScanHistory,
    closeDb,
    get isPostgres() { return isPostgres; }
};
