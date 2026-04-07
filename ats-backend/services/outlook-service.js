/**
 * Outlook Email Scanner - Microsoft Graph API
 * Quét email tuyển dụng từ Outlook (TopCV, VietnamWorks, v.v.)
 * Miễn phí - sử dụng Microsoft Graph API
 */

const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');
const fs = require('fs');
const path = require('path');

// Thư mục lưu CV đính kèm
const attachmentsDir = path.join(__dirname, '..', 'attachments');
if (!fs.existsSync(attachmentsDir)) {
    fs.mkdirSync(attachmentsDir, { recursive: true });
}

/**
 * Tạo Microsoft Graph Client từ access token
 */
function createGraphClient(accessToken) {
    return Client.init({
        authProvider: (done) => {
            done(null, accessToken);
        }
    });
}

/**
 * Quét email tuyển dụng từ Outlook
 * @param {string} accessToken - OAuth2 access token
 * @param {object} options - Tùy chọn quét
 * @returns {Array} Danh sách ứng viên mới
 */
async function scanOutlookEmails(accessToken, options = {}) {
    const {
        maxEmails = 50,
        onlyUnread = true,
        markAsRead = false,
        daysBack = 7
    } = options;

    const client = createGraphClient(accessToken);
    console.log('📧 Bắt đầu quét email Outlook...');

    try {
        // Tính ngày bắt đầu quét
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - daysBack);
        const sinceDateStr = sinceDate.toISOString();

        // Build filter: email chưa đọc + trong khoảng thời gian
        let filter = `receivedDateTime ge ${sinceDateStr}`;
        if (onlyUnread) {
            filter += ' and isRead eq false';
        }

        // Gọi Microsoft Graph API để lấy email
        const messages = await client
            .api('/me/messages')
            .filter(filter)
            .select('id,subject,from,body,receivedDateTime,hasAttachments,isRead')
            .top(maxEmails)
            .orderby('receivedDateTime desc')
            .get();

        console.log(`📬 Tìm thấy ${messages.value.length} email trong ${daysBack} ngày qua.`);

        const newCandidates = [];

        for (const msg of messages.value) {
            const subject = msg.subject || '';
            const senderEmail = msg.from?.emailAddress?.address || '';
            const senderName = msg.from?.emailAddress?.name || '';
            const bodyText = stripHtml(msg.body?.content || '');
            const receivedDate = msg.receivedDateTime;

            // Kiểm tra xem có phải email tuyển dụng không
            if (!isRecruitmentEmail(subject, senderEmail, bodyText)) {
                continue;
            }

            console.log(`  ✅ Phát hiện email tuyển dụng: "${subject}" từ ${senderEmail}`);

            // Trích xuất thông tin ứng viên
            const candidateInfo = parseCandidate(subject, bodyText, senderEmail);

            // Xử lý file đính kèm (CV)
            let cvFileName = '';
            if (msg.hasAttachments) {
                cvFileName = await downloadAttachments(client, msg.id);
            }

            const candidate = {
                id: generateId(),
                name: candidateInfo.name,
                phone: candidateInfo.phone,
                email: candidateInfo.email,
                position: candidateInfo.position,
                source: candidateInfo.source,
                status: 'SCREENING',
                appliedDate: new Date(receivedDate).toLocaleDateString('vi-VN'),
                cvLink: cvFileName,
                yob: candidateInfo.yob || '',
                outlookMsgId: msg.id
            };

            newCandidates.push(candidate);

            // Đánh dấu đã đọc nếu cần
            if (markAsRead && !msg.isRead) {
                try {
                    await client.api(`/me/messages/${msg.id}`).update({ isRead: true });
                } catch (e) {
                    console.warn(`  ⚠️ Không thể đánh dấu đã đọc: ${e.message}`);
                }
            }
        }

        console.log(`🎯 Đã trích xuất ${newCandidates.length} CV ứng viên mới!`);
        return newCandidates;

    } catch (err) {
        console.error('❌ Lỗi quét Outlook:', err.message);
        throw err;
    }
}

/**
 * Kiểm tra email có phải liên quan tuyển dụng không
 */
function isRecruitmentEmail(subject, sender, body) {
    const subjectLower = subject.toLowerCase();
    const senderLower = sender.toLowerCase();
    const bodyLower = body.toLowerCase();

    // Danh sách keyword từ các trang tuyển dụng
    const recruitmentKeywords = [
        'ứng tuyển', 'ung tuyen', 'apply', 'application',
        'cv', 'resume', 'hồ sơ', 'ho so',
        'ứng viên', 'ung vien', 'candidate',
        'tuyển dụng', 'tuyen dung', 'recruitment',
        'phỏng vấn', 'phong van', 'interview',
        'vị trí', 'vi tri', 'position',
        'new applicant', 'job application'
    ];

    // Danh sách sender từ các trang tuyển dụng
    const recruitmentSenders = [
        'topcv', 'vietnamworks', 'vnworks', 'careerbuilder',
        'jobstreet', 'linkedin', 'indeed', 'glassdoor',
        'timviecnhanh', 'vieclam24h', 'careerlink',
        'mywork', 'jobsgo', 'itviec'
    ];

    // Check sender
    if (recruitmentSenders.some(s => senderLower.includes(s))) return true;

    // Check subject
    if (recruitmentKeywords.some(kw => subjectLower.includes(kw))) return true;

    // Check body (chỉ check nếu subject có dấu hiệu liên quan)
    const bodyHints = ['ứng tuyển', 'cv', 'ứng viên', 'apply', 'candidate'];
    if (bodyHints.some(kw => bodyLower.includes(kw)) && subjectLower.length > 5) return true;

    return false;
}

/**
 * Trích xuất thông tin ứng viên từ email
 */
function parseCandidate(subject, body, senderEmail) {
    const result = {
        name: 'Ứng viên chưa rõ tên',
        phone: '',
        email: '',
        position: 'Chưa xác định',
        source: 'Outlook',
        yob: ''
    };

    // --- Xác định nguồn ---
    const senderLower = senderEmail.toLowerCase();
    if (senderLower.includes('topcv')) result.source = 'TopCV';
    else if (senderLower.includes('vietnamworks') || senderLower.includes('vnworks')) result.source = 'VietnamWorks';
    else if (senderLower.includes('linkedin')) result.source = 'LinkedIn';
    else if (senderLower.includes('indeed')) result.source = 'Indeed';
    else if (senderLower.includes('itviec')) result.source = 'ITviec';
    else if (senderLower.includes('careerbuilder')) result.source = 'CareerBuilder';
    else if (senderLower.includes('timviecnhanh')) result.source = 'TimViecNhanh';
    else if (senderLower.includes('vieclam24h')) result.source = 'ViecLam24h';
    else if (senderLower.includes('jobsgo')) result.source = 'JobsGO';
    else if (senderLower.includes('mywork')) result.source = 'MyWork';
    else result.source = 'Outlook (Email)';

    // --- Trích xuất tên ---
    const namePatterns = [
        /Ứng viên[:\s]+([^\n\r,<]+)/i,
        /Họ tên[:\s]+([^\n\r,<]+)/i,
        /Họ và tên[:\s]+([^\n\r,<]+)/i,
        /Candidate[:\s]+([^\n\r,<]+)/i,
        /Name[:\s]+([^\n\r,<]+)/i,
        /Tên[:\s]+([^\n\r,<]+)/i,
        /Applicant[:\s]+([^\n\r,<]+)/i,
    ];
    for (const pattern of namePatterns) {
        const match = body.match(pattern) || subject.match(pattern);
        if (match && match[1].trim().length > 1 && match[1].trim().length < 60) {
            result.name = match[1].trim();
            break;
        }
    }

    // --- Trích xuất SĐT ---
    const phonePatterns = [
        /(?:SĐT|Số điện thoại|Phone|ĐT|Di động|Mobile|Tel)[:\s]*([0-9\.\-\s\+]{8,15})/i,
        /(?:^|\s)(0[0-9]{9,10})(?:\s|$|,)/m,
        /(?:^|\s)(\+84[0-9]{9,10})(?:\s|$|,)/m,
    ];
    for (const pattern of phonePatterns) {
        const match = body.match(pattern);
        if (match) {
            result.phone = match[1].trim().replace(/[\.\-\s]/g, '');
            break;
        }
    }

    // --- Trích xuất email ứng viên ---
    const emailPatterns = [
        /(?:Email|E-mail|Mail)[:\s]*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i,
    ];
    for (const pattern of emailPatterns) {
        const match = body.match(pattern);
        if (match) {
            result.email = match[1].trim();
            break;
        }
    }

    // --- Trích xuất vị trí ---
    const posPatterns = [
        /[Vv]ị trí[:\s]+([^\n\r,<]+)/i,
        /[Pp]osition[:\s]+([^\n\r,<]+)/i,
        /ứng tuyển vị trí[:\s]+([^\n\r,<]+)/i,
        /[Aa]pply(?:ing)? for[:\s]+([^\n\r,<]+)/i,
        /[Cc]hức danh[:\s]+([^\n\r,<]+)/i,
    ];
    // Ưu tiên tìm trong subject trước
    for (const pattern of posPatterns) {
        const match = subject.match(pattern);
        if (match && match[1].trim().length > 1 && match[1].trim().length < 80) {
            result.position = match[1].trim();
            break;
        }
    }
    // Nếu chưa tìm được, tìm trong body
    if (result.position === 'Chưa xác định') {
        for (const pattern of posPatterns) {
            const match = body.match(pattern);
            if (match && match[1].trim().length > 1 && match[1].trim().length < 80) {
                result.position = match[1].trim();
                break;
            }
        }
    }

    // --- Trích xuất năm sinh ---
    const yobPatterns = [
        /(?:Năm sinh|YoB|Date of birth|Ngày sinh|Sinh năm)[:\s]*(\d{4})/i,
        /(?:Năm sinh|YoB|Date of birth|Ngày sinh|Sinh năm)[:\s]*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.](\d{4})/i,
    ];
    for (const pattern of yobPatterns) {
        const match = body.match(pattern);
        if (match) {
            result.yob = match[1];
            break;
        }
    }

    return result;
}

/**
 * Download file đính kèm (CV) từ email
 */
async function downloadAttachments(client, messageId) {
    try {
        const attachments = await client
            .api(`/me/messages/${messageId}/attachments`)
            .get();

        const validExtensions = ['.pdf', '.doc', '.docx'];
        let savedFile = '';

        for (const att of attachments.value) {
            if (att['@odata.type'] !== '#microsoft.graph.fileAttachment') continue;

            const fileName = att.name || 'unknown';
            const ext = path.extname(fileName).toLowerCase();

            if (!validExtensions.includes(ext)) continue;

            const safeFileName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._\-\u00C0-\u024F\u1E00-\u1EFF]/g, '_')}`;
            const filePath = path.join(attachmentsDir, safeFileName);

            // Decode base64 content và lưu file
            const buffer = Buffer.from(att.contentBytes, 'base64');
            fs.writeFileSync(filePath, buffer);

            console.log(`  📎 Đã lưu CV: ${safeFileName} (${(buffer.length / 1024).toFixed(1)} KB)`);
            savedFile = safeFileName;
            break; // Chỉ lấy file CV đầu tiên
        }

        return savedFile;
    } catch (err) {
        console.warn(`  ⚠️ Lỗi download attachment: ${err.message}`);
        return '';
    }
}

/**
 * Loại bỏ HTML tags, giữ lại text thuần
 */
function stripHtml(html) {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/tr>/gi, '\n')
        .replace(/<\/td>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * Tạo ID ngắn
 */
function generateId() {
    return Math.random().toString(36).substring(2, 9);
}

module.exports = {
    scanOutlookEmails,
    createGraphClient
};
