import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Briefcase, LayoutDashboard, Settings, UserPlus, Users, Search, Bell, Upload, RefreshCw, Mic, ClipboardCheck, Mail, LogIn, CheckCircle, AlertTriangle, FileText, Loader, ChevronLeft, ChevronRight, Database, Globe, Building2, ExternalLink, X, Trash2, Calendar, TrendingUp, BarChart3, Clock, Activity, Video, History, Sliders, User, Download, Cpu, Zap, Sun, Wrench, Sprout, ShoppingBag, Calculator, Layers } from 'lucide-react';
import * as XLSX from 'xlsx';
import { mockCandidates, columns, masterData as defaultMasterData } from './data';
import './App.css';

const DEPT_COLORS = {
  'Tự động hóa': '#4ecdc4',
  'Hệ thống điện': '#3b82f6',
  'Năng lượng/Solar': '#f59e0b',
  'Cơ điện/Cơ khí': '#eb4899',
  'Marketing & IT': '#a855f7',
  'Nông nghiệp': '#10b981',
  'Kinh doanh & Thương mại': '#3498db',
  'HCNS & Kế toán': '#6366f1',
  'Khác': '#64748b'
};

const DEPT_ICONS = {
  'Tự động hóa': Cpu,
  'Hệ thống điện': Zap,
  'Năng lượng/Solar': Sun,
  'Cơ điện/Cơ khí': Wrench,
  'Marketing & IT': Globe,
  'Nông nghiệp': Sprout,
  'Kinh doanh & Thương mại': ShoppingBag,
  'HCNS & Kế toán': Calculator,
  'Khác': Layers
};

const DeptDistributionChart = ({ data, total }) => {
  const chartData = Object.entries(data)
    .map(([name, items]) => ({
      name,
      count: items.length,
      percent: total > 0 ? Math.round((items.length / total) * 100) : 0,
      color: DEPT_COLORS[name] || '#64748b'
    }))
    .filter(d => d.count > 0)
    .sort((a, b) => b.count - a.count);

  if (total === 0) return <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '20px' }}>Chưa có dữ liệu</div>;

  let cumulativePercent = 0;
  const sectors = chartData.map(d => {
    const start = cumulativePercent;
    cumulativePercent += d.percent;
    const Icon = DEPT_ICONS[d.name] || Layers;
    return { sector: `${d.color} ${start}% ${cumulativePercent}%`, Icon };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
      <div style={{ 
        width: '120px', height: '120px', borderRadius: '50%',
        background: `conic-gradient(${sectors.map(s => s.sector).join(', ')})`,
        boxShadow: '0 0 20px rgba(0,0,0,0.3), inset 0 0 10px rgba(255,255,255,0.1)',
        position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{ 
          width: '70px', height: '70px', borderRadius: '50%', 
          background: 'var(--bg-surface-elevated)', 
          boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <span style={{ fontSize: '16px', fontWeight: '900', color: '#fff' }}>{total}</span>
          <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: '700' }}>TOTAL</span>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
        {chartData.map(d => {
          const Icon = DEPT_ICONS[d.name] || Layers;
          return (
            <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: `${d.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: d.color }}>
                  <Icon size={12} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)' }}>{d.name}</span>
              </div>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#fff' }}>{d.percent}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const API_URL = import.meta.env.VITE_API_URL || '';

const ComboInput = ({ value, onChange, options, placeholder, style = {}, className = '' }) => {
  const [showOptions, setShowOptions] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef(null);

  const calculateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const showAbove = spaceBelow < 250 && spaceAbove > spaceBelow;
      
      setCoords({
        top: showAbove ? rect.top : rect.bottom,
        left: rect.left,
        width: rect.width,
        showAbove
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setShowOptions(false);
    };
    const handleEvents = () => {
      if (showOptions) setShowOptions(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleEvents, true); 
    window.addEventListener('resize', handleEvents);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleEvents, true);
      window.removeEventListener('resize', handleEvents);
    };
  }, [showOptions]);

  const toggleOptions = () => {
    if (!showOptions) calculateCoords();
    setShowOptions(!showOptions);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }}>
      <input
        className={`input-inline ${className}`}
        style={{ paddingRight: '22px', width: '100%', cursor: showOptions ? 'text' : 'pointer' }}
        value={value}
        onChange={(e) => { onChange(e.target.value); if (!showOptions) toggleOptions(); }}
        onFocus={() => { calculateCoords(); setShowOptions(true); }}
        onClick={() => { calculateCoords(); setShowOptions(true); }}
        placeholder={placeholder}
      />
      <div 
        style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', opacity: 0.5, pointerEvents: 'none' }}
      >▼</div>
      {showOptions && createPortal(
        <div style={{
          position: 'fixed', 
          top: coords.showAbove ? `${coords.top - 8}px` : `${coords.top + 4}px`,
          left: `${coords.left}px`, 
          transform: coords.showAbove ? 'translateY(-100%)' : 'none',
          minWidth: Math.max(120, coords.width) + 'px', 
          zIndex: 999999, background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)',
          borderRadius: '6px', maxHeight: '250px', overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)', padding: '4px',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)'
        }}>
          {options.map((opt, i) => (
            <div key={i} 
                 onMouseDown={(e) => { e.preventDefault(); onChange(opt); setShowOptions(false); }}
                 style={{
                   padding: '8px 12px', cursor: 'pointer', borderRadius: '4px',
                   color: '#fff', fontSize: '13px', transition: 'background 0.2s',
                   background: value === opt ? 'rgba(78,205,196,0.15)' : 'transparent'
                 }}
                 onMouseOver={(e) => e.target.style.background = 'var(--bg-surface-hover)'}
                 onMouseOut={(e) => e.target.style.background = value === opt ? 'rgba(78,205,196,0.15)' : 'transparent'}
            >
              {opt}
            </div>
          ))}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
          <div onMouseDown={(e) => { e.preventDefault(); setShowOptions(false); }}
               style={{
                 padding: '8px 12px', cursor: 'pointer', borderRadius: '4px',
                 color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic'
               }}
               onMouseOver={(e) => e.target.style.background = 'var(--bg-surface-hover)'}
               onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            ✏️ Custom Entry
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const DateTimePicker = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const containerRef = useRef(null);

  // Parse value into date parts
  const parseValue = (val) => {
    if (!val) return { year: new Date().getFullYear(), month: new Date().getMonth(), day: null, hour: '09', minute: '00' };
    // Try ISO format first
    let d;
    if (val.includes('T')) {
      d = new Date(val);
    } else if (val.includes('/')) {
      // "HH:mm dd/MM" format
      const parts = val.split(' ');
      const [hh, mm] = (parts[0] || '09:00').split(':');
      const [dd, mon] = (parts[1] || '01/01').split('/');
      d = new Date(new Date().getFullYear(), parseInt(mon) - 1, parseInt(dd), parseInt(hh), parseInt(mm));
    } else {
      d = new Date(val);
    }
    if (isNaN(d.getTime())) return { year: new Date().getFullYear(), month: new Date().getMonth(), day: null, hour: '09', minute: '00' };
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      day: d.getDate(),
      hour: String(d.getHours()).padStart(2, '0'),
      minute: String(d.getMinutes()).padStart(2, '0')
    };
  };

  const parsed = parseValue(value);
  const [viewYear, setViewYear] = useState(parsed.year);
  const [viewMonth, setViewMonth] = useState(parsed.month);
  const [selDay, setSelDay] = useState(parsed.day);
  const [selHour, setSelHour] = useState(parsed.hour);
  const [selMinute, setSelMinute] = useState(parsed.minute);

  useEffect(() => {
    const p = parseValue(value);
    setViewYear(p.year);
    setViewMonth(p.month);
    setSelDay(p.day);
    setSelHour(p.hour);
    setSelMinute(p.minute);
  }, [value]);

  const openPicker = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setCoords({
        top: spaceBelow < 380 ? rect.top : rect.bottom + 4,
        left: rect.left,
        showAbove: spaceBelow < 380
      });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', close, true);
    return () => { document.removeEventListener('mousedown', handleClick); window.removeEventListener('scroll', close, true); };
  }, [open]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const monthNames = ['Th1','Th2','Th3','Th4','Th5','Th6','Th7','Th8','Th9','Th10','Th11','Th12'];
  const weekDays = ['CN','T2','T3','T4','T5','T6','T7'];

  const confirmSelection = (day, hour, minute) => {
    if (!day) return;
    const d = new Date(viewYear, viewMonth, day, parseInt(hour), parseInt(minute));
    onChange(d.toISOString());
    setOpen(false);
  };

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const displayText = value ? (() => {
    const p = parseValue(value);
    return p.day ? `${p.hour}:${p.minute} ${String(p.day).padStart(2,'0')}/${String(p.month+1).padStart(2,'0')}/${p.year}` : 'Chọn ngày giờ';
  })() : '';

  const today = new Date();

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={openPicker}
        className="input-inline"
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: value ? 'var(--info)' : 'var(--text-muted)', fontWeight: '600', minHeight: '32px', whiteSpace: 'nowrap' }}
      >
        <Calendar size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
        {displayText || 'Chọn ngày giờ'}
      </div>
      {open && createPortal(
        <div style={{
          position: 'fixed',
          top: coords.showAbove ? `${coords.top - 8}px` : `${coords.top}px`,
          left: `${coords.left}px`,
          transform: coords.showAbove ? 'translateY(-100%)' : 'none',
          zIndex: 999999, width: '300px',
          background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)',
          borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(16px)', padding: '16px',
          animation: 'fadeInScale 0.2s ease-out'
        }}>
          {/* Month Nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px' }} onMouseOver={e => e.target.style.background='rgba(255,255,255,0.1)'} onMouseOut={e => e.target.style.background='none'}><ChevronLeft size={16}/></button>
            <span style={{ fontSize: '14px', fontWeight: '800', color: '#fff' }}>{monthNames[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px' }} onMouseOver={e => e.target.style.background='rgba(255,255,255,0.1)'} onMouseOut={e => e.target.style.background='none'}><ChevronRight size={16}/></button>
          </div>
          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
            {weekDays.map(w => <div key={w} style={{ textAlign: 'center', fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', padding: '4px 0' }}>{w}</div>)}
          </div>
          {/* Calendar grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '16px' }}>
            {Array.from({ length: firstDay }, (_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const d = i + 1;
              const isSelected = d === selDay && viewMonth === parseValue(value).month && viewYear === parseValue(value).year;
              const isToday = d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
              return (
                <div key={d} onClick={() => { setSelDay(d); confirmSelection(d, selHour, selMinute); }}
                  style={{
                    textAlign: 'center', padding: '6px 0', fontSize: '12px', fontWeight: isSelected ? '800' : '600', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s',
                    color: isSelected ? '#000' : isToday ? 'var(--primary)' : '#fff',
                    background: isSelected ? 'var(--primary)' : 'transparent',
                    border: isToday && !isSelected ? '1px solid rgba(78,205,196,0.3)' : '1px solid transparent'
                  }}
                  onMouseOver={e => { if (!isSelected) e.target.style.background = 'rgba(255,255,255,0.08)'; }}
                  onMouseOut={e => { if (!isSelected) e.target.style.background = 'transparent'; }}
                >{d}</div>
              );
            })}
          </div>
          {/* Time selector */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <Clock size={14} color="var(--text-muted)" />
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>Giờ:</span>
            <select value={selHour} onChange={e => { setSelHour(e.target.value); if (selDay) confirmSelection(selDay, e.target.value, selMinute); }}
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', padding: '6px 8px', fontSize: '13px', fontWeight: '700', outline: 'none', textAlign: 'center' }}>
              {Array.from({ length: 24 }, (_, i) => <option key={i} value={String(i).padStart(2,'0')}>{String(i).padStart(2,'0')}</option>)}
            </select>
            <span style={{ color: 'var(--text-muted)', fontWeight: '800', fontSize: '16px' }}>:</span>
            <select value={selMinute} onChange={e => { setSelMinute(e.target.value); if (selDay) confirmSelection(selDay, selHour, e.target.value); }}
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', padding: '6px 8px', fontSize: '13px', fontWeight: '700', outline: 'none', textAlign: 'center' }}>
              {['00','15','30','45'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {/* Clear button */}
          {value && (
            <div style={{ marginTop: '10px', textAlign: 'center' }}>
              <button onClick={() => { onChange(''); setOpen(false); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}>Xóa ngày giờ</button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

function App() {
  const [candidates, setCandidates] = useState(mockCandidates);
  const [activeTab, setActiveTab] = useState('board');
  const [crawlConfig, setCrawlConfig] = useState({ platforms: {} });
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanPeriod, setScanPeriod] = useState('1d');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [masterData, setMasterData] = useState(defaultMasterData);
  const [isSaving, setIsSaving] = useState(false);
  const [globalFilters, setGlobalFilters] = useState({
    search: '',
    source: '',
    dept: '',
    status: '',
    period: 'all'
  });
  const [showMainFilter, setShowMainFilter] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [recentTimeFilter, setRecentTimeFilter] = useState('3'); // days
  const [columnFilters, setColumnFilters] = useState({ name: '', position: '', phone: '', hrPerson: '', cvStatus: '' });
  const filterRef = useRef(null);
  const [logs, setLogs] = useState([]);
  const notificationRef = useRef(null);

  // PHÂN LOẠI BỘ PHẬN CHIẾN LƯỢC
  const DEPARTMENTS = [
    'Tự động hóa', 'Hệ thống điện', 'Năng lượng/Solar', 'Cơ điện/Cơ khí', 
    'Marketing & IT', 'Nông nghiệp', 'Kinh doanh & Thương mại', 'HCNS & Kế toán'
  ];

  const getDeptByPosition = (pos) => {
    if (!pos) return 'Khác';
    const p = pos.toLowerCase();
    if (p.includes('tự động hóa')) return 'Tự động hóa';
    if (p.includes('hệ thống điện')) return 'Hệ thống điện';
    if (p.includes('solar') || p.includes('năng lượng')) return 'Năng lượng/Solar';
    if (p.includes('cơ điện') || p.includes('cơ khí')) return 'Cơ điện/Cơ khí';
    if (p.includes('mkt') || p.includes('marketing') || p.includes('dev')) return 'Marketing & IT';
    if (p.includes('nông nghiệp')) return 'Nông nghiệp';
    if (p.includes('nông sản') || p.includes('kinh doanh') || p.includes('vật tư') || p.includes('thương mại')) return 'Kinh doanh & Thương mại';
    if (p.includes('hcns') || p.includes('kế toán')) return 'HCNS & Kế toán';
    return 'Khác';
  };


  const formatDateTime = (isoStr) => {
    if (!isoStr) return 'Chưa đặt lịch';
    try {
      if (!isoStr.includes('T') && isoStr.includes(':') && isoStr.includes('/')) return isoStr; // Already formatted
      const date = new Date(isoStr);
      if (isNaN(date.getTime())) return isoStr;
      const hhmm = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
      const ddmm = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      return `${hhmm} ${ddmm}`;
    } catch (e) {
      return isoStr;
    }
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowMainFilter(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [showCrawlDropdown, setShowCrawlDropdown] = useState(false);
  const [previewCandidate, setPreviewCandidate] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Load dữ liệu khi mở trang
  useEffect(() => {
    loadConfig();
    loadCandidatesFromDB();
    fetchMasterData();
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const res = await fetch(`${API_URL}/api/scan/history`);
      const data = await res.json();
      if (Array.isArray(data)) setLogs(data);
    } catch(e) {}
  };

  const loadConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/api/config`);
      if (res.ok) {
        const data = await res.json();
        setCrawlConfig(data);
      }
    } catch (e) {
      console.log('Backend chưa chạy');
    }
  };

  const fetchMasterData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/master-data`);
      const data = await res.json();
      if (data && data.sources) setMasterData(data);
    } catch (e) {
      console.log('Backend chưa chạy, dùng master data mẫu.');
    }
  };

  const loadCandidatesFromDB = async () => {
    try {
      const res = await fetch(`${API_URL}/api/candidates`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setCandidates(data);
        console.log(`💾 Đã load ${data.length} ứng viên từ database.`);
      }
    } catch (e) {
      console.log('Backend chưa chạy, dùng dữ liệu mẫu.');
    }
  };

  const updateMasterData = async (field, newValues) => {
    // 1. Optimistic Update UI
    const updatedMaster = { ...masterData, [field]: newValues };
    setMasterData(updatedMaster);
    setIsSaving(true);

    try {
      const res = await fetch(`${API_URL}/api/master-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMaster)
      });
      if (!res.ok) throw new Error('Lỗi khi lưu Master Data');
      
      // Thành công: Reload để đảm bảo đồng bộ
      await fetchMasterData();
      // Đợi hiệu ứng spinning cho pro
      setTimeout(() => setIsSaving(false), 500);
    } catch (e) {
      console.error(e);
      alert('Không thể lưu thay đổi vào hệ thống.');
      setIsSaving(false);
      // Revert if error? (LATER)
    }
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
            cvStatus: 'Screening', // Mặc định là Screening theo yêu cầu
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

  const handleRunCrawler = async (platform) => {
    setIsScanning(true);
    setScanResult(null);
    try {
      const response = await fetch(`${API_URL}/api/crawler/run/${platform}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: scanPeriod })
      });
      const result = await response.json();

      if (!response.ok) {
        setScanResult({ type: 'error', message: result.error || result.message });
        return;
      }

      const added = result.added || 0;
      // Always reload to ensure consistency (especially for UPSERTed data like cvStatus)
      await loadCandidatesFromDB();
      
      if (added > 0) {
        setScanResult({ 
          type: 'success', 
          message: `Đã tìm thấy ${added} hồ sơ mới từ ${platform.toUpperCase()}!`,
          candidates: result.data
        });
      } else {
        setScanResult({ 
          type: 'success', 
          message: `Cập nhật dữ liệu từ ${platform.toUpperCase()} thành công.`,
          candidates: result.data
        });
      }

    } catch (err) {
      console.error(err);
      setScanResult({ type: 'error', message: 'Lỗi kết nối Server Crawler.' });
    } finally {
      setIsScanning(false);
      setShowCrawlDropdown(false);
    }
  };

  const handleCreateCandidate = async (newCand) => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newCand, cvStatus: newCand.cvStatus || 'Screening' })
      });
      if (res.ok) {
        await loadCandidatesFromDB();
        setShowCreateModal(false);
        setScanResult({ type: 'success', message: 'Candidate created successfully!' });
        setTimeout(() => setScanResult(null), 3000);
      } else {
        const err = await res.json();
        alert(err.error || 'Error creating candidate');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };


  const handleUpdateCandidate = async (id, field, value) => {
    // Tích hợp logic "Auto-Pipeline": Tự nhảy trạng thái nếu chọn Kết quả tương ứng
    let extraUpdates = {};
    const valLower = (value || '').toLowerCase();

    if (field === 'scrResult') {
      if (valLower.includes('interview') || valLower.includes('phỏng vấn')) {
        extraUpdates.status = 'INTERVIEW';
      } else if (valLower.includes('offer') || valLower.includes('đậu') || valLower.includes('pass')) {
        extraUpdates.status = 'POST-OFFER';
        extraUpdates.offResult = 'Xác nhận';
      } else if (valLower.includes('onboard') || valLower.includes('nhận việc')) {
        extraUpdates.status = 'ONBOARD';
        extraUpdates.intResult = 'Pass';
        extraUpdates.offResult = 'Xác nhận';
      } else if (valLower.includes('fail') || valLower.includes('loại') || valLower.includes('không đạt')) {
        extraUpdates.status = 'SCREENING'; // Trả về danh sách tổng
      }
    } else if (field === 'intResult') {
      if (valLower.includes('pass') || valLower.includes('đậu') || valLower.includes('đồng ý') || valLower.includes('xác nhận')) {
        extraUpdates.status = 'ONBOARD'; 
        extraUpdates.scrResult = 'Pass'; 
        extraUpdates.offResult = 'Xác nhận';
      } else if (valLower.includes('fail') || valLower.includes('loại') || valLower.includes('không đạt')) {
        extraUpdates.status = 'SCREENING'; // Trả về danh sách tổng khi tạch phỏng vấn
      }
    } else if (field === 'offResult') {
      if (valLower.includes('xác nhận') || valLower.includes('đồng ý')) {
        extraUpdates.status = 'ONBOARD';
        extraUpdates.scrResult = 'Pass';
        extraUpdates.intResult = 'Pass';
      } else if (valLower.includes('từ chối') || valLower.includes('fail') || valLower.includes('không đạt')) {
        extraUpdates.status = 'SCREENING'; // Trả về danh sách tổng khi từ chối offer
      }
    }

    // Luôn đảm bảo cvStatus có giá trị mặc định nếu chưa có
    setCandidates(prev => prev.map(cand => {
      if (cand.id === id) {
        const currentCvStatus = field === 'cvStatus' ? value : (cand.cvStatus || 'Screening');
        return { ...cand, [field]: value, cvStatus: currentCvStatus, ...extraUpdates };
      }
      return cand;
    }));

    // 2. Gửi lệnh lưu ngầm xuống Backend
    setIsSaving(true);
    try {
      await fetch(`${API_URL}/api/candidates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value, ...extraUpdates })
      });
      setTimeout(() => setIsSaving(false), 800);
    } catch (e) {
      console.error('Lỗi auto-save:', e);
      setIsSaving(false);
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'SCREENING': return 'status-screening';
      case 'INTERVIEW': return 'status-interview';
      case 'POST-OFFER': return 'status-offer';
      case 'ONBOARD': return 'status-onboard';
      default: return '';
    }
  };

  const getDropdownClass = (value) => {
    if (!value) return '';
    const val = value.toLowerCase();
    if (['pass', 'đồng ý', 'xác nhận', 'onboard'].includes(val)) return 'success';
    if (['fail', 'từ chối', 'cv not accept'].includes(val)) return 'danger';
    if (['pending', 'interview', 'screening'].includes(val)) return 'warning';
    return 'info';
  };

  const extractPhone = (text) => {
    if (!text) return '-';
    if (text.length <= 15) return text;
    const match = text.match(/(?:0|\+84)[35789]\d{8}/);
    return match ? match[0] : text;
  };

  const extractEmail = (text) => {
    if (!text) return '-';
    if (text.length <= 40 && text.includes('@')) return text;
    const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return match ? match[0] : '-';
  };

  // TÍNH TOÁN MA TRẬN PHÂN TÍCH BỘ PHẬN
  const analysisMatrix = useMemo(() => {
    const matrix = {};
    DEPARTMENTS.forEach(dept => {
      matrix[dept] = { SCREENING: 0, INTERVIEW: 0, 'POST-OFFER': 0, ONBOARD: 0, total: 0 };
    });
    matrix['Khác'] = { SCREENING: 0, INTERVIEW: 0, 'POST-OFFER': 0, ONBOARD: 0, total: 0 };

    candidates.forEach(cand => {
      const dept = getDeptByPosition(cand.position);
      if (matrix[dept]) {
        matrix[dept][cand.status]++;
        matrix[dept].total++;
      }
    });

    return matrix;
  }, [candidates]);

  // LẤY LỊCH TRÌNH PHỎNG VẤN SẮP TỚI
  const upcomingInterviews = useMemo(() => {
    return candidates
      .filter(c => c.status === 'INTERVIEW' && c.intTime)
      .sort((a, b) => new Date(a.intTime) - new Date(b.intTime))
      .slice(0, 10);
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter(c => {
      // 1. Search filter
      const s = globalFilters.search.toLowerCase();
      const matchesSearch = !s || 
        (c.name || '').toLowerCase().includes(s) || 
        (c.phone || '').toLowerCase().includes(s) || 
        (c.position || '').toLowerCase().includes(s);
      
      if (!matchesSearch) return false;

      // 2. Source filter
      if (globalFilters.source && c.source !== globalFilters.source) return false;

      // 3. Dept filter
      if (globalFilters.dept) {
        const dept = getDeptByPosition(c.position);
        if (dept !== globalFilters.dept) return false;
      }

      // 4. Status filter (Secondary filter within tabs)
      if (globalFilters.status && c.status !== globalFilters.status) return false;

      // 5. Period filter
      if (globalFilters.period !== 'all') {
        const now = new Date();
        const applied = new Date(c.appliedDate); // Should be ISO or parsable
        if (isNaN(applied.getTime())) return true; // Keep if date is weird
        
        const diffMs = now - applied;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (globalFilters.period === 'today' && diffDays > 1) return false;
        if (globalFilters.period === 'week' && diffDays > 7) return false;
        if (globalFilters.period === 'month' && diffDays > 30) return false;
      }

      return true;
    });
  }, [candidates, globalFilters]);

  // Apply Column-level Filters to the filtered candidates
  const filteredByColumn = useMemo(() => {
    return filteredCandidates.filter(c => {
      const matchName = !columnFilters.name || c.name.toLowerCase().includes(columnFilters.name.toLowerCase());
      const matchPos = !columnFilters.position || (c.position || '').toLowerCase().includes(columnFilters.position.toLowerCase());
      const matchPhone = !columnFilters.phone || (c.phone || '').includes(columnFilters.phone);
      const matchHR = !columnFilters.hrPerson || (c.hrPerson || '').toLowerCase().includes(columnFilters.hrPerson.toLowerCase());
      const matchStatus = !columnFilters.cvStatus || (c.cvStatus || '').toLowerCase().includes(columnFilters.cvStatus.toLowerCase());
      const matchResult = !columnFilters.scrResult || (c.scrResult || '').toLowerCase().includes(columnFilters.scrResult.toLowerCase());
      return matchName && matchPos && matchPhone && matchHR && matchStatus && matchResult;
    });
  }, [filteredCandidates, columnFilters]);

  // Logic for Recent Feed
  const recentCandidatesList = useMemo(() => {
    const now = new Date();
    const days = parseInt(recentTimeFilter);
    return filteredCandidates.filter(c => {
      if (!c.appliedDate) return false;
      const applied = new Date(c.appliedDate);
      if (isNaN(applied.getTime())) return false;
      const diffMs = now - applied;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays <= days;
    });
  }, [filteredCandidates, recentTimeFilter]);

  // Group candidates by department for the Departmental view
  const candidatesByDept = useMemo(() => {
    const groups = {};
    DEPARTMENTS.forEach(dept => groups[dept] = []);
    groups['Khác'] = [];
    
    filteredCandidates.forEach(c => {
      const dept = getDeptByPosition(c.position);
      if (groups[dept]) groups[dept].push(c);
      else groups['Khác'].push(c);
    });
    return groups;
  }, [filteredCandidates]);

  const handleExport = () => {
    if (filteredCandidates.length === 0) {
      alert('Không có dữ liệu để xuất!');
      return;
    }
    
    // Prepare data for export
    const exportData = filteredCandidates.map(c => ({
      'Tên ứng viên': c.name,
      'Số điện thoại': c.phone,
      'Email': c.email,
      'Vị trí': c.position,
      'Trạng thái': c.status,
      'Nguồn': c.source,
      'Ngày ứng tuyển': c.appliedDate ? new Date(c.appliedDate).toLocaleDateString('vi-VN') : '-',
      'Ghi chú': c.note || '',
      'Link CV': c.cvLink || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Candidates");
    XLSX.writeFile(wb, `ATS_Candidates_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // Performance Optimization: Group candidates by status once using useMemo
  const candidatesByStatus = React.useMemo(() => {
    const groups = { SCREENING: [], INTERVIEW: [], 'POST-OFFER': [], ONBOARD: [] };
    filteredCandidates.forEach(c => {
      if (groups[c.status]) groups[c.status].push(c);
    });
    return groups;
  }, [filteredCandidates]);

  const getCandidatesByStatus = (status) => {
    return filteredCandidates.filter((c) => c.status === status);
  };

  const handleDeleteCandidate = async (id, name) => {
    if (!window.confirm(`Bạn có chắc muốn xóa ứng viên "${name}" khỏi hệ thống?`)) return;
    
    setIsSaving(true);
    try {
      const resp = await fetch(`${API_URL}/api/candidates/${id}`, { method: 'DELETE' });
      const result = await resp.json();
      if (result.deleted) {
        setCandidates(prev => prev.filter(c => c.id !== id));
      }
      setTimeout(() => setIsSaving(false), 500);
    } catch (e) {
      console.error('Lỗi khi xóa ứng viên:', e);
      setIsSaving(false);
      alert('Không thể xóa ứng viên. Vui lòng thử lại.');
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <button className="sidebar-toggle-btn" 
                style={{ 
                  position: 'absolute', right: '-14px', top: '24px', 
                  width: '28px', height: '28px', 
                  background: 'var(--primary)', color: '#000', 
                  border: 'none', borderRadius: '50%', cursor: 'pointer', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)', zIndex: 100,
                  opacity: 1, transition: 'all 0.2s ease'
                }}
                onMouseOver={e => e.currentTarget.style.filter = 'brightness(1.2)'}
                onMouseOut={e => e.currentTarget.style.filter = 'brightness(1)'}
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
          {sidebarCollapsed ? <ChevronRight size={16} strokeWidth={3} /> : <ChevronLeft size={16} strokeWidth={3} />}
        </button>

        <div className="sidebar-logo" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px', padding: '0 24px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity size={24} className="icon" color="var(--primary)" />
            <span style={{ fontSize: '20px', letterSpacing: '-0.02em', fontWeight: '800' }}>Sovereign Intel</span>
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', fontWeight: '700', marginLeft: '36px' }}>RECRUITMENT COMMAND</span>
        </div>
        
        <nav className="nav-menu">
          <div className={`nav-item ${activeTab === 'board' ? 'active' : ''}`} onClick={() => setActiveTab('board')}>
            <LayoutDashboard size={18} className="icon" />
            <span className="nav-text">Dashboard Intelligence</span>
          </div>

          {!sidebarCollapsed && <div style={{ margin: '16px 0 8px 0', padding: '0 24px', fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', opacity: 0.5 }}>Pipeline</div>}
          <div className={`nav-item ${activeTab === 'cv_main' ? 'active' : ''}`} onClick={() => setActiveTab('cv_main')}>
            <Search size={18} className="icon" />
            <span className="nav-text">Screening</span>
          </div>
          <div className={`nav-item ${activeTab === 'interviews' ? 'active' : ''}`} onClick={() => setActiveTab('interviews')}>
            <Mic size={18} className="icon" />
            <span className="nav-text">Interview</span>
          </div>
          <div className={`nav-item ${activeTab === 'post_offer' ? 'active' : ''}`} onClick={() => setActiveTab('post_offer')}>
            <Mail size={18} className="icon" />
            <span className="nav-text">Post-Offer</span>
          </div>
          <div className={`nav-item ${activeTab === 'onboard' ? 'active' : ''}`} onClick={() => setActiveTab('onboard')}>
            <CheckCircle size={18} className="icon" />
            <span className="nav-text">Onboard</span>
          </div>

          <div style={{ margin: '12px 0', height: '1px', background: 'rgba(255,255,255,0.05)' }} />
          <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <Settings size={18} className="icon" />
            <span className="nav-text">Settings</span>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">

        <header className="topbar">
          <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Global View Search..." 
                  className="input-inline"
                  value={globalFilters.search}
                  onChange={(e) => setGlobalFilters(prev => ({ ...prev, search: e.target.value }))}
                  style={{ paddingLeft: '40px', width: '320px', background: 'var(--bg-surface)', border: 'none', borderRadius: '8px', fontSize: '13px' }}
                />
              </div>

              <div style={{ position: 'relative' }} ref={filterRef}>
                <button 
                  onClick={() => setShowMainFilter(!showMainFilter)}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', 
                    background: showMainFilter ? 'rgba(78,205,196,0.15)' : 'var(--bg-surface)', 
                    borderRadius: '8px', border: `1px solid ${showMainFilter ? 'rgba(78,205,196,0.3)' : 'transparent'}`, 
                    fontSize: '12px', fontWeight: '700', color: showMainFilter ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}>
                  <Sliders size={16} />
                  Filter
                  {(globalFilters.source || globalFilters.dept || globalFilters.status || globalFilters.period !== 'all') && (
                    <span style={{ width: '6px', height: '6px', background: 'var(--primary)', borderRadius: '50%' }}></span>
                  )}
                </button>

                {showMainFilter && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, marginTop: '12px',
                    background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)',
                    borderRadius: '16px', padding: '24px', width: '420px', zIndex: 1000,
                    boxShadow: '0 24px 64px rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)',
                    animation: 'dropdownFadeScale 0.2s ease-out'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: '#fff' }}>Advanced Filters</span>
                      <button onClick={() => setGlobalFilters({ search: '', source: '', dept: '', status: '', period: 'all' })} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Clear All</button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Bộ phận chuyên môn</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          {[...DEPARTMENTS, 'Khác'].map(dept => (
                            <button key={dept} 
                                   onClick={() => setGlobalFilters(prev => ({ ...prev, dept: prev.dept === dept ? '' : dept }))}
                                   style={{ 
                                     padding: '8px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '600', textAlign: 'left',
                                     background: globalFilters.dept === dept ? 'rgba(78,205,196,0.1)' : 'rgba(255,255,255,0.03)',
                                     border: `1px solid ${globalFilters.dept === dept ? 'rgba(78,205,196,0.4)' : 'rgba(255,255,255,0.05)'}`,
                                     color: globalFilters.dept === dept ? 'var(--primary)' : 'var(--text-secondary)',
                                     cursor: 'pointer', transition: 'all 0.2s'
                                   }}>{dept}</button>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Nguồn</div>
                          <select value={globalFilters.source} onChange={(e) => setGlobalFilters(prev => ({ ...prev, source: e.target.value }))}
                            style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: '#fff', padding: '8px', fontSize: '12px', outline: 'none' }}>
                            <option value="">Tất cả nguồn</option>
                            {masterData.sources.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Thời gian</div>
                          <select value={globalFilters.period} onChange={(e) => setGlobalFilters(prev => ({ ...prev, period: e.target.value }))}
                            style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', color: '#fff', padding: '8px', fontSize: '12px', outline: 'none' }}>
                            <option value="all">Mọi lúc</option>
                            <option value="today">Hôm nay</option>
                            <option value="week">7 ngày qua</option>
                            <option value="month">30 ngày qua</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Active filter chips */}
              <div style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
                {globalFilters.dept && (
                   <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(78,205,196,0.1)', color: 'var(--primary)', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '800', border: '1px solid rgba(78,205,196,0.2)' }}>
                     {globalFilters.dept}
                     <X size={12} style={{ cursor: 'pointer' }} onClick={() => setGlobalFilters(p => ({ ...p, dept: '' }))} />
                   </div>
                )}
                {globalFilters.source && (
                   <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '800', border: '1px solid rgba(255,255,255,0.1)' }}>
                     {globalFilters.source}
                     <X size={12} style={{ cursor: 'pointer' }} onClick={() => setGlobalFilters(p => ({ ...p, source: '' }))} />
                   </div>
                )}
                {globalFilters.period !== 'all' && (
                   <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '800', border: '1px solid rgba(255,255,255,0.1)' }}>
                     {globalFilters.period === 'today' ? 'Hôm nay' : globalFilters.period === 'week' ? 'Tuần này' : 'Tháng này'}
                     <X size={12} style={{ cursor: 'pointer' }} onClick={() => setGlobalFilters(p => ({ ...p, period: 'all' }))} />
                   </div>
                )}
              </div>
            </div>
            
            <nav style={{ display: 'flex', gap: '24px' }}>
              {['board', 'analytics', 'archive'].map(tabId => {
                const labels = { board: 'GLOBAL VIEW', analytics: 'DEPARTMENTAL', archive: 'ARCHIVED' };
                return (
                  <button 
                    key={tabId}
                    className="nav-tab-btn"
                    onClick={() => setActiveTab(tabId)}
                    style={{ 
                      fontSize: '11px', 
                      fontWeight: '800', 
                      color: activeTab === tabId ? 'var(--primary)' : 'var(--text-muted)',
                      letterSpacing: '0.08em',
                      borderBottom: activeTab === tabId ? '2px solid var(--primary)' : 'none',
                      padding: '8px 0',
                      borderRadius: 0,
                      background: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {labels[tabId]}
                  </button>
                );
              })}
            </nav>
          </div>
          
          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {/* Scan / Action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>


              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '2px' }}>
                <select 
                  value={scanPeriod} 
                  onChange={(e) => setScanPeriod(e.target.value)}
                  style={{
                    background: '#171c26', border: 'none', color: '#fff', padding: '0 12px', fontSize: '13px', 
                    outline: 'none', cursor: 'pointer', height: '36px', borderRight: '1px solid var(--border-color)',
                    appearance: 'none', WebkitAppearance: 'none'
                  }}
                >
                  <option value="1d">1 ngày</option>
                  <option value="1w">1 tuần</option>
                  <option value="1m">1 tháng</option>
                </select>
                <button 
                  className="btn-primary" 
                  style={{ background: 'none', border: 'none', cursor: isScanning ? 'wait' : 'pointer', minWidth: '100px', boxShadow: 'none', height: '36px' }}
                  disabled={isScanning}
                  onClick={() => handleRunCrawler('careerlink')}
                >
                  {isScanning ? <Loader size={18} className="spin-animation" /> : <RefreshCw size={18} />}
                  {isScanning ? 'Scan' : 'Scan'}
                </button>
              </div>

              <button className="btn-primary" onClick={() => setShowCreateModal(true)} style={{ height: '40px', whiteSpace: 'nowrap' }}>
                <UserPlus size={18} /> New CV
              </button>
            </div>

            <div className="flex-center" style={{ gap: '20px', color: 'var(--text-secondary)' }}>
              <div style={{ position: 'relative' }} ref={notificationRef}>
                <Bell size={20} style={{ cursor: 'pointer', color: showNotifications ? 'var(--primary)' : 'inherit' }} onClick={() => setShowNotifications(!showNotifications)} />
                <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '8px', height: '8px', background: 'var(--danger)', borderRadius: '50%', border: '2px solid var(--bg-surface)' }}></span>
                
                {showNotifications && (
                  <div style={{ 
                    position: 'absolute', top: '40px', right: '-10px', width: '320px', 
                    maxHeight: '400px', zIndex: 1000, padding: '20px',
                    background: '#161C2C', border: '1px solid var(--border-color)',
                    borderRadius: '16px', boxSizing: 'border-box',
                    display: 'flex', flexDirection: 'column', gap: '16px',
                    animation: 'dropdownFadeScale 0.3s ease-out',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#fff' }}>Thông báo</h4>
                      <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: '700' }}>{logs.length} mới</span>
                    </div>
                    <div className="custom-scrollbar" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {logs.length > 0 ? logs.map((log, i) => (
                        <div key={i} style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '12px', color: '#fff', fontWeight: '600', marginBottom: '2px' }}>{log.title || 'Hệ thống'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{log.message}</div>
                          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', marginTop: '4px' }}>{log.time || 'Vừa xong'}</div>
                        </div>
                      )) : (
                        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>Không có thông báo mới.</div>
                      )}
                    </div>
                    {logs.length > 0 && (
                      <button onClick={() => setLogs([])} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '11px', fontWeight: '700', cursor: 'pointer', textAlign: 'center' }}>Xóa tất cả</button>
                    )}
                  </div>
                )}
              </div>
              <History size={20} style={{ cursor: 'pointer' }} />
              <Sliders size={20} style={{ cursor: 'pointer' }} />
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <User size={24} color="var(--text-secondary)" />
              </div>
            </div>
          </div>
        </header>

          {/* Scan Result Modal - Fixed Centering with Overlay */}
          {(isScanning || scanResult) && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)',
              zIndex: 100000, padding: '20px'
            }} onClick={() => { if (!isScanning) setScanResult(null); }}>
              <div style={{
                background: 'rgba(23, 28, 38, 0.98)', border: '1px solid var(--primary)',
                padding: '32px', borderRadius: '28px', minWidth: '450px', maxWidth: '600px',
                display: 'flex', flexDirection: 'column', gap: '24px',
                animation: 'fadeInScale 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                boxShadow: '0 40px 120px rgba(0,0,0,1)',
              }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ color: 'var(--primary)', background: 'rgba(240,148,28,0.1)', padding: '12px', borderRadius: '16px' }}>
                      {isScanning ? <Loader size={32} className="spin-animation" /> : <FileText size={32} />}
                    </div>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: '900', color: '#fff', letterSpacing: '-0.02em' }}>
                        {isScanning ? 'Đang tải dữ liệu...' : 'Kết Quả Quét Dữ Liệu'}
                      </div>
                      <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {isScanning ? 'Hệ thống đang đồng bộ hồ sơ, vui lòng đợi trong giây lát...' : scanResult?.message}
                      </div>
                    </div>
                  </div>
                  {!isScanning && <button onClick={() => setScanResult(null)} style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20}/></button>}
                </div>
                {scanResult && scanResult.candidates && scanResult.candidates.length > 0 && (
                  <div style={{ 
                    maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px',
                    paddingRight: '12px'
                  }} className="custom-scrollbar">
                    {scanResult.candidates.map((c, i) => (
                      <div key={i} style={{ 
                        padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                          <div style={{ fontSize: '17px', fontWeight: '800', color: '#fff' }}>{c.name}</div>
                          <div style={{ fontSize: '14px', color: 'var(--primary)', fontWeight: '700', opacity: 0.9 }}>{c.phone}</div>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '10px' }}>
                          <span style={{ color: 'var(--primary)', fontWeight: '600' }}>Vị trí:</span> {c.position || 'Đang cập nhật...'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
                          <span>ID: {c.id}</span>
                          <span>Nguồn: CareerLink</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
                       {activeTab === 'board' && (
          <div style={{ padding: '24px 32px', flex: 1, display: 'flex', flexDirection: 'column', gap: '32px', minHeight: 0, overflowY: 'auto' }}>
            
            {/* TOP STATS ROW */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
              <div className="glass-panel" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Total Candidates</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                    <div style={{ fontSize: '32px', fontWeight: '800', color: '#fff' }}>{candidates.length.toLocaleString()}</div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <TrendingUp size={14} /> +12%
                    </div>
                  </div>
                </div>
                <Users size={80} style={{ position: 'absolute', right: '-10px', bottom: '-10px', opacity: 0.03, color: '#fff' }} />
              </div>

              <div className="glass-panel" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Total Departments</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                    <div style={{ fontSize: '32px', fontWeight: '800', color: '#fff' }}>8</div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>Operational units</div>
                  </div>
                </div>
                <Building2 size={80} style={{ position: 'absolute', right: '-10px', bottom: '-10px', opacity: 0.03, color: '#fff' }} />
              </div>

              <div className="glass-panel" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Active Interviews</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                    <div style={{ fontSize: '32px', fontWeight: '800', color: '#fff' }}>{candidates.filter(c => c.status === 'INTERVIEW').length}</div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-purple)', background: 'rgba(139, 92, 246, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>This week</div>
                  </div>
                </div>
                <Video size={80} style={{ position: 'absolute', right: '-10px', bottom: '-10px', opacity: 0.03, color: '#fff' }} />
              </div>
            </div>

            {/* MAIN DASHBOARD CONTENT */}
            <div style={{ display: 'flex', gap: '32px', flex: 1, minHeight: 0 }}>
              
              {/* MATRIX COLUMN */}
              <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '24px', minHeight: 0 }}>
                <div className="glass-panel" style={{ padding: '28px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#fff', letterSpacing: '-0.02em' }}>Ma trận Phân tích Tuyển dụng</h3>
                      <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Recruitment Analysis Matrix • Real-time pipeline health</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      {(globalFilters.dept || globalFilters.status) && (
                        <button onClick={() => setGlobalFilters(prev => ({ ...prev, dept: '', status: '' }))} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: 'rgba(78,205,196,0.1)', borderRadius: '8px', border: '1px solid rgba(78,205,196,0.3)', fontSize: '11px', fontWeight: '700', color: 'var(--primary)', cursor: 'pointer' }}>
                          <X size={14} /> Xóa bộ lọc
                        </button>
                      )}
                      <button className="btn-icon" onClick={() => setShowMainFilter(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'var(--bg-surface-elevated)', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <Sliders size={16} /> Filters
                      </button>
                      <button className="btn-icon" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'var(--bg-surface-elevated)', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <Download size={16} /> Export
                      </button>
                    </div>
                  </div>

                  <div className="custom-scrollbar" style={{ overflowY: 'auto', flex: 1, zoom: '0.9', transformOrigin: 'top left' }}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: '800' }}>Bộ phận chuyên môn</th>
                          <th style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: '800' }}>Sơ vấn</th>
                          <th style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: '800' }}>Phòng vấn</th>
                          <th style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: '800' }}>Chờ nhận việc</th>
                          <th style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: '800' }}>Đã Onboard</th>
                          <th style={{ textAlign: 'center', padding: '12px', color: 'var(--primary)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: '800' }}>Tổng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...DEPARTMENTS, 'Khác'].map(dept => {
                          const data = analysisMatrix[dept];
                          if (data.total === 0) return null;
                          const isActiveDept = globalFilters.dept === dept;
                          const cellStyle = (status) => ({
                            textAlign: 'center', padding: '16px', fontWeight: '600', fontSize: '15px', cursor: 'pointer', borderRadius: '8px', transition: 'all 0.2s',
                            color: (globalFilters.dept === dept && globalFilters.status === status) ? '#fff' : 'var(--text-secondary)',
                            background: (globalFilters.dept === dept && globalFilters.status === status) ? 'rgba(78,205,196,0.2)' : 'transparent'
                          });
                          return (
                            <tr key={dept} className="analysis-row" style={{ opacity: globalFilters.dept && !isActiveDept ? 0.35 : 1, transition: 'opacity 0.3s' }}>
                              <td style={{ padding: '18px 16px', color: isActiveDept ? 'var(--primary)' : '#fff', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }} onClick={() => setGlobalFilters(f => ({ ...f, dept: f.dept === dept ? '' : dept, status: '' }))}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  {(() => {
                                    const Icon = DEPT_ICONS[dept] || Layers;
                                    const color = DEPT_COLORS[dept] || '#fff';
                                    return (
                                      <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color }}>
                                        <Icon size={16} />
                                      </div>
                                    );
                                  })()}
                                  {dept}
                                </div>
                              </td>
                              <td style={cellStyle('SCREENING')} onClick={() => setGlobalFilters(prev => ({ ...prev, dept, status: 'SCREENING' }))}>{data.SCREENING}</td>
                              <td style={cellStyle('INTERVIEW')} onClick={() => setGlobalFilters(prev => ({ ...prev, dept, status: 'INTERVIEW' }))}>{data.INTERVIEW}</td>
                              <td style={cellStyle('POST-OFFER')} onClick={() => setGlobalFilters(prev => ({ ...prev, dept, status: 'POST-OFFER' }))}>{data['POST-OFFER']}</td>
                              <td style={cellStyle('ONBOARD')} onClick={() => setGlobalFilters(prev => ({ ...prev, dept, status: 'ONBOARD' }))}>{data.ONBOARD}</td>
                              <td style={{ textAlign: 'center', padding: '16px', color: 'var(--primary)', fontWeight: '800', fontSize: '16px', cursor: 'pointer' }} onClick={() => setGlobalFilters(f => ({ ...f, dept: f.dept === dept ? '' : dept, status: '' }))}>{data.total}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* FILTERED CANDIDATE LIST */}
                  {(globalFilters.dept || globalFilters.status) && (() => {
                    const filtered = candidates.filter(c => {
                      const dept = getDeptByPosition(c.position);
                      if (globalFilters.dept && dept !== globalFilters.dept) return false;
                      if (globalFilters.status && c.status !== globalFilters.status) return false;
                      return true;
                    });
                    return (
                      <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '14px', fontWeight: '800', color: '#fff' }}>Kết quả lọc</span>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)', background: 'rgba(78,205,196,0.1)', padding: '3px 10px', borderRadius: '6px' }}>{filtered.length} ứng viên</span>
                            {globalFilters.dept && <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: '6px' }}>{globalFilters.dept}</span>}
                            {globalFilters.status && <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: '6px' }}>{globalFilters.status}</span>}
                          </div>
                        </div>
                        <div style={{ maxHeight: '260px', overflowY: 'auto' }} className="custom-scrollbar">
                          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 3px' }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '800' }}>Ứng viên</th>
                                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '800' }}>Vị trí</th>
                                <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '800' }}>Trạng thái</th>
                                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '800' }}>Liên hệ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filtered.map(c => (
                                <tr key={c.id} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                                  <td style={{ padding: '10px 12px', fontWeight: '700', color: '#fff', fontSize: '13px' }}>{c.name}</td>
                                  <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--primary)', fontWeight: '600', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.position || '-'}</td>
                                  <td style={{ padding: '10px 12px', textAlign: 'center' }}><span className={`status-badge ${getStatusClass(c.status)}`} style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '4px', fontWeight: '700' }}>{c.status}</span></td>
                                  <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>{extractPhone(c.phone)}</td>
                                </tr>
                              ))}
                              {filtered.length === 0 && (
                                <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Không có ứng viên phù hợp với bộ lọc.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* INSIGHTS COLUMN */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', minHeight: 0 }}>
                


                {/* DEPARTMENT DISTRIBUTION CHART (Replaced Pipeline Health) */}
                <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <h4 style={{ margin: 0, fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Ứng viên theo bộ phận</h4>
                  <DeptDistributionChart data={candidatesByDept} total={filteredCandidates.length} />
                </div>

                {/* INTELLIGENCE INSIGHT WIDGET */}
                <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: '16px' }}>
                  <div style={{ height: '120px', background: 'linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.8)), url("https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&q=80") center/cover' }}></div>
                  <div style={{ padding: '16px' }}>
                    <div style={{ fontSize: '9px', fontWeight: '900', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '6px' }}>Intelligence Insight</div>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: '#fff', lineHeight: '1.5' }}>
                      Sales department showing 85% growth in applications this quarter.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
        
        {/* DEPARTMENTAL VIEW - GROUPED BY DEPT */}
        {activeTab === 'analytics' && (
          <div style={{ padding: '24px 32px', flex: 1, display: 'flex', flexDirection: 'column', gap: '32px', minHeight: 0, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '28px', fontWeight: '900', color: '#fff', letterSpacing: '-0.03em' }}>Departmental Hubs</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--text-muted)', fontWeight: '500' }}>Manage candidates grouped by strategic business units</p>
              </div>
            </div>

            {/* QUICK NAV HUB BAR */}
            <div style={{ 
              display: 'flex', gap: '10px', flexWrap: 'wrap', 
              padding: '16px', background: 'rgba(255,255,255,0.02)', 
              borderRadius: '16px', border: '1px solid var(--border-color)',
              position: 'sticky', top: '0', zIndex: 10, backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
            }}>
              {[...DEPARTMENTS, 'Khác'].map(dept => {
                const count = (candidatesByDept[dept] || []).length;
                if (count === 0 && globalFilters.dept && globalFilters.dept !== dept) return null;
                return (
                  <button 
                    key={dept}
                    onClick={() => document.getElementById(`hub-${dept}`)?.scrollIntoView({ behavior: 'smooth' })}
                    style={{ 
                      padding: '8px 16px', background: 'rgba(255,255,255,0.05)', 
                      border: '1px solid var(--border-color)', borderRadius: '10px',
                      color: count > 0 ? '#fff' : 'var(--text-muted)', fontSize: '12px', fontWeight: '700',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(78,205,196,0.1)'}
                    onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  >
                    {dept}
                    <span style={{ fontSize: '10px', opacity: 0.6 }}>{count}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
              {[...DEPARTMENTS, 'Khác'].map(dept => {
                const deptCandidates = candidatesByDept[dept] || [];
                if (deptCandidates.length === 0 && (globalFilters.dept && globalFilters.dept !== dept)) return null;
                
                return (
                  <div key={dept} id={`hub-${dept}`} style={{ display: 'flex', flexDirection: 'column', gap: '20px', scrollMarginTop: '100px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#fff', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {dept} 
                        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)', background: 'rgba(78,205,196,0.1)', padding: '2px 10px', borderRadius: '6px' }}>
                          {deptCandidates.length}
                        </span>
                      </h3>
                      <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(255,255,255,0.1), transparent)' }}></div>
                    </div>

                    {deptCandidates.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                        {deptCandidates.map(c => (
                          <div key={c.id} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', transition: 'transform 0.2s', cursor: 'pointer' }} 
                               onMouseOver={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                               onMouseOut={e => e.currentTarget.style.transform = 'none'}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ fontWeight: '800', fontSize: '15px', color: '#fff' }}>{c.name}</div>
                              <span className={`status-badge ${getStatusClass(c.status)}`} style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                {c.status}
                              </span>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '600' }}>{c.position}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.source} • {extractPhone(c.phone)}</div>
                            </div>

                            <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                               <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: '600' }}>
                                 APPLIED: {c.appliedDate ? new Date(c.appliedDate).toLocaleDateString('vi-VN') : '-'}
                               </div>
                               <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                 <ChevronRight size={14} color="var(--text-muted)" />
                               </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '32px', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', border: '1px dashed var(--border-color)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        Không còn ứng viên nào đang hoạt động trong Hub này.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}


        {/* VIEW DẠNG BẢNG - TỔNG HỢP CV ỨNG VIÊN */}
        {activeTab === 'cv_main' && (
          <div style={{ padding: '24px 32px', flex: 1, display: 'flex', flexDirection: 'column', gap: '32px', minHeight: 0, overflowY: 'auto' }}>
            
            {/* 1. RECENT SUBMISSIONS FEED */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ padding: '10px', background: 'rgba(78,205,196,0.1)', borderRadius: '12px', color: 'var(--primary)' }}>
                    <Activity size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#fff' }}>Ứng viên gần đây</h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Mới nộp trong thời gian chọn lọc</p>
                  </div>
                </div>

                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '4px', border: '1px solid var(--border-color)' }}>
                  {[
                    { label: '24H', val: '1' },
                    { label: '3 Ngày', val: '3' },
                    { label: '1 Tuần', val: '7' }
                  ].map(p => (
                    <button 
                      key={p.val}
                      onClick={() => setRecentTimeFilter(p.val)}
                      style={{ 
                        padding: '6px 16px', borderRadius: '8px', fontSize: '11px', fontWeight: '700',
                        background: recentTimeFilter === p.val ? 'var(--primary)' : 'transparent',
                        color: recentTimeFilter === p.val ? '#000' : 'var(--text-muted)'
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {recentCandidatesList.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                  {recentCandidatesList.slice(0, 4).map(c => (
                    <div key={c.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                         <div style={{ fontWeight: '700', fontSize: '14px', color: '#fff' }}>{c.name}</div>
                         <div style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: '700' }}>NEW</div>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{c.position}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                         <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{c.source}</span>
                         <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{c.appliedDate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
                  Không có ứng viên nào trong {recentTimeFilter} ngày qua.
                </div>
              )}
            </div>

            {/* 2. MASTER SCREENING PIPELINE */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                 <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Tất cả ứng viên Sơ vấn</h3>
                 <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, var(--border-color), transparent)' }}></div>
              </div>

              <div className="data-table-container">
                <table className="data-table" style={{ minWidth: '1200px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '160px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <span>Ứng viên</span>
                          <input 
                            placeholder="Lọc tên..." 
                            className="th-filter-input"
                            value={columnFilters.name}
                            onChange={(e) => setColumnFilters(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                      </th>
                      <th style={{ width: '180px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <span>Vị trí</span>
                          <select 
                            className="th-filter-input"
                            value={columnFilters.position || ''}
                            onChange={(e) => setColumnFilters(prev => ({ ...prev, position: e.target.value }))}
                            style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                          >
                            <option value="" style={{ color: '#000' }}>Tất cả vị trí</option>
                            {[...new Set(candidates.map(c => c.position).filter(Boolean))].sort().map(pos => (
                              <option key={pos} value={pos} style={{ color: '#000' }}>{pos}</option>
                            ))}
                          </select>
                        </div>
                      </th>
                      <th style={{ width: '220px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <span>Liên hệ</span>
                          <input 
                            placeholder="Lọc số điện thoại..." 
                            className="th-filter-input"
                            value={columnFilters.phone || ''}
                            onChange={(e) => setColumnFilters(prev => ({ ...prev, phone: e.target.value }))}
                          />
                        </div>
                      </th>
                      <th style={{ width: '150px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <span>HR Phụ trách</span>
                          <select 
                            className="th-filter-input"
                            value={columnFilters.hrPerson || ''}
                            onChange={(e) => setColumnFilters(prev => ({ ...prev, hrPerson: e.target.value }))}
                            style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                          >
                            <option value="" style={{ color: '#000' }}>Tất cả HR</option>
                            {masterData.hrPersons.map(hr => (
                              <option key={hr} value={hr} style={{ color: '#000' }}>{hr}</option>
                            ))}
                          </select>
                        </div>
                      </th>
                      <th style={{ width: '160px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <span>Trạng thái</span>
                          <select 
                            className="th-filter-input"
                            value={columnFilters.cvStatus || ''}
                            onChange={(e) => setColumnFilters(prev => ({ ...prev, cvStatus: e.target.value }))}
                            style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                          >
                            <option value="" style={{ color: '#000' }}>Tất cả</option>
                            {masterData.scrStatus.map(status => (
                              <option key={status} value={status} style={{ color: '#000' }}>{status}</option>
                            ))}
                          </select>
                        </div>
                      </th>
                      <th style={{ color: 'var(--warning)', minWidth: '200px' }}>Ghi chú Sơ vấn</th>
                      <th style={{ width: '140px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                          <span>Kết quả</span>
                          <select 
                            className="th-filter-input"
                            value={columnFilters.scrResult || ''}
                            onChange={(e) => setColumnFilters(prev => ({ ...prev, scrResult: e.target.value }))}
                            style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', width: '100%' }}
                          >
                            <option value="" style={{ color: '#000' }}>Tất cả</option>
                            {masterData.scrResult.map(res => (
                              <option key={res} value={res} style={{ color: '#000' }}>{res}</option>
                            ))}
                          </select>
                        </div>
                      </th>
                      <th style={{ width: '90px', textAlign: 'center' }}>CV Link</th>
                      <th style={{ width: '60px', textAlign: 'center' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredByColumn.map((cand) => (
                      <tr key={cand.id}>
                        <td 
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={(e) => setPreviewCandidate(cand)}
                          onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                          onMouseLeave={() => setPreviewCandidate(null)}
                        >
                          <div style={{ fontWeight: '700', color: '#fff', fontSize: '14px' }}>{cand.name}</div>
                        </td>
                        <td style={{ padding: '6px 12px' }}>
                          <input 
                            className="input-inline" 
                            style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '600' }}
                            value={cand.position || ''} 
                            onChange={(e) => handleUpdateCandidate(cand.id, 'position', e.target.value)} 
                            placeholder="Vị trí..."
                          />
                        </td>
                        <td>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)' }}>{extractPhone(cand.phone)}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }} className="text-truncate">{extractEmail(cand.email)}</div>
                        </td>
                        <td style={{ padding: '6px 12px' }}>
                          <ComboInput options={masterData.hrPersons} value={cand.hrPerson || ''} placeholder="-" onChange={(val) => handleUpdateCandidate(cand.id, 'hrPerson', val)} />
                        </td>
                        <td style={{ padding: '6px 12px' }}>
                          <ComboInput 
                            options={masterData.scrStatus || []} 
                            value={cand.cvStatus || ''} 
                            placeholder="- Trạng thái -" 
                            className={getDropdownClass(cand.cvStatus || '')} 
                            onChange={(val) => handleUpdateCandidate(cand.id, 'cvStatus', val)} 
                          />
                        </td>
                        <td style={{ padding: '6px 12px' }}>
                          <input className="input-inline" value={cand.scrNote || ''} placeholder="Nhập ghi chú nhanh..." onChange={(e) => handleUpdateCandidate(cand.id, 'scrNote', e.target.value)} />
                        </td>
                        <td style={{ padding: '6px 12px' }}>
                          <ComboInput 
                            options={masterData.scrResult || []} 
                            value={cand.scrResult || ''} 
                            placeholder="- Kết quả -" 
                            className={getDropdownClass(cand.scrResult || '')} 
                            onChange={(val) => handleUpdateCandidate(cand.id, 'scrResult', val)} 
                          />
                        </td>
                        <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                          {cand.cvLink ? (
                            <button 
                              onClick={(e) => { e.stopPropagation(); window.open(cand.cvLink, '_blank'); }}
                              className="btn-icon" 
                              style={{ 
                                display: 'inline-flex', padding: '8px', 
                                background: 'rgba(78,205,196,0.15)', color: 'var(--primary)', 
                                border: '1px solid rgba(78,205,196,0.3)', borderRadius: '8px',
                                cursor: 'pointer', transition: 'all 0.2s'
                              }}
                              onMouseOver={e => e.currentTarget.style.background = 'rgba(78,205,196,0.25)'}
                              onMouseOut={e => e.currentTarget.style.background = 'rgba(78,205,196,0.15)'}
                              title="Mở link CV"
                            >
                              <ExternalLink size={14} />
                            </button>
                          ) : '-'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                           <Trash2 size={14} style={{ cursor: 'pointer', opacity: 0.4, color: 'var(--danger)' }} onClick={() => handleDeleteCandidate(cand.id, cand.name)} />
                        </td>
                      </tr>
                    ))}
                    {filteredByColumn.length === 0 && (
                      <tr>
                        <td colSpan="8" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          <div style={{ marginBottom: '12px' }}><Users size={40} opacity={0.2} /></div>
                          Không tìm thấy ứng viên phù hợp với tiêu chí lọc.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW DẠNG BẢNG - INTERVIEW */}
        {activeTab === 'interviews' && (
          <div style={{ padding: '24px 32px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="data-table-container">
              <table className="data-table" style={{ minWidth: '1200px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '160px' }}>Ứng viên</th>
                    <th style={{ width: '160px' }}>Vị trí</th>
                    <th style={{ width: '140px' }}>Liên hệ</th>
                    <th style={{ width: '140px' }}>Phụ trách (HR)</th>
                    <th style={{ width: '160px' }}>Thời gian PV</th>
                    <th style={{ color: 'var(--info)', minWidth: '200px' }}>Ghi chú Phỏng vấn</th>
                    <th style={{ width: '140px', textAlign: 'center' }}>Kết quả PV</th>
                    <th style={{ width: '60px', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.filter(c => c.status === 'INTERVIEW').map((cand) => (
                    <tr key={cand.id}>
                      <td 
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={(e) => setPreviewCandidate(cand)}
                        onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setPreviewCandidate(null)}
                      >
                        <div style={{ fontWeight: '700', color: '#fff', fontSize: '14px' }}>{cand.name}</div>
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <input 
                          className="input-inline" 
                          style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '600' }}
                          value={cand.position || ''} 
                          onChange={(e) => handleUpdateCandidate(cand.id, 'position', e.target.value)} 
                          placeholder="Vị trí..."
                        />
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)' }}>{extractPhone(cand.phone)}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }} className="text-truncate">{extractEmail(cand.email)}</div>
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <ComboInput options={masterData.hrPersons} value={cand.hrPerson || ''} placeholder="-" onChange={(val) => handleUpdateCandidate(cand.id, 'hrPerson', val)} />
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <DateTimePicker value={cand.intTime || ''} onChange={(val) => handleUpdateCandidate(cand.id, 'intTime', val)} />
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <input className="input-inline" value={cand.intNote || ''} placeholder="Nhập ghi chú PV..." onChange={(e) => handleUpdateCandidate(cand.id, 'intNote', e.target.value)} />
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <ComboInput 
                          options={masterData.intResult || ['Pass', 'Fail', 'Pending', 'Đồng ý', 'Không đạt']} 
                          value={cand.intResult || ''} 
                          placeholder="- Kết quả -" 
                          className={getDropdownClass(cand.intResult || '')} 
                          onChange={(val) => handleUpdateCandidate(cand.id, 'intResult', val)} 
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Trash2 size={14} style={{ cursor: 'pointer', opacity: 0.4, color: 'var(--danger)' }} onClick={() => handleDeleteCandidate(cand.id, cand.name)} />
                      </td>
                    </tr>
                  ))}
                  {candidates.filter(c => c.status === 'INTERVIEW').length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <div style={{ marginBottom: '12px' }}><Mic size={40} opacity={0.2} /></div>
                        Chưa có ứng viên nào ở giai đoạn phỏng vấn.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW DẠNG BẢNG - SHEET POST OFFER */}
        {activeTab === 'post_offer' && (
          <div style={{ padding: '24px 32px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="data-table-container">
              <table className="data-table" style={{ minWidth: '1000px' }}>
                <thead>
                  <tr>
                    <th>Applied Date</th>
                    <th>Full Name</th>
                    <th>Position</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Assignee</th>
                    <th style={{ color: 'var(--primary)' }}>Offer Result</th>
                    <th>Offer Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.filter(c => c.status === 'POST-OFFER').map((cand) => (
                    <tr key={cand.id}>
                      <td style={{ color: 'var(--text-muted)' }}>{cand.appliedDate}</td>
                      <td 
                        style={{ fontWeight: '500', color: '#fff', cursor: 'pointer' }}
                        onMouseEnter={(e) => setPreviewCandidate(cand)}
                        onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setPreviewCandidate(null)}
                      >
                        {cand.name}
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <input 
                          className="input-inline" 
                          style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '600' }}
                          value={cand.position || ''} 
                          onChange={(e) => handleUpdateCandidate(cand.id, 'position', e.target.value)} 
                          placeholder="Vị trí..."
                        />
                      </td>
                      <td>{extractPhone(cand.phone)}</td>
                      <td><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{extractEmail(cand.email)}</div></td>
                      <td style={{ padding: '6px 12px' }}>
                        <ComboInput options={masterData.hrPersons} value={cand.hrPerson || ''} placeholder="-" onChange={(val) => handleUpdateCandidate(cand.id, 'hrPerson', val)} />
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <ComboInput 
                          options={masterData.offResult || []} 
                          value={cand.offResult || ''} 
                          placeholder="- Chốt -" 
                          className={getDropdownClass(cand.offResult || '')} 
                          onChange={(val) => handleUpdateCandidate(cand.id, 'offResult', val)} 
                        />
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                         <input className="input-inline" value={cand.offReason || ''} placeholder="Ghi chú..." onChange={(e) => handleUpdateCandidate(cand.id, 'offReason', e.target.value)} />
                      </td>
                    </tr>
                  ))}
                  {candidates.filter(c => c.status === 'POST-OFFER').length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No candidates at offer stage yet.
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
                    <th>Timestamp</th>
                    <th>Full Name</th>
                    <th>YOB</th>
                    <th>Phone</th>
                    <th>CV Link</th>
                    <th>Position</th>
                    <th>Email</th>
                    <th>Source</th>
                    <th>Assignee</th>
                    <th style={{ color: 'var(--success)' }}>Onboarding Date</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.filter(c => c.status === 'ONBOARD').map((cand) => (
                    <tr key={cand.id}>
                      <td style={{ color: 'var(--text-muted)' }}>{cand.appliedDate}</td>
                      <td 
                        style={{ fontWeight: '500', color: '#fff', cursor: 'pointer' }}
                        onMouseEnter={(e) => setPreviewCandidate(cand)}
                        onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setPreviewCandidate(null)}
                      >
                        {cand.name}
                      </td>
                      <td>{cand.yob || '-'}</td>
                      <td><div className="text-truncate-multi" title={cand.phone}>{extractPhone(cand.phone)}</div></td>
                      <td>
                        {cand.cvLink ? <a href={cand.cvLink} target="_blank" rel="noreferrer" style={{ color: 'var(--info)', textDecoration: 'none' }}>View link↗</a> : '-'}
                      </td>
                      <td>
                        <div className="text-truncate-multi" title={cand.position} style={{ fontWeight: '500' }}>{cand.position || '-'}</div>
                      </td>
                      <td>
                        <div className="text-truncate-multi" title={cand.email} style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{extractEmail(cand.email)}</div>
                      </td>
                      <td><span className="tag">{cand.source}</span></td>
                      <td style={{ padding: '6px 12px' }}>
                        <ComboInput options={masterData.hrPersons} value={cand.hrPerson || ''} placeholder="-" onChange={(val) => handleUpdateCandidate(cand.id, 'hrPerson', val)} />
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <input type="date" className="input-inline" value={cand.onboardDate || ''} onChange={(e) => handleUpdateCandidate(cand.id, 'onboardDate', e.target.value)} style={{ color: 'var(--success)', fontWeight: '600' }} />
                      </td>
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
        {activeTab === 'settings' && <SettingsPage
          crawlConfig={crawlConfig}
          onRefreshStatus={loadConfig}
          masterData={masterData}
          fetchMasterData={fetchMasterData}
          onUpdateMaster={updateMasterData}
        />}

        {/* Create Candidate Modal */}
        {showCreateModal && (
          <CreateCandidateModal 
            onClose={() => setShowCreateModal(false)} 
            onSave={handleCreateCandidate}
            masterData={masterData}
          />
        )}
      </main>
      {/* POPUP PREVIEW CV HOVER */}
      {previewCandidate && (
        <div style={{
          position: 'fixed',
          top: Math.min(mousePos.y + 15, window.innerHeight - 180),
          left: Math.min(mousePos.x + 15, window.innerWidth - 320),
          width: '300px',
          background: 'rgba(23, 28, 38, 0.98)',
          border: '1px solid var(--primary)',
          borderRadius: '16px',
          padding: '20px',
          zIndex: 99999,
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(15px)',
          pointerEvents: 'none',
          animation: 'fadeIn 0.2s ease-out',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div>
            <div style={{ fontWeight: '800', fontSize: '16px', color: '#fff', marginBottom: '4px' }}>{previewCandidate.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '600' }}>{previewCandidate.position}</div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#fff' }}>
              <Mic size={16} style={{ color: 'var(--primary)', opacity: 0.8 }} />
              {extractPhone(previewCandidate.phone)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#fff' }}>
              <Mail size={16} style={{ color: 'var(--primary)', opacity: 0.8 }} />
              <span className="text-truncate">{extractEmail(previewCandidate.email)}</span>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
             Dữ liệu đã đồng bộ • CAS Recruit
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// New Functional Components
// ============================================================

function DashboardStats({ candidates }) {
  const stats = [
    { label: 'Sơ vấn', value: candidates.filter(c => c.status === 'SCREENING').length, icon: <Search />, color: 'var(--warning)' },
    { label: 'Phỏng vấn', value: candidates.filter(c => c.status === 'INTERVIEW').length, icon: <Mic />, color: 'var(--info)' },
    { label: 'Chờ nhận việc', value: candidates.filter(c => c.status === 'POST-OFFER').length, icon: <Mail />, color: '#a855f7' },
    { label: 'Đã nhận việc', value: candidates.filter(c => c.status === 'ONBOARD').length, icon: <CheckCircle />, color: 'var(--success)' },
  ];

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(4, 1fr)', 
      gap: '20px', 
      marginBottom: '24px',
      width: '100%'
    }}>
      {stats.map((s, i) => (
        <div key={i} className="stat-card" style={{ margin: 0 }}>
          <div className="stat-icon" style={{ background: `${s.color}20`, color: s.color }}>{s.icon}</div>
          <div className="stat-info">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CreateCandidateModal({ onClose, onSave, masterData }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', position: masterData.positions[0], source: 'Thủ công', status: 'SCREENING', appliedDate: new Date().toISOString().split('T')[0] });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Tạo Ứng Viên Mới</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px' }}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Họ tên</label>
              <input className="input-inline" placeholder="Nguyễn Văn A" value={form.name} onChange={e => setForm({...form, name: e.target.value})} autofocus />
            </div>
            <div className="form-group">
              <label>Vị trí ứng tuyển</label>
              <select className="input-inline" value={form.position} onChange={e => setForm({...form, position: e.target.value})} style={{ width: '100%' }}>
                {masterData.positions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>Số điện thoại</label>
              <input className="input-inline" placeholder="09xxx" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="input-inline" type="email" placeholder="example@mail.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            </div>
          </div>
          <div className="form-group">
            <label>Nguồn</label>
            <select className="input-inline" value={form.source} onChange={e => setForm({...form, source: e.target.value})} style={{ width: '100%' }}>
              {masterData.sources.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-icon" onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px' }}>Hủy</button>
          <button className="btn-primary" onClick={() => onSave(form)} style={{ border: 'none' }}>Lưu ứng viên</button>
        </div>
      </div>
    </div>
  );
}


// ============================================================
// Settings Page Component
// ============================================================



function SettingsPage({ crawlConfig, onRefreshStatus, masterData, fetchMasterData, onUpdateMaster }) {
  const [settingsTab, setSettingsTab] = useState('sites');
  const [config, setConfig] = useState(crawlConfig);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [showPwd, setShowPwd] = useState({ careerlink: false });

  const handleSaveConfig = async (platform) => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          platforms: { 
            [platform]: config.platforms[platform] 
          } 
        })
      });
      const result = await res.json();
      setSaveMsg({ type: 'success', text: result.message });
      onRefreshStatus();
    } catch (e) {
      setSaveMsg({ type: 'error', text: 'Lỗi lưu cấu hình.' });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  const handleUpdatePlatform = (p, field, val) => {
    setConfig(prev => ({
      ...prev,
      platforms: {
        ...prev.platforms,
        [p]: { ...(prev.platforms?.[p] || {}), [field]: val }
      }
    }));
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/scan/history`);
      setScanHistory(await res.json());
    } catch (e) {}
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '14px',
    background: 'var(--bg-surface-elevated)', color: '#fff', 
    border: '1px solid var(--border-color)', outline: 'none', 
    boxSizing: 'border-box'
  };
  const labelStyle = { fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' };

  return (
    <div style={{ padding: '24px 32px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'var(--bg-surface)', borderRadius: '10px', padding: '4px', border: '1px solid var(--border-color)', alignSelf: 'flex-start' }}>
        {[
          { id: 'sites', label: '🌐 Kết nối Site', color: 'var(--primary)' },
          { id: 'db', label: '🗄️ Database', color: '#4ecdc4' },
          { id: 'master', label: '⚙️ Master Data', color: 'var(--warning)' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setSettingsTab(tab.id)} style={{
            padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: '600', transition: 'all 0.2s',
            background: settingsTab === tab.id ? 'rgba(255,255,255,0.08)' : 'transparent',
            color: settingsTab === tab.id ? '#fff' : 'var(--text-muted)'
          }}>{tab.label}</button>
        ))}
      </div>

      {settingsTab === 'sites' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 800px))', gap: '24px' }}>

          {/* CareerLink Card */}
          <div className="glass-panel" style={{ padding: '24px', borderTop: '4px solid #3498db' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ padding: '8px', background: 'rgba(52,152,219,0.1)', color: '#3498db', borderRadius: '8px' }}><Building2 size={20} /></div>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Cấu hình CareerLink</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Email đăng nhập (Employer)</label>
                <input style={inputStyle} value={config.platforms?.careerlink?.email || ''} onChange={e => handleUpdatePlatform('careerlink', 'email', e.target.value)} placeholder="email@careerlink.vn" />
              </div>
              <div>
                <label style={labelStyle}>Mật khẩu</label>
                <div style={{ position: 'relative' }}>
                  <input style={inputStyle} type={showPwd.careerlink ? 'text' : 'password'} value={config.platforms?.careerlink?.password || ''} onChange={e => handleUpdatePlatform('careerlink', 'password', e.target.value)} placeholder="••••••••" />
                  <button onClick={() => setShowPwd(p => ({...p, careerlink: !p.careerlink}))} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>{showPwd.careerlink ? 'Ẩn' : 'Hiện'}</button>
                </div>
              </div>
              <button className="btn-primary" onClick={() => handleSaveConfig('careerlink')} style={{ background: '#3498db', border: 'none', marginTop: '8px' }}>
                <CheckCircle size={16} /> Lưu cấu hình CareerLink
              </button>
            </div>
          </div>

          {/* Scan History Summary */}
          {scanHistory.length > 0 && (
            <div className="glass-panel" style={{ gridColumn: 'span 2', padding: '24px', borderTop: '4px solid #3498db' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ padding: '8px', background: 'rgba(52,152,219,0.1)', color: '#3498db', borderRadius: '8px' }}><RefreshCw size={20} /></div>
                <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Lịch sử cào dữ liệu gần đây</h4>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                {scanHistory.slice(0, 10).map((h, i) => (
                  <div key={i} style={{ 
                    padding: '16px', 
                    borderRadius: '14px', 
                    background: 'rgba(255,255,255,0.03)', 
                    border: '1px solid var(--border-color)', 
                    flex: '1 1 calc(33.333% - 16px)',
                    minWidth: '220px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    transition: 'transform 0.2s ease'
                  }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontFamily: 'monospace', letterSpacing: '0.05em' }}>{h.time}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: '900', color: '#3498db', textTransform: 'uppercase' }}>{h.source}</span>
                      <span style={{ fontSize: '15px', fontWeight: '1000', color: 'var(--primary)' }}>+{h.added} CV</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== MASTER DATA ===== */}
      {settingsTab === 'master' && masterData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '16px 24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div>
              <h3 style={{ fontSize: '16px', color: '#fff', margin: '0 0 6px 0' }}>Tùy chỉnh Dữ liệu Master</h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Thêm/bớt các lựa chọn trong dropdown của hệ thống.</p>
            </div>
            <button className="btn-primary" onClick={fetchMasterData} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)' }}>
              <RefreshCw size={16} /> Làm mới
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
            <EditableList items={masterData.sources || []} onChange={v => onUpdateMaster('sources', v)} title="Nguồn (Sources)" color="var(--info)" />
            <EditableList items={masterData.hrPersons || []} onChange={v => onUpdateMaster('hrPersons', v)} title="Nhân sự xử lý (HR)" color="var(--success)" />
            <EditableList items={masterData.positions || []} onChange={v => onUpdateMaster('positions', v)} title="Vị trí (Positions)" color="var(--danger)" />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

// ============================================================
// Helper Components
// ============================================================

const EditableList = ({ items, onChange, title, color }) => {
  const [newItem, setNewItem] = useState('');

  const addItem = () => {
    if (newItem.trim() && !items.includes(newItem.trim())) {
      onChange([...items, newItem.trim()]);
      setNewItem('');
    }
  };

  const removeItem = (item) => {
    onChange(items.filter(i => i !== item));
  };

  return (
    <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '4px', height: '16px', background: color, borderRadius: '2px' }} />
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h4>
      </div>
      
      <div style={{ display: 'flex', gap: '8px' }}>
        <input 
          style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px' }}
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          placeholder={`Add ${title.toLowerCase()}...`}
          onKeyPress={(e) => e.key === 'Enter' && addItem()}
        />
        <button onClick={addItem} style={{ background: color, border: 'none', borderRadius: '8px', padding: '0 12px', color: '#000', cursor: 'pointer' }}><UserPlus size={16} /></button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {items.map((item, i) => (
          <div key={i} style={{ 
            display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', 
            background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid var(--border-color)',
            fontSize: '13px', color: '#fff'
          }}>
            {item}
            <Trash2 size={12} style={{ cursor: 'pointer', opacity: 0.5 }} onClick={() => removeItem(item)} />
          </div>
        ))}
      </div>
    </div>
  );
};
function CalendarView({ candidates, onUpdate }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const monthNames = [
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
    "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
  ];

  const weekDays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

  const buildCalendar = () => {
    const days = [];
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);

    // Empty slots for previous month
    for (let i = 0; i < startDay; i++) {
        days.push({ day: null, current: false });
    }

    // Actual days
    for (let d = 1; d <= totalDays; d++) {
        days.push({ day: d, current: true, date: new Date(year, month, d) });
    }

    return days;
  };

  const getInterviewsForDay = (date) => {
    if (!date) return [];
    return candidates.filter(c => {
        if (!c.intTime) return false;
        // Parse "14:00 20/03" or ISO "2026-04-08T15:00:00.000Z"
        let candDate;
        if (c.intTime.includes('T')) {
            candDate = new Date(c.intTime);
        } else {
            // "hh:mm dd/mm" format
            const parts = c.intTime.split(' ');
            if (parts.length === 2) {
                const dateParts = parts[1].split('/');
                candDate = new Date(year, parseInt(dateParts[1]) - 1, parseInt(dateParts[0]));
            }
        }
        return candDate && candDate.getDate() === date.getDate() && 
               candDate.getMonth() === date.getMonth() && 
               candDate.getFullYear() === date.getFullYear();
    });
  };

  const calendarDays = buildCalendar();

  const addToGoogleCalendar = (cand) => {
    const title = `Phỏng vấn: ${cand.name} - ${cand.position}`;
    const details = `Liên hệ: ${cand.phone}\nLink CV: ${cand.cvLink || 'N/A'}`;
    const location = "Văn phòng CAS / Online";
    
    // Default to today if parse fails
    let start = new Date();
    if (cand.intTime) {
        if (cand.intTime.includes('T')) {
            start = new Date(cand.intTime);
        } else {
            const parts = cand.intTime.split(' ');
            if (parts.length === 2) {
                const [hh, mm] = parts[0].split(':');
                const [dd, mon] = parts[1].split('/');
                start = new Date(year, parseInt(mon)-1, parseInt(dd), parseInt(hh), parseInt(mm));
            }
        }
    }
    
    const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour duration
    
    const isoStart = start.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const isoEnd = end.toISOString().replace(/-|:|\.\d\d\d/g, "");
    
    const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${isoStart}/${isoEnd}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
    window.open(url, '_blank');
  };

  return (
    <div style={{ padding: '24px 32px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#fff' }}>Lịch Phỏng Vấn</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Quản lý lịch trình tuyển dụng thông minh</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button className="btn-icon" onClick={goToToday} style={{ padding: '8px 16px', background: 'var(--bg-surface-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', color: '#fff' }}>Hôm nay</button>
          <div style={{ display: 'flex', background: 'var(--bg-surface-elevated)', borderRadius: '10px', padding: '4px', border: '1px solid var(--border-color)' }}>
            <button className="btn-icon" onClick={prevMonth} style={{ background: 'none', border: 'none', color: '#fff' }}><ChevronLeft size={20}/></button>
            <span style={{ padding: '0 16px', fontWeight: '700', minWidth: '120px', textAlign: 'center' }}>{monthNames[month]} {year}</span>
            <button className="btn-icon" onClick={nextMonth} style={{ background: 'none', border: 'none', color: '#fff' }}><ChevronRight size={20}/></button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="glass-panel" style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Days Header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '16px' }}>
          {weekDays.map(d => (
            <div key={d} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase' }}>{d}</div>
          ))}
        </div>

        {/* Days Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: 'var(--border-color)', border: '1px solid var(--border-color)', flex: 1 }}>
          {calendarDays.map((d, i) => {
            const dayInterviews = getInterviewsForDay(d.date);
            const isToday = d.date && d.date.toDateString() === new Date().toDateString();
            
            return (
              <div key={i} 
                   onClick={() => d.day && setSelectedDay(d.date)}
                   style={{ 
                    background: d.current ? 'var(--bg-surface)' : 'rgba(255,255,255,0.02)',
                    minHeight: '100px',
                    padding: '8px',
                    cursor: d.day ? 'pointer' : 'default',
                    transition: 'all 0.2s',
                    position: 'relative'
                   }}
                   onMouseOver={(e) => d.day && (e.currentTarget.style.background = 'var(--bg-surface-elevated)')}
                   onMouseOut={(e) => d.day && (e.currentTarget.style.background = d.current ? 'var(--bg-surface)' : 'rgba(255,255,255,0.02)')}
              >
                {d.day && (
                  <>
                    <div style={{ 
                        fontSize: '13px', 
                        fontWeight: isToday ? '900' : '600', 
                        color: isToday ? 'var(--primary)' : 'var(--text-muted)',
                        marginBottom: '8px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: isToday ? 'rgba(78,205,196,0.1)' : 'transparent'
                    }}>
                        {d.day}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {dayInterviews.map(cand => (
                            <div key={cand.id} 
                                 className="calendar-event"
                                 title={`${cand.name} - ${cand.position}`}
                                 style={{
                                    fontSize: '11px',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    background: 'rgba(78,205,196,0.1)',
                                    color: 'var(--primary)',
                                    borderLeft: '2px solid var(--primary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                 }}
                            >
                                {cand.name}
                            </div>
                        ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Modal/Panel */}
      {selectedDay && (
          <div className="modal-overlay" onClick={() => setSelectedDay(null)}>
              <div className="glass-panel" 
                   onClick={e => e.stopPropagation()}
                   style={{ width: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: '24px', gap: '20px', animation: 'fadeInScale 0.3s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0 }}>Lịch phỏng vấn ngày {selectedDay.toLocaleDateString('vi-VN')}</h3>
                      <button onClick={() => setSelectedDay(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X/></button>
                  </div>
                  
                  <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {getInterviewsForDay(selectedDay).length > 0 ? getInterviewsForDay(selectedDay).map(cand => (
                          <div key={cand.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                  <div style={{ fontWeight: '700', fontSize: '15px' }}>{cand.name}</div>
                                  <div style={{ fontSize: '13px', color: 'var(--primary)' }}>{cand.position}</div>
                                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>🕖 {cand.intTime}</div>
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                  <button onClick={() => addToGoogleCalendar(cand)} className="btn-icon" style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', color: 'var(--primary)', border: '1px solid rgba(78,205,196,0.3)' }} title="Thêm vào Google Calendar">
                                      <Calendar size={18}/>
                                  </button>
                                  <button className="btn-icon" style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', color: 'var(--info)', border: '1px solid rgba(52,152,219,0.3)' }}>
                                      <ExternalLink size={18}/>
                                  </button>
                              </div>
                          </div>
                      )) : (
                          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Chưa có lịch phỏng vấn nào được đặt.</div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
