export default function ConfirmModal({ message, description, onConfirm, onCancel, confirmLabel = "Eliminar", confirmClass = "bg-red-500 hover:bg-red-600" }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-slide-up text-center space-y-4">
        <p className="text-lg font-semibold">{message}</p>
        {description && <p className="text-sm text-slate-500">{description}</p>}
        <div className="flex gap-2 justify-center">
          <button onClick={onConfirm}
            className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition ${confirmClass}`}>
            {confirmLabel}
          </button>
          <button onClick={onCancel}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
