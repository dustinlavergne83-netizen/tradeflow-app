import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { notify } from '../lib/notify';

export default function ServiceCalls() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending"); // pending | invoiced | all
  const [creating, setCreating] = useState(null); // service_call being converted

  useEffect(() => {
    loadCalls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function loadCalls() {
    setLoading(true);
    let q = supabase
      .from("service_calls")
      .select("*")
      .order("started_at", { ascending: false });

    if (filter !== "all") q = q.eq("status", filter);

    const { data, error } = await q;
    if (!error) setCalls(data || []);
    setLoading(false);
  }

  function formatDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  }

  function formatTime(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  }

  function calcHours(start, end) {
    if (!start || !end) return null;
    const h = (new Date(end) - new Date(start)) / 3600000;
    return Math.round(h * 100) / 100;
  }

  function materialTotal(materials) {
    if (!materials || !materials.length) return 0;
    return materials.reduce((s, m) => s + (parseFloat(m.unit_price || 0) * parseFloat(m.qty || 1)), 0);
  }

  function laborTotal(call) {
    const hrs = call.labor_hours ?? calcHours(call.started_at, call.ended_at) ?? 0;
    return hrs * (call.hourly_rate || 95);
  }

  function grandTotal(call) {
    return laborTotal(call) + materialTotal(call.materials);
  }

  async function createInvoice(call) {
    setCreating(call.id);

    // Build line items from labor + materials
    const hrs = call.labor_hours ?? calcHours(call.started_at, call.ended_at) ?? 0;
    const rate = call.hourly_rate || 95;

    const lineItems = [
      {
        description: `Labor – Service Call\n${call.description}`,
        qty: hrs,
        unit_price: rate,
        total: hrs * rate,
      },
      ...(call.materials || []).map((m) => ({
        description: m.name,
        qty: parseFloat(m.qty || 1),
        unit_price: parseFloat(m.unit_price || 0),
        total: parseFloat(m.qty || 1) * parseFloat(m.unit_price || 0),
      })),
    ];

    const subtotal = lineItems.reduce((s, l) => s + l.total, 0);

    // Create invoice
    const { data: inv, error } = await supabase
      .from("invoices")
      .insert([{
        company_id: call.company_id,
        customer_name: call.customer_name,
        address: call.address || "",
        invoice_type: "quick",
        status: "draft",
        subtotal,
        tax: 0,
        total: subtotal,
        line_items: lineItems,
        notes: `Service Call – ${call.description}\nTech: ${call.employee_name || ""}`,
        date: new Date().toISOString().split("T")[0],
      }])
      .select()
      .single();

    if (error) {
      notify("Error creating invoice: " + error.message);
      setCreating(null);
      return;
    }

    // Link service call to invoice
    await supabase
      .from("service_calls")
      .update({ invoice_id: inv.id, status: "invoiced" })
      .eq("id", call.id);

    setCreating(null);
    await loadCalls();
    notify(`✅ Invoice created! Invoice #${inv.id}`);
    window.open(`/invoice/view?id=${inv.id}`, "_blank");
  }

  const pending = calls.filter((c) => c.status === "pending");
  const invoiced = calls.filter((c) => c.status === "invoiced");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black">🔧 Service Calls</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review completed service calls and generate T&amp;M invoices
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {["pending", "invoiced", "all"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-colors ${
                filter === f
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f}
              {f === "pending" && pending.length > 0 && (
                <span className="ml-1 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5">
                  {pending.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading…</div>
      ) : calls.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">🔧</div>
          <p className="font-semibold text-lg">No {filter !== "all" ? filter : ""} service calls</p>
          <p className="text-sm mt-2">
            Service calls appear here when technicians clock in using the "Service Call" option in the mobile app.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {calls.map((call) => {
            const hrs = call.labor_hours ?? calcHours(call.started_at, call.ended_at);
            const rate = call.hourly_rate || 95;
            const matTotal = materialTotal(call.materials);
            const labTotal = hrs ? hrs * rate : 0;
            const total = labTotal + matTotal;

            return (
              <div
                key={call.id}
                className={`bg-white rounded-xl border-2 p-5 ${
                  call.status === "pending"
                    ? "border-orange-200 shadow-sm"
                    : "border-gray-100"
                }`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          call.status === "pending"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {call.status === "pending" ? "⏳ Pending" : "✅ Invoiced"}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(call.started_at)}
                      </span>
                    </div>

                    <h2 className="text-lg font-black mt-1 truncate">
                      {call.customer_name}
                    </h2>
                    <p className="text-sm text-gray-600 mt-0.5">{call.description}</p>

                    {call.address && (
                      <p className="text-xs text-gray-400 mt-1">📍 {call.address}</p>
                    )}
                  </div>

                  {/* Totals */}
                  <div className="text-right">
                    <div className="text-2xl font-black text-green-700">
                      ${total.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-400">Grand Total</div>
                  </div>
                </div>

                {/* Details row */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 font-semibold">Technician</div>
                    <div className="font-bold text-sm mt-0.5">{call.employee_name || "—"}</div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 font-semibold">Time</div>
                    <div className="font-bold text-sm mt-0.5">
                      {formatTime(call.started_at)} – {formatTime(call.ended_at)}
                    </div>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-xs text-blue-600 font-semibold">Labor</div>
                    <div className="font-black text-sm mt-0.5">
                      {hrs ? `${hrs} hrs × $${rate}/hr` : "—"}
                    </div>
                    <div className="text-xs text-blue-700 font-bold">
                      ${labTotal.toFixed(2)}
                    </div>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-3">
                    <div className="text-xs text-purple-600 font-semibold">Materials</div>
                    <div className="font-black text-sm mt-0.5">
                      {(call.materials || []).length} item
                      {(call.materials || []).length !== 1 ? "s" : ""}
                    </div>
                    <div className="text-xs text-purple-700 font-bold">
                      ${matTotal.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Materials list */}
                {call.materials && call.materials.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-bold text-gray-500 mb-1">MATERIALS USED</div>
                    <div className="bg-gray-50 rounded-lg divide-y divide-gray-100">
                      {call.materials.map((m, i) => (
                        <div key={i} className="flex justify-between items-center px-3 py-2 text-sm">
                          <span className="font-medium">{m.name}</span>
                          <span className="text-gray-500">
                            {m.qty} × ${parseFloat(m.unit_price || 0).toFixed(2)} ={" "}
                            <span className="font-bold text-gray-800">
                              ${(parseFloat(m.qty || 1) * parseFloat(m.unit_price || 0)).toFixed(2)}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {call.notes && (
                  <div className="mt-3 text-sm text-gray-500 bg-yellow-50 rounded-lg p-3">
                    <span className="font-bold">Notes: </span>{call.notes}
                  </div>
                )}

                {/* Action buttons */}
                {call.status === "pending" && (
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => createInvoice(call)}
                      disabled={creating === call.id}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-black py-3 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {creating === call.id
                        ? "Creating Invoice…"
                        : "📄 Create T&M Invoice"}
                    </button>
                  </div>
                )}

                {call.status === "invoiced" && call.invoice_id && (
                  <div className="mt-4">
                    <a
                      href={`/invoice/view?id=${call.invoice_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg text-sm transition-colors"
                    >
                      🔗 View Invoice
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
