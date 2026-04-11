const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const ViteExpress = require('vite-express');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const dns = require('dns');

if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

// Import services
const db = require('./services/database');
const crawlerService = require('./services/crawler-service');

const app = express();
app.use(cors());
app.use(express.json());

// Serve file CV đính kèm
const attachmentsDir = path.join(__dirname, 'attachments');
if (!fs.existsSync(attachmentsDir)) {
    fs.mkdirSync(attachmentsDir, { recursive: true });
}
app.use('/attachments', express.static(attachmentsDir));

const configFilePath = path.join(__dirname, 'config.json');

function loadConfig() {
    try {
        if (fs.existsSync(configFilePath)) {
            return JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
        }
    } catch (e) {
        console.warn('⚠️ Không đọc được config.json:', e.message);
    }
    return {};
}

function saveConfig(config) {
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), 'utf-8');
}

// ============================================================
// API: Cấu hình Crawler & Database
// ============================================================
app.get('/api/config', (req, res) => {
    const config = loadConfig();
    res.json({
        DATABASE_URL_SET: !!(config.DATABASE_URL || process.env.DATABASE_URL),
        platforms: config.platforms || {},
        configured: true
    });
});

app.post('/api/config', async (req, res) => {
    const { DATABASE_URL, platforms } = req.body;
    const config = loadConfig();
    
    let dbChanged = false;
    if (DATABASE_URL !== undefined && DATABASE_URL !== '') { 
        config.DATABASE_URL = DATABASE_URL; 
        process.env.DATABASE_URL = DATABASE_URL; 
        dbChanged = true;
    }
    
    if (platforms) {
        config.platforms = { ...(config.platforms || {}), ...platforms };
    }

    saveConfig(config);
    console.log('✅ Đã lưu cấu hình mới.');
    
    if (dbChanged) {
        console.log('🔄 Đang chuyển đổi Database...');
        await db.initDb();
    }
    
    res.json({ message: 'Đã lưu cấu hình thành công!', configured: true });
});

// ============================================================
// API: Lấy danh sách ứng viên
// ============================================================
app.get('/api/candidates', async (req, res) => {
    try {
        const candidates = await db.getAllCandidates();
        res.json(candidates);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============================================================
// API: Import/Update ứng viên
// ============================================================
app.post('/api/candidates/import', async (req, res) => {
    try {
        const candidates = req.body.candidates || [];
        const added = await db.insertManyCandidates(candidates);
        res.json({ message: `Đã import ${added} ứng viên`, added });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.patch('/api/candidates/:id', async (req, res) => {
    try {
        const candidate = await db.updateCandidate(req.params.id, req.body);
        if (!candidate) return res.status(404).json({ error: 'Không tìm thấy ứng viên' });
        res.json(candidate);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/candidates/:id', async (req, res) => {
    try {
        const deleted = await db.deleteCandidate(req.params.id);
        res.json({ deleted });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============================================================
// API: Chạy Crawler (CareerLink)
// ============================================================
app.post('/api/crawler/run/:platform', async (req, res) => {
    const { platform } = req.params;
    try {
        const config = loadConfig();
        const creds = config.platforms?.[platform];
        
        if (!creds || !creds.email || !creds.password) {
            return res.status(400).json({ 
                error: `Chưa cấu hình tài khoản ${platform}`,
                message: `Vui lòng vào Settings -> Kết nối Site để cấu hình.`
            });
        }

        console.log(`🚀 Bắt đầu cào dữ liệu từ: ${platform.toUpperCase()} với kỳ hạn: ${req.body.period || '1d'}...`);
        let newCandidates = [];

        if (platform === 'careerlink') {
            newCandidates = await crawlerService.crawlCareerLink(creds.email, creds.password, req.body.period || '1d');
        } else {
            return res.status(404).json({ error: 'Nền tảng không hỗ trợ' });
        }

        // 1. Phân tích & Gộp dữ liệu (Gộp nếu trùng Tên + SĐT/Email để tránh đẻ thêm dòng)
        const BLACKLIST = ['0400539269', 'hr@cas-energy.com', 'contact@careerlink.vn'];
        const uniqueCandidates = [];
        
        for (const c of newCandidates) {
            const cleanPhone = c.phone?.replace(/[\s.-]/g, '') || '';
            const isBlacklistedPhone = cleanPhone && BLACKLIST.some(b => cleanPhone.includes(b.replace(/[\s.-]/g, '')));
            const isBlacklistedEmail = c.email && BLACKLIST.some(b => c.email.toLowerCase().includes(b.toLowerCase()));

            const checkPhone = !isBlacklistedPhone && cleanPhone !== '';
            const checkEmail = !isBlacklistedEmail && c.email && c.email !== '';

            // Tìm xem người này đã tồn tại trong hệ thống chưa (theo SĐT hoặc Email)
            let existingId = null;
            if (checkPhone) existingId = await db.findCandidateIdByPhone(c.phone);
            if (!existingId && checkEmail) existingId = await db.findCandidateIdByEmail(c.email);

            if (existingId) {
                // Nếu ĐÃ CÓ: Ta dùng tiếp ID cũ để lệnh INSERT INTO ... ON CONFLICT(id) DO UPDATE sẽ cập nhật thông tin mới nhất vào dòng đó
                c.id = existingId;
            } else {
                // Nếu CHƯA CÓ: Tạo ID mới hoàn toàn
                if (!c.id) c.id = 'cl_' + Math.random().toString(36).substring(2, 9);
            }
            
            uniqueCandidates.push(c);
        }

        const added = await db.insertManyCandidates(uniqueCandidates);

        // Ghi lịch sử
        if (newCandidates.length > 0 || true) { // Luôn ghi lịch sử để biết có chạy
            await db.addScanHistory({
                time: new Date().toLocaleString('vi-VN'),
                source: platform.toUpperCase(),
                found: newCandidates.length,
                added,
                duplicates: newCandidates.length - added
            });
        }

        res.json({
            message: `Quét ${platform} thành công!`,
            found: newCandidates.length,
            added,
            duplicates: newCandidates.length - added,
            data: uniqueCandidates
        });
    } catch (e) {
        console.error(`❌ Lỗi Crawler ${platform}:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/scan/history', async (req, res) => {
    const history = await db.getScanHistory();
    res.json(history);
});

// ============================================================
// API: Master Data
// ============================================================
const masterDataPath = path.join(__dirname, 'master_data.json');
const defaultMasterData = {
    sources: ['Mail HR', 'Joboko', 'Vietnamworks', 'Vieclam24h', 'LinkedIn', 'CareerLink'],
    positions: ['TTS', 'Kỹ sư', 'Kinh doanh', 'Marketing'],
    hrPersons: ['Linh', 'Thảo', 'Lai', 'Đức Anh'],
    scrStatus: ['CV not accept', 'Screening', 'Pending'],
    scrResult: ['Interview', 'Fail', 'Pending'],
    intResult: ['Pass', 'Fail', 'Pending'],
    offResult: ['Xác nhận', 'Từ chối']
};

app.get('/api/master-data', (req, res) => {
    try {
        if (!fs.existsSync(masterDataPath)) return res.json(defaultMasterData);
        res.json(JSON.parse(fs.readFileSync(masterDataPath, 'utf8')));
    } catch (e) {
        res.json(defaultMasterData);
    }
});

app.post('/api/master-data', (req, res) => {
    try {
        console.log('📝 Nhận yêu cầu cập nhật Master Data:', Object.keys(req.body));
        fs.writeFileSync(masterDataPath, JSON.stringify(req.body, null, 2));
        console.log('✅ Đã lưu Master Data vào file thành công.');
        res.json({ message: 'Lưu cấu hình thành công!' });
    } catch (e) {
        console.error('❌ Lỗi khi lưu Master Data:', e);
        res.status(500).json({ error: 'Không thể lưu Master Data' });
    }
});

// ============================================================
// API: Job Management
// ============================================================
app.get('/api/jobs', async (req, res) => {
    const jobs = await db.getAllJobs();
    res.json(jobs);
});

app.post('/api/jobs', async (req, res) => {
    try {
        const newJob = await db.addJob(req.body);
        res.json(newJob);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/jobs/:id', async (req, res) => {
    try {
        await db.deleteJob(req.params.id);
        res.json({ message: 'Đã xóa tin tuyển dụng' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============================================================
// Integration & Start
// ============================================================
const PORT = process.env.PORT || 3001;

async function start() {
    await db.initDb();
    
    ViteExpress.listen(app, PORT, () => {
        console.log('\n═══════════════════════════════════════════════════');
        console.log(`🚀 ATS Unified System: http://localhost:${PORT}`);
        console.log(`💾 Database: ${db.isPostgres ? 'PostgreSQL' : 'SQLite'}`);
        console.log('═══════════════════════════════════════════════════\n');
    });
}

start();

process.on('SIGINT', () => { db.closeDb(); process.exit(0); });
process.on('SIGTERM', () => { db.closeDb(); process.exit(0); });
