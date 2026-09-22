/**
 * deposits.js — shared helpers for the "Apply Deposits to Invoice" prompt.
 *
 * Every invoice-creation page (Invoice, QuickInvoice, ProgressBilling,
 * GeneratorInvoice, InvoiceCommercialPublic) should show the same prompt
 * whenever a project has un-applied deposits ("received" status, not yet
 * linked to an invoice). This module is the single source of truth for:
 *   - resolving a project (by id, preferably; by name as a fallback)
 *   - loading its available (unapplied) deposits
 *   - applying selected deposits to a saved invoice
 *
 * Centralizing this fixes three bugs that existed when each page had its
 * own copy-pasted version:
 *   1. Some pages only checked deposits after the invoice was reloaded
 *      from the DB, so brand-new invoices never showed the prompt.
 *   2. Some pages resolved the project by name with `.single()`, which
 *      throws (and silently skips deposits) if the name doesn't match
 *      exactly one project.
 *   3. Some invoice types (Quick Invoice, Generator Invoice, Commercial
 *      Public Invoice) never looked for deposits at all.
 */
import { supabase } from "./supabase";

/**
 * Resolve a project id from either an explicit id or a project/customer
 * name. Uses maybeSingle() so an ambiguous or missing match returns null
 * instead of throwing.
 */
export async function resolveProjectId({ projectId, projectName, customerName } = {}) {
  if (projectId) return projectId;

  if (projectName) {
    const { data } = await supabase
      .from("projects")
      .select("id")
      .ilike("name", projectName)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  // Best-effort fallback for pages (e.g. Generator Invoice) that only know
  // a customer name, not a project — match the most recently created
  // project for that customer, if any.
  if (customerName) {
    const { data } = await supabase
      .from("projects")
      .select("id")
      .ilike("customer_name", customerName)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  return null;
}

/**
 * Load all un-applied ("received") deposits for a project, most recent first.
 */
export async function loadAvailableDeposits(projectId) {
  if (!projectId) return [];
  // 'received' and 'deposited' are both used across the app to mean
  // "un-applied" — ProjectDetail.jsx treats them as equivalent everywhere.
  // This used to only check 'received', which stranded any deposit whose
  // status was 'deposited' (it would never appear in the apply picker).
  const { data, error } = await supabase
    .from("project_deposits")
    .select("*")
    .eq("project_id", projectId)
    .in("status", ["received", "deposited"])
    .order("deposit_date", { ascending: false });

  if (error) {
    console.error("Error loading available deposits:", error);
    return [];
  }
  return data || [];
}

/**
 * Apply a set of deposits to a saved invoice: marks each deposit "applied"
 * and linked to the invoice, and syncs invoices.deposit_received /
 * deposit_date to match the total applied.
 *
 * Returns the total dollar amount applied.
 */
export async function applyDepositsToInvoice(invoiceId, deposits) {
  if (!invoiceId || !deposits || deposits.length === 0) return 0;

  const total = deposits.reduce((sum, d) => sum + (Number(d.deposit_amount) || 0), 0);
  const depositIds = deposits.map((d) => d.id);
  const mostRecentDate = deposits
    .map((d) => d.deposit_date)
    .filter(Boolean)
    .sort()
    .at(-1) || new Date().toISOString().split("T")[0];

  const { error: depError } = await supabase
    .from("project_deposits")
    .update({
      invoice_id: invoiceId,
      status: "applied",
      applied_date: new Date().toISOString(),
    })
    .in("id", depositIds);
  if (depError) throw depError;

  const { error: invError } = await supabase
    .from("invoices")
    .update({
      deposit_received: total,
      deposit_date: mostRecentDate,
    })
    .eq("id", invoiceId);
  if (invError) throw invError;

  return total;
}
