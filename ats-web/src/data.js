export const mockCandidates = [
  { 
    id: '1', 
    name: 'Trần Văn Quyết', 
    yob: '2001',
    phone: '0987654321',
    position: 'Tự động hóa - TTS', 
    source: 'Mail HR', 
    status: 'INTERVIEW', 
    appliedDate: '2025-07-11',
    hrPerson: 'Lai',
    cvLink: 'https://drive.google.com/...',
    cvStatus: 'Pass',
    scrNote: 'SV năm 4, mục tiêu TT lấy kn', scrResult: 'Interview', scrReason: '',
    intTime: '2025-07-13 00:00', intResult: '', intReason: '',
    offResult: '', offReason: '', onboardDate: ''
  },
  { 
    id: '2', 
    name: 'Nguyễn Văn A', 
    yob: '1998',
    phone: '0912345678',
    position: 'Tự động hóa - Kỹ sư', 
    source: 'Mail HR', 
    status: 'ONBOARD', 
    appliedDate: '2025-07-10',
    hrPerson: 'Linh',
    cvLink: 'https://drive.google.com/...',
    cvStatus: 'CV not accept',
    scrNote: '', scrResult: 'Interview', scrReason: '',
    intTime: '2025-07-12 14:00', intResult: 'Pass', intReason: 'Đạt yêu cầu',
    offResult: 'Đồng ý', offReason: '', onboardDate: '2025-07-15'
  }
];

export const columns = [
  { id: 'SCREENING', title: 'Sơ Vấn Giới Thiệu (Screening)' },
  { id: 'INTERVIEW', title: 'Lên Lịch Phỏng Vấn (Interview)' },
  { id: 'POST-OFFER', title: 'Chờ Nhận Việc (Post-Offer)' },
  { id: 'ONBOARD', title: 'Đã Tiếp Nhận (Onboard)' },
];

export const masterData = {
  sources: ['Mail HR', 'Joboko', 'Vietnamworks', 'Vieclam24h', 'LinkedIn', 'TopCV', 'Mail Info', 'JobsGo', 'UCTalent', 'Agri.job'],
  positions: [
    'Tự động hóa - Kỹ sư', 'Tự động hóa - TTS', 'Hệ thống điện - TTS', 'Hệ thống điện - Kỹ sư',
    'Vận hành Solar - Kỹ sư', 'Cơ Điện - KTV Cơ khí NN', 'Cơ Điện - TTS', 'Marketing', 'Fullstack Dev',
    'KS Nông nghiệp (Ninh Thuận)', 'KS Nông nghiệp (Đà Nẵng)', 'Nông sản - KD Phát triển TT',
    'Nông sản - TTS Kinh doanh', 'Nông sản - Vận hành cung ứng', 'Thương mại Vật tư', 'Môi trường - Kỹ sư',
    'HCNS - TTS', 'Mua hàng dự án (Điện/ Solar)', 'Kế toán vật tư - dự án', 'TTS kế toán', 'TTS MKT', 'TTS O&M Solar'
  ],
  hrPersons: ['Linh', 'Thảo', 'Lai', 'Đức Anh', 'Rôn'],
  scrStatus: ['CV not accept', 'Screening', 'Pending'],
  scrResult: ['Interview', 'Fail', 'Pending'],
  intResult: ['Pass', 'Fail', 'Pending'],
  offResult: ['Xác nhận', 'Từ chối']
};
