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
            slowMo: 50,
            userDataDir: userDataDir,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1280,800',
                '--window-position=40,40'
            ]
        });

        // Đóng tab trống mặc định
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

    /**
     * CareerLink.vn - Tuyển dụng
     */
    async crawlCareerLink(email, password) {
        console.log('🕵️ Bắt đầu cào CareerLink...');
        const browser = await this.initBrowser();
        const page = await browser.newPage();
        
        // Tăng timeout mặc định lên 2 phút để bạn thoải mái giải mã Captcha
        page.setDefaultTimeout(120000);

        try {
            // 1. Cấu hình chặn tài nguyên thừa để tăng tốc (Ảnh, Font, Quảng cáo)
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                const resourceType = req.resourceType();
                const url = req.url().toLowerCase();
                if (['image', 'font', 'media'].includes(resourceType) || 
                    url.includes('google-analytics') || url.includes('facebook') || url.includes('gtm')) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            // 2. Điều hướng thẳng tới trang chủ Dashboard
            console.log('🚀 Đang truy cập trang chủ để tìm đơn ứng tuyển...');
            const listUrl = 'https://www.careerlink.vn/nha-tuyen-dung/home';
            await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            
            // Nếu bị văng ra trang login
            if (page.url().includes('/dang-nhap') || page.url().includes('/login')) {
                console.log('📝 Chưa đăng nhập, đang thực hiện login...');
                await page.waitForSelector('#_username', { timeout: 15000 });
                await page.type('#_username', email);
                await page.type('#_password', password);
                await Promise.all([
                    page.click('#login_submit'),
                    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
                ]);
                await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            } else {
                console.log('🔓 Đã nhận diện phiên đăng nhập cũ.');
            }

            // 3. Đọc dữ liệu bảng ứng viên bằng selector href mở rộng (Kèm theo thao tác cuộn)
            console.log('📊 Đang cuộn trang để tải danh sách ứng viên gần đây...');
            // Cuộn xuống vài lần để kích hoạt lazy-load trên trang chủ
            for (let i = 0; i < 3; i++) {
                await page.evaluate(() => window.scrollBy(0, window.innerHeight));
                await new Promise(r => setTimeout(r, 1000));
            }

            console.log('📊 Đang quét danh sách ứng viên...');
            const basicCandidates = await page.evaluate(() => {
                // Thử lấy tất cả thẻ <a> có chứa "thu-xin-viec" hoặc có cấu trúc giống link hồ sơ
                const links = Array.from(document.querySelectorAll('a')).filter(a => {
                    const href = a.href || '';
                    // Các URL hồ sơ trên careerlink thường chứa 'thu-xin-viec-da-nhan' hoặc 'ung-vien' hoặc là một dãy số ID
                    return (href.includes('/thu-xin-viec-da-nhan/') && !href.endsWith('/latest')) || 
                           href.includes('/ung-vien/');
                });

                return links.map(link => {
                    const row = link.closest('tr, .row, .candidate-item') || link.parentElement?.parentElement;
                    const contentItems = row ? Array.from(row.children) : [];
                    
                    let position = 'N/A';
                    if (contentItems.length >= 4) {
                       // Trên bảng chuẩn, cột Công việc ở vị trí số 4 (index 3)
                       position = contentItems[3]?.innerText.trim() || 'N/A';
                    } else if (contentItems.length === 3) {
                       position = contentItems[2]?.innerText.trim() || 'N/A';
                    }

                    return {
                        name: link.innerText.trim(),
                        cvLink: link.href,
                        position: position
                    };
                }).filter(c => c.name && c.cvLink);
            });
            
            // Lọc ứng viên mới (Giới hạn 15 người mỗi lần quét để ổn định)
            const filteredCandidates = basicCandidates.slice(0, 15);

            console.log(`🚀 Tìm thấy ${filteredCandidates.length} ứng viên. Bắt đầu quét chuyên sâu...`);
            const finalCandidates = [];

            // 4. Quét từng ứng viên (Mỗi người khoảng 3-5s nhờ chặn tài nguyên thừa)
            for (let i = 0; i < filteredCandidates.length; i++) {
                const c = filteredCandidates[i];
                console.log(`👤 [${i + 1}/${filteredCandidates.length}] Đang quét chuyên sâu: ${c.name}`);
                
                try {
                    await page.goto(c.cvLink, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await page.waitForSelector('body', { timeout: 10000 });
                    
                    // Cuộn nhẹ để load nội dung ẩn
                    await page.evaluate(() => window.scrollBy(0, 500));
                    await new Promise(r => setTimeout(r, 800));

                    // --- MỚI: Lấy nội dung từ Iframe CV nếu tồn tại ---
                    let cvText = '';
                    try {
                        const frameHandle = await page.$('#application-modal iframe');
                        if (frameHandle) {
                            const frame = await frameHandle.contentFrame();
                            if (frame) {
                                console.log('📄 Đang trích xuất văn bản từ CV frame...');
                                cvText = await frame.evaluate(() => document.body.innerText);
                            }
                        }
                    } catch (fErr) {
                        console.warn('⚠️ Không thể đọc nội dung từ iframe:', fErr.message);
                    }

                    const details = await page.evaluate((extraText) => {
                        const getInfoByLabel = (label) => {
                            const elements = Array.from(document.querySelectorAll('p, div, span, li, td, b, strong'));
                            const found = elements.find(el => el.innerText.toLowerCase().includes(label.toLowerCase()));
                            return found ? found.innerText.split(':').pop().trim() : '';
                        };

                        // Gộp nội dung từ frame và body chính (ưu tiên frame lên trước)
                        const bodyText = (extraText + '\n' + document.body.innerText).trim();
                        
                        // Regex SĐT: Ưu tiên bắt các đầu số di động phổ biến (03, 05, 07, 08, 09)
                        // Bổ sung logic loại trừ các số máy bàn hoặc mã số doanh nghiệp (thường bắt đầu bằng 02, 04) nếu có thể
                        const allPhones = bodyText.match(/(?:0|\+84)[35789](?:[\s.-]?\d){8}\b/g) || [];
                        
                        // Lọc các số "nhạy cảm" (như mã số thuế/GPKD xuất hiện ở chân trang CareerLink)
                        // Chúng ta tìm trong bodyText xem con số đó có đi kèm từ khóa "GPKD" hay "Mã số" không
                        const phone = allPhones.find(p => {
                            const idx = bodyText.indexOf(p);
                            const context = bodyText.substring(Math.max(0, idx - 30), idx).toLowerCase();
                            return !context.includes('gpkd') && !context.includes('mã số') && !context.includes('tax');
                        }) || (allPhones.length > 0 ? allPhones[0] : '');

                        // Chỉ bắt đúng định dạng Email ứng viên (loại bỏ các email hệ thống CareerLink)
                        const allEmails = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
                        const email = allEmails.find(e => 
                            !e.includes('contact@careerlink.vn') && 
                            !e.includes('support@') &&
                            !e.includes('noreply')
                        ) || (allEmails.length > 0 ? allEmails[0] : '');

                        const getLevelInfo = (headerText) => {
                            const headers = Array.from(document.querySelectorAll('h3, h4, h5, strong, .title, b'));
                            const target = headers.find(h => h.innerText.toLowerCase().includes(headerText.toLowerCase()));
                            if (!target) return '';
                            let content = target.parentElement?.innerText || '';
                            return content.replace(target.innerText, '').trim();
                        };

                        const fileLinks = Array.from(document.querySelectorAll('a')).filter(a => 
                            (a.href && a.href.includes('download')) ||
                            (a.innerText && a.innerText.toLowerCase().includes('tải về')) ||
                            (a.href && a.href.includes('.pdf'))
                        );

                        return {
                            phone: phone.replace(/[\s.-]/g, ''),
                            email,
                            fileLink: fileLinks.length > 0 ? fileLinks[0].href : null,
                            experience: getLevelInfo('Kinh nghiệm làm việc') || 'Xem trong chi tiết',
                            objective: getLevelInfo('Mục tiêu nghề nghiệp') || 'Chưa cung cấp',
                            positionDetail: getInfoByLabel('Công việc') || getInfoByLabel('Hồ sơ ứng tuyển') || getInfoByLabel('Vị trí') || ''
                        };
                    }, cvText);
                    
                    // --- FALLBACK: PDF PARSING ----
                    let finalPhone = details.phone;
                    let finalEmail = details.email;
                    
                    if ((!finalPhone || !finalEmail) && details.fileLink) {
                        try {
                            const cookies = await page.cookies();
                            const cookieHeader = cookies.map(ck => `${ck.name}=${ck.value}`).join('; ');

                            const pdfReq = await fetch(details.fileLink, {
                                headers: { 'Cookie': cookieHeader }
                            });

                            if (pdfReq.ok) {
                                const buffer = await pdfReq.arrayBuffer();
                                const pdfData = await pdfParse(Buffer.from(buffer));
                                const text = pdfData.text || '';

                                if (!finalPhone) {
                                    const pMatch = text.match(/(?:0|\+84)[35789](?:[\s.-]?\d){8}\b/);
                                    if (pMatch) finalPhone = pMatch[0].replace(/[\s.-]/g, '');
                                }
                                if (!finalEmail) {
                                    const eMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                                    if (eMatch) finalEmail = eMatch[0];
                                }
                            }
                        } catch(pdfErr) {
                            console.error('Lỗi khi tải/đọc PDF cho:', c.name, pdfErr.message);
                        }
                    }

                    // --- NEW: CV SCREENSHOT CAPTURE (SCALED) ----
                    const candidateId = 'cl_' + (c.cvLink.split('/').pop()?.split('?')[0] || Math.random().toString(36).substring(7));
                    const previewFilename = `cv_preview_${candidateId}.png`;
                    const previewPath = path.join(__dirname, '..', 'attachments', previewFilename);
                    
                    try {
                        // Tìm iframe chứa CV
                        const frameHandle = await page.$('#application-modal iframe');
                        if (frameHandle) {
                            const frame = await frameHandle.contentFrame();
                            if (frame) {
                                // Thực hiện Zoom out để chụp được nhiều thông tin hơn (50% hoặc page-fit)
                                await frame.evaluate(() => {
                                    const select = document.querySelector('#scaleSelect');
                                    if (select) {
                                        select.value = 'page-fit'; // Scale để vừa chiều cao
                                        select.dispatchEvent(new Event('change'));
                                    }
                                });
                                // Đợi render
                                await new Promise(r => setTimeout(r, 1500));
                                
                                // Chụp ảnh khung nhìn
                                await page.screenshot({ 
                                    path: previewPath,
                                    clip: { x: 400, y: 100, width: 900, height: 1200 } // Khoanh vùng CV
                                });
                            }
                        } else {
                            // Nếu không có iframe (dạng text), chụp toàn bộ body
                            await page.screenshot({ path: previewPath, fullPage: true });
                        }
                    } catch (snapErr) {
                        console.error('Lỗi khi chụp ảnh CV:', snapErr.message);
                    }

                    finalCandidates.push({
                        ...c,
                        id: candidateId,
                        phone: finalPhone,
                        email: finalEmail,
                        preview_path: fs.existsSync(previewPath) ? `/attachments/${previewFilename}` : '',
                        position: c.position && c.position !== 'N/A' ? c.position : (details.positionDetail || 'Không xác định'),
                        source: 'CareerLink',
                        status: 'SCREENING',
                        cvStatus: 'Screening',
                        appliedDate: new Date().toLocaleDateString('vi-VN'),
                        scrNote: `🎯 MỤC TIÊU: ${details.objective}\n\n💼 KINH NGHIỆM: ${details.experience}`
                    });

                } catch (err) {
                    console.error(`⚠️ Lỗi khi quét chi tiết ${c.name}, bỏ qua:`, err.message);
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
