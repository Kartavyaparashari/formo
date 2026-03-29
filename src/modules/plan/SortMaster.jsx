import React, { useState, useEffect, useMemo } from 'react';
import { AlertCircle, CheckCircle, Play, RefreshCw, Filter, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import Checkbox from '../../components/ui/Checkbox';
import ToggleSwitch from '../../components/ui/ToggleSwitch';


// ─── Helper functions (unchanged) ───────────────────────────────────────────────
const hasNoPlan = (item) => {
    const val = item.plan_name;
    if (val === null || val === undefined || val === false || val === 0) return true;
    const str = String(val).trim();
    return str === '' || str === 'null' || str === 'undefined' || str === '0';
};

const parsePlanSerial = (planName) => {
    if (!planName) return { major: Infinity, minor: Infinity };
    const match = planName.match(/-(\d+)\.(\d+)$/);
    if (!match) return { major: Infinity, minor: Infinity };
    return { major: parseInt(match[1], 10), minor: parseInt(match[2], 10) };
};

const ShortMaster = () => {
    const { profile } = useAuth();
    const [pnlData, setPnlData] = useState([]);
    const [exceptionData, setExceptionData] = useState([]);
    const [shortData, setShortData] = useState([]);
    const [selectedIpos, setSelectedIpos] = useState([]);
    const [mixIposPlan, setMixIposPlan] = useState(false);
    const [showPlanDone, setShowPlanDone] = useState(true);
    const [showPendingPlan, setShowPendingPlan] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [availableIpos, setAvailableIpos] = useState([]);
    const [activeTab, setActiveTab] = useState('items');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(100);
    const [sortConfig, setSortConfig] = useState({ key: 'plan_name', direction: 'asc' });
    const [searchTerm, setSearchTerm] = useState('');
    const [searchColumn, setSearchColumn] = useState('all');
    const [autoWritePlan, setAutoWritePlan] = useState(true);
    const [manualSerial, setManualSerial] = useState('1.001');
    const [planShortDate, setPlanShortDate] = useState('');

    // ─── Data fetching (unchanged) ───────────────────────────────────────────────
    const fetchAllData = async (tableName, orderBy = null, companyId = null) => {
        let allData = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;

        while (hasMore) {
            let query = supabase.from(tableName).select('*');
            if (companyId) query = query.eq('company_id', companyId);
            if (orderBy) query = query.order(orderBy, { ascending: true });
            const { data, error } = await query.range(from, from + batchSize - 1);
            if (error) throw error;
            if (data && data.length > 0) {
                allData = [...allData, ...data];
                from += batchSize;
                if (data.length < batchSize) hasMore = false;
            } else {
                hasMore = false;
            }
        }
        return allData;
    };

    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        setPlanShortDate(today);
        loadData();
    }, [profile]);

    const loadData = async () => {
        if (!profile?.company_id) return;
        setLoading(true);
        try {
            const [pnlResult, exceptionResult, shortResult] = await Promise.all([
                fetchAllData('ipo_master', 'id', profile.company_id),
                fetchAllData('exclusion_items', null, profile.company_id),
                fetchAllData('sort_master', null, profile.company_id)
            ]);

            setPnlData(pnlResult || []);
            setExceptionData(exceptionResult || []);
            setShortData(shortResult || []);

            const ipos = [...new Set((pnlResult || []).map(item => String(item.ipo_no)))].filter(Boolean);
            setAvailableIpos(ipos);
            setSelectedIpos(ipos);

        } catch (error) {
            console.error('Error loading data:', error);
            alert('Error loading data: ' + error.message);
        }
        setLoading(false);
    };

    const isValidManualSerial = (serial) => /^\d+\.\d{3}$/.test(serial);

    const processPlanNumbers = async () => {
        if (!planShortDate) {
            alert('Please enter Plan Short Date!');
            return;
        }
        if (!autoWritePlan && !isValidManualSerial(manualSerial)) {
            alert('Please enter a valid manual serial in format like 1.003');
            return;
        }
        if (!profile?.company_id) {
            alert('Company ID missing!');
            return;
        }
        if (selectedIpos.length === 0) {
            alert('Please select at least one IPO!');
            return;
        }

        setProcessing(true);
        setProgress(30);

        try {
            const payload = {
                selectedIpos: selectedIpos.map(String),
                mixIposPlan,
                planShortDate,
                autoWritePlan,
                manualSerial,
                companyId: profile.company_id
            };

            console.log('Sending to API:', JSON.stringify(payload, null, 2));

            const response = await fetch('http://localhost:3001/api/process-plans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            setProgress(80);
            const data = await response.json();
            console.log('API response:', data);

            if (!response.ok) {
                throw new Error(data.error || 'Failed to process plans on server.');
            }

            setResults(data.results);
            setActiveTab('results');
            alert(data.message);
            await loadData();

        } catch (error) {
            console.error('Error contacting backend API:', error);
            alert('Error updating plan numbers: ' + error.message);
        }

        setProcessing(false);
        setProgress(0);
    };

    // ─── Sorting & filtering (unchanged) ─────────────────────────────────────────
    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const searchItems = (items) => {
        if (!searchTerm) return items;
        return items.filter(item => {
            if (searchColumn === 'all') {
                return Object.values(item).some(value =>
                    String(value).toLowerCase().includes(searchTerm.toLowerCase())
                );
            }
            const value = item[searchColumn];
            return value && String(value).toLowerCase().includes(searchTerm.toLowerCase());
        });
    };

    const sortItems = (items) => {
        if (!sortConfig.key) return items;

        return [...items].sort((a, b) => {
            let aVal = a[sortConfig.key] ?? '';
            let bVal = b[sortConfig.key] ?? '';

            if (sortConfig.key === 'plan_name') {
                const aSerial = parsePlanSerial(aVal);
                const bSerial = parsePlanSerial(bVal);
                if (aSerial.major !== bSerial.major) {
                    return sortConfig.direction === 'asc' ? aSerial.major - bSerial.major : bSerial.major - aSerial.major;
                }
                return sortConfig.direction === 'asc' ? aSerial.minor - bSerial.minor : bSerial.minor - aSerial.minor;
            }

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const filteredPnlData = useMemo(() => {
        let filtered = pnlData.filter(item => {
            if (!selectedIpos.includes(String(item.ipo_no))) return false;
            const hasPlan = !hasNoPlan(item);
            if (!showPlanDone && hasPlan) return false;
            if (!showPendingPlan && !hasPlan) return false;
            return true;
        });
        filtered = searchItems(filtered);
        filtered = sortItems(filtered);
        return filtered;
    }, [pnlData, selectedIpos, showPlanDone, showPendingPlan, searchTerm, searchColumn, sortConfig]);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredPnlData.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredPnlData, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredPnlData.length / itemsPerPage);

    const handleIpoToggle = (ipo) => {
        setSelectedIpos(prev =>
            prev.includes(ipo) ? prev.filter(i => i !== ipo) : [...prev, ipo]
        );
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setSelectedIpos(availableIpos);
        setMixIposPlan(false);
        setShowPlanDone(true);
        setShowPendingPlan(true);
        setSearchTerm('');
        setSearchColumn('all');
        setCurrentPage(1);
        setAutoWritePlan(true);
        setManualSerial('1.001');
        setPlanShortDate(new Date().toISOString().split('T')[0]);
    };

    const exportToCSV = (data, filename) => {
        if (!data || data.length === 0) { alert('No data to export'); return; }

        const sortedData = [...data].sort((a, b) => {
            const aSerial = parsePlanSerial(a.plan_name);
            const bSerial = parsePlanSerial(b.plan_name);
            if (aSerial.major !== bSerial.major) return aSerial.major - bSerial.major;
            return aSerial.minor - bSerial.minor;
        });
        const dataToExport = sortedData;

        const headers = Object.keys(dataToExport[0]);
        const csvContent = [
            headers.join(','),
            ...dataToExport.map(row =>
                headers.map(h => {
                    const v = row[h];
                    if (v === null || v === undefined) return '';
                    const s = String(v);
                    return s.includes(',') || s.includes('"') || s.includes('\n')
                        ? `"${s.replace(/"/g, '""')}"` : s;
                }).join(',')
            )
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const SortableHeader = ({ column, children }) => (
        <th className="table-header sortable-header" onClick={() => handleSort(column)} style={{ cursor: 'pointer' }}>
            <div className="header-content">
                {children}
                {sortConfig.key === column && (
                    sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                )}
            </div>
        </th>
    );

    const pendingCount = pnlData.filter(item =>
        selectedIpos.includes(String(item.ipo_no)) && hasNoPlan(item)
    ).length;

    if (loading) {
        return (
            <div className="loading-container">
                <Loader size="lg" color="var(--primary)" />
                <span className="loading-text">Loading data... This may take a while for large datasets.</span>
            </div>
        );
    }

    return (
        <div className="planning-system-container">
            <div className="planning-system-card">

                {/* Tabs */}
                <div className="planning-system-tabs">
                    <div className="tabs-container">
                        <button
                            onClick={() => setActiveTab('items')}
                            className={`tab-button ${activeTab === 'items' ? 'tab-active' : ''}`}
                        >
                            <Filter className="tab-icon" size={18} />
                            Items & Settings
                        </button>
                        <button
                            onClick={() => setActiveTab('results')}
                            className={`tab-button ${activeTab === 'results' ? 'tab-active' : ''}`}
                        >
                            <CheckCircle className="tab-icon" size={18} />
                            Results
                        </button>
                        <div className="tab-actions">
                            <Button
                                onClick={loadData}
                                disabled={loading}
                                variant="outline"
                                size="sm"
                                className="refresh-button"
                            >
                                <RefreshCw className={`refresh-icon ${loading ? 'loading-spin' : ''}`} size={18} />
                                Refresh Data
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="planning-system-content">

                    {/* ── Items & Settings Tab ── */}
                    {activeTab === 'items' && (
                        <div className="items-tab-container">

                            {/* Data Status */}
                            <div className="data-status-card">
                                <h3 className="data-status-title">Data Status</h3>
                                <div className="data-status-grid">
                                    <div className="status-item">
                                        <div className="status-label">IPO Master</div>
                                        <div className="status-count">{pnlData.length.toLocaleString()}</div>
                                        <div className="status-unit">items</div>
                                    </div>
                                    <div className="status-item">
                                        <div className="status-label">Exclusion Rules</div>
                                        <div className="status-count">{exceptionData.length}</div>
                                        <div className="status-unit">rules</div>
                                    </div>
                                    <div className="status-item">
                                        <div className="status-label">Sort Conditions</div>
                                        <div className="status-count">{shortData.length}</div>
                                        <div className="status-unit">conditions</div>
                                    </div>
                                    <div className="status-item">
                                        <div className="status-label">To Process</div>
                                        <div className="status-count">{pendingCount.toLocaleString()}</div>
                                        <div className="status-unit">items</div>
                                    </div>
                                </div>
                            </div>

                            {/* Filters */}
                            <div className="filters-container">
                                <div className="filters-header">
                                    <Filter className="filter-icon" />
                                    <h3 className="filters-title">Filters & Search</h3>
                                    <button className="clear-filters-button" onClick={clearFilters}>Clear All</button>
                                </div>

                                <div className="search-section">
                                    <div className="search-input-group">
                                        <input
                                            type="text"
                                            placeholder="Search across all columns..."
                                            value={searchTerm}
                                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                            className="search-input"
                                        />
                                        <select
                                            value={searchColumn}
                                            onChange={(e) => setSearchColumn(e.target.value)}
                                            className="search-column-select"
                                        >
                                            <option value="all">All Columns</option>
                                            <option value="ipo_no">IPO Number</option>
                                            <option value="item_name">Item Name</option>
                                            <option value="plan_name">Plan Name</option>
                                            <option value="fix_no">Fix Number</option>
                                            <option value="plan_date">Plan Date</option>
                                            <option value="item_type">Type</option>
                                            <option value="plan_description">Plan Description</option>
                                            <option value="drawing_no">Drawing No</option>
                                            <option value="mark_no">Mark No</option>
                                            <option value="room_no">Room No</option>
                                            <option value="lot_unit">Lot Unit</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Plan Settings */}
                                <div className="plan-settings-section">
                                    <h4 className="section-subtitle">Plan Settings</h4>
                                    <div className="plan-settings-grid">
                                        <div className="plan-setting-group">
                                            <label className="plan-setting-label">Plan Short Date</label>
                                            <input
                                                type="date"
                                                value={planShortDate}
                                                onChange={(e) => setPlanShortDate(e.target.value)}
                                                className="plan-date-input"
                                                required
                                            />
                                        </div>
                                        <div className="plan-setting-group">
                                            <Checkbox
                                                label="Auto write plan from series"
                                                checked={autoWritePlan}
                                                onChange={(e) => setAutoWritePlan(e.target.checked)}
                                                size="md"
                                                variant="primary"
                                                className="auto-write-label"
                                            />
                                            {!autoWritePlan && (
                                                <div className="manual-serial-group">
                                                    <label className="manual-serial-label">Manual Start Serial</label>
                                                    <input
                                                        type="text"
                                                        value={manualSerial}
                                                        onChange={(e) => setManualSerial(e.target.value)}
                                                        placeholder="e.g., 1.003"
                                                        className="manual-serial-input"
                                                    />
                                                    {!isValidManualSerial(manualSerial) && manualSerial && (
                                                        <div className="validation-error">Please use format like 1.003</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Plan Status */}
                                <div className="plan-status-section">
                                    <h4 className="section-subtitle">Plan Status</h4>
                                    <div className="plan-status-filters">
                                        <Checkbox
                                            label="Plan Done"
                                            checked={showPlanDone}
                                            onChange={(e) => setShowPlanDone(e.target.checked)}
                                            size="sm"
                                            variant="primary"
                                        />
                                        <Checkbox
                                            label="Pending Plan"
                                            checked={showPendingPlan}
                                            onChange={(e) => setShowPendingPlan(e.target.checked)}
                                            size="sm"
                                            variant="primary"
                                        />
                                    </div>
                                </div>

                                {/* IPO Selection */}
                                <div>
                                    <h4 className="section-subtitle">IPO Selection</h4>
                                    {availableIpos.length > 0 ? (
                                        <>
                                            <div className="ipo-grid">
                                                {availableIpos.map(ipo => (
                                                    <Checkbox
                                                        key={ipo}
                                                        label={`IPO-${ipo}`}
                                                        checked={selectedIpos.includes(ipo)}
                                                        onChange={() => handleIpoToggle(ipo)}
                                                        size="sm"
                                                        variant="primary"
                                                        className="ipo-checkbox-label"
                                                    />
                                                ))}
                                            </div>
                                            <ToggleSwitch
                                                label="Mix IPOs Plan (Single plan number across all selected IPOs)"
                                                checked={mixIposPlan}
                                                onChange={(e) => setMixIposPlan(e.target.checked)}
                                                size="md"
                                                variant="primary"
                                                className="mix-ipo-label"
                                            />
                                        </>
                                    ) : (
                                        <div className="ipo-empty-state"><p>No IPOs found in IPO Master</p></div>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="actions-container">
                                <div className="action-buttons">
                                    <Button
                                        onClick={processPlanNumbers}
                                        disabled={processing || selectedIpos.length === 0 || pnlData.length === 0 || !planShortDate}
                                        variant="primary"
                                        size="md"
                                        loading={processing}
                                        className="generate-button primary-button"
                                    >
                                        <Play className="button-icon generate-icon" size={20} />
                                        <span>{processing ? `Processing... ${progress}%` : 'Generate Plan Numbers & Types'}</span>
                                    </Button>
                                    <Button
                                        onClick={() => exportToCSV(filteredPnlData, 'IPO_Master_Export')}
                                        disabled={filteredPnlData.length === 0}
                                        variant="outline"
                                        size="md"
                                        className="generate-button export-button"
                                    >
                                        <Download className="button-icon" size={20} />
                                        <span>Export to CSV</span>
                                    </Button>
                                </div>

                                {processing && (
                                    <div style={{ marginTop: '16px' }}>
                                        <div style={{ width: '100%', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{ width: `${progress}%`, height: '100%', backgroundColor: 'var(--primary)', transition: 'width 0.3s ease', borderRadius: '4px' }} />
                                        </div>
                                        <p style={{ marginTop: '8px', fontSize: '14px', color: 'var(--secondary)', textAlign: 'center' }}>
                                            {progress}% Complete — Processing {pendingCount.toLocaleString()} items
                                        </p>
                                    </div>
                                )}

                                <div className="items-summary">
                                    <span className="items-count-text">
                                        Showing {filteredPnlData.length.toLocaleString()} of {pnlData.length.toLocaleString()} items
                                        {searchTerm && ` (filtered by "${searchTerm}")`}
                                    </span>
                                    {filteredPnlData.filter(item => hasNoPlan(item)).length > 0 && (
                                        <span className="unassigned-count-text">
                                            ({filteredPnlData.filter(item => hasNoPlan(item)).length.toLocaleString()} without plan names)
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Pagination */}
                            {filteredPnlData.length > 0 && (
                                <div className="pagination-controls">
                                    <div className="pagination-info">
                                        Page {currentPage} of {totalPages} ({itemsPerPage} items per page)
                                    </div>
                                    <div className="pagination-buttons">
                                        <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="pagination-button">First</button>
                                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="pagination-button">Previous</button>
                                        <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="page-size-select">
                                            <option value={50}>50 per page</option>
                                            <option value={100}>100 per page</option>
                                            <option value={200}>200 per page</option>
                                            <option value={500}>500 per page</option>
                                        </select>
                                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="pagination-button">Next</button>
                                        <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="pagination-button">Last</button>
                                    </div>
                                </div>
                            )}

                            {/* Table */}
                            <div className="items-table-card">
                                <h3 className="items-table-title">
                                    IPO Master Items — Page {currentPage}
                                    {paginatedData.length > 0 && ` (${(currentPage - 1) * itemsPerPage + 1} to ${Math.min(currentPage * itemsPerPage, filteredPnlData.length)} of ${filteredPnlData.length.toLocaleString()})`}
                                </h3>
                                <div className="items-table-wrapper">
                                    <table className="items-table">
                                        <thead className="items-table-head">
                                            <tr className="header-row">
                                                <SortableHeader column="plan_name">Plan Name</SortableHeader>
                                                <SortableHeader column="plan_date">Plan Date</SortableHeader>
                                                <SortableHeader column="id">ID</SortableHeader>
                                                <SortableHeader column="ipo_no">IPO-NO</SortableHeader>
                                                <SortableHeader column="fix_no">FIX-NO</SortableHeader>
                                                <SortableHeader column="item_name">Item</SortableHeader>
                                                <SortableHeader column="height">Height</SortableHeader>
                                                <SortableHeader column="width">Width</SortableHeader>
                                                <SortableHeader column="quantity">QTY</SortableHeader>
                                                <SortableHeader column="area">Area</SortableHeader>
                                                <SortableHeader column="item_type">Type</SortableHeader>
                                                <SortableHeader column="plan_description">Plan Desc</SortableHeader>
                                                <th className="table-header">Barcode</th>
                                                <th className="table-header">Mark No</th>
                                                <th className="table-header">Drawing No</th>
                                                <th className="table-header">Room No</th>
                                                <th className="table-header">Lot Unit</th>
                                                <th className="table-header">Status</th>
                                                <th className="table-header">Match</th>
                                            </tr>
                                        </thead>
                                        <tbody className="items-table-body">
                                            {paginatedData.map((item, index) => (
                                                <tr key={item.id} className={`table-row ${index % 2 === 0 ? 'even-row' : 'odd-row'}`}>
                                                    <td className="table-cell plan-no-cell">
                                                        <div className="plan-name-content">
                                                            {!hasNoPlan(item) ? (
                                                                <>
                                                                    <CheckCircle className="status-icon success-icon" size={16} />
                                                                    <span className="plan-name-assigned">{item.plan_name}</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <AlertCircle className="status-icon warning-icon" size={16} />
                                                                    <span className="plan-name-unassigned">Not assigned</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="table-cell">{item.plan_date || '-'}</td>
                                                    <td className="table-cell" style={{ fontSize: 10 }}>{item.id.substring(0, 8)}...</td>
                                                    <td className="table-cell">{item.ipo_no}</td>
                                                    <td className="table-cell">{item.fix_no || '-'}</td>
                                                    <td className="table-cell">{item.item_name || '-'}</td>
                                                    <td className="table-cell">{item.height}</td>
                                                    <td className="table-cell">{item.width}</td>
                                                    <td className="table-cell">{item.quantity}</td>
                                                    <td className="table-cell">{item.area || '-'}</td>
                                                    <td className="table-cell type-cell">
                                                        {item.item_type ? (
                                                            <span className={`type-badge type-${item.item_type.toLowerCase().replace(/\s+/g, '-')}`}>
                                                                {item.item_type}
                                                            </span>
                                                        ) : <span className="no-type">-</span>}
                                                    </td>
                                                    <td className="table-cell">{item.plan_description || '-'}</td>
                                                    <td className="table-cell">{item.barcode || '-'}</td>
                                                    <td className="table-cell">{item.mark_no || '-'}</td>
                                                    <td className="table-cell">{item.drawing_no || '-'}</td>
                                                    <td className="table-cell">{item.room_no || '-'}</td>
                                                    <td className="table-cell">{item.lot_unit || '-'}</td>
                                                    <td className="table-cell">
                                                        <span className={`status-badge status-${item.status?.toLowerCase()}`}>
                                                            {item.status || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="table-cell matched-rule-cell">
                                                        {!hasNoPlan(item)
                                                            ? <div className="rule-status">Processed</div>
                                                            : <span className="no-rule-found">-</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Results Tab ── */}
                    {activeTab === 'results' && (
                        <div className="results-tab-container">
                            {results ? (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                                        <Button
                                            onClick={() => exportToCSV(results.details, 'Plan_Processing_Results')}
                                            variant="outline"
                                            size="md"
                                            className="export-button"
                                        >
                                            <Download className="button-icon" size={20} />
                                            <span>Export Results</span>
                                        </Button>
                                    </div>

                                    <div className="results-stats-grid">
                                        <div className="stat-card">
                                            <div className="stat-label">Total Processed</div>
                                            <div className="stat-value">{results.processed.toLocaleString()}</div>
                                        </div>
                                        <div className="stat-card">
                                            <div className="stat-label">Success</div>
                                            <div className="stat-value">{results.success.toLocaleString()}</div>
                                        </div>
                                        <div className="stat-card">
                                            <div className="stat-label">Excluded</div>
                                            <div className="stat-value">{results.exception.toLocaleString()}</div>
                                        </div>
                                        <div className="stat-card">
                                            <div className="stat-label">No Match</div>
                                            <div className="stat-value">{results.noMatch.toLocaleString()}</div>
                                        </div>
                                    </div>

                                    <div className="results-table-card">
                                        <div className="results-table-wrapper">
                                            <table className="results-table">
                                                <thead className="results-table-head">
                                                    <tr>
                                                        <th className="results-header">ID</th>
                                                        <th className="results-header">Status</th>
                                                        <th className="results-header">Plan Name</th>
                                                        <th className="results-header">Type</th>
                                                        <th className="results-header">Details</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="results-table-body">
                                                    {results.details.slice(0, 1000).map((detail, idx) => (
                                                        <tr key={idx} className="results-row">
                                                            <td className="results-cell">{detail.id}</td>
                                                            <td className="results-cell">
                                                                <span className={`status-badge status-${detail.status.toLowerCase()}`}>
                                                                    {detail.status}
                                                                </span>
                                                            </td>
                                                            <td className="results-cell plan-no-cell">{detail.planNo || '-'}</td>
                                                            <td className="results-cell">
                                                                {detail.itemType ? (
                                                                    <span className={`type-badge type-${detail.itemType.toLowerCase().replace(/\s+/g, '-')}`}>
                                                                        {detail.itemType}
                                                                    </span>
                                                                ) : '-'}
                                                            </td>
                                                            <td className="results-cell">{detail.reason || 'Assigned successfully'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {results.details.length > 1000 && (
                                                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--secondary)' }}>
                                                    Showing first 1,000 of {results.details.length.toLocaleString()} results. Export to see all.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="results-empty-state">
                                    <AlertCircle className="empty-state-icon empty-icon" size={48} />
                                    <h3 className="empty-state-title">No results yet</h3>
                                    <p className="empty-state-message">Process plan numbers to see results.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ShortMaster;