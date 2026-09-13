/**
 * CompanyContext — provides company_id and company info to all Comms screens.
 *
 * After a user signs in, we look up their employee record to get company_id,
 * then fetch the company details (name, logo, colors, settings). This lets
 * one Comms codebase serve every company (DML, DT Specialties, etc.) with
 * each one's own branding and feature flags — same pattern as
 * timeclock-mobile/lib/CompanyContext.tsx.
 *
 * Usage:
 *   const { companyId, company, loading } = useCompany();
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

export type Company = {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  contact_email: string | null;
  contact_phone: string | null;
  settings: Record<string, any>;
};

type CompanyContextType = {
  companyId: string | null;
  company: Company | null;
  loading: boolean;
  /** Force refresh company data (e.g. after settings change) */
  refresh: () => Promise<void>;
};

const CompanyContext = createContext<CompanyContextType>({
  companyId: null,
  company: null,
  loading: true,
  refresh: async () => {},
});

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadCompany() {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      if (!userId) {
        setCompanyId(null);
        setCompany(null);
        setLoading(false);
        return;
      }

      // Step 1: Get the employee's company_id
      const { data: emp, error: empError } = await supabase
        .from("employees")
        .select("company_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (empError || !emp?.company_id) {
        console.log("No company_id found for user:", userId);
        setCompanyId(null);
        setCompany(null);
        setLoading(false);
        return;
      }

      setCompanyId(emp.company_id);

      // Step 2: Fetch company details
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("*")
        .eq("id", emp.company_id)
        .single();

      if (companyError) {
        console.log("Error loading company:", companyError.message);
        // Still set companyId even if company details fail
        setCompany(null);
      } else {
        setCompany({
          id: companyData.id,
          name: companyData.name,
          slug: companyData.slug,
          logo_url: companyData.logo_url,
          primary_color: companyData.primary_color || "#0b3ea8",
          secondary_color: companyData.secondary_color || "#fc6b04",
          contact_email: companyData.contact_email,
          contact_phone: companyData.contact_phone,
          settings: companyData.settings || {},
        });
      }
    } catch (err) {
      console.log("CompanyContext loadCompany error:", err);
      setCompanyId(null);
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCompany();

    // Re-load when auth state changes (sign in / sign out)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        loadCompany();
      } else {
        setCompanyId(null);
        setCompany(null);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <CompanyContext.Provider value={{ companyId, company, loading, refresh: loadCompany }}>
      {children}
    </CompanyContext.Provider>
  );
}

/** Hook to access company context from any screen */
export function useCompany() {
  return useContext(CompanyContext);
}
