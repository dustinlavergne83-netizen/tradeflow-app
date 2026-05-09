import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setEmployee(null);
        setCustomer(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadUserData(userId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user?.email) {
        setEmployee(null);
        setCustomer(null);
        setLoading(false);
        return;
      }

      const cleanEmail = user.email.trim().toLowerCase();

      // ── 1. Check employees table first ──────────────────────────────────
      const { data: empData, error: empError } = await supabase
        .from("employees")
        .select("id, email, first_name, last_name, role, is_active, phone, date_of_birth, user_id, is_super_admin")
        .ilike("email", cleanEmail)
        .maybeSingle();

      if (empData) {
        empData.full_name = `${empData.first_name || ""} ${empData.last_name || ""}`.trim();
        setEmployee(empData);
        setCustomer(null);
        setLoading(false);
        return;
      }

      // ── 2. Check customers table ─────────────────────────────────────────
      const { data: custData, error: custError } = await supabase
        .from("customers")
        .select("id, name, email, phone, address, city, state, zip, company_id")
        .ilike("email", cleanEmail)
        .maybeSingle();

      if (custData) {
        setCustomer(custData);
        setEmployee(null);
        setLoading(false);
        return;
      }

      // ── 3. Not found in either table ─────────────────────────────────────
      setEmployee(null);
      setCustomer(null);
    } catch (err) {
      console.error("AuthContext loadUserData error:", err);
      setEmployee(null);
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setEmployee(null);
    setCustomer(null);
  }

  const value = {
    user,
    employee,
    customer,
    isAdmin: employee?.role === "admin",
    isSuperAdmin: !!employee?.is_super_admin,
    isEmployee: !!employee,
    isCustomer: !!customer,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
