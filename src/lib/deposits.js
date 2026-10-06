/**
 * deposits.js — shared helpers for the "Apply Deposits to Invoice" prompt.
 *
 * Every invoice-creation page (Invoice, QuickInvoice, ProgressBilling,
 * GeneratorInvoice, InvoiceCommercialPublic) should show the same prompt
 * whenever a project has un-applied deposits ("received" status, not yet
 * linked to an invoice). This module is the single source of truth for:
 *   - resolving a project (by id, preferably; by name as a fallback)
 *   - loading its available (unapplied, or partially-applied with a
 *     remaining balance) deposits
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
 *
 * PARTIAL APPLICATION (deposit_allocations): a deposit used to be all-or-
 * nothing — applying it to one invoice set status='applied' and a single
 * invoice_id, which permanently removed it from every other invoice's
 * "available deposits" list even if the invoice total was smaller than the
 * deposit. A $3,665 deposit applied to an $8,413 invoice became entirely
 * unavailable for the NEXT progress invoice on the same project, even
 * though none of it was truly spent. Deposits now carry a running list of
 * allocations (deposit_allocations: deposit_id, invoice_id, amount), and a
 * deposit stays available as long as deposit_amount minus the sum of its
 * allocations is > 0. applyDepositsToInvoice auto-applies up to each
 * deposit's remaining balance (oldest deposit first) capped at the
 * invoice's own total, carrying any leftover deposit balance forward for
 * future invoices instead of consuming the whole deposit at once.
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
 * Load all deposits for a project that still have a remaining (unapplied)
 * balance — i.e. deposit_amount minus whatever's already been allocated to
 * other invoices is > 0. Each returned deposit carries an extra
 * `remaining_amount` field (not a DB column) reflecting that balance, which
 * callers should use instead of `deposit_amount` when deciding how much is
 * actually available. Oldest deposit_date first, so older deposits are
 * naturally consumed before newer ones.
 *
 * 'received' and 'deposited' are both used across the app to mean the
 * deposit exists and is real money in hand; 'applied' deposits are also
 * included here (unlike before) because a partially-applied deposit still
 * has status 'applied' but may well have a remaining balance left.
 */
export async function loadAvailableDeposits(projectId) {
  if (!projectId) return [];

  const { data: deposits, error } = await supabase
    .from("project_deposits")
    .select("*")
    .eq("project_id", projectId)
    .in("status", ["received", "deposited", "applied"])
    .order("deposit_date", { ascending: true });

  if (error) {
    console.error("Error loading available deposits:", error);
    return [];
  }
  if (!deposits || deposits.length === 0) return [];

  const depositIds = deposits.map(d => d.id);
  const { data: allocations, error: allocError } = await supabase
    .from("deposit_allocations")
    .select("deposit_id, amount")
    .in("deposit_id", depositIds);

  if (allocError) {
    console.error("Error loading deposit allocations:", allocError);
    // Fail safe: treat as fully available rather than hiding deposits entirely.
  }

  const allocatedByDeposit = {};
  (allocations || []).forEach(a => {
    allocatedByDeposit[a.deposit_id] = (allocatedByDeposit[a.deposit_id] || 0) + (Number(a.amount) || 0);
  });

  return deposits
    .map(d => ({
      ...d,
      remaining_amount: Math.max(0, (Number(d.deposit_amount) || 0) - (allocatedByDeposit[d.id] || 0)),
    }))
    .filter(d => d.remaining_amount > 0.004); // guard against floating-point dust
}

/**
 * Apply deposits to a saved invoice, auto-applying each deposit's
 * remaining balance in order, capped at the invoice's own total — any
 * leftover deposit balance is left alone (not consumed) so it carries
 * forward for a future invoice on the same project.
 *
 * `deposits` should be the array returned by loadAvailableDeposits (so each
 * item has `remaining_amount`); plain project_deposits rows also work and
 * are treated as fully available (remaining_amount = deposit_amount).
 *
 * `invoiceTotal` is required — without a cap, a deposit larger than the
 * invoice would overpay it by the full deposit amount instead of leaving
 * the remainder available. Pass the invoice's total/subtotal.
 *
 * Records one deposit_allocations row per deposit actually applied (skips
 * deposits with $0 to apply, e.g. after the invoice total is already
 * covered by earlier deposits in the list). Updates project_deposits.status
 * to 'applied' only once a deposit's remaining balance reaches $0, so a
 * partially-applied deposit stays 'received'/'deposited' and keeps showing
 * up (with its new, smaller remaining_amount) in future pickers.
 *
 * Returns the total dollar amount actually applied (<= invoiceTotal).
 */
export async function applyDepositsToInvoice(invoiceId, deposits, invoiceTotal) {
  if (!invoiceId || !deposits || deposits.length === 0) return 0;

  // A caller passing invoiceTotal === 0 (e.g. a brand-new invoice with no
  // line items yet) means "nothing is owed yet" — that must cap application
  // at $0, NOT be treated as "no cap supplied" (which would apply the
  // deposit's full amount, uncapped). Only treat the cap as absent when
  // invoiceTotal itself is omitted/not a number (undefined, null, NaN) —
  // legacy callers that don't pass a third argument at all.
  const cap = Number(invoiceTotal);
  const hasCap = invoiceTotal !== undefined && invoiceTotal !== null && Number.isFinite(cap);

  let remainingToApply = hasCap ? Math.max(0, cap) : Infinity;
  let totalApplied = 0;
  let mostRecentDate = null;
  const allocationRows = [];
  const depositUpdates = []; // { id, newRemaining }

  for (const dep of deposits) {
    if (remainingToApply <= 0.004) break;

    const depRemaining = dep.remaining_amount != null
      ? Number(dep.remaining_amount)
      : Number(dep.deposit_amount) || 0;
    if (depRemaining <= 0.004) continue;

    const amountToApply = Math.min(depRemaining, remainingToApply);
    if (amountToApply <= 0.004) continue;

    allocationRows.push({ deposit_id: dep.id, invoice_id: invoiceId, amount: amountToApply });
    totalApplied += amountToApply;
    remainingToApply -= amountToApply;

    const newRemaining = depRemaining - amountToApply;
    depositUpdates.push({ id: dep.id, newRemaining });

    if (dep.deposit_date && (!mostRecentDate || dep.deposit_date > mostRecentDate)) {
      mostRecentDate = dep.deposit_date;
    }
  }

  if (allocationRows.length === 0) return 0;

  const { error: allocError } = await supabase
    .from("deposit_allocations")
    .insert(allocationRows);
  if (allocError) throw allocError;

  // Only flip a deposit's status to 'applied' (and set invoice_id/applied_date
  // for backward compatibility with anything still reading those columns)
  // once it's fully consumed. A partially-applied deposit keeps its current
  // status so loadAvailableDeposits continues to surface its remainder.
  for (const upd of depositUpdates) {
    if (upd.newRemaining <= 0.004) {
      const { error: depError } = await supabase
        .from("project_deposits")
        .update({
          invoice_id: invoiceId,
          status: "applied",
          applied_date: new Date().toISOString(),
        })
        .eq("id", upd.id);
      if (depError) throw depError;
    }
  }

  // invoices.deposit_received reflects the total applied to THIS invoice
  // specifically (additive with whatever was already applied, since this
  // function can in principle run more than once against the same invoice).
  const { data: currentInvoice } = await supabase
    .from("invoices")
    .select("deposit_received")
    .eq("id", invoiceId)
    .maybeSingle();
  const newDepositReceived = (Number(currentInvoice?.deposit_received) || 0) + totalApplied;

  const { error: invError } = await supabase
    .from("invoices")
    .update({
      deposit_received: newDepositReceived,
      deposit_date: mostRecentDate || new Date().toISOString().split("T")[0],
    })
    .eq("id", invoiceId);
  if (invError) throw invError;

  return totalApplied;
}
