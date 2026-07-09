import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../components/Toast";
import ConfirmModal from "../components/ConfirmModal";
import { fmtDate } from "../lib/format";

export default function QuotesPage() {
  const { id: eventId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [quotes, setQuotes] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingQuote, setEditingQuote] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [form, setForm] = useState({ client_name: "", client_phone: "", selectedItems: [] });
  const [supplierTotalPreview, setSupplierTotalPreview] = useState(0);
  const [expandedQuote, setExpandedQuote] = useState(null);
  const [generatingPdf, setGeneratingPdf] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    api.get(`/quotes?event_id=${eventId}`).then(setQuotes).catch(console.error);
    api.get("/catalog").then(setCatalog).catch(console.error);
  }, [eventId]);

  useEffect(() => {
    if (showForm || editingQuote) {
      api.get(`/event-suppliers?event_id=${eventId}`).then((sups) => {
        const total = sups.reduce((s, sup) => s + Number(sup.budget_amount || 0), 0);
        setSupplierTotalPreview(total);
      }).catch(() => setSupplierTotalPreview(0));
    }
  }, [showForm, editingQuote, eventId]);

  const categories = useMemo(() => {
    const cats = new Set(catalog.map((i) => i.category));
    return ["", ...cats];
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      if (catFilter && item.category !== catFilter) return false;
      if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [catalog, searchTerm, catFilter]);

  function addItem(catalogItem) {
    setForm((prev) => {
      const idx = prev.selectedItems.findIndex((i) => i.item_name === catalogItem.name);
      if (idx >= 0) {
        const items = prev.selectedItems.map((i, n) =>
          n === idx ? { ...i, quantity: (Number(i.quantity) || 0) + 1 } : i
        );
        return { ...prev, selectedItems: items };
      }
      return {
        ...prev,
        selectedItems: [
          ...prev.selectedItems,
          { item_name: catalogItem.name, unit_price: Number(catalogItem.unit_price), quantity: 1 },
        ],
      };
    });
  }

  function updateItem(index, field, value) {
    setForm((prev) => {
      const items = prev.selectedItems.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      );
      return { ...prev, selectedItems: items };
    });
  }

  function removeItem(index) {
    setForm({ ...form, selectedItems: form.selectedItems.filter((_, i) => i !== index) });
  }

  const total = form.selectedItems.reduce((sum, i) => sum + (Number(i.quantity) || 0) * i.unit_price, 0);

  function normalizeItems(items) {
    return items.map((it) => ({
      ...it,
      quantity: Number(it.quantity) || 1,
    }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      if (editingQuote) {
        await api.put(`/quotes/${editingQuote.id}`, {
          client_name: form.client_name,
          client_phone: form.client_phone,
          items: normalizeItems(form.selectedItems),
        });
        toast("Cotización actualizada");
      } else {
        await api.post("/quotes", {
          event_id: eventId,
          client_name: form.client_name,
          client_phone: form.client_phone,
          items: normalizeItems(form.selectedItems),
        });
        toast("Cotización creada");
      }
      setShowForm(false);
      setEditingQuote(null);
      setForm({ client_name: "", client_phone: "", selectedItems: [] });
      setSupplierTotalPreview(0);
      setQuotes(await api.get(`/quotes?event_id=${eventId}`));
    } catch (err) { toast(err.message, "error"); }
  }

  async function startEdit(quote) {
    const full = await api.get(`/quotes/${quote.id}`);
    setForm({
      clientName: full.client_name || "",
      clientPhone: full.client_phone || "",
      selectedItems: (full.items || [])
        .filter((i) => !i.is_supplier_cost)
        .map((i) => ({
          item_name: i.item_name,
          unit_price: Number(i.unit_price),
          quantity: i.quantity,
        })),
    });
    setEditingQuote(full);
    setShowForm(true);
  }

  async function handleDelete(quoteId) {
    try {
      await api.delete(`/quotes/${quoteId}`);
      setDeleteConfirm(null);
      toast("Cotización eliminada");
      setQuotes(await api.get(`/quotes?event_id=${eventId}`));
    } catch (err) { toast(err.message, "error"); }
  }

  async function updateStatus(quoteId, status) {
    try {
      await api.patch(`/quotes/${quoteId}/status`, { status });
      toast(`Cotización marcada como ${status}`);
      setQuotes(await api.get(`/quotes?event_id=${eventId}`));
    } catch (err) { toast(err.message, "error"); }
  }

  async function generatePdf(quote) {
    setGeneratingPdf(quote.id);
    try {
      const [full, company] = await Promise.all([
        api.get(`/quotes/${quote.id}`),
        api.get("/settings"),
      ]);

      let event = null;
      let agenda = [];
      try {
        [event, agenda] = await Promise.all([
          api.get(`/events/${full.event_id}`),
          api.get(`/agenda?event_id=${full.event_id}`),
        ]);
      } catch {}

      const { default: pdfMake } = await import("pdfmake/build/pdfmake");
      const { default: pdfFonts } = await import("pdfmake/build/vfs_fonts");
      pdfMake.vfs = pdfFonts.vfs;

      let logoImage = null;
      if (company?.logo_url) {
        try {
          const resp = await fetch(company.logo_url);
          const blob = await resp.blob();
          const reader = new FileReader();
          const customLogo = await new Promise((resolve) => {
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          logoImage = customLogo;
        } catch {}
      }

      if (!logoImage) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" fill="none">
          <defs>
            <linearGradient id="lg" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#1E3A5F"/>
              <stop offset="100%" stop-color="#0F172A"/>
            </linearGradient>
            <linearGradient id="lr" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#67E8F9"/>
              <stop offset="100%" stop-color="#22D3EE"/>
            </linearGradient>
          </defs>
          <path d="M60 130 L180 410" stroke="url(#lg)" stroke-width="22" stroke-linecap="round"/>
          <path d="M340 130 L220 410" stroke="url(#lr)" stroke-width="22" stroke-linecap="round"/>
          <circle cx="340" cy="130" r="22" fill="#22D3EE"/>
          <circle cx="340" cy="130" r="7" fill="#FFFFFF"/>
        </svg>`;
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 80;
          canvas.height = 100;
          const ctx = canvas.getContext("2d");
          const img = new Image();
          logoImage = await new Promise((resolve) => {
            img.onload = () => {
              ctx.drawImage(img, 0, 0, 80, 100);
              resolve(canvas.toDataURL("image/png"));
            };
            img.onerror = () => resolve(null);
            img.src = `data:image/svg+xml;base64,${btoa(svg)}`;
          });
        } catch {
          logoImage = null;
        }
      }

      const fm = (n) => `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      const body = [
        [
          { text: "Item", style: "tableHeader" },
          { text: "Cant.", style: "tableHeader", alignment: "center" },
          { text: "P/Unit", style: "tableHeader", alignment: "right" },
          { text: "Subtotal", style: "tableHeader", alignment: "right" },
        ],
        ...full.items.map((i) => [
          i.item_name,
          { text: i.quantity.toString(), alignment: "center" },
          { text: fm(i.unit_price), alignment: "right" },
          { text: fm(i.subtotal), alignment: "right" },
        ]),
        [
          { text: "Total", colSpan: 3, alignment: "right", bold: true, fontSize: 12, color: "#0F172A" },
          {},
          {},
          { text: fm(full.total), bold: true, alignment: "right", fontSize: 12, color: "#0F172A" },
        ],
      ];

      const docDefinition = {
        pageSize: "A4",
        pageMargins: [40, 50, 40, 50],
        content: [
          {
            columns: [
              {
                width: 80,
                stack: [
                  logoImage ? { image: logoImage, width: 40, alignment: "center", margin: [0, 0, 0, 2] } : { text: "V", fontSize: 32, bold: true, color: "#0F172A", alignment: "center", margin: [0, 0, 0, -6] },
                  { text: "VENTO", fontSize: 9, bold: true, color: "#94A3B8", alignment: "center", letterSpacing: 3 },
                ],
              },
              [
                { text: company?.company_name || "VENTO", fontSize: 16, bold: true, color: "#0F172A", margin: [0, 4, 0, 0] },
                company?.address ? { text: company.address, fontSize: 9, color: "#64748B", margin: [0, 2, 0, 0] } : null,
                {
                  text: [
                    company?.phone ? `Tel: ${company.phone}` : "",
                    company?.email ? `${company?.phone ? "  |  " : ""}Email: ${company.email}` : "",
                  ].filter(Boolean).join(""),
                  fontSize: 8, color: "#94A3B8", margin: [0, 2, 0, 0],
                },
                company?.tax_id ? { text: `RFC: ${company.tax_id}`, fontSize: 8, color: "#94A3B8" } : null,
              ].filter(Boolean),
              { text: `Cotización #${full.id.slice(0, 8).toUpperCase()}`, alignment: "right", color: "#64748B", fontSize: 10, margin: [0, 6, 0, 0] },
            ],
          },
          { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: "#E2E8F0" }], margin: [0, 14, 0, 14] },
          { text: "COTIZACIÓN", fontSize: 24, bold: true, color: "#0F172A" },
          { text: `Cliente: ${full.client_name || "—"}`, fontSize: 10, margin: [0, 10, 0, 2], color: "#334155" },
          { text: `Cotización: ${new Date(full.created_at).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })}`, fontSize: 10, margin: [0, 0, 0, 2], color: "#64748B" },
          event ? { text: `Evento: ${event.date ? new Date(event.date).toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) + (event.date.includes("T") ? ` ${new Date(event.date).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}` : "") : ""}${event.venue ? ` — ${event.venue}` : ""}`, fontSize: 10, margin: [0, 0, 0, 14], color: "#64748B" } : { text: `Fecha: ${new Date(full.created_at).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })}`, fontSize: 10, margin: [0, 0, 0, 14], color: "#64748B" },
          { table: { headerRows: 1, widths: ["*", 50, 85, 90], body }, layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => "#E2E8F0",
            paddingLeft: () => 8,
            paddingRight: () => 8,
            paddingTop: () => 6,
            paddingBottom: () => 6,
            fillColor: (i) => i === 0 ? "#0F172A" : (i % 2 === 0 ? "#F8FAFC" : null),
          }},
          agenda.length > 0 ? { text: "AGENDA DEL EVENTO", fontSize: 12, bold: true, color: "#0F172A", margin: [0, 20, 0, 8] } : null,
          agenda.length > 0 ? {
            table: {
              headerRows: 1,
              widths: [55, "*", 70],
              body: [
                [
                  { text: "Hora", style: "tableHeader" },
                  { text: "Actividad", style: "tableHeader" },
                  { text: "Encargado", style: "tableHeader", alignment: "center" },
                ],
                ...agenda.map((a) => [
                  { text: a.start_time ? new Date(a.start_time).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) + (a.end_time ? ` - ${new Date(a.end_time).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}` : "") : "—", alignment: "center", fontSize: 8 },
                  { text: a.title + (a.description ? `: ${a.description}` : ""), fontSize: 8 },
                  { text: a.assigned_name || "—", alignment: "center", fontSize: 8 },
                ]),
              ],
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0,
              hLineColor: () => "#E2E8F0",
              paddingLeft: () => 6,
              paddingRight: () => 6,
              paddingTop: () => 4,
              paddingBottom: () => 4,
              fillColor: (i) => i === 0 ? "#0F172A" : (i % 2 === 0 ? "#F8FAFC" : null),
            },
          } : null,
          company?.quote_footer ? { text: `\n${company.quote_footer}`, fontSize: 9, color: "#94A3B8", margin: [0, 20, 0, 0] } : null,
          full.client_phone ? { text: `Tel. cliente: ${full.client_phone}`, fontSize: 9, color: "#94A3B8", margin: [0, 12, 0, 0] } : null,
        ].filter(Boolean),
        styles: {
          title: { fontSize: 22, bold: true, color: "#0F172A" },
          tableHeader: { bold: true, fontSize: 9, color: "#FFFFFF", fillColor: "#0F172A", margin: [4, 4] },
        },
        defaultStyle: { fontSize: 9, color: "#334155", font: "Roboto" },
      };

      pdfMake.createPdf(docDefinition).download(`Cotizacion_${full.client_name || "sin_cliente"}.pdf`);
    } catch (err) {
      console.error("PDF error:", err);
    } finally {
      setGeneratingPdf(null);
    }
  }

  async function shareWhatsApp(quote) {
    try {
      const full = await api.get(`/quotes/${quote.id}`);
      const items = (full.items || []).filter((i) => !i.is_supplier_cost);
      const fm = (n) => `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      let detail = items.map((i) =>
        `${i.item_name} x${i.quantity} = ${fm(i.subtotal)}`
      ).join("\n");

      const supTotal = (full.items || []).filter((i) => i.is_supplier_cost).reduce((s, i) => s + Number(i.subtotal), 0);
      if (supTotal > 0) detail += `\n\nCostos de proveedores: ${fm(supTotal)}`;

      const origin = window.location.origin;

      // Fetch/create client access credentials
      let portalMsg = `\n\nPortal: ${origin}/portal`;
      try {
        const existing = await api.get(`/events/${full.event_id}/client-access`);
        if (existing?.username) {
          portalMsg = `\n\nAccede a tu portal:\n${origin}/portal\nUsuario: ${existing.username}\nContrase\u00f1a: ${existing.password}`;
        }
      } catch {
        try {
          const created = await api.post(`/events/${full.event_id}/client-access`);
          if (created?.username) {
            portalMsg = `\n\nAccede a tu portal:\n${origin}/portal\nUsuario: ${created.username}\nContrase\u00f1a: ${created.password}`;
          }
        } catch {}
      }

      const message = encodeURIComponent(
        `Hola! Te comparto la cotizaci\u00f3n de Vento para "${full.client_name || "tu evento"}".\n\n` +
        `Productos:\n${detail}\n\n` +
        `Total: ${fm(full.total)}` +
        portalMsg
      );
      window.open(`https://wa.me/${quote.client_phone}?text=${message}`, "_blank");
    } catch {
      const message = encodeURIComponent(
        `Hola! Te comparto la cotizaci\u00f3n de Vento para "${quote.client_name || "tu evento"}".\n\nTotal: $${Number(quote.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      );
      window.open(`https://wa.me/${quote.client_phone}?text=${message}`, "_blank");
    }
  }

  const statusColors = {
    borrador: "bg-slate-100 text-slate-600",
    enviado: "bg-blue-100 text-blue-700",
    aceptado: "bg-green-100 text-green-700",
    rechazado: "bg-red-100 text-red-700",
  };

  return (
    <div>
      <Link to={`/events/${eventId}`} className="text-sm text-vento-cyan hover:underline mb-4 inline-block">&larr; Volver al evento</Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Cotizaciones</h1>
        {user?.role === "administrador" && (
          <button onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-vento-cyan text-vento-navy rounded-lg font-medium text-sm hover:bg-cyan-400 transition">
            + Nueva cotización
          </button>
        )}
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in" onClick={() => { setShowForm(false); setEditingQuote(null); setForm({ client_name: "", client_phone: "", selectedItems: [] }); }}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={handleCreate}
            className="bg-white rounded-2xl shadow-xl animate-slide-up w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-5 pb-0">
              <h2 className="text-lg font-bold">{editingQuote ? "Editar cotización" : "Nueva cotización"}</h2>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="text-sm text-slate-500 block mb-1">Cliente *</label>
                  <input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" required />
                </div>
                <div>
                  <label className="text-sm text-slate-500 block mb-1">WhatsApp</label>
                  <input value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan" placeholder="521234567890" />
                </div>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-0 min-h-0 overflow-hidden">
              {/* Izquierda: Catálogo */}
              <div className="flex flex-col border-r border-slate-200 p-4 overflow-hidden">
                <label className="text-sm text-slate-500 block mb-2">Catálogo</label>
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-vento-cyan mb-2" placeholder="Buscar producto..." />
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  {Array.from(categories).map((cat) => (
                    <button key={cat} type="button" onClick={() => setCatFilter(cat)}
                      className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${
                        catFilter === cat ? "bg-vento-cyan text-vento-navy" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}>
                      {cat || "Todos"}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 content-start p-0.5">
                  {filteredCatalog.map((item) => (
                    <button key={item.id} type="button" onClick={() => addItem(item)}
                      className="w-full flex gap-3 border border-slate-100 rounded-xl hover:border-vento-cyan hover:bg-vento-cyan/5 transition text-left overflow-hidden">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-24 h-24 object-cover shrink-0" />
                      ) : (
                        <div className="w-24 h-24 bg-slate-100 flex items-center justify-center shrink-0">
                          <span className="text-2xl text-slate-300">📦</span>
                        </div>
                      )}
                      <div className="py-2 pr-3 flex flex-col justify-center min-w-0">
                        <span className="text-sm font-medium truncate">{item.name}</span>
                        <span className="text-xs text-slate-400 capitalize">{item.category}</span>
                        <span className="text-vento-cyan font-bold text-sm mt-0.5">${Number(item.unit_price).toLocaleString()}</span>
                      </div>
                    </button>
                  ))}
                  {filteredCatalog.length === 0 && (
                    <p className="text-xs text-slate-400 py-8 text-center">Sin resultados</p>
                  )}
                </div>
              </div>

              {/* Derecha: Items seleccionados */}
              <div className="flex flex-col p-4 overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-slate-500">Items ({form.selectedItems.length})</label>
                  {form.selectedItems.length > 0 && (
                    <div className="text-right">
                      <span className="text-sm font-bold">Total: ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      {supplierTotalPreview > 0 && (
                        <span className="block text-[10px] text-amber-600">+ ${supplierTotalPreview.toLocaleString()} proveedores</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                  {form.selectedItems.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-8">Selecciona productos del catálogo</p>
                  )}
                  <p className="text-[10px] text-amber-600 bg-amber-50 rounded px-2 py-1 mb-1">
                    Los costos de proveedores asignados al evento se incluirán automáticamente
                  </p>
                  {form.selectedItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.item_name}</p>
                        <p className="text-[11px] text-slate-400">${Number(item.unit_price).toLocaleString()} c/u</p>
                      </div>
                      <input type="number" value={item.quantity} min="0" placeholder="0"
                        onChange={(e) => updateItem(i, "quantity", e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-20 px-2 py-1.5 border border-slate-200 rounded text-sm text-center" />
                      <span className="text-sm w-24 text-right font-semibold">
                        ${((Number(item.quantity) || 0) * item.unit_price).toLocaleString()}
                      </span>
                      <button type="button" onClick={() => removeItem(i)}
                        className="text-red-400 hover:text-red-600 text-sm p-1">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 p-4 border-t border-slate-200">
              <button type="submit" disabled={form.selectedItems.length === 0}
                className="px-4 py-2 bg-vento-cyan text-vento-navy rounded-lg text-sm font-medium hover:bg-cyan-400 transition disabled:opacity-50">
                Guardar cotización
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingQuote(null); setForm({ client_name: "", client_phone: "", selectedItems: [] }); }}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de cotizaciones */}
      <div className="space-y-3">
        {quotes.map((q) => (
          <div key={q.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold">{q.client_name || "Sin cliente"}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${statusColors[q.status]}`}>
                    {q.status === "borrador" ? "Borrador" : q.status === "enviado" ? "Enviado" : q.status === "aceptado" ? "Aceptado" : q.status === "rechazado" ? "Rechazado" : q.status}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">
                  {user?.role === "administrador" ? `$${Number(q.total).toLocaleString()} — ` : ""}{fmtDate(q.created_at)}
                  {q.client_phone && ` — ${q.client_phone}`}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                {user?.role === "administrador" && q.status === "borrador" && (
                  <>
                    <button onClick={() => updateStatus(q.id, "enviado")}
                      className="text-[10px] px-2 py-1 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition">
                      Enviar
                    </button>
                    <button onClick={() => updateStatus(q.id, "aceptado")}
                      className="text-[10px] px-2 py-1 bg-green-500 text-white rounded-full hover:bg-green-600 transition">
                      Aceptar
                    </button>
                    <button onClick={() => updateStatus(q.id, "rechazado")}
                      className="text-[10px] px-2 py-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition">
                      Rechazar
                    </button>
                  </>
                )}
                {user?.role === "administrador" && q.status === "borrador" && (
                  <button onClick={() => startEdit(q)}
                    className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                    Editar
                  </button>
                )}
                {user?.role === "administrador" && (
                  <button onClick={() => setDeleteConfirm(q.id)}
                    className="text-xs px-2.5 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition">
                    Eliminar
                  </button>
                )}
                <button onClick={() => generatePdf(q)} disabled={generatingPdf === q.id}
                  className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50">
                  {generatingPdf === q.id ? "..." : "PDF"}
                </button>
                {q.client_phone && (
                  <button onClick={() => shareWhatsApp(q)}
                    className="text-xs px-2.5 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition">
                    WhatsApp
                  </button>
                )}
                <button onClick={() => setExpandedQuote(expandedQuote === q.id ? null : q.id)}
                  className="text-xs text-slate-400 hover:text-slate-600 transition">
                  {expandedQuote === q.id ? "▲" : "▼"}
                </button>
              </div>
            </div>

            {expandedQuote === q.id && (
              <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50">
                <QuoteDetail quoteId={q.id} />
              </div>
            )}
          </div>
        ))}
      </div>

      {deleteConfirm && (
        <ConfirmModal
          message="¿Eliminar esta cotización?"
          onConfirm={() => handleDelete(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {quotes.length === 0 && !showForm && (
        <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
          <p className="text-slate-400 mb-4">No hay cotizaciones aún</p>
          {user?.role === "administrador" && (
            <button onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-vento-cyan text-vento-navy rounded-lg text-sm font-medium">
              Crear cotización
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
      `}</style>
    </div>
  );
}

function QuoteDetail({ quoteId }) {
  const [data, setData] = useState(null);
  const [payments, setPayments] = useState([]);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [payForm, setPayForm] = useState({ amount: "", method: "efectivo", reference: "", notes: "" });
  const { user } = useAuth();
  const toast = useToast();
  useEffect(() => {
    api.get(`/quotes/${quoteId}`).then(setData).catch(console.error);
    api.get(`/payments?quote_id=${quoteId}`).then(setPayments).catch(console.error);
  }, [quoteId]);

  if (!data) return <p className="text-xs text-slate-400">Cargando...</p>;

  const paidTotal = payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = Number(data.total) - paidTotal;

  async function addPayment(e) {
    e.preventDefault();
    try {
      const res = await api.post("/payments", { quote_id: quoteId, amount: Number(payForm.amount), method: payForm.method, reference: payForm.reference, notes: payForm.notes });
      setPayments([res, ...payments]);
      setShowPaymentForm(false);
      setPayForm({ amount: "", method: "efectivo", reference: "", notes: "" });
      toast("Pago registrado");
    } catch (err) { toast(err.message, "error"); }
  }

  async function deletePayment(id) {
    try {
      await api.delete(`/payments/${id}`);
      setPayments(payments.filter((p) => p.id !== id));
      toast("Pago eliminado");
    } catch (err) { toast(err.message, "error"); }
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-400 border-b border-slate-200">
            <th className="text-left py-1 font-medium">Item</th>
            <th className="text-center py-1 font-medium">Cant</th>
            {user?.role === "administrador" && <th className="text-right py-1 font-medium">P/Unit</th>}
            {user?.role === "administrador" && <th className="text-right py-1 font-medium">Subtotal</th>}
          </tr>
        </thead>
        <tbody>
          {data.items?.map((item, i) => (
            <tr key={item.id || i} className={`border-b border-slate-100 ${item.is_supplier_cost ? "bg-amber-50/50" : ""}`}>
              <td className="py-1.5">
                {item.item_name}
                {item.is_supplier_cost && <span className="text-[10px] ml-1.5 text-amber-600 font-medium">(Proveedor)</span>}
              </td>
              <td className="text-center py-1.5">{item.quantity}</td>
              {user?.role === "administrador" && <td className="text-right py-1.5">${Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>}
              {user?.role === "administrador" && <td className="text-right py-1.5 font-medium">${Number(item.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>}
            </tr>
          ))}
        </tbody>
        {user?.role === "administrador" && data.items?.length > 0 && (
        <tfoot>
          {(() => {
            const userItemsTotal = data.items.filter((i) => !i.is_supplier_cost).reduce((s, i) => s + Number(i.subtotal), 0);
            const supTotal = data.items.filter((i) => i.is_supplier_cost).reduce((s, i) => s + Number(i.subtotal), 0);
            return (
              <>
                {supTotal > 0 && (
                  <tr className="text-xs text-amber-600">
                    <td colSpan="3" className="text-right py-1">Costos de proveedores:</td>
                    <td className="text-right py-1">${supTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan="3" className="text-right py-2 font-bold">Total:</td>
                  <td className="text-right py-2 font-bold text-vento-cyan">${Number(data.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </>
            );
          })()}
        </tfoot>
        )}
      </table>

      {/* Pagos */}
      <div className="mt-4 pt-3 border-t border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-500">Pagos / Anticipos</span>
          {user?.role === "administrador" && (
            <button onClick={() => setShowPaymentForm(!showPaymentForm)}
              className="text-[10px] px-2 py-1 bg-vento-cyan text-vento-navy rounded-lg font-medium">
              {showPaymentForm ? "Cancelar" : "+ Pago"}
            </button>
          )}
        </div>

        {showPaymentForm && (
          <form onSubmit={addPayment} className="flex flex-wrap gap-2 mb-3 p-3 bg-slate-50 rounded-lg text-xs">
            <input type="number" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
              className="w-24 px-2 py-1.5 border border-slate-200 rounded" placeholder="Monto" required />
            <select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
              className="px-2 py-1.5 border border-slate-200 rounded">
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="deposito">Depósito</option>
            </select>
            <input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
              className="w-28 px-2 py-1.5 border border-slate-200 rounded" placeholder="Referencia" />
            <input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
              className="w-28 px-2 py-1.5 border border-slate-200 rounded" placeholder="Notas" />
            <button type="submit" className="px-3 py-1.5 bg-green-600 text-white rounded font-medium">Guardar</button>
          </form>
        )}

        <div className="space-y-1 mb-2">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between bg-white rounded px-3 py-1.5 border border-slate-100 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-green-600">{user?.role === "administrador" ? `$${Number(p.amount).toLocaleString()}` : "—"}</span>
                <span className="text-slate-400 capitalize">{p.method}</span>
                {p.reference && <span className="text-slate-400">{p.reference}</span>}
                {p.notes && <span className="text-slate-400">{p.notes}</span>}
                <span className="text-slate-400">{new Date(p.payment_date).toLocaleDateString("es-MX")}</span>
              </div>
              {user?.role === "administrador" && (
                <button onClick={() => deletePayment(p.id)} className="text-red-400 hover:text-red-600">✕</button>
              )}
            </div>
          ))}
          {payments.length === 0 && <p className="text-[10px] text-slate-400">Sin pagos registrados</p>}
        </div>

        {payments.length > 0 && user?.role === "administrador" && (
          <div className="flex gap-4 text-[10px] text-slate-500 font-medium">
            <span>Pagado: <span className="text-green-600">${paidTotal.toLocaleString()}</span></span>
            <span>Saldo: <span className={balance > 0 ? "text-amber-600" : "text-green-600"}>${balance.toLocaleString()}</span></span>
          </div>
        )}
      </div>
    </div>
  );
}
