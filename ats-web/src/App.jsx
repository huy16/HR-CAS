import React, { useState, useRef, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Briefcase, LayoutDashboard, Settings, UserPlus, Users, Search, Bell, Upload, RefreshCw, Mic, ClipboardCheck, Mail, LogIn, CheckCircle, Loader } from 'lucide-react';
import * as XLSX from 'xlsx';
import { mockCandidates, columns, masterData } from './data';
import './App.css';

const API_URL = 'http://localhost:3001';

function App() {
  const [candidates, setCandidates] = useState(mockCandidates);
  const [activeTab, setActiveTab] = useState('board');
  const [outlookStatus, setOutlookStatus] = useState({ configured: false, authenticated: false, account: null });
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  // Load dữ liệu từ SQLite khi mở trang
  useEffect(() => {
    checkOutlookStatus();
    loadCandidatesFromDB();
  }, []);

  const loadCandidatesFromDB = async () => {
    try {
      const res = await fetch(`${API_URL}/api/candidates`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setCandidates(data);
        console.log(`💾 Đã load ${data.length} ứng viên từ database.`);
      }
    } catch (e) {
      console.log('Backend chưa chạy, dùng dữ liệu mẫu.');
    }
  };

  const checkOutlookStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/status`);
      const data = await res.json();
      setOutlookStatus(data);
    } catch (e) {
      console.log('Backend chưa chạy');
    }
  };

  const handleOutlookLogin = () => {
    // Mở popup đăng nhập Microsoft
    const popup = window.open(
      `${API_URL}/auth/login`,
      'outlook-login',
      'width=600,height=700,left=200,top=100'
    );
    // Kiểm tra khi popup đóng
    const timer = setInterval(() => {
      if (popup && popup.closed) {
        clearInterval(timer);
        checkOutlookStatus(); // Refresh trạng thái
      }
    }, 1000);
  }; 
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames.includes('CV ỨNG VIÊN') ? 'CV ỨNG VIÊN' : workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        // Parse the sheet to JSON
        const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const newCandidates = [];
        json.forEach((row, index) => {
          const name = row['Họ tên ứng viên'] || row['Họ Tên'] || row['Họ tên'];
          // Bỏ qua dòng trống không có tên
          if (!name || name.trim() === '') return;

          const position = row['Vị trí ứng tuyển'] || row['Vị trí'] || 'Chỉnh sửa sau';
          const source = row['Nguồn'] || 'Máy tính';
          
          // Trích xuất ngày tháng
          let appliedDate = new Date().toLocaleDateString('vi-VN');
          if (row['Ngày cập nhật']) {
             // XLSX sometimes parses dates as serial numbers
             if (typeof row['Ngày cập nhật'] === 'number') {
                const dateObj = new Date((row['Ngày cập nhật'] - (25567 + 2)) * 86400 * 1000);
                appliedDate = dateObj.toLocaleDateString('vi-VN');
             } else {
                appliedDate = row['Ngày cập nhật'];
             }
          }

          // Xử lý status nhẹ
          let status = 'SCREENING';
          const interviewResult = String(row['Unnamed: 14'] || row['Kết quả PV']).toLowerCase();
          const screeningResult = String(row['Unnamed: 11'] || row['Kết quả']).toLowerCase();
          const onboardDate = String(row['Unnamed: 18'] || row['Ngày nhận việc']).toLowerCase();

          if (onboardDate && onboardDate !== 'undefined' && onboardDate !== '') {
             status = 'ONBOARD';
          } else if (interviewResult.includes('pass')) {
             status = 'POST-OFFER';
          } else if (screeningResult.includes('pass') || screeningResult.includes('interview')) {
             status = 'INTERVIEW';
          }

          newCandidates.push({
            id: Math.random().toString(36).substring(2, 9),
            name,
            position,
            source,
            status,
            appliedDate
          });
        });

        if (newCandidates.length > 0) {
          // Lưu vào SQLite qua backend
          fetch(`${API_URL}/api/candidates/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ candidates: newCandidates })
          }).then(r => r.json()).then(result => {
            console.log('💾 Đã lưu vào database:', result);
          }).catch(e => console.warn('Backend chưa chạy, chỉ lưu tạm:', e));

          setCandidates(prev => [...newCandidates, ...prev]);
          setScanResult({ type: 'success', message: `Đã import ${newCandidates.length} ứng viên từ Excel!` });
          setTimeout(() => setScanResult(null), 5000);
        } else {
          setScanResult({ type: 'warning', message: 'Không tìm thấy dữ liệu hợp lệ trong file!' });
          setTimeout(() => setScanResult(null), 5000);
        }
      } catch (err) {
        console.error(err);
        alert('Có lỗi xảy ra khi đọc file Excel!');
      }
    };
    reader.readAsArrayBuffer(file);
    // Xoá input để có thể chọn lại file cũ nếu muốn
    e.target.value = null;
  };

  const handleSyncEmails = async (source = 'all') => {
    setIsScanning(true);
    setScanResult(null);
    try {
      const endpoint = source === 'outlook' ? '/api/scan/outlook' : '/api/scan';
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysBack: 7, onlyUnread: true })
      });
      const result = await response.json();

      if (response.status === 401) {
        // Chưa đăng nhập Outlook
        setScanResult({ type: 'warning', message: 'Chưa đăng nhập Outlook. Hãy bấm "Kết nối Outlook" trước.' });
        return;
      }

      if (!response.ok) {
        setScanResult({ type: 'error', message: result.error || result.message });
        return;
      }

      const added = result.added || result.count || 0;
      if (added > 0) {
        setCandidates(prev => [...(result.data || []), ...prev]);
        setScanResult({ type: 'success', message: `Đã tải về ${added} ứng viên mới!` });
      } else {
        setScanResult({ type: 'info', message: 'Không có CV mới nào trong hòm mail.' });
      }

      // Tự đóng thông báo sau 5 giây
      setTimeout(() => setScanResult(null), 5000);

    } catch (err) {
      console.error(err);
      setScanResult({ type: 'error', message: 'Không thể kết nối Backend Server (Port 3001).' });
    } finally {
      setIsScanning(false);
    }
  };

  const handleUpdateCandidate = (id, field, value) => {
    setCandidates(prev => prev.map(cand => {
      if (cand.id === id) {
        return { ...cand, [field]: value };
      }
      return cand;
    }));
  };

  const getDropdownClass = (value) => {
    if (!value) return '';
    const val = value.toLowerCase();
    if (['pass', 'đồng ý', 'xác nhận'].includes(val)) return 'success';
    if (['fail', 'từ chối', 'cv not accept'].includes(val)) return 'danger';
    if (['pending', 'interview', 'screening'].includes(val)) return 'warning';
    return '';
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const { source, destination } = result;

    if (source.droppableId !== destination.droppableId) {
      const updatedCandidates = candidates.map((cand) => {
        if (cand.id === result.draggableId) {
          return { ...cand, status: destination.droppableId };
        }
        return cand;
      });
      setCandidates(updatedCandidates);
    }
  };

  const getCandidatesByStatus = (status) => {
    return candidates.filter((c) => c.status === status);
  };

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src="/logo.png" alt="Logo" style={{ height: '32px', objectFit: 'contain', filter: 'drop-shadow(0 0 8px var(--primary-glow))' }} />
          <span>HR</span>
        </div>
        <nav className="nav-menu" style={{ paddingTop: '12px' }}>
          <a href="#" className={`nav-item ${activeTab === 'board' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('board'); }}>
            <LayoutDashboard className="icon" size={20} />
            Dashboard
          </a>
          <a href="#" className={`nav-item ${activeTab === 'cv_main' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('cv_main'); }}>
            <Users className="icon" size={20} />
            Candidates
          </a>
          <a href="#" className={`nav-item ${activeTab === 'interview' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('interview'); }}>
            <Mic className="icon" size={20} />
            Interview
          </a>
          <a href="#" className={`nav-item ${activeTab === 'onboard' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('onboard'); }}>
            <ClipboardCheck className="icon" size={20} />
            Onboard
          </a>
          <a href="#" className={`nav-item ${activeTab === 'jobs' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('jobs'); }}>
            <Briefcase className="icon" size={20} />
            Job Management
          </a>
          <a href="#" className={`nav-item ${activeTab === 'data_master' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('data_master'); }}>
            <Settings className="icon" size={20} />
            Settings
          </a>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <h1>
              {activeTab === 'board' && 'Recruitment Life Cycle (Kanban)'}
              {activeTab === 'cv_main' && 'Tất cả CV Ứng Viên'}
              {activeTab === 'interview' && 'Danh sách Lên Lịch Phỏng Vấn'}
              {activeTab === 'onboard' && 'Danh sách Nhận Việc (Onboard)'}
              {activeTab === 'jobs' && 'Quản lý Job Đăng Tuyển'}
              {activeTab === 'data_master' && 'Master Data Khởi Tạo'}
            </h1>
          </div>
          <div className="topbar-right">
            <div className="search-bar" style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px 12px' }}>
              <Search size={18} color="var(--text-muted)" />
              <input type="text" placeholder="Tìm kiếm ứng viên..." style={{ background: 'transparent', border: 'none', boxShadow: 'none', color: '#fff' }} />
            </div>
            <input 
              type="file" 
              accept=".xlsx,.xls,.csv" 
              style={{ display: 'none' }} 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
            />
            <button 
              className="btn-icon" 
              style={{ padding: '8px 12px', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500', transition: 'all 0.2s' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={18} />
              <span style={{ fontSize: '14px', color: '#fff' }}>Import File</span>
            </button>
            {/* Outlook Connection Status */}
            {outlookStatus.authenticated ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(78,205,196,0.1)', border: '1px solid rgba(78,205,196,0.3)', borderRadius: '8px', fontSize: '13px', color: '#4ecdc4' }}>
                <CheckCircle size={14} />
                <span>{outlookStatus.account}</span>
              </div>
            ) : (
              <button
                className="btn-icon"
                style={{ padding: '8px 12px', color: '#0078d4', border: '1px solid rgba(0,120,212,0.4)', background: 'rgba(0,120,212,0.08)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500', transition: 'all 0.2s' }}
                onClick={handleOutlookLogin}
              >
                <Mail size={18} />
                <span style={{ fontSize: '14px' }}>Kết nối Outlook</span>
              </button>
            )}
            <button 
              className="btn-primary" 
              style={{ background: outlookStatus.authenticated ? '#0078d4' : 'var(--success)', border: 'none', cursor: isScanning ? 'wait' : 'pointer', minWidth: '160px', justifyContent: 'center', opacity: isScanning ? 0.7 : 1 }}
              onClick={() => handleSyncEmails(outlookStatus.authenticated ? 'outlook' : 'all')}
              disabled={isScanning}
            >
              {isScanning ? <Loader size={18} className="spin-animation" /> : <RefreshCw size={18} />}
              {isScanning ? 'Đang quét...' : (outlookStatus.authenticated ? 'Quét Outlook' : 'Quét Mail')}
            </button>
            <button className="btn-primary" style={{ border: 'none', cursor: 'pointer', minWidth: '140px', justifyContent: 'center' }}>
              <UserPlus size={18} />
              Tạo CV Mới
            </button>
          </div>
          {/* Scan Result Toast */}
          {scanResult && (
            <div style={{
              position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
              padding: '14px 20px', borderRadius: '12px', maxWidth: '400px',
              display: 'flex', alignItems: 'center', gap: '10px',
              fontSize: '14px', fontWeight: '500',
              animation: 'slideIn 0.3s ease-out',
              background: scanResult.type === 'success' ? 'rgba(78,205,196,0.15)' :
                         scanResult.type === 'error' ? 'rgba(255,107,107,0.15)' :
                         scanResult.type === 'warning' ? 'rgba(255,190,11,0.15)' : 'rgba(100,149,237,0.15)',
              border: `1px solid ${scanResult.type === 'success' ? 'rgba(78,205,196,0.4)' :
                                   scanResult.type === 'error' ? 'rgba(255,107,107,0.4)' :
                                   scanResult.type === 'warning' ? 'rgba(255,190,11,0.4)' : 'rgba(100,149,237,0.4)'}`,
              color: scanResult.type === 'success' ? '#4ecdc4' :
                     scanResult.type === 'error' ? '#ff6b6b' :
                     scanResult.type === 'warning' ? '#ffbe0b' : '#6495ed',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }}>
              {scanResult.type === 'success' ? '✅' : scanResult.type === 'error' ? '❌' : scanResult.type === 'warning' ? '⚠️' : 'ℹ️'}
              {scanResult.message}
              <button onClick={() => setScanResult(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', marginLeft: 'auto', opacity: 0.7 }}>✕</button>
            </div>
          )}
        </header>

        {activeTab === 'board' && (
          <div className="board-container">
            <DragDropContext onDragEnd={onDragEnd}>
              {columns.map((col) => {
                const colCandidates = getCandidatesByStatus(col.id);
                return (
                  <div className="board-column glass-panel" key={col.id}>
                    <div className="column-header">
                      <span>{col.title}</span>
                      <span className="badge">{colCandidates.length}</span>
                    </div>

                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div
                          className="column-content"
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          style={{
                            backgroundColor: snapshot.isDraggingOver ? 'var(--bg-surface-hover)' : 'transparent',
                            transition: 'background-color 0.2s ease',
                          }}
                        >
                          {colCandidates.map((cand, index) => (
                            <Draggable key={cand.id} draggableId={cand.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  className="cv-card"
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  style={{
                                    ...provided.draggableProps.style,
                                    transform: snapshot.isDragging ? `translateY(-4px) ${provided.draggableProps.style?.transform || ''}` : provided.draggableProps.style?.transform,
                                    boxShadow: snapshot.isDragging ? '0 12px 24px rgba(0,0,0,0.3)' : '',
                                    borderColor: snapshot.isDragging ? 'var(--primary)' : 'transparent'
                                  }}
                                >
                                  <div className="card-title">{cand.name}</div>
                                  <div className="card-subtitle">{cand.position}</div>
                                  <div className="card-tags">
                                    <span className={`tag ${cand.source.includes('Mail') ? 'source-mail' : ''}`}>
                                      {cand.source}
                                    </span>
                                    <span className="tag">
                                      {cand.appliedDate}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </DragDropContext>
          </div>
        )}

        {/* VIEW DẠNG BẢNG - TỔNG HỢP CV ỨNG VIÊN */}
        {activeTab === 'cv_main' && (
          <div style={{ padding: '24px 32px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr style={{ height: '46px' }}>
                    <th rowSpan="2" style={{ borderRight: '1px solid var(--border-color)', verticalAlign: 'middle', background: 'rgba(31, 38, 51, 0.95)' }}>Họ Tên</th>
                    <th rowSpan="2" style={{ borderRight: '1px solid var(--border-color)', verticalAlign: 'middle', background: 'rgba(31, 38, 51, 0.95)' }}>Nhân sự xử lý</th>
                    <th rowSpan="2" style={{ borderRight: '1px solid var(--border-color)', verticalAlign: 'middle', background: 'rgba(31, 38, 51, 0.95)' }}>Trạng thái CV</th>
                    <th colSpan="3" style={{ color: 'var(--warning)', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>SCREENING</th>
                    <th colSpan="3" style={{ color: 'var(--info)', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>INTERVIEW</th>
                    <th colSpan="3" style={{ color: 'var(--danger)', textAlign: 'center' }}>POST-OFFER</th>
                  </tr>
                  <tr style={{ height: '46px' }}>
                    <th style={{ top: '46px', zIndex: 1, borderRight: '1px solid var(--border-color)', borderTop: '1px solid var(--border-color)', background: 'var(--bg-surface-elevated)' }}>Ghi chú</th>
                    <th style={{ top: '46px', zIndex: 1, borderRight: '1px solid var(--border-color)', borderTop: '1px solid var(--border-color)', background: 'var(--bg-surface-elevated)' }}>Kết quả</th>
                    <th style={{ top: '46px', zIndex: 1, borderRight: '1px solid var(--border-color)', borderTop: '1px solid var(--border-color)', background: 'var(--bg-surface-elevated)' }}>Lý do</th>
                    
                    <th style={{ top: '46px', zIndex: 1, borderRight: '1px solid var(--border-color)', borderTop: '1px solid var(--border-color)', background: 'var(--bg-surface-elevated)' }}>Lịch PV</th>
                    <th style={{ top: '46px', zIndex: 1, borderRight: '1px solid var(--border-color)', borderTop: '1px solid var(--border-color)', background: 'var(--bg-surface-elevated)' }}>Kết quả PV</th>
                    <th style={{ top: '46px', zIndex: 1, borderRight: '1px solid var(--border-color)', borderTop: '1px solid var(--border-color)', background: 'var(--bg-surface-elevated)' }}>Lý do</th>

                    <th style={{ top: '46px', zIndex: 1, borderRight: '1px solid var(--border-color)', borderTop: '1px solid var(--border-color)', background: 'var(--bg-surface-elevated)' }}>Kết quả</th>
                    <th style={{ top: '46px', zIndex: 1, borderRight: '1px solid var(--border-color)', borderTop: '1px solid var(--border-color)', background: 'var(--bg-surface-elevated)' }}>Lý do</th>
                    <th style={{ top: '46px', zIndex: 1, borderTop: '1px solid var(--border-color)', background: 'var(--bg-surface-elevated)' }}>Ngày nhận việc</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((cand) => (
                    <tr key={cand.id}>
                      <td style={{ fontWeight: '500', color: '#fff' }}>{cand.name}<div style={{fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px'}} className="tag">{cand.position}</div></td>
                      <td style={{ color: 'var(--text-main)' }}>{cand.hrPerson || '-'}</td>
                      <td style={{ padding: '6px 12px' }}>
                        <select 
                          className={`select-inline ${getDropdownClass(cand.cvStatus || '')}`}
                          value={cand.cvStatus || ''} 
                          onChange={(e) => handleUpdateCandidate(cand.id, 'cvStatus', e.target.value)}
                        >
                          <option value="">- Chọn -</option>
                          {masterData.scrStatus.map(st => <option key={st} value={st}>{st}</option>)}
                        </select>
                      </td>
                      
                      <td style={{ color: 'var(--text-muted)' }}>{cand.scrNote || '-'}</td>
                      <td style={{ padding: '6px 12px' }}>
                        <select 
                          className={`select-inline ${getDropdownClass(cand.scrResult || '')}`}
                          value={cand.scrResult || ''} 
                          onChange={(e) => handleUpdateCandidate(cand.id, 'scrResult', e.target.value)}
                        >
                          <option value="">- Chọn -</option>
                          {masterData.scrResult.map(st => <option key={st} value={st}>{st}</option>)}
                        </select>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{cand.scrReason || '-'}</td>

                      <td style={{ color: 'var(--primary)' }}>{cand.intTime || '-'}</td>
                      <td style={{ padding: '6px 12px' }}>
                        <select 
                          className={`select-inline ${getDropdownClass(cand.intResult || '')}`}
                          value={cand.intResult || ''} 
                          onChange={(e) => handleUpdateCandidate(cand.id, 'intResult', e.target.value)}
                        >
                          <option value="">- Chọn -</option>
                          {masterData.intResult.map(st => <option key={st} value={st}>{st}</option>)}
                        </select>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{cand.intReason || '-'}</td>

                      <td style={{ padding: '6px 12px' }}>
                        <select 
                          className={`select-inline ${getDropdownClass(cand.offResult || '')}`}
                          value={cand.offResult || ''} 
                          onChange={(e) => handleUpdateCandidate(cand.id, 'offResult', e.target.value)}
                        >
                          <option value="">- Chọn -</option>
                          {masterData.offResult.map(st => <option key={st} value={st}>{st}</option>)}
                        </select>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{cand.offReason || '-'}</td>
                      <td style={{ color: 'var(--success)', fontWeight: '500' }}>{cand.onboardDate || '-'}</td>
                    </tr>
                  ))}
                  {candidates.length === 0 && (
                    <tr>
                      <td colSpan="12" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Không có dữ liệu trong Sheet này.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW DẠNG BẢNG - SHEET INTERVIEW */}
        {activeTab === 'interview' && (
          <div style={{ padding: '24px 32px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="data-table-container">
              <table className="data-table" style={{ minWidth: '1000px' }}>
                <thead>
                  <tr>
                    <th>Dấu thời gian</th>
                    <th>Họ tên ứng viên</th>
                    <th>Năm sinh</th>
                    <th>SĐT</th>
                    <th>Link CV</th>
                    <th>Vị trí ứng tuyển</th>
                    <th>Nguồn</th>
                    <th>Nhân sự xử lý</th>
                    <th style={{ color: 'var(--primary)' }}>Thời gian Phỏng vấn</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.filter(c => c.status === 'INTERVIEW').map((cand) => (
                    <tr key={cand.id}>
                      <td style={{ color: 'var(--text-muted)' }}>{cand.appliedDate}</td>
                      <td style={{ fontWeight: '500', color: '#fff' }}>{cand.name}</td>
                      <td>{cand.yob || '-'}</td>
                      <td>{cand.phone || '-'}</td>
                      <td>
                        {cand.cvLink ? <a href={cand.cvLink} target="_blank" rel="noreferrer" style={{ color: 'var(--info)', textDecoration: 'none' }}>Xem link↗</a> : '-'}
                      </td>
                      <td>{cand.position}</td>
                      <td><span className="tag">{cand.source}</span></td>
                      <td style={{ color: 'var(--text-muted)' }}>{cand.hrPerson || '-'}</td>
                      <td style={{ color: 'var(--primary)', fontWeight: '600' }}>{cand.intTime || '-'}</td>
                    </tr>
                  ))}
                  {candidates.filter(c => c.status === 'INTERVIEW').length === 0 && (
                    <tr>
                      <td colSpan="9" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Không có lịch phỏng vấn nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW DẠNG BẢNG - SHEET ONBOARD */}
        {activeTab === 'onboard' && (
          <div style={{ padding: '24px 32px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="data-table-container">
              <table className="data-table" style={{ minWidth: '1000px' }}>
                <thead>
                  <tr>
                    <th>Dấu thời gian</th>
                    <th>Họ tên ứng viên</th>
                    <th>Năm sinh</th>
                    <th>SĐT</th>
                    <th>Link CV</th>
                    <th>Vị trí ứng tuyển</th>
                    <th>Nguồn</th>
                    <th>Nhân sự xử lý</th>
                    <th style={{ color: 'var(--success)' }}>Ngày Nhận Việc</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.filter(c => c.status === 'ONBOARD').map((cand) => (
                    <tr key={cand.id}>
                      <td style={{ color: 'var(--text-muted)' }}>{cand.appliedDate}</td>
                      <td style={{ fontWeight: '500', color: '#fff' }}>{cand.name}</td>
                      <td>{cand.yob || '-'}</td>
                      <td>{cand.phone || '-'}</td>
                      <td>
                        {cand.cvLink ? <a href={cand.cvLink} target="_blank" rel="noreferrer" style={{ color: 'var(--info)', textDecoration: 'none' }}>Xem link↗</a> : '-'}
                      </td>
                      <td>{cand.position}</td>
                      <td><span className="tag">{cand.source}</span></td>
                      <td style={{ color: 'var(--text-muted)' }}>{cand.hrPerson || '-'}</td>
                      <td style={{ color: 'var(--success)', fontWeight: '600' }}>{cand.onboardDate || cand.appliedDate}</td>
                    </tr>
                  ))}
                  {candidates.filter(c => c.status === 'ONBOARD').length === 0 && (
                    <tr>
                      <td colSpan="9" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Không có nhân sự nào đang Onboard.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW SETTINGS */}
        {activeTab === 'data_master' && <SettingsPage
          outlookStatus={outlookStatus}
          onLogin={handleOutlookLogin}
          onRefreshStatus={checkOutlookStatus}
          masterData={masterData}
        />}
      </main>
    </div>
  );
}

// ============================================================
// Settings Page Component
// ============================================================
function SettingsPage({ outlookStatus, onLogin, onRefreshStatus, masterData }) {
  const [config, setConfig] = useState({ AZURE_CLIENT_ID: '', AZURE_TENANT_ID: 'common', AZURE_CLIENT_SECRET: '', AZURE_CLIENT_SECRET_SET: false });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [showSecret, setShowSecret] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);
  const [settingsTab, setSettingsTab] = useState('outlook');

  useEffect(() => {
    fetchConfig();
    fetchHistory();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/api/config`);
      const data = await res.json();
      setConfig(prev => ({ ...prev, ...data, AZURE_CLIENT_SECRET: '' }));
    } catch (e) { console.log('Backend chưa chạy'); }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/scan/history`);
      setScanHistory(await res.json());
    } catch (e) {}
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const body = {
        AZURE_CLIENT_ID: config.AZURE_CLIENT_ID,
        AZURE_TENANT_ID: config.AZURE_TENANT_ID,
      };
      if (config.AZURE_CLIENT_SECRET) body.AZURE_CLIENT_SECRET = config.AZURE_CLIENT_SECRET;
      if (config.DATABASE_URL) body.DATABASE_URL = config.DATABASE_URL;
      
      const res = await fetch(`${API_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await res.json();
      setSaveMsg({ type: 'success', text: result.message });
      onRefreshStatus();
      fetchConfig();
    } catch (e) {
      setSaveMsg({ type: 'error', text: 'Không thể kết nối Backend Server.' });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 4000);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`);
      onRefreshStatus();
    } catch (e) {}
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '14px',
    background: 'var(--bg-surface-elevated)', color: '#fff', fontFamily: "'JetBrains Mono', monospace",
    border: '1px solid var(--border-color)', outline: 'none', transition: 'border-color 0.2s',
    boxSizing: 'border-box'
  };
  const labelStyle = { fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' };
  const sectionTitle = (icon, title, color) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, border: `1px solid ${color}30` }}>{icon}</div>
      <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: 0 }}>{title}</h3>
    </div>
  );

  return (
    <div style={{ padding: '24px 32px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Settings Tab Navigation */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'var(--bg-surface)', borderRadius: '10px', padding: '4px', border: '1px solid var(--border-color)', alignSelf: 'flex-start' }}>
        {[
          { id: 'outlook', label: '📧 Kết nối Outlook', color: '#0078d4' },
          { id: 'master', label: '⚙️ Master Data', color: 'var(--warning)' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setSettingsTab(tab.id)} style={{
            padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: '600', transition: 'all 0.2s',
            background: settingsTab === tab.id ? 'rgba(255,255,255,0.08)' : 'transparent',
            color: settingsTab === tab.id ? '#fff' : 'var(--text-muted)',
            boxShadow: settingsTab === tab.id ? '0 2px 8px rgba(0,0,0,0.2)' : 'none'
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ===== OUTLOOK SETTINGS ===== */}
      {settingsTab === 'outlook' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
            {/* LEFT: Form cấu hình */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* SECTION: DATABASE */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                {sectionTitle(<DatabaseIcon size={18} />, 'Lưu trữ Database (Supabase/PostgreSQL)', '#4ecdc4')}
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
                  Mặc định hệ thống dùng SQLite. Để lưu dữ liệu vĩnh viễn trên Render, hãy dán <b>Connection string (URI)</b> từ Supabase vào đây. <br/>
                  <i>(Ví dụ: postgresql://postgres:[matkhau]...)</i>
                </p>
                <div>
                  <label style={labelStyle}>
                    Database URL
                    {config.DATABASE_URL_SET && <span style={{ color: '#4ecdc4', fontWeight: '400', marginLeft: '8px' }}>✓ Đã lưu</span>}
                  </label>
                  <input style={inputStyle} type="text" placeholder={config.DATABASE_URL_SET ? '••••••••• (nhập mới để thay đổi)' : 'postgresql://...'}
                    value={config.DATABASE_URL || ''} onChange={e => setConfig(prev => ({ ...prev, DATABASE_URL: e.target.value }))}
                    onFocus={e => e.target.style.borderColor = '#4ecdc4'} onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                  />
                </div>
              </div>

              {/* SECTION: AZURE OUTLOOK */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                {sectionTitle(<Mail size={18} />, 'Cấu hình Microsoft Azure (Outlook)', '#0078d4')}

                {/* Status Badge */}
                <div style={{
                  padding: '12px 16px', borderRadius: '10px', marginBottom: '20px',
                  display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px',
                  background: outlookStatus.authenticated ? 'rgba(78,205,196,0.08)' : config.configured ? 'rgba(255,190,11,0.08)' : 'rgba(255,107,107,0.08)',
                  border: `1px solid ${outlookStatus.authenticated ? 'rgba(78,205,196,0.25)' : config.configured ? 'rgba(255,190,11,0.25)' : 'rgba(255,107,107,0.25)'}`,
                  color: outlookStatus.authenticated ? '#4ecdc4' : config.configured ? '#ffbe0b' : '#ff6b6b'
                }}>
                  {outlookStatus.authenticated ? <CheckCircle size={16} /> : <Mail size={16} />}
                  <span style={{ fontWeight: '600' }}>
                    {outlookStatus.authenticated ? `Đã kết nối: ${outlookStatus.account}` :
                     config.configured ? 'Đã cấu hình — Chưa đăng nhập' : 'Chưa cấu hình'}
                  </span>
                  {outlookStatus.authenticated && (
                    <button onClick={handleLogout} style={{ marginLeft: 'auto', background: 'none', border: '1px solid rgba(255,107,107,0.3)', color: '#ff6b6b', padding: '4px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>Đăng xuất</button>
                  )}
                </div>

                {/* Form Fields */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>Application (Client) ID</label>
                    <input style={inputStyle} type="text" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={config.AZURE_CLIENT_ID || ''} onChange={e => setConfig(prev => ({ ...prev, AZURE_CLIENT_ID: e.target.value }))}
                      onFocus={e => e.target.style.borderColor = '#0078d4'} onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Directory (Tenant) ID</label>
                    <input style={inputStyle} type="text" placeholder="common (mặc định)"
                      value={config.AZURE_TENANT_ID || ''} onChange={e => setConfig(prev => ({ ...prev, AZURE_TENANT_ID: e.target.value }))}
                      onFocus={e => e.target.style.borderColor = '#0078d4'} onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>
                      Client Secret 
                      {config.AZURE_CLIENT_SECRET_SET && <span style={{ color: '#4ecdc4', fontWeight: '400', marginLeft: '8px' }}>✓ Đã lưu</span>}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input style={{ ...inputStyle, paddingRight: '60px' }}
                        type={showSecret ? 'text' : 'password'}
                        placeholder={config.AZURE_CLIENT_SECRET_SET ? '••••••••• (nhập mới để thay đổi)' : 'Nhập Client Secret'}
                        value={config.AZURE_CLIENT_SECRET || ''} onChange={e => setConfig(prev => ({ ...prev, AZURE_CLIENT_SECRET: e.target.value }))}
                        onFocus={e => e.target.style.borderColor = '#0078d4'} onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                      />
                      <button onClick={() => setShowSecret(!showSecret)} style={{
                        position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', padding: '4px 8px'
                      }}>{showSecret ? 'Ẩn' : 'Hiện'}</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', alignItems: 'center' }}>
                <button onClick={handleSave} disabled={saving} style={{
                  padding: '10px 24px', borderRadius: '8px', border: 'none', cursor: saving ? 'wait' : 'pointer',
                  background: '#0078d4', color: '#fff', fontWeight: '600', fontSize: '14px',
                  display: 'flex', alignItems: 'center', gap: '8px', opacity: saving ? 0.7 : 1,
                  boxShadow: '0 4px 12px rgba(0,120,212,0.3)', transition: 'all 0.2s'
                }}>
                  {saving ? <Loader size={16} className="spin-animation" /> : <CheckCircle size={16} />}
                  {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
                </button>

                {config.configured && !outlookStatus.authenticated && (
                  <button onClick={onLogin} style={{
                    padding: '10px 24px', borderRadius: '8px', cursor: 'pointer',
                    background: 'rgba(78,205,196,0.1)', color: '#4ecdc4', fontWeight: '600', fontSize: '14px',
                    border: '1px solid rgba(78,205,196,0.3)', display: 'flex', alignItems: 'center', gap: '8px',
                    transition: 'all 0.2s'
                  }}>
                    <LogIn size={16} />
                    Đăng nhập Outlook
                  </button>
                )}

                {saveMsg && (
                  <span style={{ fontSize: '13px', fontWeight: '500', color: saveMsg.type === 'success' ? '#4ecdc4' : '#ff6b6b' }}>
                    {saveMsg.type === 'success' ? '✅' : '❌'} {saveMsg.text}
                  </span>
                )}
              </div>
            </div>

            {/* RIGHT: Hướng dẫn setup */}
            <div className="glass-panel" style={{ padding: '20px', fontSize: '13px', lineHeight: '1.7' }}>
              {sectionTitle('📋', 'Hướng dẫn (5 phút)', 'var(--warning)')}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,120,212,0.15)', color: '#0078d4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>1</span>
                  <div>Truy cập <a href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noreferrer" style={{ color: '#0078d4', textDecoration: 'none', fontWeight: '600' }}>Azure Portal → App registrations ↗</a></div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,120,212,0.15)', color: '#0078d4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>2</span>
                  <div>Bấm <strong style={{ color: '#fff' }}>New registration</strong>, đặt tên <strong style={{ color: '#fff' }}>ATS HR Tool</strong></div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,120,212,0.15)', color: '#0078d4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>3</span>
                  <div>Chọn <strong style={{ color: '#fff' }}>Personal + Org accounts</strong></div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,120,212,0.15)', color: '#0078d4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>4</span>
                  <div>Redirect URI: <strong style={{ color: '#fff' }}>Web</strong> → <code style={{ background: 'rgba(0,120,212,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', color: '#0078d4' }}>http://localhost:3001/auth/callback</code></div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,120,212,0.15)', color: '#0078d4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>5</span>
                  <div>Copy <strong style={{ color: '#fff' }}>Client ID</strong> + <strong style={{ color: '#fff' }}>Tenant ID</strong> từ trang Overview</div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,120,212,0.15)', color: '#0078d4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>6</span>
                  <div>Vào <strong style={{ color: '#fff' }}>Certificates & secrets</strong> → tạo secret → copy Value</div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,120,212,0.15)', color: '#0078d4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>7</span>
                  <div>Vào <strong style={{ color: '#fff' }}>API permissions</strong> → thêm <strong style={{ color: '#fff' }}>Mail.Read</strong> + <strong style={{ color: '#fff' }}>User.Read</strong></div>
                </div>

                <div style={{ marginTop: '8px', padding: '12px', borderRadius: '8px', background: 'rgba(78,205,196,0.06)', border: '1px solid rgba(78,205,196,0.15)', color: '#4ecdc4', fontSize: '12px' }}>
                  💡 <strong>Tip:</strong> Azure Portal miễn phí — không cần thẻ tín dụng, chỉ cần tài khoản Microsoft/Outlook.
                </div>
              </div>
            </div>
          </div>

          {/* Scan History */}
          {scanHistory.length > 0 && (
            <div className="glass-panel" style={{ padding: '20px' }}>
              {sectionTitle('📊', 'Lịch sử quét gần đây', 'var(--info)')}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                {scanHistory.slice(0, 6).map((h, i) => (
                  <div key={i} style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', fontSize: '12px' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '6px' }}>{h.time}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="tag" style={{ background: 'rgba(0,120,212,0.1)', color: '#0078d4' }}>{h.source}</span>
                      <span style={{ color: h.added > 0 ? '#4ecdc4' : 'var(--text-muted)', fontWeight: '600' }}>+{h.added} CV</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== MASTER DATA ===== */}
      {settingsTab === 'master' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '14px', color: 'var(--info)', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Nguồn</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {masterData.sources.map(s => <span key={s} className="tag" style={{ alignSelf: 'flex-start' }}>{s}</span>)}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '14px', color: 'var(--success)', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Nhân sự xử lý</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {masterData.hrPersons.map(s => <span key={s} style={{ color: 'var(--text-main)', fontSize: '13px' }}>- {s}</span>)}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '14px', color: 'var(--warning)', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Trạng thái & Lọc</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ color: 'var(--text-secondary)' }}><strong>Trạng thái Screening:</strong></div>
                <div>{masterData.scrStatus.join(', ')}</div>
                <div style={{ color: 'var(--text-secondary)', marginTop: '8px' }}><strong>Kết quả Screening:</strong></div>
                <div>{masterData.scrResult.join(', ')}</div>
                <div style={{ color: 'var(--text-secondary)', marginTop: '8px' }}><strong>Kết quả Phỏng vấn:</strong></div>
                <div>{masterData.intResult.join(', ')}</div>
                <div style={{ color: 'var(--text-secondary)', marginTop: '8px' }}><strong>Kết quả Nhận việc:</strong></div>
                <div>{masterData.offResult.join(', ')}</div>
              </div>
            </div>
          </div>
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '14px', color: 'var(--danger)', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Vị trí ứng tuyển</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
              {masterData.positions.map(p => (
                <div key={p} style={{ fontSize: '13px', color: 'var(--text-main)', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>{p}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
