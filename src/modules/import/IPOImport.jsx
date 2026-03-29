import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import Loader from '../../components/ui/Loader';
import '../../assets/styles/components/IPOImport.css';

/* ── Excel Column → DB Column Mapping ────────────────────── */
const TEMPLATE_COLUMNS = [
  { header: 'IPO No', key: 'ipo_no', type: 'text', required: true },
  { header: 'Fix No', key: 'fix_no', type: 'text', required: false },
  { header: 'Plan Name', key: 'plan_name', type: 'text', },
  { header: 'Plan Date', key: 'plan_date', type: 'date', required: false },
  { header: 'Barcode', key: 'barcode', type: 'text', required: false },
  { header: 'Height', key: 'height', type: 'number', required: true },
  { header: 'Item Name', key: 'item_name', type: 'text', required: false },
  { header: 'Width', key: 'width', type: 'number', required: true },
  { header: 'Drawing No', key: 'drawing_no', type: 'text', required: false },
  { header: 'Quantity', key: 'quantity', type: 'integer', required: true },
  { header: 'Plan Description', key: 'plan_description', type: 'text', required: false },
  { header: 'Lot Unit', key: 'lot_unit', type: 'text', required: false },
  { header: 'Room No', key: 'room_no', type: 'text', required: false },
  { header: 'Area', key: 'area', type: 'number', required: false },
  { header: 'Mark No', key: 'mark_no', type: 'text', required: false },
  { header: 'IPO', key: 'ipo', type: 'text', required: false },
];

/* ── Helpers ──────────────────────────────────────────────── */
function parseExcelDate(v) {
  if (!v) return null;
  // If it's already a string like "2025-03-22", just return it
  if (typeof v === 'string') {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return null;
  }
  // Excel serial date number
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return null;
}

function castValue(v, type) {
  if (v === undefined || v === null || v === '') return null;
  switch (type) {
    case 'number': return parseFloat(v) || 0;
    case 'integer': return parseInt(v, 10) || 0;
    case 'date': return parseExcelDate(v);
    default: return String(v).trim();
  }
}

/* ── Icon SVGs ────────────────────────────────────────────── */
const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
const UploadIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
const FileIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);
const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);


export default function IPOImport() {
  const { user, profile } = useAuth();
  const fileInputRef = useRef(null);

  const [rows, setRows] = useState([]);           // parsed data rows
  const [errors, setErrors] = useState([]);        // validation errors
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null); // { success, failed, errors }
  const [step, setStep] = useState('upload');      // 'upload' | 'preview' | 'done'
  const [importHistory, setImportHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [filterIpo, setFilterIpo] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [importUsers, setImportUsers] = useState([]);
  const [companiesList, setCompaniesList] = useState([]);

  /* ── Fetch Companies List ── */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('companies').select('id, name').order('name');
      if (data) setCompaniesList(data);
    })();
  }, []);

  /* ── Fetch Import History ── */
  const fetchHistory = useCallback(async () => {
    if (!profile?.company_id) return;
    setHistoryLoading(true);

    // Paginate to fetch ALL rows (Supabase limits to 1000 per request)
    let allData = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
      let query = supabase
        .from('ipo_master')
        .select('ipo_no, import_id, area, quantity, created_at, company_id, import_by_user_id, profiles:import_by_user_id(full_name), companies:company_id(name)')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1);
      const { data, error } = await query;
      if (error || !data) break;
      allData = allData.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    if (allData.length > 0) {
      // Collect unique users
      const usersMap = {};
      allData.forEach(row => {
        if (row.import_by_user_id && row.profiles?.full_name) {
          usersMap[row.import_by_user_id] = row.profiles.full_name;
        }
      });
      setImportUsers(Object.entries(usersMap).map(([id, name]) => ({ id, name })));

      // Group by ipo_no
      const grouped = {};
      allData.forEach(row => {
        const key = row.ipo_no || 'Unknown';
        if (!grouped[key]) {
          grouped[key] = {
            ipo_no: key,
            import_id: row.import_id,
            total_area: 0,
            total_qty: 0,
            imported_date: row.created_at,
            imported_by: row.profiles?.full_name || 'Unknown',
            import_by_user_id: row.import_by_user_id,
            company_id: row.company_id,
            company_name: row.companies?.name || 'Unknown',
          };
        }
        grouped[key].total_area += parseFloat(row.area) || 0;
        grouped[key].total_qty += parseInt(row.quantity) || 0;
        if (row.created_at < grouped[key].imported_date) {
          grouped[key].imported_date = row.created_at;
        }
      });
      setImportHistory(Object.values(grouped));
    }
    setHistoryLoading(false);
  }, [profile?.company_id]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  /* ── Filter history ── */
  const filteredHistory = importHistory.filter(item => {
    if (filterIpo && !item.ipo_no.toLowerCase().includes(filterIpo.toLowerCase())) return false;
    if (filterUser && item.import_by_user_id !== filterUser) return false;
    if (filterCompany && item.company_id !== filterCompany) return false;
    if (filterDate) {
      const itemDate = new Date(item.imported_date).toISOString().split('T')[0];
      if (itemDate !== filterDate) return false;
    }
    return true;
  });

  /* ── Delete IPO (admin only) ── */
  const isAdmin = profile && ['admin', 'superadmin'].includes(profile.role);

  const deleteIpo = async (ipoNo) => {
    if (!isAdmin) return;
    if (!window.confirm(`Delete all records for IPO "${ipoNo}"? This cannot be undone.`)) return;
    const { error } = await supabase
      .from('ipo_master')
      .delete()
      .eq('company_id', profile.company_id)
      .eq('ipo_no', ipoNo);
    if (error) {
      alert('Failed to delete: ' + error.message);
    } else {
      fetchHistory();
    }
  };

  /* ── Download Template ── */
  const downloadTemplate = useCallback(() => {
    const headers = TEMPLATE_COLUMNS.map(c => c.header);
    // Example row with sample data
    const sampleRow = [
      'IPO-001', 'FIX-001', 'Plan A', '2025-01-15', 'BC-12345',
      '1200', 'Panel Type A', '800', 'DRW-001', '10',
      'Sample plan description', 'Lot-1', 'Room-101', '960.00', 'MK-001', 'IPO-REF'
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
    // Set column widths
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 16) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'IPO Template');
    // Write as binary and trigger download via Blob (reliable in browser/Vite)
    const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'IPO_Import_Template.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  /* ── Parse uploaded file ── */
  const parseFile = useCallback((file) => {
    if (!file) return;
    setFileName(file.name);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (jsonData.length === 0) {
          setErrors([{ row: 0, message: 'The uploaded file contains no data rows.' }]);
          setRows([]);
          setStep('preview');
          return;
        }

        // Map Excel headers to DB keys
        const headerMap = {};
        TEMPLATE_COLUMNS.forEach(col => {
          headerMap[col.header.toLowerCase()] = col;
        });

        const parsed = [];
        const validationErrors = [];

        jsonData.forEach((excelRow, idx) => {
          const row = {};
          const rowNum = idx + 2; // +1 for header, +1 for 1-indexing

          TEMPLATE_COLUMNS.forEach(col => {
            // Try to find matching header (case-insensitive)
            let value = null;
            for (const [excelKey, excelVal] of Object.entries(excelRow)) {
              if (excelKey.toLowerCase().trim() === col.header.toLowerCase()) {
                value = excelVal;
                break;
              }
            }
            const casted = castValue(value, col.type);
            row[col.key] = casted;

            // Validate required fields
            if (col.required && (casted === null || casted === '' || casted === 0)) {
              // Allow 0 for height/width/quantity only if explicitly set
              if (col.type === 'number' || col.type === 'integer') {
                if (value === '' || value === null || value === undefined) {
                  validationErrors.push({ row: rowNum, message: `Row ${rowNum}: "${col.header}" is required.` });
                }
              } else {
                validationErrors.push({ row: rowNum, message: `Row ${rowNum}: "${col.header}" is required.` });
              }
            }
          });

          parsed.push(row);
        });

        setRows(parsed);
        setErrors(validationErrors);
        setStep('preview');
      } catch (err) {
        setErrors([{ row: 0, message: `Failed to parse file: ${err.message}` }]);
        setRows([]);
        setStep('preview');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  /* ── Drag & Drop handlers ── */
  const handleDrag = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDragIn = (e) => { handleDrag(e); setDragOver(true); };
  const handleDragOut = (e) => { handleDrag(e); setDragOver(false); };
  const handleDrop = (e) => {
    handleDrag(e);
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      parseFile(file);
    } else {
      setErrors([{ row: 0, message: 'Please upload a valid .xlsx, .xls, or .csv file.' }]);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  /* ── Remove a row ── */
  const removeRow = (idx) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
    // Clear errors for removed row and re-index
    setErrors(prev => prev.filter(e => e.row !== idx + 2));
  };

  /* ── Import to Supabase ── */
  const handleImport = async () => {
    if (!profile?.company_id) {
      setErrors([{ row: 0, message: 'Your profile does not have a company_id. Please contact an admin.' }]);
      return;
    }
    if (rows.length === 0) return;
    setImporting(true);
    setImportResult(null);

    // Create import log entry
    const { data: importLog } = await supabase.from('import_logs').insert({
      company_id: profile.company_id,
      imported_by: user.id,
      import_type: 'ipo',
      file_name: fileName,
      total_records: rows.length,
      status: 'processing',
    }).select('id').single();

    const importId = importLog?.id || null;
    let successCount = 0;
    let failedCount = 0;
    const importErrors = [];

    // Insert in batches of 100
    const BATCH_SIZE = 100;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE).map(row => ({
        ...row,
        company_id: profile.company_id,
        import_by_user_id: user.id,
        import_id: importId,
        status: 'draft',
      }));

      const { data, error } = await supabase.from('ipo_master').insert(batch).select('id');

      if (error) {
        failedCount += batch.length;
        importErrors.push({ batch: Math.floor(i / BATCH_SIZE) + 1, message: error.message });
      } else {
        successCount += data?.length || batch.length;
      }
    }

    // Update import log
    if (importId) {
      await supabase.from('import_logs').update({
        success_records: successCount,
        failed_records: failedCount,
        errors: importErrors.length > 0 ? importErrors : null,
        status: failedCount === 0 ? 'completed' : (successCount > 0 ? 'completed' : 'failed'),
        completed_at: new Date().toISOString(),
      }).eq('id', importId);
    }

    setImportResult({ success: successCount, failed: failedCount, errors: importErrors });
    setImporting(false);
    setStep('done');
    // Refresh history after import
    fetchHistory();
  };

  /* ── Reset ── */
  const resetImport = () => {
    setRows([]);
    setErrors([]);
    setFileName('');
    setImportResult(null);
    setStep('upload');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ── Render ── */
  return (
    <div className="ipo-import-page">
      {/* Header */}
      <div className="ipo-import-header">
        <div>
          <h1 className="ipo-import-title">IPO Import</h1>
          <p className="ipo-import-subtitle">Import IPO data from Excel spreadsheets into the system</p>
        </div>
        <button className="ipo-btn ipo-btn-template" onClick={downloadTemplate}>
          <DownloadIcon />
          <span>Download Template</span>
        </button>
      </div>

      {/* Steps indicator */}
      <div className="ipo-steps">
        <div className={`ipo-step ${step === 'upload' ? 'is-active' : (step !== 'upload' ? 'is-done' : '')}`}>
          <div className="ipo-step-num">{step !== 'upload' ? <CheckIcon /> : '1'}</div>
          <span>Upload</span>
        </div>
        <div className="ipo-step-line" />
        <div className={`ipo-step ${step === 'preview' ? 'is-active' : (step === 'done' ? 'is-done' : '')}`}>
          <div className="ipo-step-num">{step === 'done' ? <CheckIcon /> : '2'}</div>
          <span>Preview</span>
        </div>
        <div className="ipo-step-line" />
        <div className={`ipo-step ${step === 'done' ? 'is-active' : ''}`}>
          <div className="ipo-step-num">3</div>
          <span>Complete</span>
        </div>
      </div>

      {/* ── Upload Step ── */}
      {step === 'upload' && (
        <div
          className={`ipo-dropzone ${dragOver ? 'is-dragover' : ''}`}
          onDragEnter={handleDragIn}
          onDragLeave={handleDragOut}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx,.xls,.csv"
            onChange={handleFileInput}
            hidden
          />
          <div className="ipo-dropzone-icon"><UploadIcon /></div>
          <p className="ipo-dropzone-title">Drag & drop your Excel file here</p>
          <p className="ipo-dropzone-sub">or click to browse — Supports .xlsx, .xls, .csv</p>
          <div className="ipo-dropzone-hint">
            <FileIcon />
            <span>Need a template? Click <strong>"Download Template"</strong> above to get started.</span>
          </div>
        </div>
      )}

      {/* ── Preview Step ── */}
      {step === 'preview' && (
        <div className="ipo-preview-section">
          {/* File info bar */}
          <div className="ipo-file-bar">
            <div className="ipo-file-info">
              <FileIcon />
              <span className="ipo-file-name">{fileName}</span>
              <span className="ipo-file-count">{rows.length} rows</span>
            </div>
            <div className="ipo-file-actions">
              <button className="ipo-btn ipo-btn-ghost" onClick={resetImport}>
                <TrashIcon /> <span>Clear</span>
              </button>
              <button
                className="ipo-btn ipo-btn-import"
                onClick={handleImport}
                disabled={importing || rows.length === 0 || errors.length > 0}
              >
                {importing ? (
                  <><Loader size="sm" color="#fff" /> Importing...</>
                ) : (
                  <><UploadIcon /><span>Import {rows.length} Rows</span></>
                )}
              </button>
            </div>
          </div>

          {/* Import summary — what's about to be imported */}
          {rows.length > 0 && (() => {
            const summary = {};
            let grandArea = 0, grandQty = 0;
            rows.forEach(r => {
              const key = r.ipo_no || 'Unknown';
              if (!summary[key]) summary[key] = { area: 0, qty: 0 };
              const a = parseFloat(r.area) || 0;
              const q = parseInt(r.quantity) || 0;
              summary[key].area += a;
              summary[key].qty += q;
              grandArea += a;
              grandQty += q;
            });
            const entries = Object.entries(summary);
            return (
              <div className="ipo-summary-panel">
                <div className="ipo-summary-header">Import Summary</div>
                <div className="ipo-summary-grid">
                  {entries.map(([ipo, vals], i) => (
                    <div key={i} className="ipo-summary-card">
                      <div className="ipo-summary-card-ipo">{ipo}</div>
                      <div className="ipo-summary-card-stats">
                        <span><strong>{vals.area.toFixed(2)}</strong> area</span>
                        <span><strong>{vals.qty}</strong> qty</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="ipo-summary-totals">
                  <span>Total: <strong>{grandArea.toFixed(2)}</strong> area</span>
                  <span className="ipo-summary-sep">•</span>
                  <span><strong>{grandQty}</strong> qty</span>
                  <span className="ipo-summary-sep">•</span>
                  <span><strong>{entries.length}</strong> IPO{entries.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            );
          })()}
          {errors.length > 0 && (
            <div className="ipo-errors-panel">
              <div className="ipo-errors-header">
                <AlertIcon />
                <span>{errors.length} validation error{errors.length > 1 ? 's' : ''} found</span>
              </div>
              <div className="ipo-errors-list">
                {errors.slice(0, 20).map((err, i) => (
                  <div key={i} className="ipo-error-item">{err.message}</div>
                ))}
                {errors.length > 20 && (
                  <div className="ipo-error-item ipo-error-more">...and {errors.length - 20} more errors</div>
                )}
              </div>
            </div>
          )}

          {/* Data table */}
          {rows.length > 0 && (
            <div className="ipo-table-wrap">
              <table className="ipo-table">
                <thead>
                  <tr>
                    <th className="ipo-th-num">#</th>
                    {TEMPLATE_COLUMNS.map(col => (
                      <th key={col.key}>
                        {col.header}
                        {col.required && <span className="ipo-th-required">*</span>}
                      </th>
                    ))}
                    <th className="ipo-th-action"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const hasError = errors.some(e => e.row === idx + 2);
                    return (
                      <tr key={idx} className={hasError ? 'has-error' : ''}>
                        <td className="ipo-td-num">{idx + 1}</td>
                        {TEMPLATE_COLUMNS.map(col => (
                          <td key={col.key} className={col.required && !row[col.key] ? 'is-missing' : ''}>
                            {row[col.key] !== null && row[col.key] !== undefined ? String(row[col.key]) : '—'}
                          </td>
                        ))}
                        <td className="ipo-td-action">
                          <button className="ipo-row-delete" onClick={() => removeRow(idx)} title="Remove row">
                            <TrashIcon />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Done Step ── */}
      {step === 'done' && importResult && (
        <div className="ipo-done-section">
          <div className={`ipo-done-card ${importResult.failed > 0 ? 'has-warnings' : ''}`}>
            <div className="ipo-done-icon">
              {importResult.failed === 0 ? (
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              ) : (
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              )}
            </div>
            <h2 className="ipo-done-title">
              {importResult.failed === 0 ? 'Import Successful!' : 'Import Completed with Warnings'}
            </h2>
            <p className="ipo-done-desc">
              {importResult.success} row{importResult.success !== 1 ? 's' : ''} imported successfully
              {importResult.failed > 0 && `, ${importResult.failed} failed`}.
            </p>

            <div className="ipo-done-stats">
              <div className="ipo-done-stat is-success">
                <div className="ipo-done-stat-value">{importResult.success}</div>
                <div className="ipo-done-stat-label">Successful</div>
              </div>
              <div className="ipo-done-stat is-failed">
                <div className="ipo-done-stat-value">{importResult.failed}</div>
                <div className="ipo-done-stat-label">Failed</div>
              </div>
            </div>

            {importResult.errors?.length > 0 && (
              <div className="ipo-errors-panel" style={{ marginTop: 20 }}>
                <div className="ipo-errors-header">
                  <AlertIcon /> <span>Import Errors</span>
                </div>
                <div className="ipo-errors-list">
                  {importResult.errors.map((err, i) => (
                    <div key={i} className="ipo-error-item">Batch {err.batch}: {err.message}</div>
                  ))}
                </div>
              </div>
            )}

            <button className="ipo-btn ipo-btn-import" onClick={resetImport} style={{ marginTop: 24 }}>
              Import Another File
            </button>
          </div>
        </div>
      )}

      {/* ── Import History ── */}
      {profile?.company_id && (
        <div className="ipo-history-section">
          <h2 className="ipo-history-title">Import History</h2>

          {/* Filter bar */}
          <div className="ipo-filter-bar">
            <div className="ipo-filter-group">
              <label className="ipo-filter-label">Search IPO</label>
              <input
                className="ipo-filter-input"
                type="text"
                placeholder="e.g. 12L3"
                value={filterIpo}
                onChange={e => setFilterIpo(e.target.value)}
              />
            </div>
            <div className="ipo-filter-group">
              <label className="ipo-filter-label">Date</label>
              <input
                className="ipo-filter-input"
                type="date"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
              />
            </div>
            <div className="ipo-filter-group">
              <label className="ipo-filter-label">Imported By</label>
              <select
                className="ipo-filter-input"
                value={filterUser}
                onChange={e => setFilterUser(e.target.value)}
              >
                <option value="">All Users</option>
                {importUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="ipo-filter-group">
              <label className="ipo-filter-label">Company</label>
              <select
                className="ipo-filter-input"
                value={filterCompany}
                onChange={e => setFilterCompany(e.target.value)}
              >
                <option value="">All Companies</option>
                {companiesList.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {(filterIpo || filterDate || filterUser || filterCompany) && (
              <button
                className="ipo-btn ipo-btn-ghost"
                style={{ alignSelf: 'flex-end' }}
                onClick={() => { setFilterIpo(''); setFilterDate(''); setFilterUser(''); setFilterCompany(''); }}
              >
                Clear
              </button>
            )}
          </div>

          {historyLoading ? (
            <div className="ipo-history-loading">Loading history...</div>
          ) : filteredHistory.length === 0 ? (
            <div className="ipo-history-empty">{importHistory.length === 0 ? 'No IPO imports yet.' : 'No results match your filters.'}</div>
          ) : (() => {
            // Build color map for import IDs
            const IMPORT_COLORS = [
              { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6' },
              { bg: 'rgba(16,185,129,0.12)', text: '#10b981' },
              { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' },
              { bg: 'rgba(239,68,68,0.12)', text: '#ef4444' },
              { bg: 'rgba(139,92,246,0.12)', text: '#8b5cf6' },
              { bg: 'rgba(236,72,153,0.12)', text: '#ec4899' },
              { bg: 'rgba(20,184,166,0.12)', text: '#14b8a6' },
              { bg: 'rgba(249,115,22,0.12)', text: '#f97316' },
            ];
            const uniqueIds = [...new Set(filteredHistory.map(h => h.import_id).filter(Boolean))];
            const colorMap = {};
            uniqueIds.forEach((id, i) => { colorMap[id] = IMPORT_COLORS[i % IMPORT_COLORS.length]; });

            return (
              <div className="ipo-table-wrap">
                <table className="ipo-table">
                  <thead>
                    <tr>
                      <th className="ipo-th-num">#</th>
                      <th>IPO No</th>
                      <th>Import ID</th>
                      <th>Total Area</th>
                      <th>Total Qty</th>
                      <th>Imported By</th>
                      <th>Imported Date</th>
                      {isAdmin && <th className="ipo-th-action"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((item, idx) => (
                      <tr key={idx}>
                        <td className="ipo-td-num">{idx + 1}</td>
                        <td><strong>{item.ipo_no}</strong></td>
                        <td>
                          {item.import_id ? (
                            <span className="ipo-import-badge" style={{
                              background: colorMap[item.import_id]?.bg || 'var(--surface-high)',
                              color: colorMap[item.import_id]?.text || 'var(--text-muted)',
                            }}>
                              {item.import_id.slice(0, 8)}
                            </span>
                          ) : '—'}
                        </td>
                        <td>{item.total_area.toFixed(2)}</td>
                        <td>{item.total_qty}</td>
                        <td>{item.imported_by}</td>
                        <td>{new Date(item.imported_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        {isAdmin && (
                          <td className="ipo-td-action">
                            <button className="ipo-row-delete" onClick={() => deleteIpo(item.ipo_no)} title="Delete this IPO">
                              <TrashIcon />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
