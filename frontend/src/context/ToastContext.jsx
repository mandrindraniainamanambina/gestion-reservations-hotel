import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);
let compteur = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const retirer = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const ajouter = useCallback(
    (type, message) => {
      const id = ++compteur;
      setToasts((t) => [...t, { id, type, message }]);
      setTimeout(() => retirer(id), 4500);
    },
    [retirer]
  );

  const notify = useMemo(
    () => ({ success: (m) => ajouter("success", m), error: (m) => ajouter("error", m) }),
    [ajouter]
  );

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} role={t.type === "error" ? "alert" : "status"}>
            <span>{t.message}</span>
            <button className="toast-close" onClick={() => retirer(t.id)} aria-label="Fermer">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
