/**
 * Universal Database Service (PostgreSQL & SQLite)
 * - Tự động dùng PostgreSQL nếu có biến môi trường DATABASE_URL (Cho Render Production)
 * - Fallback về SQLite nếu chạy ở máy local
 */

const { Pool } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');

// Điền chuỗi kết nối Supabase của bạn vào dấu nháy đơn dưới đây (nhớ thay đổi [YOUR-PASSWORD] thành mật khẩu thực tế)
const SUPABASE_URL = 'postgresql://postgres:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

let isPostgres = false;

let pgPool;
let sqliteDb;

async function initDb() {
    const connectionUri = (process.env.DATABASE_URL || SUPABASE_URL || '').trim();
    isPostgres = !!connectionUri && !connectionUri.includes('[YOUR-PASSWORD]');
    
    // Đóng db cũ nếu đang bật
    if (pgPool) { pgPool.end(); pgPool = null; }
    if (sqliteDb) { sqliteDb.close(); sqliteDb = null; }

    if (isPostgres) {
        // Log để debug (đã che mật khẩu)
        console.log('📡 Đang kết nối Database (Manual Mode):', connectionUri.replace(/:[^:@/]+@/, ':****@'));

        try {
            const dbUrl = new URL(connectionUri);
            pgPool = new Pool({
                user: dbUrl.username,
                password: decodeURIComponent(dbUrl.password),
                host: dbUrl.hostname,
                port: dbUrl.port || 5432,
                database: dbUrl.pathname.slice(1) || 'postgres',
                ssl: { rejectUnauthorized: false }
            });
        } catch (e) {
            console.error('❌ Lỗi phân tích DATABASE_URL:', e.message);
            // Fallback nếu URL lạ
            pgPool = new Pool({
                connectionString: connectionUri,
                ssl: { rejectUnauthorized: false }
            });
        }
        
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
                "preview_path" VARCHAR(1000) DEFAULT '',
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

            CREATE TABLE IF NOT EXISTS jobs (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                department VARCHAR(255),
                location VARCHAR(255),
                status VARCHAR(50) DEFAULT 'ACTIVE',
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Migration: Thêm cột preview_path nếu DB cũ chưa có (Postgres)
        try {
            await pgPool.query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "preview_path" VARCHAR(1000) DEFAULT ''`);
        } catch (e) {
            console.warn('⚠️ Lỗi migration Postgres (preview_path):', e.message);
        }

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
                preview_path TEXT DEFAULT '',
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

            CREATE TABLE IF NOT EXISTS jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                department TEXT,
                location TEXT,
                status TEXT DEFAULT 'ACTIVE',
                createdAt TEXT DEFAULT (datetime('now', 'localtime'))
            );
        `);

        // Migration: Thêm cột preview_path nếu DB cũ chưa có (SQLite)
        try {
            sqliteDb.prepare("ALTER TABLE candidates ADD COLUMN preview_path TEXT DEFAULT ''").run();
            console.log('➕ Đã bổ sung cột preview_path vào SQLite.');
        } catch (e) {
            if (!e.message.includes('duplicate column name')) {
                console.warn('⚠️ Lỗi migration SQLite (preview_path):', e.message);
            }
        }
            
        // Tự động sửa các hồ sơ bị thiếu trạng thái (Self-healing)
        sqliteDb.exec(`UPDATE candidates SET "cvStatus" = 'Screening' WHERE "cvStatus" = '' OR "cvStatus" IS NULL;`);
        
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
            INSERT INTO candidates (id, name, phone, email, position, source, status, "appliedDate", "cvLink", yob, "outlookMsgId", "hrPerson", "cvStatus", "scrNote", "preview_path")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                "cvStatus" = CASE WHEN candidates."cvStatus" = '' OR candidates."cvStatus" IS NULL THEN EXCLUDED."cvStatus" ELSE candidates."cvStatus" END,
                "preview_path" = CASE WHEN candidates."preview_path" = '' OR candidates."preview_path" IS NULL THEN EXCLUDED."preview_path" ELSE candidates."preview_path" END
        `;
        for (const c of candidates) {
            const res = await pgPool.query(query, [
                c.id || generateId(), c.name || '', c.phone || '', c.email || '', c.position || '', 
                c.source || '', c.status || 'SCREENING', c.appliedDate || '', c.cvLink || '', 
                c.yob || '', c.outlookMsgId || '', c.hrPerson || '', c.cvStatus || 'Screening', c.scrNote || '', c.preview_path || ''
            ]);
            if (res.rowCount > 0) added++;
        }
    } else {
        const stmt = sqliteDb.prepare(`
            INSERT INTO candidates (id, name, phone, email, position, source, status, appliedDate, cvLink, yob, outlookMsgId, hrPerson, cvStatus, scrNote, preview_path)
            VALUES (@id, @name, @phone, @email, @position, @source, @status, @appliedDate, @cvLink, @yob, @outlookMsgId, @hrPerson, @cvStatus, @scrNote, @preview_path)
            ON CONFLICT(id) DO UPDATE SET 
                cvStatus = CASE WHEN cvStatus = '' OR cvStatus IS NULL THEN excluded.cvStatus ELSE cvStatus END,
                preview_path = CASE WHEN preview_path = '' OR preview_path IS NULL THEN excluded.preview_path ELSE preview_path END
        `);
        const insertMany = sqliteDb.transaction((items) => {
            let count = 0;
            for (const c of items) {
                const res = stmt.run({
                    id: c.id || generateId(), name: c.name || '', phone: c.phone || '', email: c.email || '',
                    position: c.position || '', source: c.source || '', status: c.status || 'SCREENING',
                    appliedDate: c.appliedDate || '', cvLink: c.cvLink || '', yob: c.yob || '',
                    outlookMsgId: c.outlookMsgId || '', hrPerson: c.hrPerson || '', cvStatus: c.cvStatus || 'Screening', 
                    scrNote: c.scrNote || '', preview_path: c.preview_path || ''
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

async function candidateExistsByPhone(phone) {
    if (!phone) return false;
    // Chuẩn hóa số điện thoại (xóa khoảng trắng, chấm, gạch ngang)
    const cleanPhone = phone.replace(/[\s\.\-]/g, '');
    if (isPostgres) {
        const res = await pgPool.query('SELECT id FROM candidates WHERE REPLACE(REPLACE(REPLACE(phone, \' \', \'\'), \'.\', \'\'), \'-\', \'\') = $1', [cleanPhone]);
        return res.rows.length > 0;
    } else {
        const row = sqliteDb.prepare("SELECT id FROM candidates WHERE REPLACE(REPLACE(REPLACE(phone, ' ', ''), '.', ''), '-', '') = ?").get(cleanPhone);
        return !!row;
    }
}

async function candidateExistsByEmail(email) {
    if (!email) return false;
    const lowerEmail = email.toLowerCase().trim();
    if (isPostgres) {
        const res = await pgPool.query('SELECT id FROM candidates WHERE LOWER(TRIM(email)) = $1', [lowerEmail]);
        return res.rows.length > 0;
    } else {
        const row = sqliteDb.prepare('SELECT id FROM candidates WHERE LOWER(TRIM(email)) = ?').get(lowerEmail);
        return !!row;
    }
}

async function findCandidateIdByPhone(phone) {
    if (!phone) return null;
    const cleanPhone = phone.replace(/[\s\.\-]/g, '');
    if (isPostgres) {
        const res = await pgPool.query('SELECT id FROM candidates WHERE REPLACE(REPLACE(REPLACE(phone, \' \', \'\'), \'.\', \'\'), \'-\', \'\') = $1 LIMIT 1', [cleanPhone]);
        return res.rows[0]?.id;
    } else {
        const row = sqliteDb.prepare("SELECT id FROM candidates WHERE REPLACE(REPLACE(REPLACE(phone, ' ', ''), '.', ''), '-', '') = ? LIMIT 1").get(cleanPhone);
        return row?.id;
    }
}

async function findCandidateIdByEmail(email) {
    if (!email) return null;
    const lowerEmail = email.toLowerCase().trim();
    if (isPostgres) {
        const res = await pgPool.query('SELECT id FROM candidates WHERE LOWER(TRIM(email)) = $1 LIMIT 1', [lowerEmail]);
        return res.rows[0]?.id;
    } else {
        const row = sqliteDb.prepare('SELECT id FROM candidates WHERE LOWER(TRIM(email)) = ? LIMIT 1').get(lowerEmail);
        return row?.id;
    }
}

async function updateCandidate(id, fields) {
    const allowed = [
        'name', 'phone', 'email', 'position', 'source', 'status',
        'appliedDate', 'cvLink', 'yob', 'hrPerson', 'cvStatus',
        'scrNote', 'scrResult', 'scrReason',
        'intTime', 'intResult', 'intReason',
        'offResult', 'offReason', 'onboardDate', 'preview_path'
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

async function insertCandidate(c) {
    if (isPostgres) {
        const query = `
            INSERT INTO candidates (id, name, phone, email, position, source, status, "appliedDate", "cvLink", yob, "outlookMsgId", "hrPerson", "cvStatus", "scrNote", "preview_path")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (id) DO NOTHING
            RETURNING *
        `;
        const res = await pgPool.query(query, [
            c.id || generateId(), c.name || '', c.phone || '', c.email || '', c.position || '', 
            c.source || 'Thủ công', c.status || 'SCREENING', c.appliedDate || new Date().toLocaleDateString('vi-VN'), 
            c.cvLink || '', c.yob || '', c.outlookMsgId || '', c.hrPerson || '', c.cvStatus || 'Screening',
            c.scrNote || '', c.preview_path || ''
        ]);
        return res.rows[0];
    } else {
        const stmt = sqliteDb.prepare(`
            INSERT OR IGNORE INTO candidates (id, name, phone, email, position, source, status, appliedDate, cvLink, yob, outlookMsgId, hrPerson, cvStatus, scrNote, preview_path)
            VALUES (@id, @name, @phone, @email, @position, @source, @status, @appliedDate, @cvLink, @yob, @outlookMsgId, @hrPerson, @cvStatus, @scrNote, @preview_path)
        `);
        stmt.run({
            id: c.id || generateId(), name: c.name || '', phone: c.phone || '', email: c.email || '',
            position: c.position || '', source: c.source || 'Thủ công', status: c.status || 'SCREENING',
            appliedDate: c.appliedDate || new Date().toLocaleDateString('vi-VN'), cvLink: c.cvLink || '', yob: c.yob || '',
            outlookMsgId: c.outlookMsgId || '', hrPerson: c.hrPerson || '', cvStatus: c.cvStatus || 'Screening',
            scrNote: c.scrNote || '', preview_path: c.preview_path || ''
        });
        return sqliteDb.prepare('SELECT * FROM candidates WHERE id = ?').get(c.id);
    }
}

async function getAllJobs() {
    if (isPostgres) {
        const res = await pgPool.query('SELECT * FROM jobs ORDER BY "createdAt" DESC');
        return res.rows;
    } else {
        return sqliteDb.prepare('SELECT * FROM jobs ORDER BY createdAt DESC').all();
    }
}

async function addJob(job) {
    if (isPostgres) {
        const res = await pgPool.query(
            'INSERT INTO jobs (title, department, location, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [job.title, job.department || '', job.location || '', job.status || 'ACTIVE']
        );
        return res.rows[0];
    } else {
        const info = sqliteDb.prepare(
            'INSERT INTO jobs (title, department, location, status) VALUES (?, ?, ?, ?)'
        ).run(job.title, job.department || '', job.location || '', job.status || 'ACTIVE');
        return sqliteDb.prepare('SELECT * FROM jobs WHERE id = ?').get(info.lastInsertRowid);
    }
}

async function deleteJob(id) {
    if (isPostgres) {
        const res = await pgPool.query('DELETE FROM jobs WHERE id = $1', [id]);
        return res.rowCount > 0;
    } else {
        const res = sqliteDb.prepare('DELETE FROM jobs WHERE id = ?').run(id);
        return res.changes > 0;
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
    insertCandidate,
    updateCandidate,
    deleteCandidate,
    candidateExistsByOutlookMsgId,
    candidateExistsByPhone,
    candidateExistsByEmail,
    findCandidateIdByPhone,
    findCandidateIdByEmail,
    addScanHistory,
    getScanHistory,
    getAllJobs,
    addJob,
    deleteJob,
    closeDb,
    get isPostgres() { return isPostgres; }
};
