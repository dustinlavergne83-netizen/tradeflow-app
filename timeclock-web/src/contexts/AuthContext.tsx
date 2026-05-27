import React, { createContext, useContext, useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface Company {
  id: string;
  name: string;
  subscription_tier: string;
  subscription_status: string;
  trial_ends_at: string | null;
  primary_color: string | null;
  settings: Record<string, any> | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  company: Company | null;
  employeeRole: string | null;
  loading: boolean;
  isPro: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]               = useState<User | null>(null);
  const [session, setSession]         = useState<Session | null>(null);
  const [company, setCompany]         = useState<Company | null>(null);
  const [employeeRole, setRole]       = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) loadCompany(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) loadCompany(session.user.id);
      else { setCompany(null); setRole(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadCompany(userId: string) {
    setLoading(true);
    try {
      // Get employee row to find company_id + role
      // Use maybeSingle() so it safely returns null (no error) when 0 rows found
      const { data: emp } = await supabase
        .from("employees")
        .select("company_id, role")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!emp) { setLoading(false); return; }
      setRole(emp.role);

      // Get company record
      const { data: co } = await supabase
        .from("companies")
        .select("id, name, subscription_tier, subscription_status, trial_ends_at, primary_color, settings")
        .eq("id", emp.company_id)
        .single();

      setCompany(co ?? null);
    } finally {
      setLoading(false);
    }
  }

  const isPro =
    (company?.settings as any)?.tier === "full" ||
    (company?.subscription_status === "active" && company?.subscription_tier === "pro");

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, session, company, employeeRole, loading, isPro, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
