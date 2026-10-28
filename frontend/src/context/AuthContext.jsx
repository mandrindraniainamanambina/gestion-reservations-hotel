import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { setUnauthorizedHandler, tokenStore } from "../services/api.js";
import { authApi } from "../services/resources.js";
import { useToast } from "./ToastContext.jsx";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const notify = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  useEffect(() => {
    // Un 401 sur une requête authentifiée = session expirée ou jeton révoqué
    setUnauthorizedHandler(() => {
      setUser(null);
      notify.error("Session expirée. Veuillez vous reconnecter.");
    });
    if (tokenStore.get()) {
      authApi
        .me()
        .then(setUser)
        .catch(() => tokenStore.clear())
        .finally(() => setLoading(false));
    }
  }, [notify]);

  const login = useCallback(async (username, password) => {
    const data = await authApi.login(username, password);
    tokenStore.set(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* le jeton local est supprimé dans tous les cas */
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, isAdmin: user?.role === "ADMIN" }),
    [user, loading, login, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
