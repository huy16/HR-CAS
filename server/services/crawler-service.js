const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

/**
 * Crawler Service for Recruitment Sites
 */
class CrawlerService {
    constructor() {
        this.browser = null;
    }

    async initBrowser() {
        const userDataDir = path.join(__dirname, '..', '..', 'puppeteer_data');
        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
        }

        console.log('🚀 Đang khởi động Chrome (Chế độ tự động hóa)...');
        const browser = await puppeteer.launch({
            headless: false, 
            slowMo: 100, 
            userDataDir: userDataDir,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1366,768',
                '--start-maximized'
            ]
        });

        const pages = await browser.pages();
        if (pages.length > 1) {
            await pages[0].close().catch(() => {});
        }

        browser.on('disconnected', () => {
            console.log('🔌 Phiên làm việc của trình duyệt đã kết thúc.');
        });

        return browser;
    }

    async closeBrowser(browser) {
        if (browser) {
            await browser.close().catch(() => {});
        }
    }

    async crawlCareerLink(email, password, period = '1d') {
        console.log(`🕵️ Bắt đầu cào CareerLink theo mốc thời gian: ${period}... Email: ${email ? 'đã nhập' : 'Trống!'}`);
        const browser = await this.initBrowser();
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 900 });
        
        const now = new Date();
        let targetMs = now.getTime() - (24 * 60 * 60 * 1000); 
        if (period === '1w') targetMs = now.getTime() - (7 * 24 * 60 * 60 * 1000);
        if (period === '1m') targetMs = now.getTime() - (30 * 24 * 60 * 60 * 1000);

        page.setDefaultTimeout(120000);

        try {
            console.log('🚀 Đang truy cập trang Dashboard CareerLink...');
            const homeUrl = 'https://www.careerlink.vn/nha-tuyen-dung/home';
            await page.goto(homeUrl, { waitUntil: 'networkidle2', timeout: 60000 });
            await new Promise(r => setTimeout(r, 2000)); 
            
            const isLoginInput = await page.$('#_username').catch(() => null);
            if (isLoginInput || page.url().includes('/dang-nhap') || page.url().includes('/login')) {
                console.log('📝 Thực hiện login...');
                await page.waitForSelector('#_username', { timeout: 15000 });
                await page.type('#_username', email);
                await page.type('#_password', password);
                await Promise.all([
                    page.click('#login_submit'),
                    page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
                ]);
            }

            console.log('🖱️ Click logo CareerLink để về Dashboard...');
            const logoSelector = '.navbar-brand, a[href*="/nha-tuyen-dung/home"]';
            await page.click(logoSelector).catch(() => console.log('⚠️ Không tìm thấy logo, tiếp tục...'));
            await new Promise(r => setTimeout(r, 2000));

            const dashboardHeader = await page.evaluate(() => {
                return document.body.innerText.includes('Đơn ứng tuyển gần đây');
            });
            if (!dashboardHeader) {
                console.log('⚠️ Không thấy bảng "Đơn ứng tuyển gần đây", thử chuyển hướng cưỡng bách...');
                await page.goto(homeUrl, { waitUntil: 'networkidle2' });
            }

            const debugPath = path.join(__dirname, '..', 'attachments', 'debug_scan.png');
            await page.screenshot({ path: debugPath });

            console.log('📊 Đang quét danh sách và lọc theo ngày tháng...');
            const rawCandidates = await page.evaluate((targetMs) => {
                const parseDate = (dateStr) => {
                    const now = new Date();
                    const cleanStr = dateStr.trim().toLowerCase();
                    
                    if (cleanStr.includes('phút trước')) return now.getTime() - (parseInt(cleanStr) * 60 * 1000);
                    if (cleanStr.includes('giờ trước')) return now.getTime() - (parseInt(cleanStr) * 60 * 60 * 1000);
                    if (cleanStr.includes('hôm qua') || cleanStr.includes('yesterday')) return now.getTime() - (24 * 60 * 60 * 1000);
                    if (cleanStr.includes('ngày trước') || cleanStr.includes('days ago')) return now.getTime() - (parseInt(cleanStr) * 24 * 60 * 60 * 1000);
                    if (cleanStr.includes('một ngày trước') || cleanStr.includes('a day ago')) return now.getTime() - (24 * 60 * 60 * 1000);

                    if (cleanStr.includes('/')) {
                        const [p1, p2, p3] = cleanStr.split('/').map(Number);
                        return new Date(p3, p2 - 1, p1).getTime();
                    }
                    return now.getTime();
                };

                const rows = Array.from(document.querySelectorAll('table tbody tr')).filter(r => {
                    return r.closest('section') ? r.closest('section').innerText.includes('Đơn ứng tuyển gần đây') : true;
                });

                const results = [];
                for (const row of rows) {
                    const cols = Array.from(row.querySelectorAll('td'));
                    if (cols.length < 4) continue;

                    const nameLink = cols[0].querySelector('a');
                    if (!nameLink) continue;

                    const timestamp = parseDate(cols[1]?.innerText || '');
                    if (timestamp < targetMs) break; // Dừng quét ngay khi gặp hồ sơ quá cũ

                    results.push({
                        name: nameLink.innerText.trim(),
                        cvLink: nameLink.href,
                        position: cols[3]?.innerText.trim() || 'N/A',
                        appliedDate: cols[1]?.innerText.trim(),
                        timestamp: timestamp
                    });
                }
                return results;
            }, targetMs);

            const filteredCandidates = rawCandidates.slice(0, 30);
            console.log(`🚀 Phát hiện ${filteredCandidates.length} ứng viên thỏa mãn điều kiện lọc.`);
            
            const finalCandidates = [];

            for (let i = 0; i < filteredCandidates.length; i++) {
                const c = filteredCandidates[i];
                console.log(`👤 [${i + 1}/${filteredCandidates.length}] Đang quét: ${c.name}`);
                
                try {
                    await page.goto(c.cvLink, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await new Promise(r => setTimeout(r, 1000));

                    if (i === 0) {
                        await page.screenshot({ path: path.join(__dirname, '..', 'attachments', 'debug_detail.png') });
                    }

                    // Chờ Header và nội dung chính hiển thị
                    await new Promise(r => setTimeout(r, 2000)); 

                    const details = await page.evaluate(() => {
                        const getDeepText = (root) => {
                            let str = root.innerText || "";
                            try {
                                const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);
                                let n;
                                while(n = walker.nextNode()) {
                                    if (n.shadowRoot) str += "\n " + getDeepText(n.shadowRoot);
                                }
                            } catch(e) {}
                            return str;
                        };

                        // 1. Thu thập văn bản từ Header theo dòng (Dựa trên cấu trúc người dùng cung cấp)
                        const headerEl = document.querySelector('.modal-header') || document.querySelector('.application-viewer-header') || document.body;
                        const rawHeaderText = getDeepText(headerEl);
                        const headerLines = rawHeaderText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                        // 2. Phân bổ dữ liệu theo dòng (CareerLink Header Structure)
                        let name = '', pos = '', phone = '', email = '';
                        
                        // Theo cấu trúc bạn gửi: 
                        // Dòng 0: Tên
                        // Dòng 1: Vị trí (hoặc Tên ➔ Vị trí)
                        // Dòng 2: Số điện thoại
                        // Dòng 3: "/" hoặc Email
                        
                        if (headerLines.length >= 2) {
                            if (headerLines[0].includes('\u2794')) {
                                const parts = headerLines[0].split('\u2794');
                                name = parts[0].trim();
                                pos = parts[1].trim();
                            } else {
                                name = headerLines[0];
                                pos = headerLines[1].replace('\u2794', '').trim();
                            }
                        }

                        // Tìm SĐT và Email trong các dòng tiếp theo
                        const pRegex = /(?:0|\+84)[35789](?:[\s.-]?\d){8,9}\b/;
                        const eRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

                        for (const line of headerLines) {
                            if (!phone) {
                                const m = line.match(pRegex);
                                if (m) phone = m[0].replace(/[\s.-]/g, '');
                            }
                            if (!email) {
                                const m = line.match(eRegex);
                                if (m) email = m[0];
                            }
                        }

                        // 3. Quét phần nội dung phía dưới cho Ghi chú
                        const getSectionContent = (keywords) => {
                            const els = Array.from(document.querySelectorAll('h3, h4, strong, .section-title'));
                            const target = els.find(el => keywords.some(k => el.innerText.toLowerCase().includes(k.toLowerCase())));
                            return target ? (target.nextElementSibling?.innerText || target.parentElement?.innerText.replace(target.innerText, '').trim()) : '';
                        };

                        return {
                            name: name || document.title.split('-')[0].trim(),
                            position: pos || 'N/A',
                            phone: phone,
                            email: email,
                            experience: getSectionContent(['Kinh nghiệm', 'Experience']) || 'Xem trong file đính kèm',
                            objective: getSectionContent(['Mục tiêu', 'Objective']) || 'Chưa cung cấp',
                            fileLink: Array.from(document.querySelectorAll('a')).find(a => a.href?.includes('download') || a.innerText?.includes('tải về'))?.href || null
                        };
                    });

                    const candidateId = 'cl_' + (c.cvLink.split('/').pop()?.split('?')[0] || Math.random().toString(36).substring(7));
                    const previewPath = path.join(__dirname, '..', 'attachments', `cv_preview_${candidateId}.png`);

                    // PDF Fallback
                    let finalPhone = details.phone;
                    let finalEmail = details.email;
                    if ((!finalPhone || !finalEmail) && details.fileLink) {
                        try {
                            const cookies = await page.cookies();
                            const cookieHeader = cookies.map(ck => `${ck.name}=${ck.value}`).join('; ');
                            const pdfReq = await fetch(details.fileLink, { headers: { 'Cookie': cookieHeader } });
                            if (pdfReq.ok) {
                                const buffer = await pdfReq.arrayBuffer();
                                const pdfData = await pdfParse(Buffer.from(buffer));
                                const text = pdfData.text || '';
                                if (!finalPhone) finalPhone = (text.match(/(?:0|\+84)[35789](?:[\s.-]?\d){8}\b/) || [''])[0].replace(/[\s.-]/g, '');
                                if (!finalEmail) finalEmail = (text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/) || [''])[0];
                            }
                        } catch(e) {}
                    }

                    finalCandidates.push({
                        ...c,
                        id: candidateId,
                        name: details.name || c.name,
                        phone: finalPhone,
                        email: finalEmail,
                        position: (details.position && details.position !== 'N/A') ? details.position : c.position,
                        source: 'CareerLink',
                        status: 'SCREENING',
                        cvStatus: 'Screening',
                        appliedDate: new Date().toLocaleDateString('vi-VN'),
                        scrNote: `🎯 MỤC TIÊU: ${details.objective}\n\n💼 KINH NGHIỆM: ${details.experience}`
                    });

                } catch (err) {
                    console.error(`⚠️ Lỗi khi quét chi tiết ${c.name}:`, err.message);
                }
            }

            console.log(`✅ Hoàn tất! Đã thu thập ${finalCandidates.length} ứng viên.`);
            return finalCandidates;
        } catch (error) {
            console.error('❌ Lỗi cào CareerLink:', error.message);
            throw error;
        } finally {
            if (page) await page.close().catch(() => {});
            await this.closeBrowser(browser);
        }
    }
}

module.exports = new CrawlerService();
