import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";

const tabs = [
  { id: "events", label: "Eventos" },
  { id: "clients", label: "Clientes" },
  { id: "suppliers", label: "Proveedores" },
  { id: "catalog", label: "Catálogo con fotos" },
  { id: "financial", label: "Financiero" },
];

export default function ReportsPage() {
  const [tab, setTab] = useState("events");
  const [events, setEvents] = useState([]);
  const [clients, setClients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [categories, setCategories] = useState([]);
  const [financial, setFinancial] = useState(null);
  const [loading, setLoading] = useState(false);
  const [start, setStart] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [catFilter, setCatFilter] = useState("");
  const printRef = useRef();

  useEffect(() => {
    api.get("/reports/categories").then(setCategories).catch(() => {});
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

  const fm = (n) => `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const fmDate = (d) => d ? new Date(d).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" }) : "—";

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
        @media print { body { padding: 0; } }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <h1 className="text-2xl font-bold">Reportes</h1>
        <button onClick={handlePrint}
          className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition">
          Imprimir
        </button>
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
            <div className="flex gap-2 items-center mb-4">
              <label className="text-xs text-slate-500">Del:</label>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded text-sm" />
              <label className="text-xs text-slate-500">Al:</label>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded text-sm" />
            </div>
            <h2 className="text-lg font-bold mb-3 text-vento-navy"><span className="text-amber-500 mr-2">⬥</span>Eventos del {fmDate(start)} al {fmDate(end)}</h2>
            {events.length === 0 && <p className="text-sm text-slate-400">Sin eventos en este periodo</p>}
            <div className="overflow-x-auto">
            <table>
              <thead>
                <tr><th>Evento</th><th>Fecha</th><th>Estatus</th><th>Cotizado</th><th>Pagado</th><th>Pendiente</th><th>Staff</th><th>Proveedores</th></tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const pending = Number(e.pending_total || 0);
                  return (
                    <tr key={e.id}>
                      <td className="font-medium">{e.name}</td>
                      <td>{fmDate(e.date)}</td>
                      <td><span className={`badge ${e.status === "completado" ? "badge-green" : e.status === "activo" ? "badge-blue" : "badge-yellow"}`}>{e.status}</span></td>
                      <td>{fm(e.quoted_total)}</td>
                      <td>{fm(e.paid_total)}</td>
                      <td>{pending > 0 ? fm(pending) : "—"}</td>
                      <td className="text-center">{e.staff_count}</td>
                      <td className="text-center">{e.supplier_count}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <td colSpan={3}>Totales</td>
                  <td>{fm(events.reduce((s, e) => s + Number(e.quoted_total || 0), 0))}</td>
                  <td>{fm(events.reduce((s, e) => s + Number(e.paid_total || 0), 0))}</td>
                  <td>{fm(events.reduce((s, e) => s + Number(e.pending_total || 0), 0))}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
            </div>
          </div>
        )}

        {tab === "clients" && (
          <div>
            <h2 className="text-lg font-bold mb-3 text-vento-navy"><span className="text-amber-500 mr-2">⬥</span>Clientes</h2>
            {clients.length === 0 && <p className="text-sm text-slate-400">Sin clientes registrados</p>}
            <div className="overflow-x-auto">
            <table>
              <thead>
                <tr><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Eventos</th><th>Total gastado</th><th>Pagado</th></tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.display_name}</td>
                    <td>{c.email || "—"}</td>
                    <td>{c.phone || "—"}</td>
                    <td className="text-center">{c.event_count}</td>
                    <td>{fm(c.total_spent)}</td>
                    <td>{fm(c.total_paid)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <td colSpan={3}>Totales</td>
                  <td className="text-center">{clients.reduce((s, c) => s + Number(c.event_count || 0), 0)}</td>
                  <td>{fm(clients.reduce((s, c) => s + Number(c.total_spent || 0), 0))}</td>
                  <td>{fm(clients.reduce((s, c) => s + Number(c.total_paid || 0), 0))}</td>
                </tr>
              </tfoot>
            </table>
            </div>
          </div>
        )}

        {tab === "suppliers" && (
          <div>
            <div className="flex gap-2 items-center mb-4 flex-wrap">
              <span className="text-xs text-slate-500">Categoría:</span>
              {["", ...categories].map((c) => (
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
            <div className="overflow-x-auto">
            <table>
              <thead>
                <tr><th>Nombre</th><th>Categoría</th><th>Contacto</th><th>Teléfono</th><th>Eventos</th><th>Presupuestado</th><th>Pagado</th></tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium">{s.name}</td>
                    <td><span className="capitalize">{s.category}</span></td>
                    <td>{s.contact_name || "—"}</td>
                    <td>{s.phone || "—"}</td>
                    <td className="text-center">{s.event_count}</td>
                    <td>{fm(s.total_budgeted)}</td>
                    <td>{fm(s.total_paid)}</td>
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
            <div className="flex gap-1 mb-4 flex-wrap">
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
                <div key={item.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-36 object-cover" />
                  ) : (
                    <div className="w-full h-36 bg-slate-100 flex items-center justify-center text-slate-300 text-2xl font-bold">[Sin foto]</div>
                  )}
                  <div className="p-2">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{item.category}</p>
                    <p className="text-amber-600 font-bold text-sm">{fm(item.unit_price)}</p>
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
            <div className="flex gap-2 items-center mb-4">
              <label className="text-xs text-slate-500">Del:</label>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded text-sm" />
              <label className="text-xs text-slate-500">Al:</label>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded text-sm" />
            </div>
            <h2 className="text-lg font-bold mb-3 text-vento-navy"><span className="text-amber-500 mr-2">⬥</span>Resumen financiero</h2>
            {!financial && <p className="text-sm text-slate-400">Cargando...</p>}
            {financial && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl border-l-4 border-l-amber-500 border border-slate-200 p-4">
                    <p className="text-xs text-slate-400">Pagos recibidos</p>
                    <p className="text-2xl font-bold text-green-600">{financial.payment_count}</p>
                  </div>
                  <div className="bg-white rounded-xl border-l-4 border-l-amber-500 border border-slate-200 p-4">
                    <p className="text-xs text-slate-400">Total recibido</p>
                    <p className="text-2xl font-bold text-vento-navy">{fm(financial.total_received)}</p>
                  </div>
                  <div className="bg-white rounded-xl border-l-4 border-l-amber-500 border border-slate-200 p-4">
                    <p className="text-xs text-slate-400">Cotizaciones con pago</p>
                    <p className="text-2xl font-bold text-amber-600">{financial.quotes_with_payment}</p>
                  </div>
                  <div className="bg-white rounded-xl border-l-4 border-l-amber-500 border border-slate-200 p-4">
                    <p className="text-xs text-slate-400">Total cotizado</p>
                    <p className="text-2xl font-bold text-amber-600">{fm(financial.total_quoted)}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold mb-2">Por método de pago</h3>
                  <div className="overflow-x-auto">
                  <table>
                    <thead>
                      <tr><th>Método</th><th className="text-right">Pagos</th><th className="text-right">Total</th></tr>
                    </thead>
                    <tbody>
                      {financial.by_method?.map((m) => (
                        <tr key={m.method}>
                          <td className="capitalize">{m.method}</td>
                          <td className="text-right">{m.count}</td>
                          <td className="text-right font-medium">{fm(m.total)}</td>
                        </tr>
                      ))}
                    </tbody>
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