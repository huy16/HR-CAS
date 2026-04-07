const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
require('dotenv').config();

// Import services & routes
const { router: authRouter, getAccessToken, isConfigured } = require('./routes/auth');
const { scanOutlookEmails } = require('./services/outlook-service');

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
// In-memory Database (Prototype)
// ============================================================
let db = {
    candidates: [],
    scanHistory: [] // Lịch sử quét
};

// ============================================================
// Auth Routes - Đăng nhập Microsoft
// ============================================================
app.use('/auth', authRouter);

// ============================================================
// API: Lấy danh sách ứng viên
// ============================================================
app.get('/api/candidates', (req, res) => {
    res.json(db.candidates);
});

// ============================================================
// API: Quét email Outlook (Microsoft Graph API)
// ============================================================
app.post('/api/scan/outlook', async (req, res) => {
    try {
        // Kiểm tra Azure đã cấu hình chưa
        if (!isConfigured()) {
            return res.status(400).json({
                error: 'Chưa cấu hình Azure credentials',
                message: 'Hãy điền AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET trong file .env rồi truy cập http://localhost:3001/auth/login để đăng nhập.'
            });
        }

        // Kiểm tra đã đăng nhập chưa
        const accessToken = getAccessToken();
        if (!accessToken) {
            return res.status(401).json({
                error: 'Chưa đăng nhập Outlook',
                loginUrl: 'http://localhost:3001/auth/login',
                message: 'Truy cập http://localhost:3001/auth/login để đăng nhập tài khoản Outlook trước.'
            });
        }

        // Quét email
        const options = {
            maxEmails: req.body.maxEmails || 50,
            onlyUnread: req.body.onlyUnread !== false,
            markAsRead: req.body.markAsRead || false,
            daysBack: req.body.daysBack || 7
        };

        const newCandidates = await scanOutlookEmails(accessToken, options);

        // Loại bỏ trùng lặp (theo outlookMsgId)
        const existingMsgIds = new Set(db.candidates.map(c => c.outlookMsgId).filter(Boolean));
        const uniqueCandidates = newCandidates.filter(c => !existingMsgIds.has(c.outlookMsgId));

        // Thêm vào database
        db.candidates.unshift(...uniqueCandidates);

        // Ghi lịch sử quét
        db.scanHistory.unshift({
            time: new Date().toLocaleString('vi-VN'),
            source: 'Outlook',
            found: newCandidates.length,
            added: uniqueCandidates.length,
            duplicates: newCandidates.length - uniqueCandidates.length
        });

        res.json({
            message: 'Quét Outlook thành công!',
            found: newCandidates.length,
            added: uniqueCandidates.length,
            duplicates: newCandidates.length - uniqueCandidates.length,
            data: uniqueCandidates
        });

    } catch (e) {
        console.error('❌ API scan/outlook error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ============================================================
// API: Quét email qua IMAP (Gmail - phương pháp cũ, giữ lại)
// ============================================================
app.post('/api/scan/imap', async (req, res) => {
    try {
        // Giữ lại chức năng IMAP cũ cho Gmail
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

        const searchCriteria = ['UNSEEN'];
        const fetchOptions = {
            bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', ''],
            struct: true,
            markSeen: false
        };

        const messages = await connection.search(searchCriteria, fetchOptions);
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
                const phoneMatch = textBody.match(/SĐT:\s*([\d\.\-\s]+)/i) || textBody.match(/C:\s*([\d\.\-\s]+)/i);
                const positionMatch = subject.match(/vị trí\s+(.*)/i);

                const name = nameMatch ? nameMatch[1].trim() : 'Ứng viên chưa rõ tên';
                const phone = phoneMatch ? phoneMatch[1].trim() : '';
                const position = positionMatch ? positionMatch[1].trim() : 'Không rõ vị trí';

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
                    name, phone, position,
                    source: sender.includes('topcv') ? 'TopCV (Mail)' : 'VietnamWorks (Mail)',
                    status: 'SCREENING',
                    appliedDate: new Date().toLocaleDateString('vi-VN'),
                    cvLink: cvFileName
                });
            }
        }

        for (const c of newCandidates) {
            db.candidates.unshift(c);
        }

        connection.end();
        console.log(`🎯 Đã quét thêm ${newCandidates.length} CV mới (IMAP)!`);
        res.json({ message: 'Quét IMAP thành công', count: newCandidates.length, data: newCandidates });

    } catch (err) {
        console.error('❌ Lỗi IMAP:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// API: Quét tất cả nguồn (Outlook + IMAP nếu có)
// ============================================================
app.post('/api/scan', async (req, res) => {
    const results = { outlook: null, imap: null, totalAdded: 0 };

    // Quét Outlook nếu đã đăng nhập
    const accessToken = getAccessToken();
    if (accessToken) {
        try {
            const candidates = await scanOutlookEmails(accessToken, { daysBack: 7 });
            const existingMsgIds = new Set(db.candidates.map(c => c.outlookMsgId).filter(Boolean));
            const unique = candidates.filter(c => !existingMsgIds.has(c.outlookMsgId));
            db.candidates.unshift(...unique);
            results.outlook = { found: candidates.length, added: unique.length };
            results.totalAdded += unique.length;
        } catch (e) {
            results.outlook = { error: e.message };
        }
    }

    res.json({
        message: `Quét hoàn tất! Thêm ${results.totalAdded} CV mới.`,
        count: results.totalAdded,
        details: results,
        data: db.candidates.slice(0, results.totalAdded)
    });
});

// ============================================================
// API: Lịch sử quét
// ============================================================
app.get('/api/scan/history', (req, res) => {
    res.json(db.scanHistory);
});

// ============================================================
// API: Xóa ứng viên
// ============================================================
app.delete('/api/candidates/:id', (req, res) => {
    const before = db.candidates.length;
    db.candidates = db.candidates.filter(c => c.id !== req.params.id);
    res.json({ deleted: db.candidates.length < before });
});

// ============================================================
// API: Cập nhật ứng viên
// ============================================================
app.patch('/api/candidates/:id', (req, res) => {
    const candidate = db.candidates.find(c => c.id === req.params.id);
    if (!candidate) return res.status(404).json({ error: 'Không tìm thấy ứng viên' });

    Object.assign(candidate, req.body);
    res.json(candidate);
});

// ============================================================
// API: Đọc cấu hình (cho Settings page)
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

// Load config từ file khi server khởi động (ghi đè lên .env nếu có)
const savedConfig = loadConfig();
if (savedConfig.AZURE_CLIENT_ID) process.env.AZURE_CLIENT_ID = savedConfig.AZURE_CLIENT_ID;
if (savedConfig.AZURE_TENANT_ID) process.env.AZURE_TENANT_ID = savedConfig.AZURE_TENANT_ID;
if (savedConfig.AZURE_CLIENT_SECRET) process.env.AZURE_CLIENT_SECRET = savedConfig.AZURE_CLIENT_SECRET;

app.get('/api/config', (req, res) => {
    const config = loadConfig();
    res.json({
        AZURE_CLIENT_ID: config.AZURE_CLIENT_ID || process.env.AZURE_CLIENT_ID || '',
        AZURE_TENANT_ID: config.AZURE_TENANT_ID || process.env.AZURE_TENANT_ID || 'common',
        // Mask secret cho bảo mật
        AZURE_CLIENT_SECRET_SET: !!(config.AZURE_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET),
        AUTO_SCAN: config.AUTO_SCAN || process.env.AUTO_SCAN || 'false',
        configured: isConfigured()
    });
});

app.post('/api/config', (req, res) => {
    const { AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET, AUTO_SCAN } = req.body;

    const config = loadConfig();

    if (AZURE_CLIENT_ID !== undefined) {
        config.AZURE_CLIENT_ID = AZURE_CLIENT_ID;
        process.env.AZURE_CLIENT_ID = AZURE_CLIENT_ID;
    }
    if (AZURE_TENANT_ID !== undefined) {
        config.AZURE_TENANT_ID = AZURE_TENANT_ID;
        process.env.AZURE_TENANT_ID = AZURE_TENANT_ID;
    }
    if (AZURE_CLIENT_SECRET !== undefined && AZURE_CLIENT_SECRET !== '') {
        config.AZURE_CLIENT_SECRET = AZURE_CLIENT_SECRET;
        process.env.AZURE_CLIENT_SECRET = AZURE_CLIENT_SECRET;
    }
    if (AUTO_SCAN !== undefined) {
        config.AUTO_SCAN = AUTO_SCAN;
        process.env.AUTO_SCAN = AUTO_SCAN;
    }

    saveConfig(config);
    console.log('✅ Đã lưu cấu hình Azure mới.');

    res.json({
        message: 'Đã lưu cấu hình thành công!',
        configured: isConfigured()
    });
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
                const existingMsgIds = new Set(db.candidates.map(c => c.outlookMsgId).filter(Boolean));
                const unique = candidates.filter(c => !existingMsgIds.has(c.outlookMsgId));
                if (unique.length > 0) {
                    db.candidates.unshift(...unique);
                    console.log(`  ✅ Auto-scan: Thêm ${unique.length} CV mới!`);
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
// Start Server
// ============================================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log(`🚀 ATS Backend Server đang chạy tại http://localhost:${PORT}`);
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    console.log('📋 API Endpoints:');
    console.log(`   GET  /auth/status        → Trạng thái đăng nhập Outlook`);
    console.log(`   GET  /auth/login         → Đăng nhập Microsoft Outlook`);
    console.log(`   POST /api/scan           → Quét tất cả nguồn`);
    console.log(`   POST /api/scan/outlook   → Quét riêng Outlook`);
    console.log(`   POST /api/scan/imap      → Quét riêng IMAP (Gmail)`);
    console.log(`   GET  /api/candidates     → Danh sách ứng viên`);
    console.log('');

    if (!isConfigured()) {
        console.log('⚠️  CHƯA CẤU HÌNH OUTLOOK:');
        console.log('   1. Tạo Azure App tại https://portal.azure.com');
        console.log('   2. Điền AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET vào file .env');
        console.log('   3. Truy cập http://localhost:3001/auth/login để đăng nhập');
    } else {
        console.log('✅ Azure đã cấu hình. Truy cập http://localhost:3001/auth/login để đăng nhập Outlook.');
    }
    console.log('');
});
