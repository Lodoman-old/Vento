import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

pdfMake.vfs = pdfFonts.vfs;

const NAVY = "#0F172A";
const GOLD = "#D4A853";
const MUTED = "#94A3B8";
const SLATE = "#334155";

const tabs = [
  { id: "events", label: "Eventos" },
  { id: "clients", label: "Clientes" },
  { id: "suppliers", label: "Proveedores" },
  { id: "catalog", label: "Catálogo con fotos" },
  { id: "financial", label: "Financiero" },
];

const fm = (n) => `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmDate = (d) => d ? new Date(d).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" }) : "—";
const statusLabel = (s) => s === "completado" ? "Completado" : s === "activo" ? "Activo" : "Borrador";
const statusInfo = (s) => s === "completado"
  ? { label: "Completado", cls: "bg-green-100 text-green-700" }
  : s === "activo" ? { label: "Activo", cls: "bg-blue-100 text-blue-700" }
  : { label: "Borrador", cls: "bg-amber-100 text-amber-700" };

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function exportExcel(filename, headers, rows) {
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const thead = `<tr>${headers.map((h) => `<th style="background:#0F172A;color:#D4A853">${esc(h)}</th>`).join("")}</tr>`;
  const tbody = rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("");
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table border="1">${thead}${tbody}</table></body></html>`;
  downloadBlob(new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8" }), filename);
}

function exportTablePdf({ title, subtitle, headers, rows, widths, footer }) {
  const body = [
    headers.map((h, i) => ({ text: h, style: "th", alignment: i === 0 ? "left" : "right" })),
    ...rows.map((r) => r.map((c, i) => ({ text: c, alignment: i === 0 ? "left" : "right", style: "td" }))),
  ];
  if (footer) body.push(footer.map((c, i) => ({ text: c, alignment: "right", style: "total" })));
  const docDef = {
    pageSize: "A4",
    pageMargins: [36, 40, 36, 40],
    content: [
      { table: { widths: ["*"], body: [[{ text: "VENTO", alignment: "center", color: GOLD, fontSize: 26, bold: true, margin: [0, 16, 0, 4] }]] }, layout: { fillColor: () => NAVY, hLineWidth: () => 0, vLineWidth: () => 0 } },
      { text: title, alignment: "center", fontSize: 14, bold: true, color: NAVY, margin: [0, 10, 0, 2] },
      { text: subtitle, alignment: "center", fontSize: 9, color: MUTED, margin: [0, 0, 0, 12] },
      { table: { headerRows: 1, widths, body }, layout: {
        hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => "#E2E8F0", vLineColor: () => "#E2E8F0",
        fillColor: (i) => (i === 0 ? NAVY : i % 2 === 0 ? "#F8FAFC" : null),
        paddingTop: () => 6, paddingBottom: () => 6, paddingLeft: () => 8, paddingRight: () => 8,
      }},
      { text: `Generado por Vento — ${new Date().toLocaleString("es-MX")}`, fontSize: 8, color: MUTED, margin: [0, 16, 0, 0] },
    ],
    styles: { th: { bold: true, fontSize: 9, color: GOLD }, td: { fontSize: 9, color: SLATE }, total: { bold: true, fontSize: 10, color: NAVY } },
    defaultStyle: { font: "Roboto" },
  };
  pdfMake.createPdf(docDef).download(`${title.replace(/\s+/g, "_")}.pdf`);
}

function imageToDataUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d").drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function ReportsPage() {
  const [tab, setTab] = useState("events");
  const [events, setEvents] = useState([]);
  const [clients, setClients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [categories, setCategories] = useState([]);
  const [supplierCategories, setSupplierCategories] = useState([]);
  const [financial, setFinancial] = useState(null);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(null);
  const [start, setStart] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [catFilter, setCatFilter] = useState("");
  const printRef = useRef();

  useEffect(() => {
    api.get("/reports/categories").then(setCategories).catch(() => {});
    api.get("/reports/supplier-categories").then(setSupplierCategories).catch(() => {});
    api.get("/settings").then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === "events") {
      setLoading(true);
      api.get(`/reports/events?start=${start}&end=${end}`).then(setEvents).catch(() => {}).finally(() => setLoading(false));
    } else if (tab === "clients") {
      setLoading(true);
      api.get("/reports/clients").then(setClients).catch(() => {}).finally(() => setLoading(false));
    } else if (tab === "suppliers") {
      setLoading(true);
      api.get(`/reports/suppliers${catFilter ? `?category=${catFilter}` : ""}`).then(setSuppliers).catch(() => {}).finally(() => setLoading(false));
    } else if (tab === "catalog") {
      setLoading(true);
      api.get(`/reports/catalog${catFilter ? `?category=${catFilter}` : ""}`).then(setCatalog).catch(() => {}).finally(() => setLoading(false));
    } else if (tab === "financial") {
      setLoading(true);
      api.get(`/reports/financial?start=${start}&end=${end}`).then(setFinancial).catch(() => {}).finally(() => setLoading(false));
    }
  }, [tab, start, end, catFilter]);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>Reporte Vento</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 11px; }
        th { background: #0F172A; color: #D4A853; }
        h2 { color: #0F172A; margin-top: 20px; }
        h2::before { content: "⬥ "; color: #D4A853; }
        .badge { padding: 2px 6px; border-radius: 10px; font-size: 10px; }
        .badge-green { background: #dcfce7; color: #166534; }
        .badge-yellow { background: #fef9c3; color: #854d0e; }
        .badge-blue { background: #dbeafe; color: #1e40af; }
        img { max-width: 80px; max-height: 80px; object-fit: cover; border-radius: 4px; }
        tfoot td { border-top: 2px solid #D4A853; font-weight: bold; }
        .no-print { display: none !important; }
        .overflow-x-auto { border: none !important; box-shadow: none !important; }
        .hidden-print { display: none !important; }
        @media print { body { padding: 0; } }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const periodLabel = `del ${fmDate(start)} al ${fmDate(end)}`;

  function exportEventsPdf() {
    exportTablePdf({
      title: "Eventos",
      subtitle: periodLabel,
      headers: ["Evento", "Fecha", "Estatus", "Cotizado", "Pagado", "Pendiente", "Staff", "Prov."],
      widths: ["*", 90, 70, 70, 70, 70, 40, 50],
      rows: events.map((e) => [
        e.name,
        fmDate(e.date),
        statusLabel(e.status),
        fm(e.quoted_total),
        fm(e.paid_total),
        Number(e.pending_total) > 0 ? fm(e.pending_total) : "—",
        String(e.staff_count),
        String(e.supplier_count),
      ]),
      footer: ["", "", "Totales", fm(events.reduce((s, e) => s + Number(e.quoted_total || 0), 0)), fm(events.reduce((s, e) => s + Number(e.paid_total || 0), 0)), fm(events.reduce((s, e) => s + Number(e.pending_total || 0), 0)), "", ""],
    });
  }

  function exportEventsExcel() {
    exportExcel(`Eventos_${start}_${end}.xls`, ["Evento", "Fecha", "Estatus", "Cotizado", "Pagado", "Pendiente", "Staff", "Proveedores"],
      [...events.map((e) => [e.name, fmDate(e.date), statusLabel(e.status), fm(e.quoted_total), fm(e.paid_total), Number(e.pending_total) > 0 ? fm(e.pending_total) : "—", e.staff_count, e.supplier_count]),
      ["Totales", "", "", fm(events.reduce((s, e) => s + Number(e.quoted_total || 0), 0)), fm(events.reduce((s, e) => s + Number(e.paid_total || 0), 0)), fm(events.reduce((s, e) => s + Number(e.pending_total || 0), 0)), "", ""]]);
  }

  function exportClientsPdf() {
    exportTablePdf({
      title: "Clientes",
      subtitle: "Clientes registrados",
      headers: ["Nombre", "Email", "Teléfono", "Eventos", "Total gastado", "Pagado"],
      widths: ["*", "*", 90, 55, 70, 70],
      rows: clients.map((c) => [c.display_name, c.email || "—", c.phone || "—", String(c.event_count), fm(c.total_spent), fm(c.total_paid)]),
      footer: ["", "", "Totales", String(clients.reduce((s, c) => s + Number(c.event_count || 0), 0)), fm(clients.reduce((s, c) => s + Number(c.total_spent || 0), 0)), fm(clients.reduce((s, c) => s + Number(c.total_paid || 0), 0))],
    });
  }

  function exportClientsExcel() {
    exportExcel("Clientes.xls", ["Nombre", "Email", "Teléfono", "Eventos", "Total gastado", "Pagado"],
      [...clients.map((c) => [c.display_name, c.email || "—", c.phone || "—", c.event_count, fm(c.total_spent), fm(c.total_paid)]),
      ["Totales", "", "", clients.reduce((s, c) => s + Number(c.event_count || 0), 0), fm(clients.reduce((s, c) => s + Number(c.total_spent || 0), 0)), fm(clients.reduce((s, c) => s + Number(c.total_paid || 0), 0))]]);
  }

  function exportSuppliersPdf() {
    exportTablePdf({
      title: "Proveedores",
      subtitle: catFilter ? `Categoría: ${catFilter}` : "Todos los proveedores",
      headers: ["Nombre", "Categoría", "Contacto", "Teléfono", "Eventos", "Presupuestado", "Pagado"],
      widths: ["*", "*", "*", 90, 55, 70, 70],
      rows: suppliers.map((s) => [s.name, s.category, s.contact_name || "—", s.phone || "—", String(s.event_count), fm(s.total_budgeted), fm(s.total_paid)]),
    });
  }

  function exportSuppliersExcel() {
    exportExcel("Proveedores.xls", ["Nombre", "Categoría", "Contacto", "Teléfono", "Eventos", "Presupuestado", "Pagado"],
      suppliers.map((s) => [s.name, s.category, s.contact_name || "—", s.phone || "—", s.event_count, fm(s.total_budgeted), fm(s.total_paid)]));
  }

  function exportFinancialPdf() {
    const body = [
      ["Método", { text: "Pagos", style: "th", alignment: "right" }, { text: "Total", style: "th", alignment: "right" }],
      ...(financial?.by_method || []).map((m) => [m.method, { text: String(m.count), alignment: "right", style: "td" }, { text: fm(m.total), alignment: "right", style: "td" }]),
      [{ text: "TOTAL RECIBIDO", colSpan: 2, style: "total" }, {}, { text: fm(financial?.total_received || 0), alignment: "right", style: "total" }],
    ];
    pdfMake.createPdf({
      pageSize: "A4",
      pageMargins: [36, 40, 36, 40],
      content: [
        { table: { widths: ["*"], body: [[{ text: "VENTO", alignment: "center", color: GOLD, fontSize: 26, bold: true, margin: [0, 16, 0, 4] }]] }, layout: { fillColor: () => NAVY, hLineWidth: () => 0, vLineWidth: () => 0 } },
        { text: "Resumen financiero", alignment: "center", fontSize: 14, bold: true, color: NAVY, margin: [0, 10, 0, 2] },
        { text: periodLabel, alignment: "center", fontSize: 9, color: MUTED, margin: [0, 0, 0, 12] },
        { columns: [
          { table: { widths: ["*"], body: [[{ text: "PAGOS RECIBIDOS", alignment: "center", color: GOLD, bold: true, fontSize: 9 }], [{ text: String(financial?.payment_count || 0), alignment: "center", color: "#FFFFFF", bold: true, fontSize: 20 }]] }, layout: { fillColor: () => NAVY, hLineWidth: () => 0, vLineWidth: () => 0, paddingTop: () => 10, paddingBottom: () => 10 } },
          { table: { widths: ["*"], body: [[{ text: "TOTAL RECIBIDO", alignment: "center", color: GOLD, bold: true, fontSize: 9 }], [{ text: fm(financial?.total_received || 0), alignment: "center", color: "#FFFFFF", bold: true, fontSize: 20 }]] }, layout: { fillColor: () => NAVY, hLineWidth: () => 0, vLineWidth: () => 0, paddingTop: () => 10, paddingBottom: () => 10 } },
        ], columnGap: 10, margin: [0, 0, 0, 14] },
        { table: { widths: ["*", 60, 100], body, layout: {
          hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => "#E2E8F0", vLineColor: () => "#E2E8F0",
          fillColor: (i) => (i === 0 ? NAVY : i % 2 === 0 ? "#F8FAFC" : null),
          paddingTop: () => 6, paddingBottom: () => 6, paddingLeft: () => 8, paddingRight: () => 8,
        }}},
        { text: `Generado por Vento — ${new Date().toLocaleString("es-MX")}`, fontSize: 8, color: MUTED, margin: [0, 16, 0, 0] },
      ],
      styles: { th: { bold: true, fontSize: 9, color: GOLD }, td: { fontSize: 9, color: SLATE }, total: { bold: true, fontSize: 10, color: NAVY } },
      defaultStyle: { font: "Roboto" },
    }).download("Resumen_Financiero.pdf");
  }

  function exportFinancialExcel() {
    const rows = (financial?.by_method || []).map((m) => [m.method, m.count, fm(m.total)]);
    rows.push(["TOTAL RECIBIDO", financial?.payment_count || 0, fm(financial?.total_received || 0)]);
    exportExcel(`Resumen_Financiero_${start}_${end}.xls`, ["Método", "Pagos", "Total"], rows);
  }

  async function exportCatalogPdf() {
    if (!catalog.length) return;
    const company = settings?.company_name || "VENTO";

    let logoData = null;
    if (settings?.logo_url) {
      try { logoData = await imageToDataUrl(settings.logo_url); } catch { logoData = null; }
    }

    const grouped = {};
    catalog.forEach((i) => { const k = i.category || "Otros"; (grouped[k] = grouped[k] || []).push(i); });
    const cats = Object.keys(grouped).sort();

    const content = [
      { table: { widths: ["*"], body: [[
        {
          stack: [
            ...(logoData ? [{ image: logoData, fit: [140, 64], alignment: "center", margin: [0, 22, 0, 4] }] : []),
            { text: company, alignment: "center", color: GOLD, fontSize: logoData ? 18 : 30, bold: true, characterSpacing: 2, margin: [0, logoData ? 0 : 22, 0, 2] },
            { text: "Catálogo de productos", alignment: "center", color: "#CBD5E1", fontSize: 10, margin: [0, 0, 0, 20] },
          ],
        },
      ]]}, layout: { fillColor: () => NAVY, hLineWidth: () => 0, vLineWidth: () => 0 } },
      { canvas: [
        { type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: GOLD },
        { type: "line", x1: 0, y1: 4, x2: 515, y2: 4, lineWidth: 0.6, lineColor: GOLD },
      ], margin: [0, 4, 0, 4] },
    ];

    for (const cat of cats) {
      content.push({ text: cat.toUpperCase(), fontSize: 13, bold: true, color: NAVY, characterSpacing: 1, margin: [0, 14, 0, 2] });
      content.push({ canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: GOLD, dash: { length: 4, space: 3 } }], margin: [0, 0, 0, 6] });

      const rows = [];
      for (const item of grouped[cat]) {
        let imgCell = { stack: [{ text: "VENTO", alignment: "center", color: GOLD, bold: true, fontSize: 16, margin: [0, 30, 0, 4] }] };
        if (item.image_url) {
          try {
            const dataUrl = await imageToDataUrl(item.image_url);
            imgCell = { image: dataUrl, fit: [80, 80], alignment: "center" };
          } catch {}
        }
        rows.push([
          { table: { widths: ["*"], body: [[imgCell]] }, layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => "#F5F1E4" } },
          {
            stack: [
              {
                columns: [
                  { text: item.name, bold: true, fontSize: 11, color: NAVY, width: "auto" },
                  { canvas: [{ type: "line", x1: 0, y1: 6, x2: 60, y2: 6, lineWidth: 1, lineColor: GOLD, dash: { length: 2, space: 2 } }], width: "*", margin: [4, 0, 4, 0] },
                  { text: fm(item.unit_price), color: GOLD, bold: true, fontSize: 12, width: "auto" },
                ],
                columnGap: 4,
              },
              ...(item.description ? [{ text: item.description, fontSize: 8.5, color: "#7C7358", italics: true, margin: [0, 2, 0, 0] }] : []),
              ...(item.stock_available != null ? [{ text: `Stock: ${item.stock_available}`, fontSize: 7.5, color: MUTED, margin: [0, 3, 0, 0] }] : []),
            ],
          },
        ]);
      }
      content.push({ table: { widths: [92, "*"], body: rows }, layout: {
        hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0 : 0.5), vLineWidth: () => 0, hLineColor: () => "#E8E0CC",
        paddingTop: () => 5, paddingBottom: () => 5, paddingLeft: () => 4, paddingRight: () => 6,
      }});
    }

    content.push({ text: `${company} — Eventos en perfecta sincronía`, alignment: "center", color: MUTED, fontSize: 8, margin: [0, 18, 0, 0] });

    pdfMake.createPdf({
      pageSize: "A4",
      pageMargins: [36, 36, 36, 40],
      content,
      background: (page, pageSize) => ({
        canvas: [
          { type: "rect", x: 0, y: 0, w: pageSize.width, h: pageSize.height, color: "#FDFBF4" },
          { type: "rect", x: 26, y: 26, w: pageSize.width - 52, h: pageSize.height - 52, lineColor: GOLD, lineWidth: 1.2 },
        ],
      }),
      defaultStyle: { font: "Roboto" },
    }).download("Catalogo_Vento.pdf");
  }

  function exportCatalogExcel() {
    exportExcel("Catalogo.xls", ["Nombre", "Categoría", "Descripción", "Precio", "Stock"],
      catalog.map((i) => [i.name, i.category, i.description || "", fm(i.unit_price), i.stock_available != null ? i.stock_available : ""]));
  }

  const handleExportPdf = () => {
    if (tab === "events") exportEventsPdf();
    else if (tab === "clients") exportClientsPdf();
    else if (tab === "suppliers") exportSuppliersPdf();
    else if (tab === "catalog") exportCatalogPdf();
    else if (tab === "financial") exportFinancialPdf();
  };

  const handleExportExcel = () => {
    if (tab === "events") exportEventsExcel();
    else if (tab === "clients") exportClientsExcel();
    else if (tab === "suppliers") exportSuppliersExcel();
    else if (tab === "catalog") exportCatalogExcel();
    else if (tab === "financial") exportFinancialExcel();
  };

  const thCls = "text-left px-4 py-3 font-medium text-xs uppercase tracking-wide";
  const tdCls = "px-4 py-3";

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <h1 className="text-2xl font-bold">Reportes</h1>
        <div className="flex gap-2 flex-wrap no-print">
          <button onClick={handleExportExcel}
            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition">
            Exportar Excel
          </button>
          <button onClick={handleExportPdf}
            className="px-3 py-1.5 bg-vento-navy text-amber-400 rounded-lg text-sm font-medium hover:bg-slate-800 transition">
            {tab === "catalog" ? "PDF menú" : "Exportar PDF"}
          </button>
          <button onClick={handlePrint}
            className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition">
            Imprimir
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-4 border-b border-slate-200 overflow-x-auto whitespace-nowrap">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition shrink-0 ${
              tab === t.id ? "border-amber-500 text-amber-700" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-slate-400">Cargando...</p>}

      <div ref={printRef}>
        {tab === "events" && (
          <div>
            <div className="flex gap-2 items-center mb-4 no-print">
              <label className="text-xs text-slate-500">Del:</label>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded text-sm" />
              <label className="text-xs text-slate-500">Al:</label>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded text-sm" />
            </div>
            <h2 className="text-lg font-bold mb-3 text-vento-navy"><span className="text-amber-500 mr-2">⬥</span>Eventos {periodLabel}</h2>
            {events.length === 0 && <p className="text-sm text-slate-400">Sin eventos en este periodo</p>}
            <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500">
                    <th className={thCls}>Evento</th>
                    <th className={thCls}>Fecha</th>
                    <th className={thCls}>Estatus</th>
                    <th className={`${thCls} text-right`}>Cotizado</th>
                    <th className={`${thCls} text-right`}>Pagado</th>
                    <th className={`${thCls} text-right`}>Pendiente</th>
                    <th className={`${thCls} text-center`}>Staff</th>
                    <th className={`${thCls} text-center`}>Prov.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {events.map((e) => {
                    const pending = Number(e.pending_total || 0);
                    const st = statusInfo(e.status);
                    return (
                      <tr key={e.id} className="hover:bg-slate-50/50">
                        <td className={`${tdCls} font-medium`}>{e.name}</td>
                        <td className={`${tdCls} text-slate-500`}>{fmDate(e.date)}</td>
                        <td className={tdCls}><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span></td>
                        <td className={`${tdCls} text-right`}>{fm(e.quoted_total)}</td>
                        <td className={`${tdCls} text-right`}>{fm(e.paid_total)}</td>
                        <td className={`${tdCls} text-right ${pending > 0 ? "font-medium" : "text-slate-300"}`}>{pending > 0 ? fm(pending) : "—"}</td>
                        <td className={`${tdCls} text-center`}>{e.staff_count}</td>
                        <td className={`${tdCls} text-center`}>{e.supplier_count}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {events.length > 0 && (
                  <tfoot>
                    <tr className="font-bold bg-slate-50 border-t-2 border-t-slate-200">
                      <td className={`${tdCls} uppercase text-xs text-slate-500`} colSpan={3}>Totales</td>
                      <td className={`${tdCls} text-right`}>{fm(events.reduce((s, e) => s + Number(e.quoted_total || 0), 0))}</td>
                      <td className={`${tdCls} text-right`}>{fm(events.reduce((s, e) => s + Number(e.paid_total || 0), 0))}</td>
                      <td className={`${tdCls} text-right`}>{fm(events.reduce((s, e) => s + Number(e.pending_total || 0), 0))}</td>
                      <td className={tdCls} colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {tab === "clients" && (
          <div>
            <h2 className="text-lg font-bold mb-3 text-vento-navy"><span className="text-amber-500 mr-2">⬥</span>Clientes</h2>
            {clients.length === 0 && <p className="text-sm text-slate-400">Sin clientes registrados</p>}
            <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500">
                    <th className={thCls}>Nombre</th>
                    <th className={thCls}>Email</th>
                    <th className={thCls}>Teléfono</th>
                    <th className={`${thCls} text-center`}>Eventos</th>
                    <th className={`${thCls} text-right`}>Total gastado</th>
                    <th className={`${thCls} text-right`}>Pagado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clients.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50">
                      <td className={`${tdCls} font-medium`}>{c.display_name}</td>
                      <td className={`${tdCls} text-slate-500`}>{c.email || "—"}</td>
                      <td className={`${tdCls} text-slate-500`}>{c.phone || "—"}</td>
                      <td className={`${tdCls} text-center`}>{c.event_count}</td>
                      <td className={`${tdCls} text-right`}>{fm(c.total_spent)}</td>
                      <td className={`${tdCls} text-right`}>{fm(c.total_paid)}</td>
                    </tr>
                  ))}
                </tbody>
                {clients.length > 0 && (
                  <tfoot>
                    <tr className="font-bold bg-slate-50 border-t-2 border-t-slate-200">
                      <td className={`${tdCls} uppercase text-xs text-slate-500`} colSpan={3}>Totales</td>
                      <td className={`${tdCls} text-center`}>{clients.reduce((s, c) => s + Number(c.event_count || 0), 0)}</td>
                      <td className={`${tdCls} text-right`}>{fm(clients.reduce((s, c) => s + Number(c.total_spent || 0), 0))}</td>
                      <td className={`${tdCls} text-right`}>{fm(clients.reduce((s, c) => s + Number(c.total_paid || 0), 0))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {tab === "suppliers" && (
          <div>
            <div className="flex gap-2 items-center mb-4 flex-wrap no-print">
              <span className="text-xs text-slate-500">Categoría:</span>
              {["", ...supplierCategories].map((c) => (
                <button key={c} onClick={() => setCatFilter(c)}
                  className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                    catFilter === c ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-500"
                  }`}>
                  {c || "Todas"}
                </button>
              ))}
            </div>
            <h2 className="text-lg font-bold mb-3 text-vento-navy"><span className="text-amber-500 mr-2">⬥</span>Proveedores</h2>
            {suppliers.length === 0 && <p className="text-sm text-slate-400">Sin proveedores</p>}
            <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500">
                    <th className={thCls}>Nombre</th>
                    <th className={thCls}>Categoría</th>
                    <th className={thCls}>Contacto</th>
                    <th className={thCls}>Teléfono</th>
                    <th className={`${thCls} text-center`}>Eventos</th>
                    <th className={`${thCls} text-right`}>Presupuestado</th>
                    <th className={`${thCls} text-right`}>Pagado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50">
                      <td className={`${tdCls} font-medium`}>{s.name}</td>
                      <td className={tdCls}><span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize font-medium">{s.category}</span></td>
                      <td className={`${tdCls} text-slate-500`}>{s.contact_name || "—"}</td>
                      <td className={`${tdCls} text-slate-500`}>{s.phone || "—"}</td>
                      <td className={`${tdCls} text-center`}>{s.event_count}</td>
                      <td className={`${tdCls} text-right`}>{fm(s.total_budgeted)}</td>
                      <td className={`${tdCls} text-right`}>{fm(s.total_paid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "catalog" && (
          <div>
            <p className="text-xs text-slate-500 mb-3">Catálogo para imprimir — el cliente puede marcar sus selecciones</p>
            <div className="flex gap-1 mb-4 flex-wrap no-print">
              {["", ...categories].map((c) => (
                <button key={c} onClick={() => setCatFilter(c)}
                  className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                    catFilter === c ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-500"
                  }`}>
                  {c || "Todas"}
                </button>
              ))}
            </div>
            {catalog.length === 0 && <p className="text-sm text-slate-400">Sin items en esta categoría</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {catalog.map((item) => (
                <div key={item.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-36 object-cover" />
                  ) : (
                    <div className="w-full h-36 bg-slate-100 flex items-center justify-center text-slate-300 text-2xl font-bold">[Sin foto]</div>
                  )}
                  <div className="p-3">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{item.category}</p>
                    <p className="text-amber-600 font-bold text-sm mt-1">{fm(item.unit_price)}</p>
                    {item.stock_available != null && (
                      <p className="text-[10px] text-slate-400">Stock: {item.stock_available}</p>
                    )}
                    <div className="mt-1 flex items-center gap-1">
                      <input type="checkbox" className="accent-amber-500" />
                      <span className="text-[10px] text-slate-400">Seleccionar</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "financial" && (
          <div>
            <div className="flex gap-2 items-center mb-4 no-print">
              <label className="text-xs text-slate-500">Del:</label>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded text-sm" />
              <label className="text-xs text-slate-500">Al:</label>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded text-sm" />
            </div>
            <h2 className="text-lg font-bold mb-3 text-vento-navy"><span className="text-amber-500 mr-2">⬥</span>Resumen financiero {periodLabel}</h2>
            {!financial && <p className="text-sm text-slate-400">Cargando...</p>}
            {financial && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-xs text-slate-400">Pagos recibidos</p>
                    <p className="text-2xl font-bold text-vento-navy">{financial.payment_count}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-xs text-slate-400">Total recibido</p>
                    <p className="text-2xl font-bold text-vento-navy">{fm(financial.total_received)}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-xs text-slate-400">Cotizaciones con pago</p>
                    <p className="text-2xl font-bold text-vento-navy">{financial.quotes_with_payment}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-xs text-slate-400">Total cotizado</p>
                    <p className="text-2xl font-bold text-vento-navy">{fm(financial.total_quoted)}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold mb-2 text-vento-navy">Por método de pago</h3>
                  <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500">
                          <th className={thCls}>Método</th>
                          <th className={`${thCls} text-right`}>Pagos</th>
                          <th className={`${thCls} text-right`}>Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {financial.by_method?.map((m) => (
                          <tr key={m.method} className="hover:bg-slate-50/50">
                            <td className={`${tdCls} capitalize font-medium`}>{m.method}</td>
                            <td className={`${tdCls} text-right`}>{m.count}</td>
                            <td className={`${tdCls} text-right font-medium`}>{fm(m.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="font-bold bg-slate-50 border-t-2 border-t-slate-200">
                          <td className={`${tdCls} uppercase text-xs text-slate-500`}>Total recibido</td>
                          <td className={`${tdCls} text-right`}>{financial.payment_count}</td>
                          <td className={`${tdCls} text-right`}>{fm(financial.total_received)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
