import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import logoImage from "../assets/LOGOD.jpg";

const ACCENT = "#fc6b04";
const GREEN = "#16a34a";

export default function InvoicePaySuccess() {
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get("invoiceId");
  const sessionId = searchParams.get("session_id");

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (invoiceId) loadInvoice();
  }, [invoiceId]);

  async function loadInvoice() {
    try {
      const { data } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .single();
      setInvoice(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const fmtMoney = (n) =>
    "$" + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (loading) {
    return (
      <div style={pg}>
        <p style={{ textAlign: "center", padding: "60px", color: "#666", fontSize: 16 }}>
          Loading...
        </p>
      </div>
    );
  }

  const isPending = invoice?.status === "payment_pending";

  return (
    <div style={pg}>
      <div style={card}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img
            src={logoImage}
            alt="DML Electrical"
            style={{ maxWidth: 180, width: "100%", height: "auto" }}
          />
        </div>

        {/* Success Icon */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              backgroundColor: isPending ? "#fef9c3" : "#dcfce7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: 40,
            }}
          >
            {isPending ? "⏳" : "✅"}
          </div>

          <h1
            style={{
              fontSize: 26,
              fontWeight: "bold",
              color: isPending ? "#92400e" : GREEN,
              margin: "0 0 8px",
            }}
          >
            {isPending ? "Payment Initiated" : "Payment Received!"}
          </h1>

          <p style={{ fontSize: 15, color: "#555", margin: 0, lineHeight: 1.6 }}>
            {isPending
              ? "Your ACH bank transfer has been initiated. Payments typically clear within 2–5 business days. We'll update your invoice once funds are confirmed."
              : "Thank you! Your payment has been processed successfully."}
          </p>
        </div>

        {/* Invoice Summary */}
        {invoice && (
          <div
            style={{
              background: "#f9fafb",
              borderRadius: 10,
              padding: "16px 20px",
              marginBottom: 24,
              borderLeft: `4px solid ${isPending ? ACCENT : GREEN}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "#666" }}>Invoice #</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>
                {invoice.invoice_number}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "#666" }}>Customer</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>
                {invoice.customer_name}
              </span>
            </div>
            {invoice.project_name && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "#666" }}>Project</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>
                  {invoice.project_name}
                </span>
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingTop: 10,
                borderTop: "1px solid #e5e7eb",
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>
                {isPending ? "Amount Initiated" : "Amount Paid"}
              </span>
              <span
                style={{ fontSize: 18, fontWeight: "bold", color: isPending ? ACCENT : GREEN }}
              >
                {fmtMoney(invoice.amount_paid || invoice.total)}
              </span>
            </div>
          </div>
        )}

        {/* What's next for ACH */}
        {isPending && (
          <div
            style={{
              background: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: 8,
              padding: "12px 16px",
              marginBottom: 20,
              fontSize: 13,
              color: "#78350f",
              lineHeight: 1.6,
            }}
          >
            <strong>What happens next?</strong>
            <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
              <li>Your bank will verify and process the transfer</li>
              <li>Funds typically arrive in 2–5 business days</li>
              <li>Your invoice will automatically update to "Paid" once confirmed</li>
              <li>You'll receive a receipt email when payment clears</li>
            </ul>
          </div>
        )}

        {/* View invoice link */}
        {invoiceId && (
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <Link
              to={`/invoice/view?invoiceId=${invoiceId}`}
              style={{
                display: "inline-block",
                padding: "12px 32px",
                background: ACCENT,
                color: "#fff",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: "bold",
                fontSize: 15,
              }}
            >
              📄 View Invoice
            </Link>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            textAlign: "center",
            borderTop: "1px solid #eee",
            paddingTop: 16,
            marginTop: 16,
          }}
        >
          <p style={{ fontSize: 12, color: "#bbb", margin: "2px 0" }}>
            Thank you for choosing DML Electrical Service, LLC
          </p>
          <p style={{ fontSize: 12, color: "#bbb", margin: "2px 0" }}>
            (337) 288-0395 · info@dmlelectrical.com
          </p>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#555", margin: "8px 0 0" }}>
            P.O. Box 363, Jennings, LA 70546
          </p>
        </div>
      </div>
    </div>
  );
}

const pg = {
  minHeight: "100vh",
  background: "#f3f4f6",
  padding: "12px",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const card = {
  maxWidth: 520,
  margin: "0 auto",
  background: "#fff",
  borderRadius: 12,
  padding: "28px 20px",
  boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
};
