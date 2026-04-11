const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'ats-database.db');
const db = new Database(dbPath);

console.log('🚀 Đang bắt đầu dọn dẹp Database...');

try {
    const candidates = db.prepare('SELECT id, position FROM candidates').all();
    let count = 0;
    
    for (const cand of candidates) {
        if (cand.position && cand.position.includes('Chỉnh sửa sơ lược công ty')) {
            // Lấy phần tên vị trí trước dấu mũi tên hoặc trước đoạn rác
            let cleanPos = cand.position.split(/[➔→▶|>-]/)[0].trim();
            if (cleanPos.includes('Công ty TNHH')) cleanPos = 'Ứng viên CareerLink';
            
            db.prepare('UPDATE candidates SET position = ? WHERE id = ?').run(cleanPos, cand.id);
            count++;
        }
    }
    console.log(`✅ Đã dọn dẹp thành công ${count} hồ sơ bị dính rác văn bản!`);
} catch (err) {
    console.error('❌ Lỗi dọn dẹp:', err.message);
} finally {
    db.close();
}
