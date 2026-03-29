
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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

// ============================================================================
// FICTURE HELPERS
// ============================================================================
const childPartMatches = (cp, itemName, height, width) => {
    if (!cp.item_prefix || !itemName) return false;
    if (!itemName.toLowerCase().startsWith(cp.item_prefix.toLowerCase())) return false;
    const h = parseFloat(height) || 0;
    const w = parseFloat(width) || 0;
    const hFrom = cp.from_height != null && cp.from_height !== '' ? parseFloat(cp.from_height) : null;
    const hTo = cp.to_height != null && cp.to_height !== '' ? parseFloat(cp.to_height) : null;
    const wFrom = cp.from_width != null && cp.from_width !== '' ? parseFloat(cp.from_width) : null;
    const wTo = cp.to_width != null && cp.to_width !== '' ? parseFloat(cp.to_width) : null;
    if (hFrom !== null && h < hFrom) return false;
    if (hTo !== null && h > hTo) return false;
    if (wFrom !== null && w < wFrom) return false;
    if (wTo !== null && w > wTo) return false;
    return true;
};

const getMatchingChildParts = (childParts, itemName, height, width) => {
    if (!childParts?.length || !itemName) return [];
    return childParts
        .filter(cp => childPartMatches(cp, itemName, height, width))
        .map(cp => ({
            rmId: cp.rm_id,
            rmName: cp.rm_stock?.rm_name || cp.rm_id || 'UNKNOWN',
            qty: parseInt(cp.child_part_quantity, 10) || 0,
        }));
};

const collectChildPartColumns = planData => {
    const seen = new Map();
    const order = [];
    planData.forEach(row => {
        (row.childParts || []).forEach(cp => {
            if (!seen.has(cp.rmId)) { seen.set(cp.rmId, cp.rmName); order.push(cp.rmId); }
        });
    });
    return order.map(id => ({ rmId: id, rmName: seen.get(id) }));
};

const getSharingValuesFic = (itemName, sharingMaster) => {
    if (!itemName || !sharingMaster?.length) return { heightSharing: 0, leftWidthSharing: 0, rightWidthSharing: 0 };
    const nm = itemName.trim().toLowerCase();
    const sd = sharingMaster.find(s => s.item_prefix && new RegExp(`\\b${s.item_prefix.trim().toLowerCase()}(?:\\(|\\s|$)`, 'i').test(nm));
    return sd
        ? { heightSharing: parseFloat(sd.right_height_sharing) || 0, leftWidthSharing: parseFloat(sd.left_width_sharing) || 0, rightWidthSharing: parseFloat(sd.right_width_sharing) || 0 }
        : { heightSharing: 0, leftWidthSharing: 0, rightWidthSharing: 0 };
};

const findBestLSec = (targetWidth, rmStock) => {
    if (!targetWidth || targetWidth < 50) return null;
    return rmStock
        .filter(rm => (parseFloat(rm.width) || 0) >= targetWidth)
        .sort((a, b) => (parseFloat(a.width) || 0) - (parseFloat(b.width) || 0))[0] || null;
};

const calculateLSecWidths = (panelWidth, rmStock, lws = 0, rws = 0) => {
    if (!panelWidth || panelWidth < 300) return { rightLSec: null, leftLSec: null, leftCuttingWidth: null, error: 'Panel width too small' };
    const rightLSec = findBestLSec(Math.round(panelWidth / 2), rmStock);
    if (!rightLSec) return { rightLSec: null, leftLSec: null, leftCuttingWidth: null, error: 'No suitable Right L-SEC found' };
    const leftCuttingWidth = Math.round(panelWidth - (parseFloat(rightLSec.width) || 0) - (lws + rws));
    if (leftCuttingWidth < 50) return { rightLSec, leftLSec: null, leftCuttingWidth: null, error: 'Left L-SEC cutting width too small' };
    const leftLSec = findBestLSec(leftCuttingWidth, rmStock);
    if (!leftLSec) return { rightLSec, leftLSec: null, leftCuttingWidth, error: 'No suitable Left L-SEC stock found' };
    return { rightLSec, leftLSec, leftCuttingWidth, error: null };
};

// ============================================================================
// LS HELPERS
// ============================================================================
const getSharingValuesLs = (itemName, sharingMaster) => {
    if (!itemName || !sharingMaster?.length) return { heightSharing: 0, widthSharing: 0 };
    const nm = itemName.trim().toLowerCase();
    const sd = sharingMaster.find(s => s.ITEM && new RegExp(`\\b${s.ITEM.trim().toLowerCase()}(?:\\(|\\s|$)`, 'i').test(nm));
    return sd ? { heightSharing: parseFloat(sd['HEIGHT-SHARING']) || 0, widthSharing: parseFloat(sd['WIDTH-SHARING']) || 0 } : { heightSharing: 0, widthSharing: 0 };
};

const findBestLSecLs = (targetWidth, rmStock) => {
    if (!targetWidth || targetWidth < 50) return null;
    return rmStock
        .filter(rm => (parseFloat(rm.width) || 0) >= targetWidth && rm.type === 'L-SEC')
        .sort((a, b) => (parseFloat(a.width) || 0) - (parseFloat(b.width) || 0))[0] || null;
};

const calculateLSecForLs = (panelWidth, rmStock, widthSharing = 0) => {
    const targetWidth = Math.round(panelWidth - widthSharing);
    const lSec = findBestLSecLs(targetWidth, rmStock);
    if (!lSec) return { lSec: null, cuttingWidth: null, error: 'No suitable L-SEC found' };
    const cuttingWidth = targetWidth;
    if (cuttingWidth < 50) return { lSec: null, cuttingWidth: null, error: 'L-SEC cutting width too small' };
    return { lSec, cuttingWidth, error: null };
};

const getMainFrame = rmStock => rmStock.find(rm => rm.type === 'MF') || null;

// ============================================================================
// CH HELPERS
// ============================================================================
const findBestCH = (targetWidth, rmStock) => {
    if (!targetWidth || targetWidth < 50) return null;
    return rmStock
        .filter(rm => (parseFloat(rm.width) || 0) >= targetWidth && rm.type === 'CH')
        .sort((a, b) => (parseFloat(a.width) || 0) - (parseFloat(b.width) || 0))[0] || null;
};

const calculateCH = (panelWidth, rmStock) => {
    const targetWidth = Math.round(panelWidth);
    const channel = findBestCH(targetWidth, rmStock);
    if (!channel) return { channel: null, cuttingWidth: null, error: 'No suitable CH found' };
    const cuttingWidth = targetWidth;
    if (cuttingWidth < 50) return { channel: null, cuttingWidth: null, error: 'CH cutting width too small' };
    return { channel, cuttingWidth, error: null };
};

// ============================================================================
// SHARED STIFFENER & RK HELPERS
// ============================================================================
const getStiffenerDetails = async (itemName, height, width) => {
    if (!itemName) return { uWithLipQty: 0, uWithoutLipQty: 0, iStiffQty: 0 };
    try {
        const itemHeight = parseFloat(height) || 0;
        const itemWidth = parseFloat(width) || 0;
        const [uWithLipRes, uWithoutLipRes, iStiffRes] = await Promise.all([
            supabase.from('U-WITH-LIP-MASTER').select('*').order('id'),
            supabase.from('U-W-O-LIP').select('*').order('id'),
            supabase.from('I-STIFF').select('*').order('id'),
        ]);
        if (uWithLipRes.error || uWithoutLipRes.error || iStiffRes.error) {
            console.error('Stiffener fetch errors');
            return { uWithLipQty: 0, uWithoutLipQty: 0, iStiffQty: 0 };
        }
        const uWithLipMaster = uWithLipRes.data || [];
        const uWithoutLipMaster = uWithoutLipRes.data || [];
        const iStiffMaster = iStiffRes.data || [];

        const inRange = (val, fromVal, toVal) => {
            const from = parseFloat(fromVal) || 0;
            const to = parseFloat(toVal) || 999999;
            const v = parseFloat(val) || 0;
            return v >= from && v <= to;
        };
        const findMatch = (table) => {
            return table.find(st => {
                const start = st['item-name-start-with'];
                if (!start) return false;
                if (!itemName.toLowerCase().startsWith(start.toLowerCase())) return false;
                if (!inRange(itemHeight, st['FROM-HEIGHT'], st['TO-HEIGHT'])) return false;
                if (!inRange(itemWidth, st['FROM-WIDTH'], st['TO-WIDTH'])) return false;
                return true;
            });
        };
        const uWithLipMatch = findMatch(uWithLipMaster);
        const uWithoutLipMatch = findMatch(uWithoutLipMaster);
        const iStiffMatch = findMatch(iStiffMaster);
        const uWithLipQty = uWithLipMatch ? parseInt(uWithLipMatch['U-WITH-LIP-QTY']) || 0 : 0;
        const uWithoutLipQty = uWithoutLipMatch ? parseInt(uWithoutLipMatch['U-W/O-LIP-QTY']) || 0 : 0;
        const iStiffQty = iStiffMatch ? parseInt(iStiffMatch['I-STIFF-QTY']) || 0 : 0;
        return { uWithLipQty, uWithoutLipQty, iStiffQty };
    } catch (err) {
        console.error('getStiffenerDetails error', err);
        return { uWithLipQty: 0, uWithoutLipQty: 0, iStiffQty: 0 };
    }
};

const getRKDetails = (rkMaster, itemName, height, width) => {
    if (!rkMaster?.length || !itemName) return { rkName: '', rkLength: '', rkQty: 0 };
    const matching = rkMaster.filter(rk => {
        const start = rk['item-name-start-with'];
        if (!start) return false;
        if (!itemName.toLowerCase().startsWith(start.toLowerCase())) return false;
        const fromH = parseFloat(rk['FROM-HEIGHT']) || 0;
        const toH = parseFloat(rk['TO-HEIGHT']) || 999999;
        const h = parseFloat(height) || 0;
        if (h < fromH || h > toH) return false;
        const fromW = parseFloat(rk['FROM-WIDTH']) || 0;
        const toW = parseFloat(rk['TO-WIDTH']) || 999999;
        const w = parseFloat(width) || 0;
        if (w < fromW || w > toW) return false;
        return true;
    });
    if (matching.length === 0) return { rkName: '', rkLength: '', rkQty: 0 };
    const rk = matching[0];
    const rkLength = Math.max((parseFloat(width) || 0) - 1, 0);
    return { rkName: rk['RK-Name'] || '', rkLength, rkQty: 1 };
};

// ============================================================================
// NESTING HELPERS (FICTURE only)
// ============================================================================
const nestGetSharingValues = (itemName, sma) => {
    if (!itemName || !sma.length) return { heightSharing: 0, leftWidthSharing: 0, rightWidthSharing: 0 };
    const nm = itemName.trim().toLowerCase();
    const sd = sma.find(s => s.item_prefix && new RegExp(`\\b${s.item_prefix.trim().toLowerCase()}(?:\\(|\\s|$)`, 'i').test(nm));
    return sd ? { heightSharing: parseFloat(sd.right_height_sharing) || 0, leftWidthSharing: parseFloat(sd.left_width_sharing) || 0, rightWidthSharing: parseFloat(sd.right_width_sharing) || 0 } : { heightSharing: 0, leftWidthSharing: 0, rightWidthSharing: 0 };
};

const nestFindBestLSec = (targetWidth, cutLength, rmStockArr) => {
    if (!targetWidth || targetWidth < 50) return null;
    return rmStockArr.filter(s => (parseFloat(s.width) || 0) >= targetWidth && (parseFloat(s.height) || 0) >= cutLength)
        .sort((a, b) => { const wa = parseFloat(a.width) || 0, wb = parseFloat(b.width) || 0; return wa !== wb ? wa - wb : (parseFloat(a.height) || 0) - (parseFloat(b.height) || 0); })[0] || null;
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
        if (!map[key]) map[key] = { cutLength, panelWidth: panW, itemName: item.item_name || '', drawingNo: item.drawing_no || '', markNo: item.mark_no || '', ipoNo: item.ipo_no || '', leftWidthSharing, rightWidthSharing, totalQty: 0, totalArea: 0 };
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
            const bar = openBars[bestIdx], yOff = bar.usedLength === 0 ? 0 : bar.usedLength + NEST_BLADE_MM;
            bar.pieces.push({ ...piece, y: yOff }); bar.usedLength = yOff + pLen;
        } else {
            const cands = (stockByWidth[pW] || []).filter(s => s.height >= pLen);
            if (!cands.length) continue;
            openBars.push({ rmWidth: pW, rmHeight: cands[0].height, rmName: cands[0].name, usedLength: pLen, pieces: [{ ...piece, y: 0 }] });
        }
    }
    return openBars.map(bar => {
        const usedArea = bar.pieces.reduce((s, p) => s + p.cutLength * bar.rmWidth, 0), totalArea = bar.rmWidth * bar.rmHeight;
        return { rmStockName: bar.rmName, rmStockWidth: bar.rmWidth, rmStockHeight: bar.rmHeight, pieces: bar.pieces, usedHeight: bar.usedLength, wasteHeight: bar.rmHeight - bar.usedLength, usedArea, wasteArea: totalArea - usedArea, totalArea, utilization: totalArea > 0 ? parseFloat(((usedArea / totalArea) * 100).toFixed(2)) : 0 };
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

const nestComputeNesting = (planNo, items, rmStockArr, sma) => {
    if (!items?.length || !rmStockArr.length) return null;
    const uniqueItems = nestGroupUniqueItems(items, sma);
    if (!uniqueItems.length) return null;
    const stockByWidth = {};
    rmStockArr.forEach(s => { const w = parseFloat(s.width) || 0, h = parseFloat(s.height) || 0, n = s.rm_name || `L-SEC-${w}`; if (w > 0 && h > 0) { if (!stockByWidth[w]) stockByWidth[w] = []; stockByWidth[w].push({ height: h, name: n }); } });
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
    return { planNo, ipoNo: uniqueItems[0]?.ipoNo || '', date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString(), layouts, totalSheets: layouts.reduce((s, l) => s + l.layoutQty, 0), totalUsedArea: tU, totalWasteArea: tW, totalStockArea: tS, utilization: tS > 0 ? ((tU / tS) * 100).toFixed(2) : '0.00', itemsProcessed: uniqueItems.length, piecesGenerated: allPieces.length, allPieces };
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

const nestDrawRmTable = (doc, reqs, title, startY = 30, PW = 297, PH = 210, M = 6) => {
    const rH = 7, cW = [60, 25, 25, 30, 40], hdr = ['RM Name', 'Width (mm)', 'Height (mm)', 'Qty (bars)', 'Total (m)'];
    let y = startY;
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 31, 46); doc.text(title, PW / 2, y, { align: 'center' }); y += 7;
    let x = M; doc.setFillColor(26, 31, 46); doc.rect(M, y, PW - 2 * M, rH, 'F'); doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    hdr.forEach((h, i) => { doc.text(h, x + cW[i] / 2, y + rH - 2, { align: 'center' }); x += cW[i]; }); y += rH;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 30);
    reqs.forEach((r, idx) => {
        if (y + rH > PH - M) { doc.addPage(); y = M; }
        if (idx % 2 === 0) { doc.setFillColor(248, 249, 250); doc.rect(M, y, PW - 2 * M, rH, 'F'); }
        doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.1); doc.rect(M, y, PW - 2 * M, rH, 'S');
        x = M;[r.rmName, r.width.toFixed(0), r.height.toFixed(0), r.qty, r.totalLength.toFixed(2)].forEach((v, i) => { doc.text(String(v), x + cW[i] / 2, y + rH - 2, { align: 'center' }); x += cW[i]; }); y += rH;
    });
    return y + 5;
};

const nestPdfLabel = (doc, px, py, pw, ph, num, dim, fc, sc) => {
    const spw = Number(pw) || 0, sph = Number(ph) || 0, nb = Math.min(sph * 0.42, spw * 0.28, 5.5);
    if (nb > 1.2) { doc.setFillColor(sc[0], sc[1], sc[2]); doc.rect(px, py, nb, nb, 'F'); doc.setFontSize(Math.max(3, nb * 0.62)); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255); doc.text(num, px + nb / 2, py + nb * 0.72, { align: 'center' }); }
    const MN = 3, MX = 5.5, CW = 0.55;
    const fsH = Math.min(MX, Math.max(MN, Math.min(spw / (dim.length * CW), sph * 0.32))), fitH = dim.length * CW * fsH <= spw - 1.5 && sph >= fsH + 1.5;
    const fsV = Math.min(MX, Math.max(MN, Math.min(sph / (dim.length * CW), spw * 0.32))), fitV = dim.length * CW * fsV <= sph - 1.5 && spw >= fsV + 1.5;
    const cx = px + spw / 2, cy = py + sph / 2;
    doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 15, 15);
    if (fitH) { doc.setFontSize(fsH); doc.text(dim, cx, cy + fsH * 0.38, { align: 'center' }); }
    else if (fitV) { doc.setFontSize(fsV); doc.text(dim, cx, cy + fsV * 0.38, { align: 'center', angle: 90 }); }
    else { doc.setFontSize(MN); doc.text(dim, cx, cy + MN * 0.38, { align: 'center' }); }
};

const nestPdfCell = (doc, layout, cX, cY, cW, cH, total) => {
    const N = (v, fb = 0) => { const x = Number(v); return isFinite(x) ? x : fb; };
    const sL = N(layout.rmStockHeight, 4820), sW = N(layout.rmStockWidth, 300), qty = N(layout.layoutQty, 1);
    const HH = 5.5, PT = 1, DB = 5, UH = 4, baX = cX + 8, baY = cY + HH + PT, baW = cW - 10, baH = cH - HH - PT - DB - UH;
    const sc = Math.min(baW / sL, baH / sW), bW = sL * sc, bH = baH, bX = baX + (baW - bW) / 2, bY = baY;
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.15); doc.rect(cX, cY, cW, cH, 'S');
    doc.setFillColor(26, 31, 46); doc.rect(cX, cY, cW, HH, 'F');
    doc.setFontSize(5.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text(`Layout ${N(layout.layoutNumber)}/${total}  ·  RM:${layout.rmStockName || 'L-SEC'}  ·  ${sL}×${sW}mm  ·  Qty:${qty}`, cX + cW / 2, cY + HH - 1.2, { align: 'center' });
    doc.setFillColor(255, 255, 255); doc.setDrawColor(26, 31, 46); doc.setLineWidth(0.5); doc.rect(bX, bY, bW, bH, 'FD');
    doc.saveGraphicsState();
    layout.pieces.forEach((piece, idx) => {
        const pxS = bX + N(piece.y) * sc, pw = Math.min(N(piece.cutLength) * sc, bX + bW - pxS), ph = bH;
        if (pw < 0.1 || ph < 0.1 || pxS >= bX + bW || pxS < bX) return;
        const ci = idx % NEST_PDF_FILLS.length, fc = NEST_PDF_FILLS[ci], sc2 = NEST_PDF_STROKES[ci];
        doc.setFillColor(fc[0], fc[1], fc[2]); doc.setDrawColor(sc2[0], sc2[1], sc2[2]); doc.setLineWidth(0.25); doc.rect(pxS, bY, pw, ph, 'FD');
        nestPdfLabel(doc, pxS, bY, pw, ph, String(idx + 1), piece.type === 'LEFT' && piece.leftCuttingWidth ? `${Math.round(N(piece.cutLength))}×${Math.round(N(piece.leftCuttingWidth))}(L)` : `${Math.round(N(piece.cutLength))}×${Math.round(N(piece.rmStockWidth))}`, fc, sc2);
    });
    doc.restoreGraphicsState();
    const used = N(layout.usedHeight, 0);
    if (used > 0 && used < sL) { const wx = bX + used * sc, ww = (sL - used) * sc; if (ww > 0.3) { doc.setFillColor(210, 210, 210); doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.15); doc.rect(wx, bY, ww, bH, 'FD'); if (ww > 4) { doc.setFontSize(4); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 100); doc.text(`WASTE ${Math.round(sL - used)}mm`, wx + ww / 2, bY + bH / 2, { align: 'center' }); } } }
    doc.setFontSize(4.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
    doc.text(`Util:${N(layout.utilization)}%  ·  Used:${Math.round(used)}mm  ·  Waste:${Math.round(N(layout.wasteHeight))}mm  ·  Sheets:${qty}`, cX + cW / 2, cY + cH - 0.8, { align: 'center' });
};

const nestBuildPages = (doc, nd) => {
    if (!nd?.layouts?.length) return;
    const PW = 297, PH = 210, M = 6, FH = 7, BH = 22, CH = 14, CG = 2, CEG = 2, PTH = 6, LPP = 6;
    const cellH = ((PH - 2 * M - FH - PTH) - CEG * (LPP - 1)) / LPP, cellW = PW - 2 * M;
    doc.addPage('a4', 'landscape'); let sy = M;
    doc.setFillColor(26, 31, 46); doc.rect(0, sy, PW, BH, 'F'); doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text('L-SEC NESTING LAYOUTS', PW / 2, sy + 8, { align: 'center' }); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(`Plan: ${nd.planNo}   IPO: ${nd.ipoNo}   ${nd.date}  ${nd.time}`, PW / 2, sy + 15, { align: 'center' });
    const cY2 = sy + BH + 1, cW2 = (cellW - 6) / 4;
    [{ v: nd.layouts.length, l: 'Unique Layouts' }, { v: nd.totalSheets, l: 'Total Sheets' }, { v: `${nd.utilization}%`, l: 'Utilization' }, { v: nd.piecesGenerated, l: 'Piece Types' }]
        .forEach((c, i) => { const cx = M + i * (cW2 + 2); doc.setFillColor(235, 245, 255); doc.roundedRect(cx, cY2, cW2, CH, 1, 1, 'F'); doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 31, 46); doc.text(String(c.v), cx + cW2 / 2, cY2 + 7, { align: 'center' }); doc.setFontSize(5.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(90, 90, 90); doc.text(c.l, cx + cW2 / 2, cY2 + 12, { align: 'center' }); });
    let curY = cY2 + CH + CG;
    nd.layouts.forEach(layout => {
        if (curY + cellH > PH - M - FH) { doc.addPage('a4', 'landscape'); doc.setFillColor(26, 31, 46); doc.rect(0, M, PW, PTH, 'F'); doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255); doc.text(`${nd.planNo}  —  continued`, PW / 2, M + PTH - 1.5, { align: 'center' }); curY = M + PTH + CEG; }
        nestPdfCell(doc, layout, M, curY, cellW, cellH, nd.layouts.length); curY += cellH + CEG;
    });
    const req = nestComputeRmReq([nd]);
    if (req.length) { doc.addPage('a4', 'landscape'); doc.setFillColor(26, 31, 46); doc.rect(0, 0, PW, 14, 'F'); doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255); doc.text(`RM Requirement  —  ${nd.planNo}  (${nd.ipoNo})`, PW / 2, 9, { align: 'center' }); nestDrawRmTable(doc, req, `Material Requirement  —  Plan: ${nd.planNo}`, 22, PW, PH, M); }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function CreatePlan() {
    // State
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

    // Fetch filter options on mount
    useEffect(() => {
        fetchFilterOptions();
        fetchRmStockForNesting();
    }, []);

    // Re‑fetch plans when selected types or filters change
    useEffect(() => {
        if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
        fetchTimeout.current = setTimeout(() => {
            fetchUnplannedItems();
        }, 300);
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
            if (types.length === 0) {
                setPlans({});
                setLoading(false);
                return;
            }

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
                Object.entries(grouped).forEach(([pn, items]) => {
                    if (nestingEnabled[pn]) filtered[pn] = items;
                });
                setPlans(filtered);
            } else {
                setPlans(grouped);
            }
        } catch (e) {
            console.error('Error fetching items:', e);
            alert('Error loading data: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const checkPlanExists = async planNo => {
        try {
            const { data, error } = await supabase.from('ipo_master').select('id, generated_date')
                .eq('plan_name', planNo)
                .not('generated_date', 'is', null).limit(1).single();
            if (error && error.code !== 'PGRST116') throw error;
            return data || null;
        } catch (e) { console.error(e); return null; }
    };

    const updatePlanDateInMaster = async planNo => {
        const { error } = await supabase.from('ipo_master')
            .update({ generated_date: new Date().toISOString().split('T')[0] })
            .eq('plan_name', planNo);
        if (error) throw error;
    };

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

            const ficItems = items.filter(i => i.item_type === 'FICTURE');
            const lsItems = items.filter(i => i.item_type === 'LS');
            const chItems = items.filter(i => i.item_type === 'CH');

            const [sharingRes, rmStockRes, exclusionRes, childPartsRes, uWithLipRes, uWithoutLipRes, iStiffRes, rkRes] = await Promise.all([
                supabase.from('sharing_master').select('*'),
                supabase.from('rm_stock').select('*').eq('status', 'available'),
                supabase.from('exclusion_items').select('*').eq('status', 'active'),
                supabase.from('child_parts').select('*, rm_stock:rm_id ( rm_name )'),
                supabase.from('U-WITH-LIP-MASTER').select('*'),
                supabase.from('U-W-O-LIP').select('*'),
                supabase.from('I-STIFF').select('*'),
                supabase.from('RK-MASTER').select('*'),
            ]);

            const sharingMaster = sharingRes.data || [];
            const rmStock = rmStockRes.data || [];
            const exclusionItems = exclusionRes.data || [];
            const childParts = childPartsRes.data || [];
            const uWithLipMaster = uWithLipRes.data || [];
            const uWithoutLipMaster = uWithoutLipRes.data || [];
            const iStiffMaster = iStiffRes.data || [];
            const rkMaster = rkRes.data || [];

            if (!rmStock.length) { alert('No active RM stock found'); return; }

            const planData = [];
            let totalArea = 0, totalQty = 0;

            // --- FICTURE ---
            for (const ui of groupUniqueItems(ficItems)) {
                const { height, width, totalQty: qty, totalArea: area, item: itemName } = ui;
                const isExcluded = exclusionItems.some(ex => {
                    if (!ex.item_prefix || !itemName) return false;
                    if (!itemName.toLowerCase().startsWith(ex.item_prefix.toLowerCase())) return false;
                    const hFrom = parseFloat(ex.from_height) || 0, hTo = parseFloat(ex.to_height) || 999999;
                    const wFrom = parseFloat(ex.from_width) || 0, wTo = parseFloat(ex.to_width) || 999999;
                    const hOk = !ex.from_height && !ex.to_height ? true : (height >= hFrom && height <= hTo);
                    const wOk = !ex.from_width && !ex.to_width ? true : (width >= wFrom && width <= wTo);
                    return hOk && wOk;
                });
                if (isExcluded) continue;

                totalArea += area;
                totalQty += qty;

                const { heightSharing, leftWidthSharing, rightWidthSharing } = getSharingValuesFic(itemName, sharingMaster);
                const lsecResult = calculateLSecWidths(width, rmStock, leftWidthSharing, rightWidthSharing);
                const { rightLSec, leftLSec, leftCuttingWidth } = lsecResult;
                const rightLName = rightLSec ? (rightLSec.rm_name || `L-SEC-${parseFloat(rightLSec.width) || 0}`) : 'ERROR-NO-LSEC';
                const leftLName = leftLSec ? (leftLSec.rm_name || `L-SEC-${parseFloat(leftLSec.width) || 0}`) : 'ERROR-NO-LSEC';
                const rightLWidth = rightLSec ? (parseFloat(rightLSec.width) || 0) : 0;
                const leftLStockWidth = leftLSec ? (parseFloat(leftLSec.width) || 0) : 0;
                const rightLCuttingLength = Math.max(height - heightSharing, 0);
                const leftLCuttingLength = Math.max(height - heightSharing, 0);
                const sideFrameLength = Math.max(width - 17, 0);

                const matchedCPs = getMatchingChildParts(childParts, itemName, height, width);
                const childPartTotals = matchedCPs.map(cp => ({
                    rmId: cp.rmId,
                    rmName: cp.rmName,
                    perPieceQty: cp.qty,
                    totalQty: cp.qty * qty,
                    cuttingSize: sideFrameLength,
                }));

                planData.push({
                    type: 'FICTURE',
                    planNo, ipoNo: ui.ipoNo, height, item: itemName, width,
                    drawingNo: ui.drawingNo, markNo: ui.markNo, importId: ui.importId, importDate: ui.importDate,
                    qty, area,
                    rightLName, rightLCuttingLength, rightLWidth, rightLQtyPerPc: 1, rightLTotalQty: qty,
                    leftLName, leftLCuttingLength, leftLStockWidth, leftCuttingWidth, leftLQtyPerPc: 1, leftLTotalQty: qty,
                    sideFrameName: 'SIDE FRAME', sideFrameQtyPerPc: 2, sideFrameTotalQty: qty * 2, sideFrameCuttingSize: sideFrameLength,
                    childParts: childPartTotals,
                    calculationError: lsecResult.error,
                });
            }

            // --- LS ---
            for (const ui of groupUniqueItems(lsItems)) {
                const { height, width, totalQty: qty, totalArea: area, item: itemName } = ui;
                const isExcluded = exclusionItems.some(ex => {
                    if (!ex.item_prefix || !itemName) return false;
                    if (!itemName.toLowerCase().startsWith(ex.item_prefix.toLowerCase())) return false;
                    const hFrom = parseFloat(ex.from_height) || 0, hTo = parseFloat(ex.to_height) || 999999;
                    const wFrom = parseFloat(ex.from_width) || 0, wTo = parseFloat(ex.to_width) || 999999;
                    const hOk = !ex.from_height && !ex.to_height ? true : (height >= hFrom && height <= hTo);
                    const wOk = !ex.from_width && !ex.to_width ? true : (width >= wFrom && width <= wTo);
                    return hOk && wOk;
                });
                if (isExcluded) continue;

                totalArea += area;
                totalQty += qty;

                const { heightSharing, widthSharing } = getSharingValuesLs(itemName, sharingMaster);
                const lsecResult = calculateLSecForLs(width, rmStock.filter(r => r.type === 'L-SEC'), widthSharing);
                const { lSec, cuttingWidth } = lsecResult;
                const lSecName = lSec ? (lSec.rm_name || `L-SEC-${parseFloat(lSec.width) || 0}`) : 'ERROR-NO-LSEC';
                const lSecStockWidth = lSec ? (parseFloat(lSec.width) || 0) : 0;
                const lSecCuttingLength = Math.max(height - heightSharing, 0);
                const lSecTotalQty = qty;

                const mainFrame = getMainFrame(rmStock);
                const mainFrameName = mainFrame ? (mainFrame.rm_name || 'MAIN FRAME') : '';
                const mainFrameCuttingLength = Math.max(height - heightSharing, 0);
                const mainFrameTotalQty = qty;

                const sideFrameLength = Math.max(width - 17, 0);
                const sideFrameTotalQty = qty * 2;

                const stiffenerDetails = await getStiffenerDetails(itemName, height, width);
                const { uWithLipQty, uWithoutLipQty, iStiffQty } = stiffenerDetails;
                const rkDetails = getRKDetails(rkMaster, itemName, height, width);

                planData.push({
                    type: 'LS',
                    planNo, ipoNo: ui.ipoNo, height, item: itemName, width,
                    drawingNo: ui.drawingNo, qty, area,
                    lSecName, lSecCuttingLength, lSecStockWidth, cuttingWidth, lSecQtyPerPc: 1, lSecTotalQty,
                    mainFrameName, mainFrameCuttingLength, mainFrameTotalQty,
                    sideFrameName: 'SIDE FRAME', sideFrameQtyPerPc: 2, sideFrameTotalQty, sideFrameCuttingSize: sideFrameLength,
                    uStiffWithLipName: uWithLipQty ? 'U-STIFF WITH LIP' : '',
                    uStiffWithLipPerPieceQty: uWithLipQty,
                    uStiffWithLipTotalQty: uWithLipQty * qty,
                    uStiffWithLipCuttingSize: uWithLipQty ? sideFrameLength : '',
                    uStiffWithoutLipName: uWithoutLipQty ? 'U-STIFF' : '',
                    uStiffWithoutLipPerPieceQty: uWithoutLipQty,
                    uStiffWithoutLipTotalQty: uWithoutLipQty * qty,
                    uStiffWithoutLipCuttingSize: uWithoutLipQty ? sideFrameLength : '',
                    iStiffName: iStiffQty ? 'I-STIFF' : '',
                    iStiffPerPieceQty: iStiffQty,
                    iStiffTotalQty: iStiffQty * qty,
                    iStiffCuttingSize: iStiffQty ? sideFrameLength : '',
                    rkName: rkDetails.rkName,
                    rkLength: rkDetails.rkLength,
                    rkPerPieceQty: rkDetails.rkQty,
                    rkTotalQty: rkDetails.rkQty * qty,
                    calculationError: lsecResult.error,
                });
            }

            // --- CH ---
            for (const ui of groupUniqueItems(chItems)) {
                const { height, width, totalQty: qty, totalArea: area, item: itemName } = ui;
                const isExcluded = exclusionItems.some(ex => {
                    if (!ex.item_prefix || !itemName) return false;
                    if (!itemName.toLowerCase().startsWith(ex.item_prefix.toLowerCase())) return false;
                    const hFrom = parseFloat(ex.from_height) || 0, hTo = parseFloat(ex.to_height) || 999999;
                    const wFrom = parseFloat(ex.from_width) || 0, wTo = parseFloat(ex.to_width) || 999999;
                    const hOk = !ex.from_height && !ex.to_height ? true : (height >= hFrom && height <= hTo);
                    const wOk = !ex.from_width && !ex.to_width ? true : (width >= wFrom && width <= wTo);
                    return hOk && wOk;
                });
                if (isExcluded) continue;

                totalArea += area;
                totalQty += qty;

                const { heightSharing } = getSharingValuesLs(itemName, sharingMaster);
                const chResult = calculateCH(width, rmStock.filter(r => r.type === 'CH'));
                const { channel, cuttingWidth } = chResult;
                const channelName = channel ? (channel.rm_name || `CH-${parseFloat(channel.width) || 0}`) : 'ERROR-NO-CH';
                const channelStockWidth = channel ? (parseFloat(channel.width) || 0) : 0;
                const channelCuttingLength = Math.max(height - heightSharing, 0);
                const channelTotalQty = qty;

                const sideFrameLength = Math.max(width - 17, 0);
                const sideFrameTotalQty = qty * 2;

                const stiffenerDetails = await getStiffenerDetails(itemName, height, width);
                const { uWithLipQty, uWithoutLipQty, iStiffQty } = stiffenerDetails;
                const rkDetails = getRKDetails(rkMaster, itemName, height, width);

                planData.push({
                    type: 'CH',
                    planNo, ipoNo: ui.ipoNo, height, item: itemName, width,
                    drawingNo: ui.drawingNo, qty, area,
                    channelName, channelCuttingLength, channelStockWidth, cuttingWidth, channelQtyPerPc: 1, channelTotalQty,
                    sideFrameName: 'SIDE FRAME', sideFrameQtyPerPc: 2, sideFrameTotalQty, sideFrameCuttingSize: sideFrameLength,
                    uStiffWithLipName: uWithLipQty ? 'U-STIFF WITH LIP' : '',
                    uStiffWithLipPerPieceQty: uWithLipQty,
                    uStiffWithLipTotalQty: uWithLipQty * qty,
                    uStiffWithLipCuttingSize: uWithLipQty ? sideFrameLength : '',
                    uStiffWithoutLipName: uWithoutLipQty ? 'U-STIFF' : '',
                    uStiffWithoutLipPerPieceQty: uWithoutLipQty,
                    uStiffWithoutLipTotalQty: uWithoutLipQty * qty,
                    uStiffWithoutLipCuttingSize: uWithoutLipQty ? sideFrameLength : '',
                    iStiffName: iStiffQty ? 'I-STIFF' : '',
                    iStiffPerPieceQty: iStiffQty,
                    iStiffTotalQty: iStiffQty * qty,
                    iStiffCuttingSize: iStiffQty ? sideFrameLength : '',
                    rkName: rkDetails.rkName,
                    rkLength: rkDetails.rkLength,
                    rkPerPieceQty: rkDetails.rkQty,
                    rkTotalQty: rkDetails.rkQty * qty,
                    calculationError: chResult.error,
                });
            }

            if (planData.length === 0) { alert('No valid items found after applying exclusion rules'); return; }

            await updatePlanDateInMaster(planNo);

            const childPartCols = collectChildPartColumns(planData.filter(p => p.type === 'FICTURE'));

            const result = {
                planNo, data: planData,
                summary: { 'IPO-NO': planData[0]?.ipoNo || '', AREA: totalArea, QTY: totalQty },
                existing: !!existingPlan,
                childPartCols,
            };
            setPlanDetails(result);
            setBulkPlans(prev => ({ ...prev, [planNo]: result }));

            const shouldNest = forceNesting || nestingEnabled[planNo];
            if (shouldNest && rmStockNest.length && ficItems.length) {
                const nd = nestComputeNesting(planNo, ficItems, rmStockNest, sharingMasterNest);
                if (nd) setNestingResults(prev => ({ ...prev, [planNo]: nd }));
                else console.warn(`Nesting for ${planNo}: no valid pieces.`);
            }

            await fetchUnplannedItems();
            alert(`Plan ${planNo} ${existingPlan ? 'regenerated' : 'generated'} successfully!`);
            return result;
        } catch (error) { console.error(error); alert('Error generating plan: ' + error.message); throw error; }
        finally { setLoading(false); }
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
                try {
                    await generatePlan(planNo);
                    ok++;
                } catch (e) {
                    console.error(`Nesting failed for ${planNo}:`, e);
                    fail++;
                }
            }
            alert(`Nesting generation complete! Success: ${ok}, Failed: ${fail}`);
        } catch (e) {
            console.error('Error in bulk nesting:', e);
            alert('Error: ' + e.message);
        } finally {
            setBulkLoading(false);
        }
    };

    // ==========================================================================
    // EXCEL EXPORT (unified)
    // ==========================================================================
    const generateWorkbook = (planNo, planDataObj) => {
        const data = planDataObj?.data;
        const summary = planDataObj?.summary;
        const cpCols = planDataObj?.childPartCols || [];
        if (!data) return null;

        const wb = XLSX.utils.book_new();

        // --- Sheet 1: Main Plan (unified columns) ---
        const mainRows = [];
        mainRows.push(['PLAN DATE', new Date().toLocaleDateString()]);
        mainRows.push(['PLAN NO', planNo]);
        mainRows.push(['IPO NO', summary['IPO-NO'] || '']);
        mainRows.push(['TOTAL AREA', summary.AREA?.toFixed(2) || '0']);
        mainRows.push(['TOTAL QTY', summary.QTY || '0']);
        mainRows.push(['UNIQUE ITEMS', data.length]);
        mainRows.push([]);

        const baseHeaders = ['PLAN NO', 'IPO NO', 'HEIGHT', 'ITEM', 'WIDTH', 'DRAWING NO', 'TOTAL QTY', 'TOTAL AREA'];

        const hasFic = data.some(r => r.type === 'FICTURE');
        const hasLs = data.some(r => r.type === 'LS');
        const hasCh = data.some(r => r.type === 'CH');

        const ficHeaders = hasFic ? [
            'RIGHT L-SEC NAME', 'RIGHT CUT LEN', 'RIGHT L-WIDTH', 'RIGHT QTY/PC', 'RIGHT TOTAL QTY',
            'LEFT L-SEC NAME', 'LEFT CUT LEN', 'LEFT STOCK W', 'LEFT CUT W', 'LEFT QTY/PC', 'LEFT TOTAL QTY',
        ] : [];
        const lsHeaders = hasLs ? [
            'L-SEC NAME', 'L-SEC CUT LEN', 'L-SEC STOCK W', 'L-SEC CUT W', 'L-SEC QTY/PC', 'L-SEC TOTAL QTY',
            'MAIN FRAME NAME', 'MAIN FRAME CUT LEN', 'MAIN FRAME QTY',
        ] : [];
        const chHeaders = hasCh ? [
            'CH NAME', 'CH CUT LEN', 'CH STOCK W', 'CH CUT W', 'CH QTY/PC', 'CH TOTAL QTY',
        ] : [];
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
                ficPart = [
                    row.rightLName, row.rightLCuttingLength, row.rightLWidth, row.rightLQtyPerPc, row.rightLTotalQty,
                    row.leftLName, row.leftLCuttingLength, row.leftLStockWidth, row.leftCuttingWidth, row.leftLQtyPerPc, row.leftLTotalQty,
                ];
                lsPart = new Array(lsHeaders.length).fill('');
                chPart = new Array(chHeaders.length).fill('');
            } else if (row.type === 'LS') {
                ficPart = new Array(ficHeaders.length).fill('');
                lsPart = [
                    row.lSecName, row.lSecCuttingLength, row.lSecStockWidth, row.cuttingWidth, row.lSecQtyPerPc, row.lSecTotalQty,
                    row.mainFrameName, row.mainFrameCuttingLength, row.mainFrameTotalQty,
                ];
                chPart = new Array(chHeaders.length).fill('');
            } else if (row.type === 'CH') {
                ficPart = new Array(ficHeaders.length).fill('');
                lsPart = new Array(lsHeaders.length).fill('');
                chPart = [
                    row.channelName, row.channelCuttingLength, row.channelStockWidth, row.cuttingWidth, row.channelQtyPerPc, row.channelTotalQty,
                ];
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
            const err = row.calculationError || '';
            mainRows.push([...baseRow, ...ficPart, ...lsPart, ...chPart, ...sidePart, ...stiffPart, ...childPart, err]);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mainRows), 'Main Plan');

        // --- Sheet 2: Totals (summary per component) ---
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

        // --- Sheet 3: RM Requirement ---
        const rmReq = {};
        data.forEach(row => {
            const add = (name, length, qty) => {
                if (!name || !length) return;
                const total = length * qty;
                rmReq[name] = (rmReq[name] || 0) + total;
            };
            if (row.type === 'FICTURE') {
                add(row.rightLName, row.rightLCuttingLength, row.rightLTotalQty);
                add(row.leftLName, row.leftLCuttingLength, row.leftLTotalQty);
            } else if (row.type === 'LS') {
                add(row.lSecName, row.lSecCuttingLength, row.lSecTotalQty);
                add(row.mainFrameName, row.mainFrameCuttingLength, row.mainFrameTotalQty);
            } else if (row.type === 'CH') {
                add(row.channelName, row.channelCuttingLength, row.channelTotalQty);
            }
            add(row.sideFrameName, row.sideFrameCuttingSize, row.sideFrameTotalQty);
            add(row.uStiffWithLipName, row.uStiffWithLipCuttingSize, row.uStiffWithLipTotalQty);
            add(row.uStiffWithoutLipName, row.uStiffWithoutLipCuttingSize, row.uStiffWithoutLipTotalQty);
            add(row.iStiffName, row.iStiffCuttingSize, row.iStiffTotalQty);
            add(row.rkName, row.rkLength, row.rkTotalQty);
            (row.childParts || []).forEach(cp => add(cp.rmName, cp.cuttingSize, cp.totalQty));
        });
        const rmRows = [
            ['RM REQUIREMENT'], ['PLAN:', planNo], [],
            ['SERIAL NO', 'RM NAME', 'TOTAL LENGTH (MM)', 'QTY (4800MM BARS)']
        ];
        let sn = 1;
        Object.entries(rmReq).forEach(([name, total]) => {
            rmRows.push([sn++, name, total.toFixed(2), Math.ceil(total / 4800)]);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rmRows), 'RM Requirement');

        // --- Sheet 4: Stickers ---
        const stickerRows = [['CUTTING STICKERS'], ['PLAN:', planNo], [], ['STICKER', 'PANEL DIMENSIONS', 'DETAILS']];
        data.forEach(row => {
            const stickerBase = `${row.ipoNo}-${row.planNo}`;
            const dims = `${row.height}${row.item}${row.width}{}`;
            for (let i = 1; i <= row.qty; i++) {
                if (row.type === 'FICTURE') {
                    stickerRows.push([stickerBase, dims, `(R)${row.rightLCuttingLength}x${row.rightLWidth} ${i}OF${row.qty}`]);
                    stickerRows.push([stickerBase, dims, `(L)${row.leftLCuttingLength}x${row.leftCuttingWidth || 0} ${i}OF${row.qty}`]);
                } else if (row.type === 'LS') {
                    stickerRows.push([stickerBase, dims, `L-SEC:${row.lSecCuttingLength}x${row.cuttingWidth} ${i}OF${row.qty}`]);
                    stickerRows.push([stickerBase, dims, `MF:${row.mainFrameCuttingLength} ${i}OF${row.qty}`]);
                } else if (row.type === 'CH') {
                    stickerRows.push([stickerBase, dims, `CH:${row.channelCuttingLength}x${row.cuttingWidth} ${i}OF${row.qty}`]);
                }
                stickerRows.push([stickerBase, dims, `SF:${row.sideFrameCuttingSize} ${i}OF${row.qty}`]);
                if (row.uStiffWithLipTotalQty) stickerRows.push([stickerBase, dims, `U+L:${row.uStiffWithLipCuttingSize} ${i}OF${row.qty}`]);
                if (row.uStiffWithoutLipTotalQty) stickerRows.push([stickerBase, dims, `U-L:${row.uStiffWithoutLipCuttingSize} ${i}OF${row.qty}`]);
                if (row.iStiffTotalQty) stickerRows.push([stickerBase, dims, `I:${row.iStiffCuttingSize} ${i}OF${row.qty}`]);
                if (row.rkTotalQty) stickerRows.push([stickerBase, dims, `RK:${row.rkLength} ${i}OF${row.qty}`]);
            }
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stickerRows), 'Stickers');

        return wb;
    };

    const downloadSinglePlan = async (planNo, pd) => {
        try { const wb = generateWorkbook(planNo, pd); if (wb) XLSX.writeFile(wb, `plan_${planNo}_${new Date().toISOString().split('T')[0]}.xlsx`); }
        catch (e) { console.error(e); alert('Error: ' + e.message); }
    };

    const downloadAllPlans = async () => {
        if (!Object.keys(bulkPlans).length) { alert('No plans. Generate first.'); return; }
        try {
            const zip = new JSZip(), date = new Date().toISOString().split('T')[0];
            Object.entries(bulkPlans).forEach(([pn, pd]) => { const wb = generateWorkbook(pn, pd); if (wb) zip.file(`plan_${pn}_${date}.xlsx`, s2ab(XLSX.write(wb, { type: 'binary', bookType: 'xlsx' }))); });
            saveAs(await zip.generateAsync({ type: 'blob' }), `plans_bulk_${date}.zip`);
        } catch (e) { console.error(e); alert('Error: ' + e.message); }
    };

    // ==========================================================================
    // PDF EXPORT (styled like original CreatePlan)
    // ==========================================================================
    const buildPlanPDF = (planNo, planDataObj) => {
        const data = planDataObj?.data;
        const summary = planDataObj?.summary;
        if (!data) return null;

        const doc = new jsPDF('landscape', 'mm', 'a4');
        let currentPage = 1;
        const ipoNo = data[0]?.ipoNo || 'N/A';

        const addHeader = (title) => {
            doc.setFillColor(255, 255, 255);
            doc.rect(5, 5, 287, 25, 'F');
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(18, 18, 18);
            doc.text(`IPO: ${ipoNo} | Plan: ${planNo} - ${title}`, 8, 13);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(`Area: ${summary?.AREA?.toFixed(2) || '0'} m² | Qty: ${summary?.QTY || '0'}`, 8, 20);
            doc.text(`${new Date().toLocaleDateString()} | Page ${currentPage}`, 284, 20, { align: 'right' });
            doc.setTextColor(0, 0, 0);
        };

        const tableOpts = {
            startY: 22,
            margin: { left: 5, right: 5 },
            theme: 'grid',
            styles: { fontSize: 6, cellPadding: 1, lineColor: [200, 200, 200], lineWidth: 0.1 },
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 7 },
            alternateRowStyles: { fillColor: [248, 249, 250] },
        };

        // ---- Page 1: L‑SEC / CH Details ----
        addHeader('L-SEC / CH Details');
        const hasFic = data.some(r => r.type === 'FICTURE');
        const hasLs = data.some(r => r.type === 'LS');
        const hasCh = data.some(r => r.type === 'CH');

        let mainHead, mainBody;
        if (hasFic) {
            mainHead = [
                [
                    { content: 'PLAN NO', rowSpan: 2 }, { content: 'IPO NO', rowSpan: 2 },
                    { content: 'HEIGHT', rowSpan: 2 }, { content: 'ITEM', rowSpan: 2 },
                    { content: 'WIDTH', rowSpan: 2 }, { content: 'DRAWING NO', rowSpan: 2 },
                    { content: 'TOTAL QTY', rowSpan: 2 }, { content: 'TOTAL AREA', rowSpan: 2 },
                    { content: 'RIGHT L-SEC DETAILS', colSpan: 5 }, { content: 'LEFT L-SEC DETAILS', colSpan: 6 },
                ],
                [
                    'NAME', 'CUT LEN', 'WIDTH', 'QTY/PC', 'TOTAL',
                    'NAME', 'CUT LEN', 'STOCK W', 'CUT W', 'QTY/PC', 'TOTAL',
                ],
            ];
            mainBody = data
                .filter(r => r.type === 'FICTURE')
                .map(r => [
                    r.planNo, r.ipoNo, r.height, r.item, r.width, r.drawingNo, r.qty, r.area.toFixed(2),
                    r.rightLName, r.rightLCuttingLength, r.rightLWidth, r.rightLQtyPerPc, r.rightLTotalQty,
                    r.leftLName, r.leftLCuttingLength, r.leftLStockWidth, r.leftCuttingWidth, r.leftLQtyPerPc, r.leftLTotalQty,
                ]);
        } else if (hasLs) {
            mainHead = [
                [
                    { content: 'PLAN NO', rowSpan: 2 }, { content: 'IPO NO', rowSpan: 2 },
                    { content: 'HEIGHT', rowSpan: 2 }, { content: 'ITEM', rowSpan: 2 },
                    { content: 'WIDTH', rowSpan: 2 }, { content: 'DRAWING NO', rowSpan: 2 },
                    { content: 'TOTAL QTY', rowSpan: 2 }, { content: 'TOTAL AREA', rowSpan: 2 },
                    { content: 'L-SEC DETAILS', colSpan: 6 }, { content: 'MAIN FRAME DETAILS', colSpan: 3 },
                ],
                [
                    'NAME', 'CUT LEN', 'STOCK W', 'CUT W', 'QTY/PC', 'TOTAL',
                    'NAME', 'CUT LEN', 'QTY',
                ],
            ];
            mainBody = data
                .filter(r => r.type === 'LS')
                .map(r => [
                    r.planNo, r.ipoNo, r.height, r.item, r.width, r.drawingNo, r.qty, r.area.toFixed(2),
                    r.lSecName, r.lSecCuttingLength, r.lSecStockWidth, r.cuttingWidth, r.lSecQtyPerPc, r.lSecTotalQty,
                    r.mainFrameName, r.mainFrameCuttingLength, r.mainFrameTotalQty,
                ]);
        } else if (hasCh) {
            mainHead = [
                [
                    { content: 'PLAN NO', rowSpan: 2 }, { content: 'IPO NO', rowSpan: 2 },
                    { content: 'HEIGHT', rowSpan: 2 }, { content: 'ITEM', rowSpan: 2 },
                    { content: 'WIDTH', rowSpan: 2 }, { content: 'DRAWING NO', rowSpan: 2 },
                    { content: 'TOTAL QTY', rowSpan: 2 }, { content: 'TOTAL AREA', rowSpan: 2 },
                    { content: 'CH DETAILS', colSpan: 6 },
                ],
                ['NAME', 'CUT LEN', 'STOCK W', 'CUT W', 'QTY/PC', 'TOTAL'],
            ];
            mainBody = data
                .filter(r => r.type === 'CH')
                .map(r => [
                    r.planNo, r.ipoNo, r.height, r.item, r.width, r.drawingNo, r.qty, r.area.toFixed(2),
                    r.channelName, r.channelCuttingLength, r.channelStockWidth, r.cuttingWidth, r.channelQtyPerPc, r.channelTotalQty,
                ]);
        } else {
            mainHead = [['No data']];
            mainBody = [];
        }

        autoTable(doc, { ...tableOpts, head: mainHead, body: mainBody });

        // ---- Page 2: Side Frame Details ----
        doc.addPage();
        currentPage++;
        addHeader('Side Frame Details');
        autoTable(doc, {
            ...tableOpts,
            head: [[
                { content: 'PLAN NO', rowSpan: 2 }, { content: 'IPO NO', rowSpan: 2 },
                { content: 'HEIGHT', rowSpan: 2 }, { content: 'ITEM', rowSpan: 2 },
                { content: 'WIDTH', rowSpan: 2 }, { content: 'DRAWING NO', rowSpan: 2 },
                { content: 'TOTAL QTY', rowSpan: 2 }, { content: 'TOTAL AREA', rowSpan: 2 },
                { content: 'SIDE FRAME DETAILS', colSpan: 4 },
            ], ['NAME', 'QTY PER PC', 'TOTAL QTY', 'CUTTING SIZE']],
            body: data.map(r => [
                r.planNo, r.ipoNo, r.height, r.item, r.width, r.drawingNo, r.qty, r.area.toFixed(2),
                r.sideFrameName, r.sideFrameQtyPerPc, r.sideFrameTotalQty, r.sideFrameCuttingSize,
            ]),
        });

        // ---- Page 3: Stiffener Details (if any) ----
        const hasUWithLip = data.some(r => r.uStiffWithLipTotalQty);
        const hasUWithoutLip = data.some(r => r.uStiffWithoutLipTotalQty);
        const hasIStiff = data.some(r => r.iStiffTotalQty);
        if (hasUWithLip || hasUWithoutLip || hasIStiff) {
            doc.addPage();
            currentPage++;
            addHeader('Stiffener Details');

            const stiffHeadRows = [[
                { content: 'PLAN NO', rowSpan: 2 }, { content: 'IPO NO', rowSpan: 2 },
                { content: 'HEIGHT', rowSpan: 2 }, { content: 'ITEM', rowSpan: 2 },
                { content: 'WIDTH', rowSpan: 2 }, { content: 'DRAWING NO', rowSpan: 2 },
                { content: 'TOTAL QTY', rowSpan: 2 }, { content: 'TOTAL AREA', rowSpan: 2 },
            ]];
            const stiffSubHeaders = [];
            if (hasUWithLip) {
                stiffHeadRows[0].push({ content: 'U WITH LIP DETAILS', colSpan: 4 });
                stiffSubHeaders.push('NAME', 'PER PIECE QTY', 'TOTAL QTY', 'CUTTING SIZE');
            }
            if (hasUWithoutLip) {
                stiffHeadRows[0].push({ content: 'U WITHOUT LIP DETAILS', colSpan: 4 });
                stiffSubHeaders.push('NAME', 'PER PIECE QTY', 'TOTAL QTY', 'CUTTING SIZE');
            }
            if (hasIStiff) {
                stiffHeadRows[0].push({ content: 'I STIFF DETAILS', colSpan: 4 });
                stiffSubHeaders.push('NAME', 'PER PIECE QTY', 'TOTAL QTY', 'CUTTING SIZE');
            }
            stiffHeadRows.push(stiffSubHeaders);

            const stiffBody = data.map(r => {
                const row = [
                    r.planNo, r.ipoNo, r.height, r.item, r.width, r.drawingNo, r.qty, r.area.toFixed(2),
                ];
                if (hasUWithLip) row.push(r.uStiffWithLipName, r.uStiffWithLipPerPieceQty, r.uStiffWithLipTotalQty, r.uStiffWithLipCuttingSize);
                if (hasUWithoutLip) row.push(r.uStiffWithoutLipName, r.uStiffWithoutLipPerPieceQty, r.uStiffWithoutLipTotalQty, r.uStiffWithoutLipCuttingSize);
                if (hasIStiff) row.push(r.iStiffName, r.iStiffPerPieceQty, r.iStiffTotalQty, r.iStiffCuttingSize);
                return row;
            });

            autoTable(doc, { ...tableOpts, head: stiffHeadRows, body: stiffBody });
        }

        // ---- Page 4: RK Details (if any) ----
        const hasRK = data.some(r => r.rkTotalQty);
        if (hasRK) {
            doc.addPage();
            currentPage++;
            addHeader('RK Details');
            autoTable(doc, {
                ...tableOpts,
                head: [[
                    { content: 'PLAN NO', rowSpan: 2 }, { content: 'IPO NO', rowSpan: 2 },
                    { content: 'HEIGHT', rowSpan: 2 }, { content: 'ITEM', rowSpan: 2 },
                    { content: 'WIDTH', rowSpan: 2 }, { content: 'DRAWING NO', rowSpan: 2 },
                    { content: 'TOTAL QTY', rowSpan: 2 }, { content: 'TOTAL AREA', rowSpan: 2 },
                    { content: 'RK DETAILS', colSpan: 4 },
                ], ['NAME', 'LENGTH', 'PER PIECE QTY', 'TOTAL QTY']],
                body: data
                    .filter(r => r.rkTotalQty)
                    .map(r => [
                        r.planNo, r.ipoNo, r.height, r.item, r.width, r.drawingNo, r.qty, r.area.toFixed(2),
                        r.rkName, r.rkLength, r.rkPerPieceQty, r.rkTotalQty,
                    ]),
            });
        }

        // ---- Page 5: L‑SEC / CH Summary ----
        doc.addPage();
        currentPage++;
        addHeader('L-SEC / CH Summary');
        const lSecMap = new Map();
        data.forEach(row => {
            if (row.type === 'FICTURE') {
                lSecMap.set(`${row.rightLName}|${row.rightLCuttingLength}x${row.rightLWidth}`, (lSecMap.get(`${row.rightLName}|${row.rightLCuttingLength}x${row.rightLWidth}`) || 0) + row.rightLTotalQty);
                lSecMap.set(`${row.leftLName}|${row.leftLCuttingLength}x${row.leftCuttingWidth}`, (lSecMap.get(`${row.leftLName}|${row.leftLCuttingLength}x${row.leftCuttingWidth}`) || 0) + row.leftLTotalQty);
            } else if (row.type === 'LS') {
                lSecMap.set(`${row.lSecName}|${row.lSecCuttingLength}x${row.cuttingWidth}`, (lSecMap.get(`${row.lSecName}|${row.lSecCuttingLength}x${row.cuttingWidth}`) || 0) + row.lSecTotalQty);
            } else if (row.type === 'CH') {
                lSecMap.set(`${row.channelName}|${row.channelCuttingLength}x${row.cuttingWidth}`, (lSecMap.get(`${row.channelName}|${row.channelCuttingLength}x${row.cuttingWidth}`) || 0) + row.channelTotalQty);
            }
        });
        const lSecRows = Array.from(lSecMap.entries()).map(([key, qty]) => {
            const [name, size] = key.split('|');
            return [name, size, qty];
        });
        lSecRows.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
        lSecRows.push(['TOTAL', '', lSecRows.reduce((s, r) => s + r[2], 0)]);
        autoTable(doc, {
            ...tableOpts,
            head: [['Component', 'Cutting Size', 'Total Qty']],
            body: lSecRows,
            styles: { fontSize: 10, cellPadding: 3 },
            headStyles: { fillColor: [52, 152, 219], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 11 },
        });

        // ---- Page 6: Side Frame Summary ----
        doc.addPage();
        currentPage++;
        addHeader('Side Frame Summary');
        const sfMap = new Map();
        data.forEach(row => {
            sfMap.set(`${row.sideFrameName}|${row.sideFrameCuttingSize}mm`, (sfMap.get(`${row.sideFrameName}|${row.sideFrameCuttingSize}mm`) || 0) + row.sideFrameTotalQty);
        });
        const sfRows = Array.from(sfMap.entries()).map(([key, qty]) => {
            const [name, size] = key.split('|');
            return [name, size, qty];
        });
        sfRows.sort((a, b) => a[1].localeCompare(b[1]));
        sfRows.push(['TOTAL', '', sfRows.reduce((s, r) => s + r[2], 0)]);
        autoTable(doc, {
            ...tableOpts,
            head: [['Component', 'Cutting Size', 'Total Qty']],
            body: sfRows,
            styles: { fontSize: 10, cellPadding: 3 },
            headStyles: { fillColor: [39, 174, 96], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 11 },
        });

        // ---- Page 7: Stiffener Summary ----
        const hasAnyStiff = data.some(r => r.uStiffWithLipTotalQty || r.uStiffWithoutLipTotalQty || r.iStiffTotalQty);
        if (hasAnyStiff) {
            doc.addPage();
            currentPage++;
            addHeader('Stiffener Summary');
            const stiffMap = new Map();
            data.forEach(row => {
                if (row.uStiffWithLipTotalQty) stiffMap.set(`U WITH LIP|${row.uStiffWithLipCuttingSize}mm`, (stiffMap.get(`U WITH LIP|${row.uStiffWithLipCuttingSize}mm`) || 0) + row.uStiffWithLipTotalQty);
                if (row.uStiffWithoutLipTotalQty) stiffMap.set(`U WITHOUT LIP|${row.uStiffWithoutLipCuttingSize}mm`, (stiffMap.get(`U WITHOUT LIP|${row.uStiffWithoutLipCuttingSize}mm`) || 0) + row.uStiffWithoutLipTotalQty);
                if (row.iStiffTotalQty) stiffMap.set(`I STIFF|${row.iStiffCuttingSize}mm`, (stiffMap.get(`I STIFF|${row.iStiffCuttingSize}mm`) || 0) + row.iStiffTotalQty);
            });
            const stiffRows = Array.from(stiffMap.entries()).map(([key, qty]) => {
                const [name, size] = key.split('|');
                return [name, size, qty];
            });
            stiffRows.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
            stiffRows.push(['TOTAL', '', stiffRows.reduce((s, r) => s + r[2], 0)]);
            autoTable(doc, {
                ...tableOpts,
                head: [['Stiffener Type', 'Cutting Size', 'Total Qty']],
                body: stiffRows,
                styles: { fontSize: 10, cellPadding: 3 },
                headStyles: { fillColor: [155, 89, 182], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 11 },
            });
        }

        // ---- Page 8: RK Summary ----
        if (hasRK) {
            doc.addPage();
            currentPage++;
            addHeader('RK Summary');
            const rkMap = new Map();
            data.forEach(row => {
                if (row.rkTotalQty) rkMap.set(`${row.rkName}|${row.rkLength}mm`, (rkMap.get(`${row.rkName}|${row.rkLength}mm`) || 0) + row.rkTotalQty);
            });
            const rkRows = Array.from(rkMap.entries()).map(([key, qty]) => {
                const [name, size] = key.split('|');
                return [name, size, qty];
            });
            rkRows.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
            rkRows.push(['TOTAL', '', rkRows.reduce((s, r) => s + r[2], 0)]);
            autoTable(doc, {
                ...tableOpts,
                head: [['RK Name', 'Length', 'Total Qty']],
                body: rkRows,
                styles: { fontSize: 10, cellPadding: 3 },
                headStyles: { fillColor: [231, 76, 60], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 11 },
            });
        }

        // ---- Nesting Pages ----
        const nd = nestingResults[planNo];
        if (nd) nestBuildPages(doc, nd);

        return doc;
    };

    const generatePlanPDF = async (planNo, pd) => {
        try { const d = buildPlanPDF(planNo, pd); if (d) d.save(`plan_${planNo}_${new Date().toISOString().split('T')[0]}.pdf`); }
        catch (e) { console.error(e); alert('Error: ' + e.message); }
    };

    const printPlanPDF = async (planNo, pd) => {
        try { const d = buildPlanPDF(planNo, pd); if (!d) return; const u = URL.createObjectURL(d.output('blob')); const w = window.open(u); if (w) w.onload = () => w.print(); }
        catch (e) { console.error(e); alert('Error: ' + e.message); }
    };

    const downloadAllPlansPDF = async () => {
        if (!Object.keys(bulkPlans).length) { alert('No plans. Generate first.'); return; }
        try { const zip = new JSZip(), date = new Date().toISOString().split('T')[0]; for (const [pn, pd] of Object.entries(bulkPlans)) { const d = buildPlanPDF(pn, pd); if (d) zip.file(`plan_${pn}_${date}.pdf`, d.output('blob')); } saveAs(await zip.generateAsync({ type: 'blob' }), `plans_pdf_${date}.zip`); }
        catch (e) { console.error(e); alert('Error: ' + e.message); }
    };

    const printAllPlansPDF = async () => {
        if (!Object.keys(bulkPlans).length) { alert('No plans. Generate first.'); return; }
        try { const doc = new jsPDF('landscape', 'mm', 'a4'); let first = true; for (const [pn, pd] of Object.entries(bulkPlans)) { const pd2 = buildPlanPDF(pn, pd); if (!pd2) continue; for (let i = 1; i <= pd2.internal.getNumberOfPages(); i++) { if (!first || i > 1) doc.addPage(); doc.internal.addPage(pd2.internal.getPageData(i), pd2.internal.getPageContent(i)); } first = false; } const u = URL.createObjectURL(doc.output('blob')); const w = window.open(u); if (w) w.onload = () => w.print(); }
        catch (e) { console.error(e); alert('Error: ' + e.message); }
    };

    // ==========================================================================
    // UI RENDER
    // ==========================================================================
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
    const getSortIcon = key => sortConfig.key !== key ? <span className="tab-icon alpha-sort-inactive">↓</span> : (sortConfig.direction === 'asc' ? <span className="tab-icon alpha-sort-asc">↑</span> : <span className="tab-icon alpha-sort-desc">↓</span>);
    const isPlanGenerated = items => items.some(i => i.generated_date);
    const getGeneratedBadge = items => isPlanGenerated(items) ? <span className="alpha-generated-badge alpha-generated">Generated</span> : <span className="alpha-generated-badge alpha-not-generated">Not Generated</span>;

    return (
        <div className="planning-system-container">
            <div >
                <div className="planning-system-card">
                    <div className="planning-system-header">
                        <div >
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
                                <div className="plan-setting-group"><label className="plan-setting-label">IPO Number (Multiple)</label><select multiple value={filters.ipoNo} onChange={e => setFilters({ ...filters, ipoNo: Array.from(e.target.selectedOptions, o => o.value) })} className="search-column-select">{ipoOptions.map(i => <option key={i} value={i}>{i}</option>)}</select><small className="validation-error">Hold Ctrl/Cmd to select multiple</small></div>
                                <div className="plan-setting-group"><label className="plan-setting-label">Plan Name (Multiple)</label><select multiple value={filters.planNo} onChange={e => setFilters({ ...filters, planNo: Array.from(e.target.selectedOptions, o => o.value) })} className="search-column-select">{planOptions.map(p => <option key={p} value={p}>{p}</option>)}</select><small className="validation-error">Hold Ctrl/Cmd to select multiple</small></div>
                                <div className="plan-setting-group"><label className="plan-setting-label">Generated Status</label><select value={filters.generatedStatus} onChange={e => setFilters({ ...filters, generatedStatus: e.target.value })} className="search-column-select"><option value="all">All Plans</option><option value="generated">Generated</option><option value="not-generated">Not Generated</option></select></div>
                                <div className="plan-setting-group"><label className="plan-setting-label">Item Name</label><input type="text" value={filters.itemName} onChange={e => setFilters({ ...filters, itemName: e.target.value })} className="search-input" placeholder="Filter by Item..." /></div>
                                <div className="plan-setting-group"><label className="plan-setting-label">Drawing Number</label><input type="text" value={filters.drawingNo} onChange={e => setFilters({ ...filters, drawingNo: e.target.value })} className="search-input" placeholder="Filter by Drawing No..." /></div>
                                <div className="plan-setting-group"><label className="plan-setting-label">Import Date</label><input type="date" value={filters.importDate} onChange={e => setFilters({ ...filters, importDate: e.target.value })} className="search-input" /></div>
                                <div className="plan-setting-group"><label className="plan-setting-label">Import ID</label><input type="text" value={filters.importId} onChange={e => setFilters({ ...filters, importId: e.target.value })} className="search-input" placeholder="Filter by Import ID..." /></div>
                            </div>
                            <div className="actions-container">
                                <button onClick={fetchUnplannedItems} className="primary-button generate-button">Apply Filters</button>
                                <button onClick={() => setFilters({ ipoNo: [], planNo: [], importDate: '', importId: '', itemName: '', drawingNo: '', generatedStatus: 'all', planTypes: ['FICTURE', 'LS', 'CH'], nestingOnly: false })} className="clear-filters-button">Clear Filters</button>
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
                            <div >
                                <h3 className="data-status-title">Bulk Operations</h3>
                                <p className="items-summary">Generate and download multiple plans at once</p>
                            </div>
                            <div className="action-buttons">
                                <div className="nesting-toggle">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={bulkNesting}
                                            onChange={e => setBulkNesting(e.target.checked)}
                                        />
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
                                <button onClick={downloadAllPlansPDF} disabled={!Object.keys(bulkPlans).length} className="generate-button">
                                    <FileText size={16} />
                                    <span>PDF ZIP</span>
                                </button>
                                <button onClick={printAllPlansPDF} disabled={!Object.keys(bulkPlans).length} className="generate-button">
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

                    {loading && <div className="loading-container"><div className="loading-spinner"></div><p className="loading-text">Loading plans...</p></div>}

                    <div className="items-tab-container">
                        {getSortedPlans().map(([planNo, items]) => {
                            const uniqueItems = groupUniqueItems(items);
                            const isGenerated = isPlanGenerated(items);
                            const currentResult = planDetails?.planNo === planNo ? planDetails : (bulkPlans[planNo] || null);
                            const isInBulkPlans = !!(bulkPlans[planNo] || (planDetails?.planNo === planNo));
                            const cpCols = currentResult?.childPartCols || [];

                            return (
                                <div key={planNo} className="items-table-card">
                                    <div className="filters-header">
                                        <div >
                                            <div className="items-table-title">
                                                <h3 >
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
                                                {items[0]?.ipo_no && (
                                                    <span className="meta-item">IPO: {items[0].ipo_no}</span>
                                                )}
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
                                            <button onClick={() => generatePlanPDF(planNo, bulkPlans[planNo])} disabled={!isInBulkPlans} className="alpha-btn-outline">
                                                <FileText size={14} />
                                                PDF
                                            </button>
                                            <button onClick={() => printPlanPDF(planNo, bulkPlans[planNo])} disabled={!isInBulkPlans} className="alpha-btn-outline">
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