import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import {
    Search,
    Filter,
    RefreshCw,
    LayoutDashboard,
    FileText,
    Download,
    Printer,
    ChevronRight,
    ChevronDown,
    CheckCircle2,
    AlertCircle,
    Layers,
    Box,
    Hash,
    Maximize2
} from 'lucide-react';
import { generatePlanPDF, printPlanPDF, downloadAllPlansPDF, printAllPlansPDF } from './PlanPdf';

// ============================================================================
// CONSTANTS & UTILITIES
// ============================================================================
const NEST_BLADE_MM = 10;
const NEST_MIN_DIM_MM = 1;
const NEST_PDF_FILLS = [
    [208, 232, 255], [213, 245, 227], [253, 235, 208], [249, 235, 234], [244, 236, 247],
    [234, 244, 251], [254, 249, 231], [234, 250, 241], [253, 237, 236], [232, 248, 245],
    [255, 243, 205], [209, 236, 241], [248, 215, 218], [210, 244, 211], [255, 228, 230],
];
const NEST_PDF_STROKES = [
    [41, 128, 185], [39, 174, 96], [230, 126, 34], [192, 57, 43], [142, 68, 173],
    [26, 188, 156], [243, 156, 18], [46, 204, 113], [231, 76, 60], [22, 160, 133],
    [255, 193, 7], [23, 162, 184], [220, 53, 69], [40, 167, 69], [232, 62, 140],
];

const s2ab = s => {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xff;
    return buf;
};

const groupUniqueItems = items => {
    const grouped = {};
    items.forEach(item => {
        const key = `${item.height}-${item.item_name}-${item.width}-${item.drawing_no}`;
        if (!grouped[key]) {
            grouped[key] = {
                height: parseFloat(item.height) || 0,
                item: item.item_name,
                width: parseFloat(item.width) || 0,
                drawingNo: item.drawing_no,
                markNo: item.mark_no,
                ipoNo: item.ipo_no,
                importId: item.import_id || '',
                importDate: item.created_at || '',
                totalQty: 0,
                totalArea: 0,
                originalItems: [],
            };
        }
        const qty = parseInt(item.quantity) || 0;
        const area = parseFloat(item.area) || 0;
        grouped[key].totalQty += qty;
        grouped[key].totalArea += area * qty;
        grouped[key].originalItems.push(item);
    });
    return Object.values(grouped);
};

const collectChildPartColumns = planData => {
    const seen = new Map(), order = [];
    planData.forEach(row => {
        (row.childParts || []).forEach(cp => {
            if (!seen.has(cp.rmId)) { seen.set(cp.rmId, cp.rmName); order.push(cp.rmId); }
        });
    });
    return order.map(id => ({ rmId: id, rmName: seen.get(id) }));
};

// ============================================================================
// NESTING HELPERS (frontend — kept for local fallback display)
// ============================================================================
const nestGetSharingValues = (itemName, sma) => {
    if (!itemName || !sma.length) return { heightSharing: 0, leftWidthSharing: 0, rightWidthSharing: 0 };
    const nm = itemName.trim().toLowerCase();
    const sd = sma.find(s => s.item_prefix && new RegExp(`\\b${s.item_prefix.trim().toLowerCase()}(?:\\(|\\s|$)`, 'i').test(nm));
    return sd
        ? { heightSharing: parseFloat(sd.right_height_sharing) || 0, leftWidthSharing: parseFloat(sd.left_width_sharing) || 0, rightWidthSharing: parseFloat(sd.right_width_sharing) || 0 }
        : { heightSharing: 0, leftWidthSharing: 0, rightWidthSharing: 0 };
};

const nestFindBestLSec = (targetWidth, cutLength, rmStockArr) => {
    if (!targetWidth || targetWidth < 50) return null;
    return rmStockArr
        .filter(s => (parseFloat(s.width) || 0) >= targetWidth && (parseFloat(s.height) || 0) >= cutLength)
        .sort((a, b) => {
            const wa = parseFloat(a.width) || 0, wb = parseFloat(b.width) || 0;
            return wa !== wb ? wa - wb : (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0);
        })[0] || null;
};

const nestCalcLSecWidths = (panelWidth, cutLength, lws, rws, rmStockArr) => {
    if (!panelWidth || panelWidth < 300) return null;
    const rightLSec = nestFindBestLSec(Math.round(panelWidth / 2), cutLength, rmStockArr);
    if (!rightLSec) return null;
    const rightWidth = parseFloat(rightLSec.width) || 0;
    const leftCuttingWidth = Math.round(panelWidth - rightWidth - (lws + rws));
    if (leftCuttingWidth < 50) return null;
    const leftLSec = nestFindBestLSec(leftCuttingWidth, cutLength, rmStockArr);
    if (!leftLSec) return null;
    return { rightLSec, leftLSec, rightWidth, leftCuttingWidth, leftStockWidth: parseFloat(leftLSec.width) || 0 };
};

const nestGroupUniqueItems = (items, sma) => {
    const map = {};
    items.forEach(item => {
        const rawH = parseFloat(item.height) || 0, panW = parseFloat(item.width) || 0;
        if (rawH <= NEST_MIN_DIM_MM || panW <= NEST_MIN_DIM_MM) return;
        const { heightSharing, leftWidthSharing, rightWidthSharing } = nestGetSharingValues(item.item_name || '', sma);
        const cutLength = Math.max(rawH - heightSharing, 0);
        if (cutLength <= NEST_MIN_DIM_MM) return;
        const key = `${cutLength}|${panW}|${item.item_name}|${item.drawing_no}`;
        if (!map[key]) map[key] = {
            cutLength, panelWidth: panW,
            itemName: item.item_name || '',
            drawingNo: item.drawing_no || '',
            markNo: item.mark_no || '',
            ipoNo: item.ipo_no || '',
            leftWidthSharing,
            rightWidthSharing,
            totalQty: 0,
            totalArea: 0
        };
        map[key].totalQty += parseInt(item.quantity, 10) || 0;
        map[key].totalArea += (parseFloat(item.area) || 0) * (parseInt(item.quantity, 10) || 0);
    });
    return Object.values(map);
};

const nestPackPieces = (pieces, stockByWidth) => {
    if (!pieces?.length) return [];
    const expanded = [];
    pieces.forEach(p => { for (let i = 0; i < Math.max(1, parseInt(p.qty, 10) || 1); i++) expanded.push({ ...p }); });
    expanded.sort((a, b) => b.cutLength - a.cutLength);
    const openBars = [];
    for (const piece of expanded) {
        const pLen = piece.cutLength, pW = piece.rmStockWidth;
        let bestIdx = -1, bestLO = Infinity;
        for (let i = 0; i < openBars.length; i++) {
            const bar = openBars[i];
            if (bar.rmWidth !== pW) continue;
            const off = bar.usedLength === 0 ? 0 : bar.usedLength + NEST_BLADE_MM;
            const rem = bar.rmHeight - off;
            if (rem >= pLen && rem - pLen < bestLO) { bestLO = rem - pLen; bestIdx = i; }
        }
        if (bestIdx >= 0) {
            const bar = openBars[bestIdx];
            const yOff = bar.usedLength === 0 ? 0 : bar.usedLength + NEST_BLADE_MM;
            bar.pieces.push({ ...piece, y: yOff });
            bar.usedLength = yOff + pLen;
        } else {
            const cands = (stockByWidth[pW] || []).filter(s => s.height >= pLen);
            if (!cands.length) continue;
            openBars.push({ rmWidth: pW, rmHeight: cands[0].height, rmName: cands[0].name, usedLength: pLen, pieces: [{ ...piece, y: 0 }] });
        }
    }
    return openBars.map(bar => {
        const usedArea = bar.pieces.reduce((s, p) => s + p.cutLength * bar.rmWidth, 0);
        const totalArea = bar.rmWidth * bar.rmHeight;
        return {
            rmStockName: bar.rmName, rmStockWidth: bar.rmWidth, rmStockHeight: bar.rmHeight,
            pieces: bar.pieces, usedHeight: bar.usedLength, wasteHeight: bar.rmHeight - bar.usedLength,
            usedArea, wasteArea: totalArea - usedArea, totalArea,
            utilization: totalArea > 0 ? parseFloat(((usedArea / totalArea) * 100).toFixed(2)) : 0
        };
    });
};

const nestDeduplicateLayouts = layouts => {
    const map = {};
    layouts.forEach(l => {
        const sig = l.pieces.map(p => `${Math.round(p.cutLength)}x${Math.round(p.rmStockWidth)}@${Math.round(p.y)}`).join('|');
        const fp = `${l.rmStockName}|${l.rmStockWidth}|${l.rmStockHeight}|${sig}`;
        if (!map[fp]) map[fp] = { ...l, pieces: l.pieces.map(p => ({ ...p })), layoutQty: 1 };
        else map[fp].layoutQty++;
    });
    return Object.values(map).map((l, i) => ({ ...l, layoutNumber: i + 1 }));
};

const nestComputeRmReq = ndArray => {
    const map = new Map();
    ndArray.forEach(nd => nd.layouts.forEach(l => {
        const key = `${l.rmStockName}|${l.rmStockWidth}|${l.rmStockHeight}`;
        if (!map.has(key)) map.set(key, { rmName: l.rmStockName, width: l.rmStockWidth, height: l.rmStockHeight, qty: 0 });
        map.get(key).qty += (l.layoutQty || 1);
    }));
    return [...map.values()].map(r => ({ ...r, totalLength: (r.height * r.qty) / 1000 })).sort((a, b) => a.rmName.localeCompare(b.rmName) || a.width - b.width);
};

const nestComputeNesting = (planNo, items, rmStockArr, sma) => {
    if (!items?.length || !rmStockArr.length) return null;
    const uniqueItems = nestGroupUniqueItems(items, sma);
    if (!uniqueItems.length) return null;
    const stockByWidth = {};
    rmStockArr.forEach(s => {
        const w = parseFloat(s.width) || 0, h = parseFloat(s.height) || 0, n = s.rm_name || `L-SEC-${w}`;
        if (w > 0 && h > 0) { if (!stockByWidth[w]) stockByWidth[w] = []; stockByWidth[w].push({ height: h, name: n }); }
    });
    Object.keys(stockByWidth).forEach(w => stockByWidth[w].sort((a, b) => a.height - b.height));
    const allPieces = []; let pctr = 1;
    for (const ui of uniqueItems) {
        if (ui.totalQty <= 0) continue;
        const lsec = nestCalcLSecWidths(ui.panelWidth, ui.cutLength, ui.leftWidthSharing, ui.rightWidthSharing, rmStockArr);
        if (!lsec) continue;
        allPieces.push({ id: `P${pctr++}-R`, cutLength: ui.cutLength, rmStockWidth: lsec.rightWidth, panelWidth: ui.panelWidth, type: 'RIGHT', qty: ui.totalQty, itemName: ui.itemName, drawingNo: ui.drawingNo });
        allPieces.push({ id: `P${pctr++}-L`, cutLength: ui.cutLength, rmStockWidth: lsec.leftStockWidth, leftCuttingWidth: lsec.leftCuttingWidth, panelWidth: ui.panelWidth, type: 'LEFT', qty: ui.totalQty, itemName: ui.itemName, drawingNo: ui.drawingNo });
    }
    if (!allPieces.length) return null;
    const rawBars = nestPackPieces(allPieces, stockByWidth);
    if (!rawBars.length) return null;
    const layouts = nestDeduplicateLayouts(rawBars);
    let tS = 0, tU = 0, tW = 0;
    layouts.forEach(l => { tS += l.totalArea * l.layoutQty; tU += l.usedArea * l.layoutQty; tW += l.wasteArea * l.layoutQty; });
    return {
        planNo, ipoNo: uniqueItems[0]?.ipoNo || '',
        date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString(),
        layouts,
        totalSheets: layouts.reduce((s, l) => s + l.layoutQty, 0),
        totalUsedArea: tU, totalWasteArea: tW, totalStockArea: tS,
        utilization: tS > 0 ? ((tU / tS) * 100).toFixed(2) : '0.00',
        itemsProcessed: uniqueItems.length, piecesGenerated: allPieces.length, allPieces
    };
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function CreatePlan() {
    // ── State ──────────────────────────────────────────────────────────────────
    const [selectedTypes, setSelectedTypes] = useState({ FICTURE: true, LS: true, CH: true });
    const [nestingEnabled, setNestingEnabled] = useState({});
    const [nestingResults, setNestingResults] = useState({});
    const [rmStockNest, setRmStockNest] = useState([]);
    const [sharingMasterNest, setSharingMasterNest] = useState([]);
    const [plans, setPlans] = useState({});
    const [loading, setLoading] = useState(false);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [planDetails, setPlanDetails] = useState(null);
    const [bulkPlans, setBulkPlans] = useState({});
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        ipoNo: [],
        planNo: [],
        importDate: '',
        importId: '',
        itemName: '',
        drawingNo: '',
        generatedStatus: 'all',
        planTypes: ['FICTURE', 'LS', 'CH'],
        nestingOnly: false,
    });
    const [ipoOptions, setIpoOptions] = useState([]);
    const [planOptions, setPlanOptions] = useState([]);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [bulkNesting, setBulkNesting] = useState(false);
    const fetchTimeout = useRef(null);

    // Sync top checkboxes with filter.planTypes
    useEffect(() => {
        const types = Object.entries(selectedTypes).filter(([, v]) => v).map(([k]) => k);
        setFilters(prev => ({ ...prev, planTypes: types }));
    }, [selectedTypes]);

    const handlePlanTypesFilterChange = (types) => {
        setFilters(prev => ({ ...prev, planTypes: types }));
        setSelectedTypes({
            FICTURE: types.includes('FICTURE'),
            LS: types.includes('LS'),
            CH: types.includes('CH'),
        });
    };

    // Fetch filter options and RM stock on mount
    useEffect(() => {
        fetchFilterOptions();
        fetchRmStockForNesting();
    }, []);

    // Re-fetch plans when selected types or filters change
    useEffect(() => {
        if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
        fetchTimeout.current = setTimeout(() => { fetchUnplannedItems(); }, 300);
        return () => clearTimeout(fetchTimeout.current);
    }, [selectedTypes, filters]);

    const fetchRmStockForNesting = async () => {
        try {
            const [rmRes, shareRes] = await Promise.all([
                supabase.from('rm_stock').select('*').eq('status', 'available').eq('type', 'L-SEC').order('width', { ascending: true }),
                supabase.from('sharing_master').select('*'),
            ]);
            if (!rmRes.error) setRmStockNest(rmRes.data || []);
            if (!shareRes.error) setSharingMasterNest(shareRes.data || []);
        } catch (err) { console.error('fetchRmStockForNesting:', err); }
    };

    const fetchFilterOptions = async () => {
        try {
            const { data: ipoData, error: ipoError } = await supabase.from('ipo_master').select('ipo_no').not('ipo_no', 'is', null);
            const { data: planData, error: planError } = await supabase.from('ipo_master').select('plan_name').not('plan_name', 'is', null);
            if (!ipoError && ipoData) setIpoOptions([...new Set(ipoData.map(i => i.ipo_no))].filter(Boolean));
            if (!planError && planData) setPlanOptions([...new Set(planData.map(i => i.plan_name))].filter(p => p && p !== 'UNASSIGNED'));
        } catch (e) { console.error('fetchFilterOptions error:', e); }
    };

    const fetchUnplannedItems = async () => {
        try {
            setLoading(true);
            const types = filters.planTypes;
            if (types.length === 0) { setPlans({}); setLoading(false); return; }

            let query = supabase.from('ipo_master').select('*').in('item_type', types);
            if (filters.ipoNo.length > 0) query = query.in('ipo_no', filters.ipoNo);
            if (filters.planNo.length > 0) query = query.in('plan_name', filters.planNo);
            if (filters.itemName) query = query.ilike('item_name', `%${filters.itemName}%`);
            if (filters.drawingNo) query = query.ilike('drawing_no', `%${filters.drawingNo}%`);
            if (filters.importDate) query = query.eq('created_at', filters.importDate);
            if (filters.importId) query = query.ilike('import_id', `%${filters.importId}%`);
            if (filters.generatedStatus === 'generated') query = query.not('generated_date', 'is', null);
            if (filters.generatedStatus === 'not-generated') query = query.is('generated_date', null);
            query = query.order('plan_name');

            const { data, error } = await query;
            if (error) throw error;

            const grouped = data.reduce((acc, item) => {
                const pn = item.plan_name || 'UNASSIGNED';
                if (!acc[pn]) acc[pn] = [];
                acc[pn].push(item);
                return acc;
            }, {});

            if (filters.nestingOnly) {
                const filtered = {};
                Object.entries(grouped).forEach(([pn, items]) => { if (nestingEnabled[pn]) filtered[pn] = items; });
                setPlans(filtered);
            } else {
                setPlans(grouped);
            }
        } catch (e) {
            console.error('Error fetching items:', e);
            alert('Error loading data: ' + e.message);
        } finally { setLoading(false); }
    };

    const checkPlanExists = async planNo => {
        try {
            const { data, error } = await supabase
                .from('ipo_master')
                .select('id, generated_date')
                .eq('plan_name', planNo)
                .not('generated_date', 'is', null)
                .limit(1)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            return data || null;
        } catch (e) { console.error(e); return null; }
    };

    // ── GENERATE PLAN — calls backend ─────────────────────────────────────────
    const generatePlan = async (planNo, options = {}) => {
        const { forceNesting = false } = options;
        try {
            setLoading(true);
            const items = plans[planNo];
            if (!items?.length) { alert('No items found for this plan'); return; }

            const existingPlan = await checkPlanExists(planNo);
            if (existingPlan && !window.confirm(`Plan ${planNo} already generated. Regenerate?`)) {
                setLoading(false);
                return;
            }

            // ── 1. CALL BACKEND: plan calculation ──────────────────────────────
            const planResponse = await fetch('http://localhost:3001/api/generate-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    planNo,
                    companyId: items[0]?.company_id,
                    items,
                }),
            });

            if (!planResponse.ok) {
                const err = await planResponse.json();
                throw new Error(err.error || 'Backend plan generation error');
            }

            const result = await planResponse.json();
            // result: { planNo, data, summary, childPartCols }

            setPlanDetails(result);
            setBulkPlans(prev => ({ ...prev, [planNo]: result }));

            // ── 2. CALL BACKEND: nesting engine (non-fatal) ────────────────────
            const ficItems = items.filter(i => i.item_type === 'FICTURE');
            const shouldNest = forceNesting || nestingEnabled[planNo];

            if (shouldNest && ficItems.length) {
                try {
                    const nestResponse = await fetch('http://localhost:3001/api/generate-nesting', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            planNo,
                            ipoNo: ficItems[0]?.ipo_no || '',
                            ficItems,
                            // Pass cached frontend arrays — backend will self-fetch if empty
                            rmStock: rmStockNest,
                            sharingMaster: sharingMasterNest,
                        }),
                    });

                    if (nestResponse.ok) {
                        const nd = await nestResponse.json();
                        if (!nd.error) {
                            setNestingResults(prev => ({ ...prev, [planNo]: nd }));
                        } else {
                            console.warn(`[nesting] warning for ${planNo}:`, nd.error);
                        }
                    } else {
                        console.warn(`[nesting] HTTP ${nestResponse.status} for ${planNo}`);
                    }
                } catch (nestErr) {
                    // Nesting failure is NON-FATAL — plan generation still succeeded
                    console.warn(`[nesting] failed for ${planNo}:`, nestErr.message);
                }
            }

            await fetchUnplannedItems();
            alert(`Plan ${planNo} ${existingPlan ? 'regenerated' : 'generated'} successfully!`);
            return result;
        } catch (error) {
            console.error(error);
            alert('Error generating plan: ' + error.message);
            throw error;
        } finally { setLoading(false); }
    };

    const generateAllPlans = async () => {
        try {
            setBulkLoading(true);
            const planNumbers = Object.keys(plans).filter(p => p !== 'UNASSIGNED');
            if (!planNumbers.length) { alert('No plans found to generate'); return; }
            let ok = 0, fail = 0;
            const results = {};
            for (const planNo of planNumbers) {
                try {
                    const forceNesting = bulkNesting && plans[planNo].some(i => i.item_type === 'FICTURE');
                    const r = await generatePlan(planNo, { forceNesting });
                    if (r) { results[planNo] = r; ok++; }
                } catch (e) { console.error(`Failed: ${planNo}`, e); fail++; }
            }
            setBulkPlans(results);
            alert(`Bulk complete! Success: ${ok}, Failed: ${fail}`);
        } catch (e) { console.error(e); alert('Error in bulk generation: ' + e.message); }
        finally { setBulkLoading(false); }
    };

    const generateNestingForAll = async () => {
        try {
            setBulkLoading(true);
            const planNumbers = Object.keys(plans).filter(p => p !== 'UNASSIGNED');
            const ficPlans = planNumbers.filter(pn => plans[pn].some(i => i.item_type === 'FICTURE'));
            if (!ficPlans.length) { alert('No FICTURE plans found to apply nesting.'); return; }

            const newNesting = { ...nestingEnabled };
            ficPlans.forEach(pn => { newNesting[pn] = true; });
            setNestingEnabled(newNesting);

            let ok = 0, fail = 0;
            for (const planNo of ficPlans) {
                try { await generatePlan(planNo); ok++; }
                catch (e) { console.error(`Nesting failed for ${planNo}:`, e); fail++; }
            }
            alert(`Nesting generation complete! Success: ${ok}, Failed: ${fail}`);
        } catch (e) { console.error('Error in bulk nesting:', e); alert('Error: ' + e.message); }
        finally { setBulkLoading(false); }
    };

    // ============================================================================
    // EXCEL EXPORT
    // ============================================================================
    const generateWorkbook = (planNo, planDataObj) => {
        const data = planDataObj?.data;
        const summary = planDataObj?.summary;
        const cpCols = planDataObj?.childPartCols || [];
        if (!data) return null;

        const wb = XLSX.utils.book_new();

        // ── Sheet 1: Main Plan ───────────────────────────────────────────────
        const mainRows = [];
        mainRows.push(['PLAN DATE', new Date().toLocaleDateString()]);
        mainRows.push(['PLAN NO', planNo]);
        mainRows.push(['IPO NO', summary['IPO-NO'] || '']);
        mainRows.push(['TOTAL AREA', summary.AREA?.toFixed(2) || '0']);
        mainRows.push(['TOTAL QTY', summary.QTY || '0']);
        mainRows.push(['UNIQUE ITEMS', data.length]);
        mainRows.push([]);

        const hasFic = data.some(r => r.type === 'FICTURE');
        const hasLs = data.some(r => r.type === 'LS');
        const hasCh = data.some(r => r.type === 'CH');

        const baseHeaders = ['PLAN NO', 'IPO NO', 'HEIGHT', 'ITEM', 'WIDTH', 'DRAWING NO', 'TOTAL QTY', 'TOTAL AREA'];
        const ficHeaders = hasFic ? ['RIGHT L-SEC NAME', 'RIGHT CUT LEN', 'RIGHT L-WIDTH', 'RIGHT QTY/PC', 'RIGHT TOTAL QTY', 'LEFT L-SEC NAME', 'LEFT CUT LEN', 'LEFT STOCK W', 'LEFT CUT W', 'LEFT QTY/PC', 'LEFT TOTAL QTY'] : [];
        const lsHeaders = hasLs ? ['L-SEC NAME', 'L-SEC CUT LEN', 'L-SEC STOCK W', 'L-SEC CUT W', 'L-SEC QTY/PC', 'L-SEC TOTAL QTY', 'MAIN FRAME NAME', 'MAIN FRAME CUT LEN', 'MAIN FRAME QTY'] : [];
        const chHeaders = hasCh ? ['CH NAME', 'CH CUT LEN', 'CH STOCK W', 'CH CUT W', 'CH QTY/PC', 'CH TOTAL QTY'] : [];
        const sideFrameHeaders = ['SIDE FRAME NAME', 'SIDE FRAME QTY/PC', 'SIDE FRAME TOTAL QTY', 'SIDE FRAME CUT SIZE'];
        const stiffenerHeaders = [
            'U WITH LIP NAME', 'U WITH LIP PER PC QTY', 'U WITH LIP TOTAL QTY', 'U WITH LIP CUT SIZE',
            'U WITHOUT LIP NAME', 'U WITHOUT LIP PER PC QTY', 'U WITHOUT LIP TOTAL QTY', 'U WITHOUT LIP CUT SIZE',
            'I STIFF NAME', 'I STIFF PER PC QTY', 'I STIFF TOTAL QTY', 'I STIFF CUT SIZE',
            'RK NAME', 'RK LENGTH', 'RK PER PC QTY', 'RK TOTAL QTY',
        ];
        const childHeaders = cpCols.flatMap(col => [`${col.rmName} NAME`, `${col.rmName} QTY/PC`, `${col.rmName} TOTAL QTY`, `${col.rmName} CUT SIZE`]);
        const allHeaders = [...baseHeaders, ...ficHeaders, ...lsHeaders, ...chHeaders, ...sideFrameHeaders, ...stiffenerHeaders, ...childHeaders, 'CALCULATION ERROR'];
        mainRows.push(allHeaders);

        data.forEach(row => {
            const baseRow = [row.planNo, row.ipoNo, row.height, row.item, row.width, row.drawingNo, row.qty, row.area];
            let ficPart = [], lsPart = [], chPart = [];
            if (row.type === 'FICTURE') {
                ficPart = [row.rightLName, row.rightLCuttingLength, row.rightLWidth, row.rightLQtyPerPc, row.rightLTotalQty, row.leftLName, row.leftLCuttingLength, row.leftLStockWidth, row.leftCuttingWidth, row.leftLQtyPerPc, row.leftLTotalQty];
                lsPart = new Array(lsHeaders.length).fill('');
                chPart = new Array(chHeaders.length).fill('');
            } else if (row.type === 'LS') {
                ficPart = new Array(ficHeaders.length).fill('');
                lsPart = [row.lSecName, row.lSecCuttingLength, row.lSecStockWidth, row.cuttingWidth, row.lSecQtyPerPc, row.lSecTotalQty, row.mainFrameName, row.mainFrameCuttingLength, row.mainFrameTotalQty];
                chPart = new Array(chHeaders.length).fill('');
            } else if (row.type === 'CH') {
                ficPart = new Array(ficHeaders.length).fill('');
                lsPart = new Array(lsHeaders.length).fill('');
                chPart = [row.channelName, row.channelCuttingLength, row.channelStockWidth, row.cuttingWidth, row.channelQtyPerPc, row.channelTotalQty];
            }
            const sidePart = [row.sideFrameName, row.sideFrameQtyPerPc, row.sideFrameTotalQty, row.sideFrameCuttingSize];
            const stiffPart = [
                row.uStiffWithLipName, row.uStiffWithLipPerPieceQty, row.uStiffWithLipTotalQty, row.uStiffWithLipCuttingSize,
                row.uStiffWithoutLipName, row.uStiffWithoutLipPerPieceQty, row.uStiffWithoutLipTotalQty, row.uStiffWithoutLipCuttingSize,
                row.iStiffName, row.iStiffPerPieceQty, row.iStiffTotalQty, row.iStiffCuttingSize,
                row.rkName, row.rkLength, row.rkPerPieceQty, row.rkTotalQty,
            ];
            const childPart = cpCols.flatMap(col => {
                const cp = row.childParts?.find(c => c.rmId === col.rmId);
                return cp ? [col.rmName, cp.perPieceQty, cp.totalQty, cp.cuttingSize] : ['', '', '', ''];
            });
            mainRows.push([...baseRow, ...ficPart, ...lsPart, ...chPart, ...sidePart, ...stiffPart, ...childPart, row.calculationError || '']);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mainRows), 'Main Plan');

        // ── Sheet 2: Totals ──────────────────────────────────────────────────
        const totalsRows = [];
        totalsRows.push(['PLAN NAME:', planNo]);
        totalsRows.push([]);

        const addSummaryTable = (title, rows) => {
            totalsRows.push([title]);
            totalsRows.push(['IPO NO', 'NAME', 'CUTTING SIZE', 'TOTAL QTY']);
            rows.forEach(r => totalsRows.push([r.ipoNo, r.name, r.size, r.qty]));
            totalsRows.push([]);
        };

        const lSecSummary = [], mainFrameSummary = [], chSummary = [], sideFrameSummary = [], stiffSummary = [], rkSummary = [];
        data.forEach(row => {
            const ipo = row.ipoNo;
            if (row.type === 'FICTURE') {
                lSecSummary.push({ ipo, name: row.rightLName, size: `${row.rightLCuttingLength}x${row.rightLWidth}`, qty: row.rightLTotalQty });
                lSecSummary.push({ ipo, name: row.leftLName, size: `${row.leftLCuttingLength}x${row.leftCuttingWidth}`, qty: row.leftLTotalQty });
            } else if (row.type === 'LS') {
                lSecSummary.push({ ipo, name: row.lSecName, size: `${row.lSecCuttingLength}x${row.cuttingWidth}`, qty: row.lSecTotalQty });
                mainFrameSummary.push({ ipo, name: row.mainFrameName, size: `${row.mainFrameCuttingLength}mm`, qty: row.mainFrameTotalQty });
            } else if (row.type === 'CH') {
                chSummary.push({ ipo, name: row.channelName, size: `${row.channelCuttingLength}x${row.cuttingWidth}`, qty: row.channelTotalQty });
            }
            sideFrameSummary.push({ ipo, name: row.sideFrameName, size: `${row.sideFrameCuttingSize}mm`, qty: row.sideFrameTotalQty });
            if (row.uStiffWithLipTotalQty) stiffSummary.push({ ipo, name: 'U WITH LIP', size: `${row.uStiffWithLipCuttingSize}mm`, qty: row.uStiffWithLipTotalQty });
            if (row.uStiffWithoutLipTotalQty) stiffSummary.push({ ipo, name: 'U WITHOUT LIP', size: `${row.uStiffWithoutLipCuttingSize}mm`, qty: row.uStiffWithoutLipTotalQty });
            if (row.iStiffTotalQty) stiffSummary.push({ ipo, name: 'I STIFF', size: `${row.iStiffCuttingSize}mm`, qty: row.iStiffTotalQty });
            if (row.rkTotalQty) rkSummary.push({ ipo, name: row.rkName, size: `${row.rkLength}mm`, qty: row.rkTotalQty });
        });

        const aggregate = arr => {
            const map = new Map();
            arr.forEach(item => {
                const key = `${item.ipo}|${item.name}|${item.size}`;
                if (!map.has(key)) map.set(key, { ipoNo: item.ipo, name: item.name, size: item.size, qty: 0 });
                map.get(key).qty += item.qty;
            });
            return Array.from(map.values());
        };

        if (lSecSummary.length) addSummaryTable('L-SEC / CH Summary', aggregate(lSecSummary));
        if (mainFrameSummary.length) addSummaryTable('Main Frame Summary', aggregate(mainFrameSummary));
        if (chSummary.length) addSummaryTable('CH Summary', aggregate(chSummary));
        if (sideFrameSummary.length) addSummaryTable('Side Frame Summary', aggregate(sideFrameSummary));
        if (stiffSummary.length) addSummaryTable('Stiffener Summary', aggregate(stiffSummary));
        if (rkSummary.length) addSummaryTable('RK Summary', aggregate(rkSummary));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(totalsRows), 'Totals');

        // ── Sheet 3: RM Requirement ──────────────────────────────────────────
        const rmReq = {};
        const addRm = (name, length, qty) => {
            if (!name || !length) return;
            rmReq[name] = (rmReq[name] || 0) + length * qty;
        };
        data.forEach(row => {
            if (row.type === 'FICTURE') {
                addRm(row.rightLName, row.rightLCuttingLength, row.rightLTotalQty);
                addRm(row.leftLName, row.leftLCuttingLength, row.leftLTotalQty);
            } else if (row.type === 'LS') {
                addRm(row.lSecName, row.lSecCuttingLength, row.lSecTotalQty);
                addRm(row.mainFrameName, row.mainFrameCuttingLength, row.mainFrameTotalQty);
            } else if (row.type === 'CH') {
                addRm(row.channelName, row.channelCuttingLength, row.channelTotalQty);
            }
            addRm(row.sideFrameName, row.sideFrameCuttingSize, row.sideFrameTotalQty);
            addRm(row.uStiffWithLipName, row.uStiffWithLipCuttingSize, row.uStiffWithLipTotalQty);
            addRm(row.uStiffWithoutLipName, row.uStiffWithoutLipCuttingSize, row.uStiffWithoutLipTotalQty);
            addRm(row.iStiffName, row.iStiffCuttingSize, row.iStiffTotalQty);
            addRm(row.rkName, row.rkLength, row.rkTotalQty);
            (row.childParts || []).forEach(cp => addRm(cp.rmName, cp.cuttingSize, cp.totalQty));
        });
        const rmRows = [['RM REQUIREMENT'], ['PLAN:', planNo], [], ['SERIAL NO', 'RM NAME', 'TOTAL LENGTH (MM)', 'QTY (4800MM BARS)']];
        let sn = 1;
        Object.entries(rmReq).forEach(([name, total]) => {
            rmRows.push([sn++, name, total.toFixed(2), Math.ceil(total / 4800)]);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rmRows), 'RM Requirement');

        // ── Sheet 4: Stickers ────────────────────────────────────────────────
        const stickerRows = [['CUTTING STICKERS'], ['PLAN:', planNo], [], ['STICKER', 'PANEL DIMENSIONS', 'DETAILS']];
        data.forEach(row => {
            const base = `${row.ipoNo}-${row.planNo}`;
            const dims = `${row.height}${row.item}${row.width}{}`;
            for (let i = 1; i <= row.qty; i++) {
                if (row.type === 'FICTURE') {
                    stickerRows.push([base, dims, `(R)${row.rightLCuttingLength}x${row.rightLWidth} ${i}OF${row.qty}`]);
                    stickerRows.push([base, dims, `(L)${row.leftLCuttingLength}x${row.leftCuttingWidth || 0} ${i}OF${row.qty}`]);
                } else if (row.type === 'LS') {
                    stickerRows.push([base, dims, `L-SEC:${row.lSecCuttingLength}x${row.cuttingWidth} ${i}OF${row.qty}`]);
                    stickerRows.push([base, dims, `MF:${row.mainFrameCuttingLength} ${i}OF${row.qty}`]);
                } else if (row.type === 'CH') {
                    stickerRows.push([base, dims, `CH:${row.channelCuttingLength}x${row.cuttingWidth} ${i}OF${row.qty}`]);
                }
                stickerRows.push([base, dims, `SF:${row.sideFrameCuttingSize} ${i}OF${row.qty}`]);
                if (row.uStiffWithLipTotalQty) stickerRows.push([base, dims, `U+L:${row.uStiffWithLipCuttingSize} ${i}OF${row.qty}`]);
                if (row.uStiffWithoutLipTotalQty) stickerRows.push([base, dims, `U-L:${row.uStiffWithoutLipCuttingSize} ${i}OF${row.qty}`]);
                if (row.iStiffTotalQty) stickerRows.push([base, dims, `I:${row.iStiffCuttingSize} ${i}OF${row.qty}`]);
                if (row.rkTotalQty) stickerRows.push([base, dims, `RK:${row.rkLength} ${i}OF${row.qty}`]);
            }
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stickerRows), 'Stickers');

        return wb;
    };

    const downloadSinglePlan = async (planNo, pd) => {
        try {
            const wb = generateWorkbook(planNo, pd);
            if (wb) XLSX.writeFile(wb, `plan_${planNo}_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (e) { console.error(e); alert('Error: ' + e.message); }
    };

    const downloadAllPlans = async () => {
        if (!Object.keys(bulkPlans).length) { alert('No plans. Generate first.'); return; }
        try {
            const zip = new JSZip();
            const date = new Date().toISOString().split('T')[0];
            Object.entries(bulkPlans).forEach(([pn, pd]) => {
                const wb = generateWorkbook(pn, pd);
                if (wb) zip.file(`plan_${pn}_${date}.xlsx`, s2ab(XLSX.write(wb, { type: 'binary', bookType: 'xlsx' })));
            });
            saveAs(await zip.generateAsync({ type: 'blob' }), `plans_bulk_${date}.zip`);
        } catch (e) { console.error(e); alert('Error: ' + e.message); }
    };

    // ============================================================================
    // UI HELPERS
    // ============================================================================
    const handleSort = key => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));

    const getSortedPlans = () => {
        const entries = Object.entries(plans);
        if (!sortConfig.key) return entries;
        return entries.sort(([aK, aD], [bK, bD]) => {
            let av, bv;
            if (sortConfig.key === 'planNo') { av = aK; bv = bK; }
            if (sortConfig.key === 'itemCount') { av = aD.length; bv = bD.length; }
            if (sortConfig.key === 'totalQty') { av = aD.reduce((s, i) => s + (parseInt(i.quantity) || 0), 0); bv = bD.reduce((s, i) => s + (parseInt(i.quantity) || 0), 0); }
            if (sortConfig.key === 'totalArea') { av = aD.reduce((s, i) => s + (parseFloat(i.area) || 0) * (parseInt(i.quantity) || 0), 0); bv = bD.reduce((s, i) => s + (parseFloat(i.area) || 0) * (parseInt(i.quantity) || 0), 0); }
            if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1;
            if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const getSortIcon = key =>
        sortConfig.key !== key
            ? <span className="tab-icon alpha-sort-inactive">↓</span>
            : sortConfig.direction === 'asc'
                ? <span className="tab-icon alpha-sort-asc">↑</span>
                : <span className="tab-icon alpha-sort-desc">↓</span>;

    const isPlanGenerated = items => items.some(i => i.generated_date);

    const getGeneratedBadge = items =>
        isPlanGenerated(items)
            ? <span className="alpha-generated-badge alpha-generated">Generated</span>
            : <span className="alpha-generated-badge alpha-not-generated">Not Generated</span>;

    // ============================================================================
    // RENDER
    // ============================================================================
    return (
        <div className="planning-system-container">
            <div>
                <div className="planning-system-card">
                    <div className="planning-system-header">
                        <div>
                            <h1 className="planning-system-title">
                                <LayoutDashboard className="alpha-header-icon" size={24} />
                                PNL PLANNING
                            </h1>
                            <p className="planning-system-subtitle">Production planning and material optimization</p>
                        </div>
                        <div className="tab-actions">
                            <div className="alpha-type-selectors" style={{ display: 'flex', gap: 12, marginRight: 16 }}>
                                {['FICTURE', 'LS', 'CH'].map(type => (
                                    <label key={type} className="alpha-type-checkbox" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedTypes[type]}
                                            onChange={e => setSelectedTypes({ ...selectedTypes, [type]: e.target.checked })}
                                        />
                                        <span>{type}</span>
                                    </label>
                                ))}
                            </div>
                            <button onClick={fetchUnplannedItems} disabled={loading} className="refresh-button">
                                <RefreshCw size={16} className={loading ? 'spin' : ''} />
                                {loading ? 'Loading...' : 'Refresh'}
                            </button>
                            <button onClick={() => setShowFilters(!showFilters)} className={`alpha-filter-btn ${showFilters ? 'is-active' : ''}`}>
                                <Filter size={16} />
                                Filters
                            </button>
                        </div>
                    </div>

                    {showFilters && (
                        <div className="filters-container">
                            <div className="plan-settings-grid">
                                <div className="plan-setting-group">
                                    <label className="plan-setting-label">Plan Type (Multiple)</label>
                                    <select
                                        multiple
                                        value={filters.planTypes}
                                        onChange={e => handlePlanTypesFilterChange(Array.from(e.target.selectedOptions, o => o.value))}
                                        className="search-column-select"
                                    >
                                        <option value="FICTURE">FICTURE</option>
                                        <option value="LS">LS</option>
                                        <option value="CH">CH</option>
                                    </select>
                                    <small className="validation-error">Hold Ctrl/Cmd to select multiple</small>
                                </div>
                                <div className="plan-setting-group">
                                    <label className="plan-setting-label">Nesting Only</label>
                                    <input
                                        type="checkbox"
                                        checked={filters.nestingOnly}
                                        onChange={e => setFilters(prev => ({ ...prev, nestingOnly: e.target.checked }))}
                                        className="alpha-filter-checkbox"
                                    />
                                </div>
                                <div className="plan-setting-group">
                                    <label className="plan-setting-label">IPO Number (Multiple)</label>
                                    <select multiple value={filters.ipoNo} onChange={e => setFilters({ ...filters, ipoNo: Array.from(e.target.selectedOptions, o => o.value) })} className="search-column-select">
                                        {ipoOptions.map(i => <option key={i} value={i}>{i}</option>)}
                                    </select>
                                    <small className="validation-error">Hold Ctrl/Cmd to select multiple</small>
                                </div>
                                <div className="plan-setting-group">
                                    <label className="plan-setting-label">Plan Name (Multiple)</label>
                                    <select multiple value={filters.planNo} onChange={e => setFilters({ ...filters, planNo: Array.from(e.target.selectedOptions, o => o.value) })} className="search-column-select">
                                        {planOptions.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                    <small className="validation-error">Hold Ctrl/Cmd to select multiple</small>
                                </div>
                                <div className="plan-setting-group">
                                    <label className="plan-setting-label">Generated Status</label>
                                    <select value={filters.generatedStatus} onChange={e => setFilters({ ...filters, generatedStatus: e.target.value })} className="search-column-select">
                                        <option value="all">All Plans</option>
                                        <option value="generated">Generated</option>
                                        <option value="not-generated">Not Generated</option>
                                    </select>
                                </div>
                                <div className="plan-setting-group">
                                    <label className="plan-setting-label">Item Name</label>
                                    <input type="text" value={filters.itemName} onChange={e => setFilters({ ...filters, itemName: e.target.value })} className="search-input" placeholder="Filter by Item..." />
                                </div>
                                <div className="plan-setting-group">
                                    <label className="plan-setting-label">Drawing Number</label>
                                    <input type="text" value={filters.drawingNo} onChange={e => setFilters({ ...filters, drawingNo: e.target.value })} className="search-input" placeholder="Filter by Drawing No..." />
                                </div>
                                <div className="plan-setting-group">
                                    <label className="plan-setting-label">Import Date</label>
                                    <input type="date" value={filters.importDate} onChange={e => setFilters({ ...filters, importDate: e.target.value })} className="search-input" />
                                </div>
                                <div className="plan-setting-group">
                                    <label className="plan-setting-label">Import ID</label>
                                    <input type="text" value={filters.importId} onChange={e => setFilters({ ...filters, importId: e.target.value })} className="search-input" placeholder="Filter by Import ID..." />
                                </div>
                            </div>
                            <div className="actions-container">
                                <button onClick={fetchUnplannedItems} className="primary-button generate-button">Apply Filters</button>
                                <button
                                    onClick={() => setFilters({ ipoNo: [], planNo: [], importDate: '', importId: '', itemName: '', drawingNo: '', generatedStatus: 'all', planTypes: ['FICTURE', 'LS', 'CH'], nestingOnly: false })}
                                    className="clear-filters-button"
                                >
                                    Clear Filters
                                </button>
                                <div className="items-summary">
                                    Active: {filters.planTypes.length > 0 && ` Types: ${filters.planTypes.join(', ')}`}
                                    {filters.nestingOnly && ' (Nesting only)'}
                                    {filters.ipoNo.length > 0 && ` IPO: ${filters.ipoNo.join(', ')}`}
                                    {filters.planNo.length > 0 && ` Plans: ${filters.planNo.join(', ')}`}
                                    {filters.generatedStatus !== 'all' && ` Status: ${filters.generatedStatus}`}
                                    {!filters.planTypes.length && !filters.ipoNo.length && !filters.planNo.length && filters.generatedStatus === 'all' && !filters.nestingOnly && ' No filters'}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="data-status-card">
                        <div className="filters-header">
                            <div>
                                <h3 className="data-status-title">Bulk Operations</h3>
                                <p className="items-summary">Generate and download multiple plans at once</p>
                            </div>
                            <div className="action-buttons">
                                <div className="nesting-toggle">
                                    <label>
                                        <input type="checkbox" checked={bulkNesting} onChange={e => setBulkNesting(e.target.checked)} />
                                        <span>Include Nesting</span>
                                    </label>
                                </div>
                                <button onClick={generateAllPlans} disabled={bulkLoading || !Object.keys(plans).length} className="primary-button generate-button">
                                    <Layers size={16} />
                                    {bulkLoading ? 'Generating...' : 'Generate All'}
                                </button>
                                <button onClick={downloadAllPlans} disabled={!Object.keys(bulkPlans).length} className="generate-button">
                                    <Download size={16} />
                                    <span>Excel ZIP</span>
                                </button>
                                <button onClick={() => downloadAllPlansPDF(bulkPlans, nestingResults)} disabled={!Object.keys(bulkPlans).length} className="generate-button">
                                    <FileText size={16} />
                                    <span>PDF ZIP</span>
                                </button>
                                <button onClick={() => printAllPlansPDF(bulkPlans, nestingResults)} disabled={!Object.keys(bulkPlans).length} className="generate-button">
                                    <Printer size={16} />
                                    <span>Print All</span>
                                </button>
                            </div>
                        </div>
                        {Object.keys(bulkPlans).length > 0 && (
                            <div className="items-summary">
                                <CheckCircle2 size={14} />
                                Generated {Object.keys(bulkPlans).length} plan(s) — Ready for download/print
                            </div>
                        )}
                    </div>

                    {loading && (
                        <div className="loading-container">
                            <div className="loading-spinner"></div>
                            <p className="loading-text">Loading plans...</p>
                        </div>
                    )}

                    <div className="items-tab-container">
                        {getSortedPlans().map(([planNo, items]) => {
                            const uniqueItems = groupUniqueItems(items);
                            const isGenerated = isPlanGenerated(items);
                            const currentResult = planDetails?.planNo === planNo ? planDetails : (bulkPlans[planNo] || null);
                            const isInBulkPlans = !!(bulkPlans[planNo] || (planDetails?.planNo === planNo));

                            return (
                                <div key={planNo} className="items-table-card">
                                    <div className="filters-header">
                                        <div>
                                            <div className="items-table-title">
                                                <h3>
                                                    {planNo === 'UNASSIGNED' ? (
                                                        <><AlertCircle size={18} className="icon-warn" /> Unassigned Items</>
                                                    ) : (
                                                        <><FileText size={18} className="icon-plan" /> {planNo}</>
                                                    )}
                                                </h3>
                                                {getGeneratedBadge(items)}
                                            </div>
                                            <div className="plan-status-filters">
                                                <button onClick={() => handleSort('itemCount')} className="stat-badge">
                                                    <Box size={14} />
                                                    <span>Items: {items.length}</span>
                                                    {getSortIcon('itemCount')}
                                                </button>
                                                <div className="stat-badge">
                                                    <Layers size={14} />
                                                    <span>Unique: {uniqueItems.length}</span>
                                                </div>
                                                <button onClick={() => handleSort('totalQty')} className="stat-badge">
                                                    <Hash size={14} />
                                                    <span>Qty: {items.reduce((s, i) => s + (parseInt(i.quantity) || 0), 0)}</span>
                                                    {getSortIcon('totalQty')}
                                                </button>
                                                <button onClick={() => handleSort('totalArea')} className="stat-badge">
                                                    <Maximize2 size={14} />
                                                    <span>Area: {items.reduce((s, i) => s + (parseFloat(i.area) || 0) * (parseInt(i.quantity) || 0), 0).toFixed(2)} m²</span>
                                                    {getSortIcon('totalArea')}
                                                </button>
                                            </div>
                                            <div className="items-summary">
                                                {items[0]?.ipo_no && <span className="meta-item">IPO: {items[0].ipo_no}</span>}
                                                <span className="meta-item">Import: {items[0]?.import_id}</span>
                                                <span className="meta-item">Date: {new Date(items[0]?.created_at).toLocaleDateString()}</span>
                                                {isGenerated && items[0]?.generated_date && (
                                                    <span className="meta-item meta-gen">
                                                        <CheckCircle2 size={12} />
                                                        Gen: {new Date(items[0].generated_date).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="action-buttons">
                                            {items.some(i => i.item_type === 'FICTURE') && (
                                                <label className={`action-checkbox ${nestingEnabled[planNo] ? 'is-active' : ''}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={!!nestingEnabled[planNo]}
                                                        onChange={e => setNestingEnabled(prev => ({ ...prev, [planNo]: e.target.checked }))}
                                                    />
                                                    <span>Nesting</span>
                                                </label>
                                            )}
                                            {nestingResults[planNo] && (
                                                <div className="alpha-nesting-badge">
                                                    <RefreshCw size={12} />
                                                    {nestingResults[planNo].layouts.length}L · {nestingResults[planNo].totalSheets}S · {nestingResults[planNo].utilization}%
                                                </div>
                                            )}
                                            <button onClick={() => generatePlan(planNo)} disabled={loading || planNo === 'UNASSIGNED'} className="alpha-btn-primary">
                                                <Layers size={14} />
                                                {isInBulkPlans ? 'Regenerate' : 'Generate'}
                                            </button>
                                            <button onClick={() => downloadSinglePlan(planNo, bulkPlans[planNo])} disabled={!isInBulkPlans} className="alpha-btn-outline">
                                                <Download size={14} />
                                                Excel
                                            </button>
                                            <button onClick={() => generatePlanPDF(planNo, bulkPlans[planNo], nestingResults)} disabled={!isInBulkPlans} className="alpha-btn-outline">
                                                <FileText size={14} />
                                                PDF
                                            </button>
                                            <button onClick={() => printPlanPDF(planNo, bulkPlans[planNo], nestingResults)} disabled={!isInBulkPlans} className="alpha-btn-outline">
                                                <Printer size={14} />
                                                Print
                                            </button>
                                        </div>
                                    </div>

                                    {currentResult && (
                                        <div className="items-table-wrapper">
                                            <div className="alpha-details-header">
                                                <h4 className="items-table-title">Plan Details — {currentResult.data.length} Unique Items</h4>
                                            </div>
                                            <div className="items-table-wrapper">
                                                <table className="items-table">
                                                    <thead className="items-table-head">
                                                        <tr>
                                                            <th className="table-header">Type</th>
                                                            <th className="table-header">Item</th>
                                                            <th className="table-header">H×W</th>
                                                            <th className="table-header">Qty</th>
                                                            <th className="table-header">Main Component</th>
                                                            <th className="table-header">Side Frame</th>
                                                            <th className="table-header">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {currentResult.data.map((row, idx) => (
                                                            <tr key={idx} className="table-row">
                                                                <td className="table-cell">
                                                                    <span className={`alpha-type-tag tag-${row.type.toLowerCase()}`}>{row.type}</span>
                                                                </td>
                                                                <td className="table-cell">
                                                                    <div className="alpha-item-name">{row.item}</div>
                                                                    <div className="alpha-drawing">Draw: {row.drawingNo}</div>
                                                                </td>
                                                                <td className="table-cell alpha-dims">{row.height}×{row.width}</td>
                                                                <td className="table-cell alpha-quantity">{row.qty}</td>
                                                                <td className="table-cell">
                                                                    {row.type === 'FICTURE' && (
                                                                        <div className="alpha-comp-spec">
                                                                            <div>Right: {row.rightLName} {row.rightLCuttingLength}mm ×{row.rightLTotalQty}</div>
                                                                            <div>Left: {row.leftLName} {row.leftLCuttingLength}mm ×{row.leftLTotalQty}</div>
                                                                        </div>
                                                                    )}
                                                                    {row.type === 'LS' && (
                                                                        <div className="alpha-comp-spec">
                                                                            <div>L-SEC: {row.lSecName} {row.lSecCuttingLength}mm ×{row.lSecTotalQty}</div>
                                                                            <div>MF: {row.mainFrameName} {row.mainFrameCuttingLength}mm ×{row.mainFrameTotalQty}</div>
                                                                        </div>
                                                                    )}
                                                                    {row.type === 'CH' && (
                                                                        <div className="alpha-comp-spec">
                                                                            <div>CH: {row.channelName} {row.channelCuttingLength}mm ×{row.channelTotalQty}</div>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="table-cell">{row.sideFrameCuttingSize}mm ×{row.sideFrameTotalQty}</td>
                                                                <td className="table-cell alpha-status">
                                                                    {row.calculationError ? (
                                                                        <span className="alpha-status-error"><AlertCircle size={14} /> Error</span>
                                                                    ) : (
                                                                        <span className="alpha-status-ok"><CheckCircle2 size={14} /> OK</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {!Object.keys(plans).length && !loading && (
                        <div className="results-empty-state">
                            <span className="empty-state-icon empty-icon">📄</span>
                            <p className="empty-state-title">No items found for selected types</p>
                            <p className="empty-state-message">Check your ipo_master table for FICTURE, LS, or CH items</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}