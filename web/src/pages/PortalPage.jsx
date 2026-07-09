import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { fmtDateTime, fmtTime, fmtMoney } from "../lib/format";

export default function PortalPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [agenda, setAgenda] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    if (!user || user.role !== "cliente") return;
    async function load() {
      try {
        const res = await api.get("/events?page=1&limit=1");
        const events = res.data || res;
        if (events.length === 0) { setLoading(false); return; }
        const evt = events[0];
        setEvent(evt);
        const [ag, sup, quo] = await Promise.allSettled([
          api.get(`/agenda?event_id=${evt.id}`),
          api.get(`/event-suppliers?event_id=${evt.id}`),
          api.get(`/quotes?event_id=${evt.id}`),
        ]);
        if (ag.status === "fulfilled") setAgenda(ag.value);
        if (sup.status === "fulfilled") setSuppliers(sup.value);
        if (quo.status === "fulfilled") {
          const list = quo.value;
          const withItems = await Promise.allSettled(
            list.map((q) => api.get(`/quotes/${q.id}`))
          );
          setQuotes(
            withItems
              .filter((r) => r.status === "fulfilled")
              .map((r) => r.value)
          );
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  if (!user || user.role !== "cliente") {
    return <p className="text-slate-400 p-6">Acceso solo para clientes</p>;
  }

  if (loading) return <p className="text-slate-400 p-6">Cargando...</p>;
  if (!event) return <p className="text-slate-400 p-6">No tienes eventos asignados</p>;

  const completedAgenda = agenda.filter((a) => a.is_completed).length;
  const hiredSuppliers = suppliers.filter((s) => s.contract_status === "contratado").length;
  const statusMap = { activo: "Activo", borrador: "Borrador", completado: "Completado", cancelado: "Cancelado" };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Mi evento</h1>
          <p className="text-sm text-slate-500">Bienvenido, {user?.display_name || user?.displayName}</p>
        </div>
        <button onClick={() => { logout(); navigate("/login"); }}
          className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
          Cerrar sesión
        </button>
      </div>

      <div className="bg-white rounded-xl p-6 border border-slate-200 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">{event.name}</h2>
            <p className="text-slate-500 text-sm mt-1">{fmtDateTime(event.date)}</p>
            {event.venue && <p className="text-slate-500 text-sm mt-0.5">{event.venue}</p>}
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${
            event.status === "activo" ? "bg-green-100 text-green-700" :
            event.status === "borrador" ? "bg-slate-100 text-slate-600" :
            event.status === "completado" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
          }`}>{statusMap[event.status] || event.status}</span>
        </div>
        {event.description && <p className="text-slate-600 text-sm mt-3">{event.description}</p>}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-slate-200 text-center">
          <p className="text-xs text-slate-400">Agenda</p>
          <p className="text-2xl font-bold text-vento-navy mt-1">{completedAgenda}/{agenda.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 text-center">
          <p className="text-xs text-slate-400">Proveedores</p>
          <p className="text-2xl font-bold text-vento-navy mt-1">{hiredSuppliers}/{suppliers.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 text-center">
          <p className="text-xs text-slate-400">Cotizaciones</p>
          <p className="text-2xl font-bold text-vento-navy mt-1">{quotes.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {["overview", "agenda", "suppliers", "quotes"].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition -mb-px capitalize ${
              tab === t ? "border-vento-cyan text-vento-cyan" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {t === "overview" ? "Resumen" : t === "agenda" ? `Agenda (${agenda.length})` : t === "suppliers" ? `Proveedores (${suppliers.length})` : `Cotizaciones (${quotes.length})`}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <h3 className="text-sm font-semibold mb-3">Avance del evento</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Agenda</span>
                <span className="text-slate-400">{completedAgenda}/{agenda.length}</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-vento-cyan rounded-full" style={{ width: `${agenda.length ? (completedAgenda / agenda.length) * 100 : 0}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Proveedores contratados</span>
                <span className="text-slate-400">{hiredSuppliers}/{suppliers.length}</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${suppliers.length ? (hiredSuppliers / suppliers.length) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "agenda" && (
        <div className="space-y-1.5">
          {agenda.map((item) => (
            <div key={item.id} className={`flex items-center gap-3 bg-white rounded-lg px-4 py-2.5 border text-sm ${
              item.is_completed ? "border-green-200 bg-green-50/50" : "border-slate-200"
            }`}>
              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                item.is_completed ? "bg-green-500 border-green-500" : "border-slate-300"
              }`}>
                {item.is_completed && <span className="text-white text-[8px]">✓</span>}
              </span>
              <span className={item.is_completed ? "line-through text-slate-400 flex-1" : "flex-1"}>{item.title}</span>
              <span className="text-xs text-slate-400">{fmtTime(item.start_time)}</span>
            </div>
          ))}
          {agenda.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Sin tareas en la agenda</p>}
        </div>
      )}

      {tab === "suppliers" && (
        <div className="space-y-2">
          {suppliers.map((s) => (
            <div key={s.id} className="bg-white rounded-lg px-4 py-3 border border-slate-200 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{s.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                  s.contract_status === "contratado" ? "bg-green-100 text-green-700" :
                  s.contract_status === "contactado" ? "bg-yellow-100 text-yellow-700" :
                  "bg-slate-100 text-slate-600"
                }`}>{s.contract_status}</span>
              </div>
              {s.budget_amount > 0 && <p className="text-xs text-slate-400 mt-1">${Number(s.budget_amount).toLocaleString()}</p>}
            </div>
          ))}
          {suppliers.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Sin proveedores asignados</p>}
        </div>
      )}

      {tab === "quotes" && (
        <div className="space-y-3">
          {quotes.map((q) => (
            <div key={q.id} className="bg-white rounded-lg border border-slate-200 text-sm overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
                <div>
                  <span className="font-medium">{q.client_name || "Cotización"}</span>
                  <span className="text-slate-400 ml-2">{fmtMoney(q.total)}</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full capitalize ${
                    q.status === "aceptado" ? "bg-green-100 text-green-700" :
                    q.status === "enviado" ? "bg-blue-100 text-blue-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>{q.status}</span>
                </div>
              </div>
              {q.items && q.items.length > 0 && (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400">
                      <th className="text-left px-4 py-2 font-medium">Producto</th>
                      <th className="text-right px-4 py-2 font-medium">Cant.</th>
                      <th className="text-right px-4 py-2 font-medium">Precio</th>
                      <th className="text-right px-4 py-2 font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {q.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2 text-slate-700">{item.item_name}</td>
                        <td className="px-4 py-2 text-right text-slate-500">{item.quantity}</td>
                        <td className="px-4 py-2 text-right text-slate-500">{fmtMoney(item.unit_price)}</td>
                        <td className="px-4 py-2 text-right text-slate-700 font-medium">{fmtMoney(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
          {quotes.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Sin cotizaciones</p>}
        </div>
      )}
    </div>
  );
}
