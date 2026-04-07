/**
 * Microsoft OAuth2 Authentication Routes
 * Xử lý đăng nhập Microsoft → lấy Access Token → quét email
 */

const express = require('express');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const router = express.Router();

// MSAL Config - đọc từ .env
const msalConfig = {
    auth: {
        clientId: process.env.AZURE_CLIENT_ID || '',
        authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'common'}`,
        clientSecret: process.env.AZURE_CLIENT_SECRET || ''
    }
};

// Scopes cần thiết để đọc email
const SCOPES = ['Mail.Read', 'Mail.ReadWrite', 'User.Read'];

// In-memory token store (prototype - production nên dùng Redis/DB)
let tokenCache = {
    accessToken: null,
    expiresAt: null,
    refreshToken: null,
    account: null
};

/**
 * Kiểm tra cấu hình Azure đã đầy đủ chưa
 */
function isConfigured() {
    return !!(process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET);
}

/**
 * Lấy MSAL client instance
 */
function getMsalClient() {
    if (!isConfigured()) {
        throw new Error('Azure credentials chưa được cấu hình. Hãy điền AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET trong file .env');
    }
    return new ConfidentialClientApplication(msalConfig);
}

// ============================================================
// GET /auth/status - Kiểm tra trạng thái đăng nhập
// ============================================================
router.get('/status', (req, res) => {
    if (!isConfigured()) {
        return res.json({
            configured: false,
            authenticated: false,
            message: '⚠️ Chưa cấu hình Azure. Hãy điền AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET trong file .env'
        });
    }

    const isAuthenticated = tokenCache.accessToken && tokenCache.expiresAt && new Date() < new Date(tokenCache.expiresAt);

    res.json({
        configured: true,
        authenticated: isAuthenticated,
        account: tokenCache.account || null,
        expiresAt: tokenCache.expiresAt || null,
        message: isAuthenticated
            ? `✅ Đã đăng nhập: ${tokenCache.account}`
            : '🔐 Chưa đăng nhập. Truy cập /auth/login để kết nối Outlook.'
    });
});

// ============================================================
// GET /auth/login - Redirect đến Microsoft Login
// ============================================================
router.get('/login', async (req, res) => {
    try {
        const msalClient = getMsalClient();
        const APP_URL = process.env.APP_URL || 'https://hr-cas.onrender.com';
        const redirectUri = `${APP_URL}/auth/callback`;

        const authUrl = await msalClient.getAuthCodeUrl({
            scopes: SCOPES,
            redirectUri,
            prompt: 'select_account' // Luôn cho chọn tài khoản
        });

        res.redirect(authUrl);
    } catch (err) {
        console.error('❌ Lỗi tạo URL đăng nhập:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// GET /auth/callback - Nhận code từ Microsoft → đổi lấy token
// ============================================================
router.get('/callback', async (req, res) => {
    const { code, error, error_description } = req.query;

    if (error) {
        console.error('❌ OAuth Error:', error, error_description);
        return res.send(`
            <html><body style="font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #1a1a2e; color: #fff;">
                <div style="text-align: center; padding: 40px; background: rgba(255,255,255,0.05); border-radius: 16px; border: 1px solid rgba(255,0,0,0.3);">
                    <h2 style="color: #ff6b6b;">❌ Đăng nhập thất bại</h2>
                    <p>${error_description || error}</p>
                    <a href="/auth/login" style="color: #4ecdc4;">Thử lại →</a>
                </div>
            </body></html>
        `);
    }

    try {
        const msalClient = getMsalClient();
        const APP_URL = process.env.APP_URL || 'https://hr-cas.onrender.com';
        const redirectUri = `${APP_URL}/auth/callback`;

        const tokenResponse = await msalClient.acquireTokenByCode({
            code,
            scopes: SCOPES,
            redirectUri
        });

        // Lưu token
        tokenCache = {
            accessToken: tokenResponse.accessToken,
            expiresAt: tokenResponse.expiresOn,
            account: tokenResponse.account?.username || tokenResponse.account?.name || 'Unknown',
            idTokenClaims: tokenResponse.idTokenClaims
        };

        console.log(`✅ Đăng nhập Outlook thành công: ${tokenCache.account}`);
        console.log(`   Token hết hạn: ${tokenCache.expiresAt}`);

        // Redirect về frontend với thông báo thành công
        res.send(`
            <html><body style="font-family: 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #1a1a2e; color: #fff;">
                <div style="text-align: center; padding: 40px; background: rgba(255,255,255,0.05); border-radius: 16px; border: 1px solid rgba(78,205,196,0.3);">
                    <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
                    <h2 style="color: #4ecdc4; margin-bottom: 8px;">Kết nối Outlook thành công!</h2>
                    <p style="color: #aaa;">Tài khoản: <strong style="color: #fff;">${tokenCache.account}</strong></p>
                    <p style="color: #aaa; font-size: 14px;">Bạn có thể đóng tab này và quay lại ATS.</p>
                    <script>setTimeout(() => { window.close(); }, 3000);</script>
                </div>
            </body></html>
        `);

    } catch (err) {
        console.error('❌ Lỗi đổi token:', err.message);
        res.status(500).send(`
            <html><body style="font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #1a1a2e; color: #fff;">
                <div style="text-align: center; padding: 40px; background: rgba(255,255,255,0.05); border-radius: 16px; border: 1px solid rgba(255,0,0,0.3);">
                    <h2 style="color: #ff6b6b;">❌ Lỗi xác thực</h2>
                    <p>${err.message}</p>
                    <a href="/auth/login" style="color: #4ecdc4;">Thử lại →</a>
                </div>
            </body></html>
        `);
    }
});

// ============================================================
// GET /auth/logout - Xóa token
// ============================================================
router.get('/logout', (req, res) => {
    const account = tokenCache.account;
    tokenCache = { accessToken: null, expiresAt: null, refreshToken: null, account: null };
    console.log(`🔓 Đã đăng xuất Outlook: ${account}`);
    res.json({ message: `Đã đăng xuất ${account}` });
});

/**
 * Lấy access token hiện tại (dùng nội bộ)
 */
function getAccessToken() {
    if (!tokenCache.accessToken) return null;
    if (new Date() >= new Date(tokenCache.expiresAt)) {
        console.warn('⚠️ Token đã hết hạn. Cần đăng nhập lại.');
        return null;
    }
    return tokenCache.accessToken;
}

module.exports = { router, getAccessToken, isConfigured };
