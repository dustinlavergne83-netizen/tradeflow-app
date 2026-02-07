import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadEmployeeData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadEmployeeData(session.user.id);
      } else {
        setEmployee(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadEmployeeData(userId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.email) {
        setEmployee(null);
        setLoading(false);
        return;
      }

      // Try to find employee by email
      const cleanEmail = user.email.trim().toLowerCase();
      const { data, error } = await supabase
        .from("employees")
        .select("id, email, first_name, last_name, role, is_active, phone, date_of_birth")
        .ilike("email", cleanEmail) // Case-insensitive match
        .maybeSingle();

      if (error) {
        setEmployee(null);
      } else if (data) {
        // Add full_name property for easier display
        data.full_name = `${data.first_name || ''} ${data.last_name || ''}`.trim();
        setEmployee(data);
      } else {
        setEmployee(null);
      }
    } catch (err) {
      setEmployee(null);
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
  }

  const value = {
    user,
    employee,
    isAdmin: employee?.role === 'admin',
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
