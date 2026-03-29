// PlanPdf.jsx
// All PDF generation logic — exported as named functions only (no default export).
// Import into CreatePlan.jsx:
//   import { generatePlanPDF, printPlanPDF, downloadAllPlansPDF, printAllPlansPDF } from './PlanPdf';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// ============================================================================
// CONSTANTS
// ============================================================================
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

// ============================================================================
// NESTING PDF HELPERS
// ============================================================================

const nestComputeRmReq = (ndArray) => {
    const map = new Map();
    ndArray.forEach(nd => nd.layouts.forEach(l => {
        const key = `${l.rmStockName}|${l.rmStockWidth}|${l.rmStockHeight}`;
        if (!map.has(key)) map.set(key, { rmName: l.rmStockName, width: l.rmStockWidth, height: l.rmStockHeight, qty: 0 });
        map.get(key).qty += (l.layoutQty || 1);
    }));
    return [...map.values()]
        .map(r => ({ ...r, totalLength: (r.height * r.qty) / 1000 }))
        .sort((a, b) => a.rmName.localeCompare(b.rmName) || a.width - b.width);
};

const nestDrawRmTable = (doc, reqs, title, startY = 30, PW = 297, PH = 210, M = 6) => {
    const rH = 7;
    const cW = [60, 25, 25, 30, 40];
    const hdr = ['RM Name', 'Width (mm)', 'Height (mm)', 'Qty (bars)', 'Total (m)'];
    let y = startY;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 31, 46);
    doc.text(title, PW / 2, y, { align: 'center' });
    y += 7;

    let x = M;
    doc.setFillColor(26, 31, 46);
    doc.rect(M, y, PW - 2 * M, rH, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    hdr.forEach((h, i) => {
        doc.text(h, x + cW[i] / 2, y + rH - 2, { align: 'center' });
        x += cW[i];
    });
    y += rH;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    reqs.forEach((r, idx) => {
        if (y + rH > PH - M) { doc.addPage(); y = M; }
        if (idx % 2 === 0) { doc.setFillColor(248, 249, 250); doc.rect(M, y, PW - 2 * M, rH, 'F'); }
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.1);
        doc.rect(M, y, PW - 2 * M, rH, 'S');
        x = M;
        [r.rmName, r.width.toFixed(0), r.height.toFixed(0), r.qty, r.totalLength.toFixed(2)].forEach((v, i) => {
            doc.text(String(v), x + cW[i] / 2, y + rH - 2, { align: 'center' });
            x += cW[i];
        });
        y += rH;
    });
    return y + 5;
};

const nestPdfLabel = (doc, px, py, pw, ph, num, dim, fc, sc) => {
    const spw = Number(pw) || 0, sph = Number(ph) || 0;
    const nb = Math.min(sph * 0.42, spw * 0.28, 5.5);
    if (nb > 1.2) {
        doc.setFillColor(sc[0], sc[1], sc[2]);
        doc.rect(px, py, nb, nb, 'F');
        doc.setFontSize(Math.max(3, nb * 0.62));
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(num, px + nb / 2, py + nb * 0.72, { align: 'center' });
    }
    const MN = 3, MX = 5.5, CW = 0.55;
    const fsH = Math.min(MX, Math.max(MN, Math.min(spw / (dim.length * CW), sph * 0.32)));
    const fitH = dim.length * CW * fsH <= spw - 1.5 && sph >= fsH + 1.5;
    const fsV = Math.min(MX, Math.max(MN, Math.min(sph / (dim.length * CW), spw * 0.32)));
    const fitV = dim.length * CW * fsV <= sph - 1.5 && spw >= fsV + 1.5;
    const cx = px + spw / 2, cy = py + sph / 2;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 15, 15);
    if (fitH) {
        doc.setFontSize(fsH);
        doc.text(dim, cx, cy + fsH * 0.38, { align: 'center' });
    } else if (fitV) {
        doc.setFontSize(fsV);
        doc.text(dim, cx, cy + fsV * 0.38, { align: 'center', angle: 90 });
    } else {
        doc.setFontSize(MN);
        doc.text(dim, cx, cy + MN * 0.38, { align: 'center' });
    }
};

const nestPdfCell = (doc, layout, cX, cY, cW, cH, total) => {
    const N = (v, fb = 0) => { const x = Number(v); return isFinite(x) ? x : fb; };
    const sL = N(layout.rmStockHeight, 4820);
    const sW = N(layout.rmStockWidth, 300);
    const qty = N(layout.layoutQty, 1);
    const HH = 5.5, PT = 1, DB = 5, UH = 4;
    const baX = cX + 8, baY = cY + HH + PT, baW = cW - 10, baH = cH - HH - PT - DB - UH;
    const sc = Math.min(baW / sL, baH / sW);
    const bW = sL * sc, bH = baH, bX = baX + (baW - bW) / 2, bY = baY;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.15);
    doc.rect(cX, cY, cW, cH, 'S');

    doc.setFillColor(26, 31, 46);
    doc.rect(cX, cY, cW, HH, 'F');
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(
        `Layout ${N(layout.layoutNumber)}/${total}  ·  RM:${layout.rmStockName || 'L-SEC'}  ·  ${sL}×${sW}mm  ·  Qty:${qty}`,
        cX + cW / 2, cY + HH - 1.2, { align: 'center' }
    );

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(26, 31, 46);
    doc.setLineWidth(0.5);
    doc.rect(bX, bY, bW, bH, 'FD');

    doc.saveGraphicsState();
    layout.pieces.forEach((piece, idx) => {
        const pxS = bX + N(piece.y) * sc;
        const pw = Math.min(N(piece.cutLength) * sc, bX + bW - pxS);
        const ph = bH;
        if (pw < 0.1 || ph < 0.1 || pxS >= bX + bW || pxS < bX) return;
        const ci = idx % NEST_PDF_FILLS.length;
        const fc = NEST_PDF_FILLS[ci];
        const sc2 = NEST_PDF_STROKES[ci];
        doc.setFillColor(fc[0], fc[1], fc[2]);
        doc.setDrawColor(sc2[0], sc2[1], sc2[2]);
        doc.setLineWidth(0.25);
        doc.rect(pxS, bY, pw, ph, 'FD');
        nestPdfLabel(
            doc, pxS, bY, pw, ph,
            String(idx + 1),
            piece.type === 'LEFT' && piece.leftCuttingWidth
                ? `${Math.round(N(piece.cutLength))}×${Math.round(N(piece.leftCuttingWidth))}(L)`
                : `${Math.round(N(piece.cutLength))}×${Math.round(N(piece.rmStockWidth))}`,
            fc, sc2
        );
    });
    doc.restoreGraphicsState();

    const used = N(layout.usedHeight, 0);
    if (used > 0 && used < sL) {
        const wx = bX + used * sc, ww = (sL - used) * sc;
        if (ww > 0.3) {
            doc.setFillColor(210, 210, 210);
            doc.setDrawColor(150, 150, 150);
            doc.setLineWidth(0.15);
            doc.rect(wx, bY, ww, bH, 'FD');
            if (ww > 4) {
                doc.setFontSize(4);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(100, 100, 100);
                doc.text(`WASTE ${Math.round(sL - used)}mm`, wx + ww / 2, bY + bH / 2, { align: 'center' });
            }
        }
    }

    doc.setFontSize(4.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(
        `Util:${N(layout.utilization)}%  ·  Used:${Math.round(used)}mm  ·  Waste:${Math.round(N(layout.wasteHeight))}mm  ·  Sheets:${qty}`,
        cX + cW / 2, cY + cH - 0.8, { align: 'center' }
    );
};

const nestBuildPages = (doc, nd) => {
    if (!nd?.layouts?.length) return;
    const PW = 297, PH = 210, M = 6, FH = 7, BH = 22, CH = 14, CG = 2, CEG = 2, PTH = 6, LPP = 6;
    const cellH = ((PH - 2 * M - FH - PTH) - CEG * (LPP - 1)) / LPP;
    const cellW = PW - 2 * M;

    doc.addPage('a4', 'landscape');
    let sy = M;

    // Banner
    doc.setFillColor(26, 31, 46);
    doc.rect(0, sy, PW, BH, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('L-SEC NESTING LAYOUTS', PW / 2, sy + 8, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`Plan: ${nd.planNo}   IPO: ${nd.ipoNo}   ${nd.date}  ${nd.time}`, PW / 2, sy + 15, { align: 'center' });

    // Summary cards
    const cY2 = sy + BH + 1;
    const cW2 = (cellW - 6) / 4;
    [
        { v: nd.layouts.length, l: 'Unique Layouts' },
        { v: nd.totalSheets, l: 'Total Sheets' },
        { v: `${nd.utilization}%`, l: 'Utilization' },
        { v: nd.piecesGenerated, l: 'Piece Types' },
    ].forEach((c, i) => {
        const cx = M + i * (cW2 + 2);
        doc.setFillColor(235, 245, 255);
        doc.roundedRect(cx, cY2, cW2, CH, 1, 1, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(26, 31, 46);
        doc.text(String(c.v), cx + cW2 / 2, cY2 + 7, { align: 'center' });
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(90, 90, 90);
        doc.text(c.l, cx + cW2 / 2, cY2 + 12, { align: 'center' });
    });

    let curY = cY2 + CH + CG;
    nd.layouts.forEach(layout => {
        if (curY + cellH > PH - M - FH) {
            doc.addPage('a4', 'landscape');
            doc.setFillColor(26, 31, 46);
            doc.rect(0, M, PW, PTH, 'F');
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text(`${nd.planNo}  —  continued`, PW / 2, M + PTH - 1.5, { align: 'center' });
            curY = M + PTH + CEG;
        }
        nestPdfCell(doc, layout, M, curY, cellW, cellH, nd.layouts.length);
        curY += cellH + CEG;
    });

    // RM Requirement page
    const req = nestComputeRmReq([nd]);
    if (req.length) {
        doc.addPage('a4', 'landscape');
        doc.setFillColor(26, 31, 46);
        doc.rect(0, 0, PW, 14, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(`RM Requirement  —  ${nd.planNo}  (${nd.ipoNo})`, PW / 2, 9, { align: 'center' });
        nestDrawRmTable(doc, req, `Material Requirement  —  Plan: ${nd.planNo}`, 22, PW, PH, M);
    }
};

// ============================================================================
// CORE PDF BUILDER
// ============================================================================

/**
 * buildPlanPDF
 * @param {string} planNo
 * @param {object} planDataObj  — { data, summary, childPartCols }
 * @param {object} nestingResults — keyed by planNo, value is nesting data from /api/generate-nesting
 * @returns {jsPDF|null}
 */
export const buildPlanPDF = (planNo, planDataObj, nestingResults = {}) => {
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

    const hasFic = data.some(r => r.type === 'FICTURE');
    const hasLs = data.some(r => r.type === 'LS');
    const hasCh = data.some(r => r.type === 'CH');

    // ── Page 1: L-SEC / CH Details ────────────────────────────────────────────
    addHeader('L-SEC / CH Details');

    let mainHead, mainBody;
    if (hasFic) {
        mainHead = [
            [
                { content: 'PLAN NO', rowSpan: 2 }, { content: 'IPO NO', rowSpan: 2 },
                { content: 'HEIGHT', rowSpan: 2 }, { content: 'ITEM', rowSpan: 2 },
                { content: 'WIDTH', rowSpan: 2 }, { content: 'DRAWING NO', rowSpan: 2 },
                { content: 'TOTAL QTY', rowSpan: 2 }, { content: 'TOTAL AREA', rowSpan: 2 },
                { content: 'RIGHT L-SEC DETAILS', colSpan: 5 },
                { content: 'LEFT L-SEC DETAILS', colSpan: 6 },
            ],
            ['NAME', 'CUT LEN', 'WIDTH', 'QTY/PC', 'TOTAL', 'NAME', 'CUT LEN', 'STOCK W', 'CUT W', 'QTY/PC', 'TOTAL'],
        ];
        mainBody = data.filter(r => r.type === 'FICTURE').map(r => [
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
                { content: 'L-SEC DETAILS', colSpan: 6 },
                { content: 'MAIN FRAME DETAILS', colSpan: 3 },
            ],
            ['NAME', 'CUT LEN', 'STOCK W', 'CUT W', 'QTY/PC', 'TOTAL', 'NAME', 'CUT LEN', 'QTY'],
        ];
        mainBody = data.filter(r => r.type === 'LS').map(r => [
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
        mainBody = data.filter(r => r.type === 'CH').map(r => [
            r.planNo, r.ipoNo, r.height, r.item, r.width, r.drawingNo, r.qty, r.area.toFixed(2),
            r.channelName, r.channelCuttingLength, r.channelStockWidth, r.cuttingWidth, r.channelQtyPerPc, r.channelTotalQty,
        ]);
    } else {
        mainHead = [['No data']];
        mainBody = [];
    }

    autoTable(doc, { ...tableOpts, head: mainHead, body: mainBody });

    // ── Page 2: Side Frame Details ────────────────────────────────────────────
    doc.addPage(); currentPage++;
    addHeader('Side Frame Details');
    autoTable(doc, {
        ...tableOpts,
        head: [
            [
                { content: 'PLAN NO', rowSpan: 2 }, { content: 'IPO NO', rowSpan: 2 },
                { content: 'HEIGHT', rowSpan: 2 }, { content: 'ITEM', rowSpan: 2 },
                { content: 'WIDTH', rowSpan: 2 }, { content: 'DRAWING NO', rowSpan: 2 },
                { content: 'TOTAL QTY', rowSpan: 2 }, { content: 'TOTAL AREA', rowSpan: 2 },
                { content: 'SIDE FRAME DETAILS', colSpan: 4 },
            ],
            ['NAME', 'QTY PER PC', 'TOTAL QTY', 'CUTTING SIZE'],
        ],
        body: data.map(r => [
            r.planNo, r.ipoNo, r.height, r.item, r.width, r.drawingNo, r.qty, r.area.toFixed(2),
            r.sideFrameName, r.sideFrameQtyPerPc, r.sideFrameTotalQty, r.sideFrameCuttingSize,
        ]),
    });

    // ── Page 3: Stiffener Details (only if any stiffeners exist) ─────────────
    const hasUWithLip = data.some(r => r.uStiffWithLipTotalQty);
    const hasUWithoutLip = data.some(r => r.uStiffWithoutLipTotalQty);
    const hasIStiff = data.some(r => r.iStiffTotalQty);
    if (hasUWithLip || hasUWithoutLip || hasIStiff) {
        doc.addPage(); currentPage++;
        addHeader('Stiffener Details');

        const stiffHeadRows = [[
            { content: 'PLAN NO', rowSpan: 2 }, { content: 'IPO NO', rowSpan: 2 },
            { content: 'HEIGHT', rowSpan: 2 }, { content: 'ITEM', rowSpan: 2 },
            { content: 'WIDTH', rowSpan: 2 }, { content: 'DRAWING NO', rowSpan: 2 },
            { content: 'TOTAL QTY', rowSpan: 2 }, { content: 'TOTAL AREA', rowSpan: 2 },
        ]];
        const stiffSubHeaders = [];
        if (hasUWithLip) { stiffHeadRows[0].push({ content: 'U WITH LIP DETAILS', colSpan: 4 }); stiffSubHeaders.push('NAME', 'PER PIECE QTY', 'TOTAL QTY', 'CUTTING SIZE'); }
        if (hasUWithoutLip) { stiffHeadRows[0].push({ content: 'U WITHOUT LIP DETAILS', colSpan: 4 }); stiffSubHeaders.push('NAME', 'PER PIECE QTY', 'TOTAL QTY', 'CUTTING SIZE'); }
        if (hasIStiff) { stiffHeadRows[0].push({ content: 'I STIFF DETAILS', colSpan: 4 }); stiffSubHeaders.push('NAME', 'PER PIECE QTY', 'TOTAL QTY', 'CUTTING SIZE'); }
        stiffHeadRows.push(stiffSubHeaders);

        const stiffBody = data.map(r => {
            const row = [r.planNo, r.ipoNo, r.height, r.item, r.width, r.drawingNo, r.qty, r.area.toFixed(2)];
            if (hasUWithLip) row.push(r.uStiffWithLipName, r.uStiffWithLipPerPieceQty, r.uStiffWithLipTotalQty, r.uStiffWithLipCuttingSize);
            if (hasUWithoutLip) row.push(r.uStiffWithoutLipName, r.uStiffWithoutLipPerPieceQty, r.uStiffWithoutLipTotalQty, r.uStiffWithoutLipCuttingSize);
            if (hasIStiff) row.push(r.iStiffName, r.iStiffPerPieceQty, r.iStiffTotalQty, r.iStiffCuttingSize);
            return row;
        });
        autoTable(doc, { ...tableOpts, head: stiffHeadRows, body: stiffBody });
    }

    // ── Page 4: RK Details (only if any RK items exist) ──────────────────────
    const hasRK = data.some(r => r.rkTotalQty);
    if (hasRK) {
        doc.addPage(); currentPage++;
        addHeader('RK Details');
        autoTable(doc, {
            ...tableOpts,
            head: [
                [
                    { content: 'PLAN NO', rowSpan: 2 }, { content: 'IPO NO', rowSpan: 2 },
                    { content: 'HEIGHT', rowSpan: 2 }, { content: 'ITEM', rowSpan: 2 },
                    { content: 'WIDTH', rowSpan: 2 }, { content: 'DRAWING NO', rowSpan: 2 },
                    { content: 'TOTAL QTY', rowSpan: 2 }, { content: 'TOTAL AREA', rowSpan: 2 },
                    { content: 'RK DETAILS', colSpan: 4 },
                ],
                ['NAME', 'LENGTH', 'PER PIECE QTY', 'TOTAL QTY'],
            ],
            body: data.filter(r => r.rkTotalQty).map(r => [
                r.planNo, r.ipoNo, r.height, r.item, r.width, r.drawingNo, r.qty, r.area.toFixed(2),
                r.rkName, r.rkLength, r.rkPerPieceQty, r.rkTotalQty,
            ]),
        });
    }

    // ── Page 5: L-SEC / CH Summary ────────────────────────────────────────────
    doc.addPage(); currentPage++;
    addHeader('L-SEC / CH Summary');
    const lSecMap = new Map();
    data.forEach(row => {
        if (row.type === 'FICTURE') {
            const rk1 = `${row.rightLName}|${row.rightLCuttingLength}x${row.rightLWidth}`;
            const rk2 = `${row.leftLName}|${row.leftLCuttingLength}x${row.leftCuttingWidth}`;
            lSecMap.set(rk1, (lSecMap.get(rk1) || 0) + row.rightLTotalQty);
            lSecMap.set(rk2, (lSecMap.get(rk2) || 0) + row.leftLTotalQty);
        } else if (row.type === 'LS') {
            const rk = `${row.lSecName}|${row.lSecCuttingLength}x${row.cuttingWidth}`;
            lSecMap.set(rk, (lSecMap.get(rk) || 0) + row.lSecTotalQty);
        } else if (row.type === 'CH') {
            const rk = `${row.channelName}|${row.channelCuttingLength}x${row.cuttingWidth}`;
            lSecMap.set(rk, (lSecMap.get(rk) || 0) + row.channelTotalQty);
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

    // ── Page 6: Side Frame Summary ────────────────────────────────────────────
    doc.addPage(); currentPage++;
    addHeader('Side Frame Summary');
    const sfMap = new Map();
    data.forEach(row => {
        const k = `${row.sideFrameName}|${row.sideFrameCuttingSize}mm`;
        sfMap.set(k, (sfMap.get(k) || 0) + row.sideFrameTotalQty);
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

    // ── Page 7: Stiffener Summary ─────────────────────────────────────────────
    const hasAnyStiff = data.some(r => r.uStiffWithLipTotalQty || r.uStiffWithoutLipTotalQty || r.iStiffTotalQty);
    if (hasAnyStiff) {
        doc.addPage(); currentPage++;
        addHeader('Stiffener Summary');
        const stiffMap = new Map();
        data.forEach(row => {
            if (row.uStiffWithLipTotalQty) { const k = `U WITH LIP|${row.uStiffWithLipCuttingSize}mm`; stiffMap.set(k, (stiffMap.get(k) || 0) + row.uStiffWithLipTotalQty); }
            if (row.uStiffWithoutLipTotalQty) { const k = `U WITHOUT LIP|${row.uStiffWithoutLipCuttingSize}mm`; stiffMap.set(k, (stiffMap.get(k) || 0) + row.uStiffWithoutLipTotalQty); }
            if (row.iStiffTotalQty) { const k = `I STIFF|${row.iStiffCuttingSize}mm`; stiffMap.set(k, (stiffMap.get(k) || 0) + row.iStiffTotalQty); }
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

    // ── Page 8: RK Summary ───────────────────────────────────────────────────
    if (hasRK) {
        doc.addPage(); currentPage++;
        addHeader('RK Summary');
        const rkMap = new Map();
        data.forEach(row => {
            if (row.rkTotalQty) {
                const k = `${row.rkName}|${row.rkLength}mm`;
                rkMap.set(k, (rkMap.get(k) || 0) + row.rkTotalQty);
            }
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

    // ── Nesting pages (from nestingResults passed in — not React state) ───────
    const nd = nestingResults[planNo];
    if (nd) nestBuildPages(doc, nd);

    return doc;
};

// ============================================================================
// EXPORTED PDF ACTIONS
// ============================================================================

/**
 * Download a single plan as PDF.
 * @param {string} planNo
 * @param {object} pd          — plan data object { data, summary, childPartCols }
 * @param {object} nestingResults — { [planNo]: nestingData }
 */
export const generatePlanPDF = async (planNo, pd, nestingResults = {}) => {
    try {
        const d = buildPlanPDF(planNo, pd, nestingResults);
        if (d) d.save(`plan_${planNo}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) {
        console.error('[generatePlanPDF]', e);
        alert('Error generating PDF: ' + e.message);
    }
};

/**
 * Open print dialog for a single plan PDF.
 * @param {string} planNo
 * @param {object} pd
 * @param {object} nestingResults
 */
export const printPlanPDF = async (planNo, pd, nestingResults = {}) => {
    try {
        const d = buildPlanPDF(planNo, pd, nestingResults);
        if (!d) return;
        const u = URL.createObjectURL(d.output('blob'));
        const w = window.open(u);
        if (w) w.onload = () => w.print();
    } catch (e) {
        console.error('[printPlanPDF]', e);
        alert('Error printing PDF: ' + e.message);
    }
};

/**
 * Download all generated plans as a ZIP of PDFs.
 * @param {object} bulkPlans     — { [planNo]: planDataObj }
 * @param {object} nestingResults — { [planNo]: nestingData }
 */
export const downloadAllPlansPDF = async (bulkPlans, nestingResults = {}) => {
    if (!Object.keys(bulkPlans).length) { alert('No plans. Generate first.'); return; }
    try {
        const zip = new JSZip();
        const date = new Date().toISOString().split('T')[0];
        for (const [pn, pd] of Object.entries(bulkPlans)) {
            const d = buildPlanPDF(pn, pd, nestingResults);
            if (d) zip.file(`plan_${pn}_${date}.pdf`, d.output('blob'));
        }
        saveAs(await zip.generateAsync({ type: 'blob' }), `plans_pdf_${date}.zip`);
    } catch (e) {
        console.error('[downloadAllPlansPDF]', e);
        alert('Error creating PDF ZIP: ' + e.message);
    }
};

/**
 * Merge all generated plans into one PDF and open print dialog.
 * @param {object} bulkPlans
 * @param {object} nestingResults
 */
export const printAllPlansPDF = async (bulkPlans, nestingResults = {}) => {
    if (!Object.keys(bulkPlans).length) { alert('No plans. Generate first.'); return; }
    try {
        const doc = new jsPDF('landscape', 'mm', 'a4');
        let first = true;
        for (const [pn, pd] of Object.entries(bulkPlans)) {
            const pd2 = buildPlanPDF(pn, pd, nestingResults);
            if (!pd2) continue;
            for (let i = 1; i <= pd2.internal.getNumberOfPages(); i++) {
                if (!first || i > 1) doc.addPage();
                doc.internal.addPage(pd2.internal.getPageData(i), pd2.internal.getPageContent(i));
            }
            first = false;
        }
        const u = URL.createObjectURL(doc.output('blob'));
        const w = window.open(u);
        if (w) w.onload = () => w.print();
    } catch (e) {
        console.error('[printAllPlansPDF]', e);
        alert('Error printing all PDFs: ' + e.message);
    }
};