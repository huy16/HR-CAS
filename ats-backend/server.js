const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
require('dotenv').config();
const dns = require('dns');
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

// Import services & routes
const { router: authRouter, getAccessToken, isConfigured } = require('./routes/auth');
const { scanOutlookEmails } = require('./services/outlook-service');
const db = require('./services/database');

const app = express();
app.use(cors());
app.use(express.json());

// Serve file CV đính kèm
const attachmentsDir = path.join(__dirname, 'attachments');
if (!fs.existsSync(attachmentsDir)) {
    fs.mkdirSync(attachmentsDir, { recursive: true });
}
app.use('/attachments', express.static(attachmentsDir));

// ============================================================
// Auth Routes - Đăng nhập Microsoft
// ============================================================
app.use('/auth', authRouter);

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
// API: Import ứng viên từ Frontend (Excel/Manual)
// ============================================================
app.post('/api/candidates/import', async (req, res) => {
    try {
        const candidates = req.body.candidates || [];
        if (!Array.isArray(candidates) || candidates.length === 0) {
            return res.status(400).json({ error: 'Không có dữ liệu để import' });
        }
        const added = await db.insertManyCandidates(candidates);
        console.log(`📥 Import: Đã thêm ${added}/${candidates.length} ứng viên vào database.`);
        res.json({ message: `Đã import ${added} ứng viên`, added, total: candidates.length });
    } catch (e) {
        console.error('❌ Import error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ============================================================
// API: Quét email Outlook (Microsoft Graph API)
// ============================================================
app.post('/api/scan/outlook', async (req, res) => {
    try {
        if (!isConfigured()) {
            return res.status(400).json({
                error: 'Chưa cấu hình Azure credentials',
                message: 'Vào Settings → Kết nối Outlook để cấu hình.'
            });
        }

        const accessToken = getAccessToken();
        if (!accessToken) {
            return res.status(401).json({
                error: 'Chưa đăng nhập Outlook',
                loginUrl: `${process.env.APP_URL || 'https://hr-cas.onrender.com'}/auth/login`,
                message: 'Bấm "Kết nối Outlook" để đăng nhập trước.'
            });
        }

        const options = {
            maxEmails: req.body.maxEmails || 50,
            onlyUnread: req.body.onlyUnread !== false,
            markAsRead: req.body.markAsRead || false,
            daysBack: req.body.daysBack || 7
        };

        const newCandidates = await scanOutlookEmails(accessToken, options);

        // Loại trùng dựa trên outlookMsgId
        const uniqueCandidates = [];
        for (const c of newCandidates) {
            const exists = await db.candidateExistsByOutlookMsgId(c.outlookMsgId);
            if (!exists) uniqueCandidates.push(c);
        }

        // Lưu vào SQLite/Postgres
        const added = await db.insertManyCandidates(uniqueCandidates);

        // Ghi lịch sử
        await db.addScanHistory({
            time: new Date().toLocaleString('vi-VN'),
            source: 'Outlook',
            found: newCandidates.length,
            added,
            duplicates: newCandidates.length - added
        });

        res.json({
            message: 'Quét Outlook thành công!',
            found: newCandidates.length,
            added,
            duplicates: newCandidates.length - added,
            data: uniqueCandidates
        });

    } catch (e) {
        console.error('❌ API scan/outlook error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ============================================================
// API: Quét email qua IMAP (Gmail - phương pháp cũ)
// ============================================================
app.post('/api/scan/imap', async (req, res) => {
    try {
        const imaps = require('imap-simple');
        const { simpleParser } = require('mailparser');

        const imapConfig = {
            imap: {
                user: process.env.EMAIL_USER || '',
                password: process.env.EMAIL_PASSWORD || '',
                host: process.env.IMAP_HOST || 'imap.gmail.com',
                port: process.env.IMAP_PORT || 993,
                tls: true,
                authTimeout: 3000,
                tlsOptions: { rejectUnauthorized: false }
            }
        };

        if (!imapConfig.imap.user || imapConfig.imap.user === 'your-email@gmail.com') {
            return res.status(400).json({ error: 'Chưa cấu hình email IMAP trong file .env' });
        }

        console.log('📧 Bắt đầu quét IMAP...');
        const connection = await imaps.connect(imapConfig);
        await connection.openBox('INBOX');

        const messages = await connection.search(['UNSEEN'], {
            bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', ''],
            struct: true, markSeen: false
        });
        console.log(`📬 Tìm thấy ${messages.length} email chưa đọc (IMAP).`);

        let newCandidates = [];

        for (let item of messages) {
            const bodyPart = item.parts.find(p => p.which === '');
            const parsedMail = await simpleParser(bodyPart.body);

            const subject = parsedMail.subject || '';
            const textBody = parsedMail.text || '';
            const sender = parsedMail.from.value[0].address;

            if (subject.toLowerCase().includes('ứng tuyển') || sender.includes('topcv')) {
                const nameMatch = textBody.match(/Ứng viên:\s*(.*)/i) || textBody.match(/Họ tên:\s*(.*)/i);
                const phoneMatch = textBody.match(/SĐT:\s*([\d\.\-\s]+)/i);
                const positionMatch = subject.match(/vị trí\s+(.*)/i);

                let cvFileName = '';
                if (parsedMail.attachments && parsedMail.attachments.length > 0) {
                    const attachment = parsedMail.attachments[0];
                    if (attachment.filename.endsWith('.pdf')) {
                        cvFileName = `${Date.now()}_${attachment.filename}`;
                        fs.writeFileSync(path.join(attachmentsDir, cvFileName), attachment.content);
                    }
                }

                newCandidates.push({
                    id: Math.random().toString(36).substring(2, 9),
                    name: nameMatch ? nameMatch[1].trim() : 'Ứng viên chưa rõ tên',
                    phone: phoneMatch ? phoneMatch[1].trim() : '',
                    position: positionMatch ? positionMatch[1].trim() : 'Không rõ vị trí',
                    source: sender.includes('topcv') ? 'TopCV (Mail)' : 'VietnamWorks (Mail)',
                    status: 'SCREENING',
                    appliedDate: new Date().toLocaleDateString('vi-VN'),
                    cvLink: cvFileName
                });
            }
        }

        // Lưu vào SQLite
        const added = await db.insertManyCandidates(newCandidates);
        await db.addScanHistory({ time: new Date().toLocaleString('vi-VN'), source: 'IMAP', found: newCandidates.length, added, duplicates: 0 });

        connection.end();
        console.log(`🎯 Đã quét thêm ${added} CV mới (IMAP)!`);
        res.json({ message: 'Quét IMAP thành công', count: added, data: newCandidates });

    } catch (err) {
        console.error('❌ Lỗi IMAP:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// API: Quét tất cả nguồn
// ============================================================
app.post('/api/scan', async (req, res) => {
    const results = { outlook: null, totalAdded: 0 };

    const accessToken = getAccessToken();
    if (accessToken) {
        try {
            const candidates = await scanOutlookEmails(accessToken, { daysBack: 7 });
            const unique = [];
            for (const c of candidates) {
                const exists = await db.candidateExistsByOutlookMsgId(c.outlookMsgId);
                if (!exists) unique.push(c);
            }
            const added = await db.insertManyCandidates(unique);
            results.outlook = { found: candidates.length, added };
            results.totalAdded += added;

            await db.addScanHistory({ time: new Date().toLocaleString('vi-VN'), source: 'Outlook', found: candidates.length, added, duplicates: candidates.length - added });
        } catch (e) {
            results.outlook = { error: e.message };
        }
    }

    const allCandidates = await db.getAllCandidates();

    res.json({
        message: `Quét hoàn tất! Thêm ${results.totalAdded} CV mới.`,
        count: results.totalAdded,
        details: results,
        data: allCandidates.slice(0, results.totalAdded)
    });
});

// ============================================================
// API: Lịch sử quét
// ============================================================
app.get('/api/scan/history', async (req, res) => {
    const history = await db.getScanHistory();
    res.json(history);
});

// ============================================================
// API: Xóa ứng viên
// ============================================================
app.delete('/api/candidates/:id', async (req, res) => {
    const deleted = await db.deleteCandidate(req.params.id);
    res.json({ deleted });
});

// ============================================================
// API: Cập nhật ứng viên
// ============================================================
app.patch('/api/candidates/:id', async (req, res) => {
    const candidate = await db.updateCandidate(req.params.id, req.body);
    if (!candidate) return res.status(404).json({ error: 'Không tìm thấy ứng viên' });
    res.json(candidate);
});

// ============================================================
// API: Cấu hình Azure (cho Settings page)
// ============================================================
const configFilePath = path.join(__dirname, 'config.json');

function loadConfig() {
    try {
        if (fs.existsSync(configFilePath)) {
            return JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
        }
    } catch (e) { console.warn('Không đọc được config.json:', e.message); }
    return {};
}

function saveConfig(config) {
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), 'utf-8');
}

const savedConfig = loadConfig();
if (savedConfig.AZURE_CLIENT_ID) process.env.AZURE_CLIENT_ID = savedConfig.AZURE_CLIENT_ID;
if (savedConfig.AZURE_TENANT_ID) process.env.AZURE_TENANT_ID = savedConfig.AZURE_TENANT_ID;
if (savedConfig.AZURE_CLIENT_SECRET) process.env.AZURE_CLIENT_SECRET = savedConfig.AZURE_CLIENT_SECRET;
if (savedConfig.DATABASE_URL) process.env.DATABASE_URL = savedConfig.DATABASE_URL;

app.get('/api/config', (req, res) => {
    const config = loadConfig();
    res.json({
        AZURE_CLIENT_ID: config.AZURE_CLIENT_ID || process.env.AZURE_CLIENT_ID || '',
        AZURE_TENANT_ID: config.AZURE_TENANT_ID || process.env.AZURE_TENANT_ID || 'common',
        AZURE_CLIENT_SECRET_SET: !!(config.AZURE_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET),
        DATABASE_URL_SET: !!(config.DATABASE_URL || process.env.DATABASE_URL),
        AUTO_SCAN: config.AUTO_SCAN || process.env.AUTO_SCAN || 'false',
        configured: isConfigured()
    });
});

app.post('/api/config', async (req, res) => {
    const { AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET, DATABASE_URL, AUTO_SCAN } = req.body;
    const config = loadConfig();

    if (AZURE_CLIENT_ID !== undefined) { config.AZURE_CLIENT_ID = AZURE_CLIENT_ID; process.env.AZURE_CLIENT_ID = AZURE_CLIENT_ID; }
    if (AZURE_TENANT_ID !== undefined) { config.AZURE_TENANT_ID = AZURE_TENANT_ID; process.env.AZURE_TENANT_ID = AZURE_TENANT_ID; }
    if (AZURE_CLIENT_SECRET !== undefined && AZURE_CLIENT_SECRET !== '') { config.AZURE_CLIENT_SECRET = AZURE_CLIENT_SECRET; process.env.AZURE_CLIENT_SECRET = AZURE_CLIENT_SECRET; }
    
    let dbChanged = false;
    if (DATABASE_URL !== undefined && DATABASE_URL !== '') { 
        config.DATABASE_URL = DATABASE_URL; 
        process.env.DATABASE_URL = DATABASE_URL; 
        dbChanged = true;
    }
    
    if (AUTO_SCAN !== undefined) { config.AUTO_SCAN = AUTO_SCAN; process.env.AUTO_SCAN = AUTO_SCAN; }

    saveConfig(config);
    console.log('✅ Đã lưu cấu hình mới.');
    
    if (dbChanged) {
        console.log('🔄 Đang chuyển đổi Database...');
        await db.initDb();
    }
    
    res.json({ message: 'Đã lưu cấu hình thành công!', configured: isConfigured() });
});

// ============================================================
// Auto-scan bằng cron (mỗi 10 phút)
// ============================================================
if (process.env.AUTO_SCAN === 'true') {
    cron.schedule('*/10 * * * *', async () => {
        console.log('\n⏰ [Auto-scan] Bắt đầu quét tự động...');
        const accessToken = getAccessToken();
        if (accessToken) {
            try {
                const candidates = await scanOutlookEmails(accessToken, { daysBack: 1, onlyUnread: true });
                const unique = [];
                for (const c of candidates) {
                    if (!(await db.candidateExistsByOutlookMsgId(c.outlookMsgId))) unique.push(c);
                }
                if (unique.length > 0) {
                    const added = await db.insertManyCandidates(unique);
                    console.log(`  ✅ Auto-scan: Thêm ${added} CV mới!`);
                } else {
                    console.log('  📭 Auto-scan: Không có CV mới.');
                }
            } catch (e) {
                console.error(`  ❌ Auto-scan error: ${e.message}`);
            }
        } else {
            console.log('  ⚠️ Auto-scan: Chưa đăng nhập Outlook, bỏ qua.');
        }
    });
    console.log('⏰ Auto-scan đã bật: quét mỗi 10 phút');
}

// ============================================================
// Serve Frontend (Production - khi deploy lên Render)
// ============================================================
const frontendBuild = path.join(__dirname, '..', 'ats-web', 'dist');
if (fs.existsSync(frontendBuild)) {
    app.use(express.static(frontendBuild));
    // SPA fallback - tất cả route không phải API → trả về index.html
    app.use((req, res, next) => {
        if (!req.path.startsWith('/api') && !req.path.startsWith('/auth') && !req.path.startsWith('/attachments')) {
            res.sendFile(path.join(frontendBuild, 'index.html'));
        } else {
            next();
        }
    });
    console.log('🌐 Frontend: Serving từ ats-web/dist/');
}

// ============================================================
// Start Server
// ============================================================
// API: Master Data (Quản lý các danh sách dropdown)
// ============================================================
const masterDataPath = path.join(__dirname, 'master_data.json');
const defaultMasterData = {
  sources: ['Mail HR', 'Joboko', 'Vietnamworks', 'Vieclam24h', 'LinkedIn', 'TopCV', 'Mail Info', 'JobsGo', 'UCTalent', 'Agri.job'],
  positions: [
    'Tự động hóa - Kỹ sư', 'Tự động hóa - TTS', 'Hệ thống điện - TTS', 'Hệ thống điện - Kỹ sư',
    'Vận hành Solar - Kỹ sư', 'Cơ Điện - KTV Cơ khí NN', 'Cơ Điện - TTS', 'Marketing', 'Fullstack Dev',
    'KS Nông nghiệp (Ninh Thuận)', 'KS Nông nghiệp (Đà Nẵng)', 'Nông sản - KD Phát triển TT',
    'Nông sản - TTS Kinh doanh', 'Nông sản - Vận hành cung ứng', 'Thương mại Vật tư', 'Môi trường - Kỹ sư',
    'HCNS - TTS', 'Mua hàng dự án (Điện/ Solar)', 'Kế toán vật tư - dự án', 'TTS kế toán', 'TTS MKT', 'TTS O&M Solar'
  ],
  hrPersons: ['Ms. Linh', 'Ms. Thảo', 'Ms. Lai', 'Mr. Đức Anh', 'Mr. Rôn'],
  scrStatus: ['CV not accept', 'Screening', 'Pending'],
  scrResult: ['Interview', 'Fail', 'Pending'],
  intResult: ['Pass', 'Fail', 'Pending'],
  offResult: ['Xác nhận', 'Từ chối']
};

app.get('/api/master-data', (req, res) => {
    try {
        if (!fs.existsSync(masterDataPath)) {
            fs.writeFileSync(masterDataPath, JSON.stringify(defaultMasterData, null, 2));
            return res.json(defaultMasterData);
        }
        const data = JSON.parse(fs.readFileSync(masterDataPath, 'utf8'));
        res.json(data);
    } catch (e) {
        console.error('Lỗi đọc master data:', e);
        res.json(defaultMasterData);
    }
});

app.post('/api/master-data', (req, res) => {
    try {
        fs.writeFileSync(masterDataPath, JSON.stringify(req.body, null, 2));
        res.json({ message: 'Lưu cấu hình thành công!' });
    } catch (e) {
        console.error('Lỗi lưu master data:', e);
        res.status(500).json({ error: 'Không thể lưu Master Data' });
    }
});

// ============================================================
const PORT = process.env.PORT || 3001;

async function start() {
    await db.initDb();
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log('');
        console.log('═══════════════════════════════════════════════════');
        console.log(`🚀 ATS Backend Server đang chạy tại http://0.0.0.0:${PORT}`);
        console.log(`💾 Database: ${db.isPostgres ? 'PostgreSQL (Render)' : 'SQLite (Local)'}`);
        console.log('═══════════════════════════════════════════════════');
        console.log('');

        if (!isConfigured()) {
            console.log('⚠️  CHƯA CẤU HÌNH OUTLOOK:');
            console.log('   Vào Settings trên web → Kết nối Outlook → Điền Azure credentials');
        } else {
            console.log('✅ Azure đã cấu hình. Bấm "Kết nối Outlook" trên web để đăng nhập.');
        }
        console.log('');
    });
}

start();

// Đóng DB an toàn khi tắt server
process.on('SIGINT', () => { db.closeDb(); process.exit(0); });
process.on('SIGTERM', () => { db.closeDb(); process.exit(0); });


