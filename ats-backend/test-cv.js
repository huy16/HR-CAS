const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const pdfParse = require('pdf-parse');
const path = require('path');
puppeteer.use(StealthPlugin());

async function testExtraction() {
    const detailUrl = 'https://www.careerlink.vn/nha-tuyen-dung/thu-xin-viec-da-nhan/19246208?job_id=3447303';
    console.log('Khởi động Puppeteer...');
    const userDataDir = path.join(__dirname, '..', 'puppeteer_data');
    
    const browser = await puppeteer.launch({
        headless: false,
        userDataDir: userDataDir,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    console.log('Đang truy cập:', detailUrl);
    
    try {
        await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));
        
        console.log('Quét DOM...');
        const details = await page.evaluate(() => {
            const getInfoByLabel = (label) => {
                const elements = Array.from(document.querySelectorAll('p, div, span, li, td, b, strong'));
                const found = elements.find(el => el.innerText.includes(label));
                return found ? found.innerText.replace(label, '').replace(':', '').trim() : '';
            };

            const bodyText = document.body.innerText;
            const phoneMatch = bodyText.match(/(?:0|\+84)[35789](?:[\s.-]?\d){8}\b/);
            const phone = phoneMatch ? phoneMatch[0].replace(/[\s.-]/g, '') : '';

            const emailMatch = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            const email = emailMatch ? emailMatch[0] : '';

            const getLevelInfo = (headerText) => {
                const headers = Array.from(document.querySelectorAll('h3, h4, h5, strong, .title, b'));
                const target = headers.find(h => h.innerText.toLowerCase().includes(headerText.toLowerCase()));
                if (!target) return '';
                let content = target.parentElement?.innerText || '';
                return content.replace(target.innerText, '').trim();
            };

            const fileLinkEl = Array.from(document.querySelectorAll('a')).find(a => 
                (a.href && a.href.includes('download')) ||
                (a.innerText && a.innerText.toLowerCase().includes('tải về')) ||
                (a.href && a.href.includes('.pdf'))
            );

            return {
                phone, email,
                fileLink: fileLinkEl ? fileLinkEl.href : null,
                experience: getLevelInfo('Kinh nghiệm làm việc') || 'Xem trong chi tiết',
                objective: getLevelInfo('Mục tiêu nghề nghiệp') || 'Chưa cung cấp',
                positionDetail: getInfoByLabel('Công việc') || getInfoByLabel('Hồ sơ ứng tuyển') || getInfoByLabel('Vị trí') || ''
            };
        });

        console.log('Cơ bản từ Web:', details);
        
        let finalPhone = details.phone;
        let finalEmail = details.email;
        
        if ((!finalPhone || !finalEmail) && details.fileLink) {
            console.log('SĐT hoặc Email trống, phát hiện file đính kèm:', details.fileLink);
            console.log('Bắt đầu tải PDF để bóc tách chữ...');
            
            const cookies = await page.cookies();
            const cookieHeader = cookies.map(ck => `${ck.name}=${ck.value}`).join('; ');

            const pdfReq = await fetch(details.fileLink, {
                headers: { 'Cookie': cookieHeader }
            });

            if (pdfReq.ok) {
                const buffer = await pdfReq.arrayBuffer();
                const pdfData = await pdfParse(Buffer.from(buffer));
                const text = pdfData.text || '';
                
                console.log('--- ĐÃ ĐỌC XONG PDF (Mẫu 50 chữ đầu) ---');
                console.log(text.substring(0, 50).replace(/\n/g, ' ') + '...');

                if (!finalPhone) {
                    const pMatch = text.match(/(?:0|\+84)[35789](?:[\s.-]?\d){8}\b/);
                    if (pMatch) {
                        finalPhone = pMatch[0].replace(/[\s.-]/g, '');
                        console.log('-> Tìm thấy Phone trong PDF:', finalPhone);
                    }
                }
                if (!finalEmail) {
                    const eMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                    if (eMatch) {
                        finalEmail = eMatch[0];
                        console.log('-> Tìm thấy Email trong PDF:', finalEmail);
                    }
                }
            } else {
                console.log('Không thể tải PDF, mã lỗi HTTP:', pdfReq.status);
            }
        }

        console.log('==== KẾT QUẢ CUỐI CÙNG ====');
        console.log('Email:', finalEmail);
        console.log('Phone:', finalPhone);
        console.log('Vị trí:', details.positionDetail);
        
    } catch (err) {
        console.error('Lỗi:', err);
    } finally {
        await browser.close();
    }
}

testExtraction();
