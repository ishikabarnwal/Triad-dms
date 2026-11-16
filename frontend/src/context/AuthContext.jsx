import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as authApi from "../api/auth";
import { setUnauthorizedHandler, tokenStore } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  // With a saved token we must ask the API who it belongs to before rendering protected pages.
  const [ready, setReady] = useState(!tokenStore.get());

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      navigate("/login", { replace: true, state: { reason: "expired" } });
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate]);

  useEffect(() => {
    if (!tokenStore.get()) {
      return;
    }
    authApi
      .me()
      .then((response) => setUser(response.data.user))
      .catch(() => tokenStore.clear())
      .finally(() => setReady(true));
  }, []);

  const startSession = useCallback((data) => {
    tokenStore.set(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const login = useCallback(
    async (identifier, password) => startSession((await authApi.login(identifier, password)).data),
    [startSession],
  );

  const register = useCallback(async (body) => startSession((await authApi.register(body)).data), [startSession]);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  const value = useMemo(
    () => ({ user, ready, isAdmin: user?.role === "admin", login, register, logout }),
    [user, ready, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
