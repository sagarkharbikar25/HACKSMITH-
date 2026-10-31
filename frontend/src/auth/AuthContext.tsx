import React, { createContext, useContext, useState, useEffect } from "react";
import type { User, Role } from "../types";
import { api } from "../api/client";

export interface SystemCredential {
  role: Role;
  name: string;
  email: string;
  label: string;
  pass: string;
}

export const SYSTEM_CREDENTIALS: SystemCredential[] = [
  {
    role: "creator",
    name: "Elena Vance",
    email: "creator@lumora.demo",
    label: "Creator",
    pass: "demo1234",
  },
  {
    role: "agency",
    name: "Nexus Agency",
    email: "agency@lumora.demo",
    label: "Agency",
    pass: "demo1234",
  },
  {
    role: "reviewer",
    name: "Marcus Cole",
    email: "reviewer@lumora.demo",
    label: "Reviewer",
    pass: "demo1234",
  },
  {
    role: "brand_manager",
    name: "Sarah Chen",
    email: "brand@lumora.demo",
    label: "Brand Manager",
    pass: "demo1234",
  },
  {
    role: "admin",
    name: "System Admin",
    email: "admin@lumora.demo",
    label: "Admin",
    pass: "demo1234",
  },
  {
    role: "creator",
    name: "Creator (Sagar)",
    email: "saar@test.com",
    label: "Creator Test",
    pass: "12345678",
  },
  {
    role: "reviewer",
    name: "Reviewer (SS)",
    email: "ss@test.com",
    label: "Reviewer Test",
    pass: "12345678",
  },
  {
    role: "brand_manager",
    name: "Brand Manager (SK)",
    email: "sk@test.com",
    label: "Brand Mgr Test",
    pass: "12345678",
  },
];

// Compatibility alias
export const DEMO_PERSONAS = SYSTEM_CREDENTIALS;

export function getRoleHomeRoute(role?: string): string {
  switch (role) {
    case "creator":
    case "agency":
      return "/creator/workspace";
    case "reviewer":
      return "/reviewer/queue";
    case "brand_manager":
      return "/governance/insights";
    case "admin":
      return "/governance/audit-trail";
    default:
      return "/creator/workspace";
  }
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<User>;
  register: (name: string, email: string, password: string, role: Role) => Promise<User>;
  quickLogin: (email: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = sessionStorage.getItem("brandguard_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return sessionStorage.getItem("brandguard_token");
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function initAuth() {
      const savedToken = sessionStorage.getItem("brandguard_token");
      if (savedToken) {
        try {
          const me = await api.auth.me();
          setUser(me);
          sessionStorage.setItem("brandguard_user", JSON.stringify(me));
        } catch {
          sessionStorage.removeItem("brandguard_token");
          sessionStorage.removeItem("brandguard_user");
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    }
    initAuth();
  }, []);

  const login = async (email: string, password: string = "12345678"): Promise<User> => {
    const res = await api.auth.login(email, password);
    sessionStorage.setItem("brandguard_token", res.token);
    sessionStorage.setItem("brandguard_user", JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const register = async (name: string, email: string, password: string, role: Role): Promise<User> => {
    const res = await api.auth.register(name, email, password, role);
    sessionStorage.setItem("brandguard_token", res.token);
    sessionStorage.setItem("brandguard_user", JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const quickLogin = async (email: string): Promise<User> => {
    const cred = SYSTEM_CREDENTIALS.find((c) => c.email.toLowerCase() === email.toLowerCase());
    return login(email, cred ? cred.pass : "12345678");
  };

  const logout = () => {
    sessionStorage.removeItem("brandguard_token");
    sessionStorage.removeItem("brandguard_user");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, quickLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
