import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { TOKEN_KEY, USER_KEY } from "../lib/constants";
import { loginRequest, registerRequest } from "../services/auth";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<User>;
  register: (input: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  });

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    window.addEventListener("auth:unauthorized", logout);
    return () => window.removeEventListener("auth:unauthorized", logout);
  }, []);

  const save = (nextToken: string, nextUser: User) => {
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
    return nextUser;
  };

  const value = useMemo(
    () => ({
      user,
      token,
      login: async (email: string, password: string) => {
        const response = await loginRequest(email, password);
        return save(response.data.token, response.data.user);
      },
      register: async (input: { name: string; email: string; phone: string; password: string }) => {
        const response = await registerRequest(input);
        return save(response.data.token, response.data.user);
      },
      logout,
    }),
    [user, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth harus digunakan di dalam AuthProvider");
  return value;
};
