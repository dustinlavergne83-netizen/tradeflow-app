import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { formatDate } from "../utils/dateUtils";
import { notify, confirmDialog } from '../lib/notify';

const BRAND = {
  bg: "#0b3ea8",
  text: "#f97316", 
  accent: "#fc6b04ff",
  primary: "#2563eb",
};

const MATERIAL_CATEGORIES = [
  'Wire & Cable',
  'Conduit & Fittings', 
  'Electrical Devices',
  'Fixtures',
  'Panels & Breakers',
  'Hardware & Fasteners',
  'Tools & Supplies',
  'Other'
];

export default function ProjectMaterialList() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [project, setProject] = useState(null);
  const [materialLists, setMaterialLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddListModal, setShowAddListModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showEditListModal, setShowEditListModal] = useState(false);
  const [editingList, setEditingList] = useState(null);
  const [editListForm, setEditListForm] = useState({ title: '', description: '', status: 'draft' });
  const [selectedList, setSelectedList] = useState(null);
  const [expandedList, setExpandedList] = useState(null);
  const [editingItems, setEditingItems] = useState([]);
  const [savingItems, setSavingItems] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState({});
  const [itemListRefreshKey, setItemListRefreshKey] = useState({});
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendingList, setSendingList] = useState(null);
  const [sendForm, setSendForm] = useState({ email: '', phone: '' });
  const [sending, setSending] = useState(false);
  const [allVendors, setAllVendors] = useState([]);
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [sendMethod, setSendMethod] = useState('email'); // 'email' | 'text' | 'both'
  const [vendorContactsList, setVendorContactsList] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  
  const [listForm, setListForm] = useState({
    title: 'Material List',
    description: '',
    status: 'draft'
  });
  
  const [itemForm, setItemForm] = useState({
    description: '',
    quantity: 1,
    unit: 'ea',
    unit_cost: 0,
    vendor: '',
    manufacturer: '',
    part_number: '',
    category: 'Wire & Cable',
    notes: ''
  });

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  async function loadData() {
    try {
      // Load project
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      // Load material lists
      const { data: listsData, error: listsError } = await supabase
        .from("project_material_lists")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false });

      if (listsError) throw listsError;
      setMaterialLists(listsData || []);

    } catch (err) {
      console.error("Error loading data:", err);
      notify("Failed to load material lists: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateList() {
    if (!editListForm.title.trim()) {
      notify('List title is required');
      return;
    }
    try {
      const { error } = await supabase
        .from("project_material_lists")
        .update({
          title: editListForm.title.trim(),
          description: editListForm.description.trim() || null,
          status: editListForm.status,
        })
        .eq("id", editingList.id);

      if (error) throw error;

      setMaterialLists(materialLists.map(l =>
        l.id === editingList.id
          ? { ...l, title: editListForm.title.trim(), description: editListForm.description.trim() || null, status: editListForm.status }
          : l
      ));
      setShowEditListModal(false);
      setEditingList(null);
    } catch (err) {
      console.error("Error updating list:", err);
      notify("Failed to update list: " + err.message);
    }
  }

  async function handleDeleteList(list) {
    if (!window.await confirmDialog(`Delete "${list.title}" and all its items? This cannot be undone.`)) return;
    try {
      // Delete items first
      const { error: itemsError } = await supabase
        .from("material_list_items")
        .delete()
        .eq("material_list_id", list.id);
      if (itemsError) throw itemsError;

      // Delete the list
      const { error } = await supabase
        .from("project_material_lists")
        .delete()
        .eq("id", list.id);
      if (error) throw error;

      setMaterialLists(materialLists.filter(l => l.id !== list.id));
      if (expandedList === list.id) setExpandedList(null);
    } catch (err) {
      console.error("Error deleting list:", err);
      notify("Failed to delete list: " + err.message);
    }
  }

  async function handleCreateList() {
    if (!listForm.title.trim()) {
      notify('List title is required');
      return;
    }

    try {
      const { data, error } = await supabase
        .from("project_material_lists")
        .insert([{
          project_id: id,
          title: listForm.title.trim(),
          description: listForm.description.trim() || null,
          status: listForm.status,
          created_by: user?.id
        }])
        .select()
        .single();

      if (error) throw error;

      setMaterialLists([data, ...materialLists]);
      setShowAddListModal(false);
      setListForm({ title: 'Material List', description: '', status: 'draft' });
      notify('Material list created successfully!');

    } catch (err) {
      console.error("Error creating list:", err);
      notify("Failed to create list: " + err.message);
    }
  }

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  async function exportMaterialListCSV(list) {
    try {
      const { data: items, error } = await supabase
        .from("material_list_items")
        .select("*")
        .eq("material_list_id", list.id)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      if (!items || items.length === 0) { notify("No items to export in this list"); return; }

      const headers = ["Qty", "Unit", "Description", "Cost", "Ext Cost"];
      const csvRows = [
        headers.join(","),
        ...items.map(item => [
          item.quantity || 0,
          `"${item.unit || 'ea'}"`,
          `"${(item.description || '').replace(/"/g, '""')}"`,
          item.unit_cost || 0,
          item.total_cost || 0
        ].join(","))
      ];

      const projectInfo = [
        `"Project: ${project.name}"`,
        `"Material List: ${list.title}"`,
        ...(list.description ? [`"${list.description.replace(/"/g, '""')}"`, ""] : [""]),
        `"Created: ${formatDate(list.created_at)}"`,
        `"Total Items: ${items.length}"`,
        `"Total Cost: $${items.reduce((sum, item) => sum + (item.total_cost || 0), 0).toFixed(2)}"`,
        "",
        ""
      ];

      const fullCSV = [...projectInfo, ...csvRows].join("\n");
      const blob = new Blob([fullCSV], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `${project.name}_${list.title}_Materials.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting CSV:", err);
      notify("Failed to export material list: " + err.message);
    }
  }

  async function printMaterialListPDF(list) {
    try {
      const { data: items, error } = await supabase
        .from("material_list_items")
        .select("*")
        .eq("material_list_id", list.id)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      if (!items || items.length === 0) { notify("No items to print in this list"); return; }

      const totalCost = items.reduce((sum, i) => sum + (i.total_cost || 0), 0);

      const rows = items.map(item => `
        <tr>
          <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity || ''}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.unit || 'ea'}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;">${item.description || ''}</td>
        </tr>
      `).join('');

      // Build plain-text body for email/text — embedded in the popup so buttons work standalone
      const separator = '─'.repeat(50);
      const plainTextBody =
        `${project.name}\n${separator}\n${list.title}\n` +
        (list.description ? `${list.description}\n` : '') +
        `${separator}\n\n` +
        items.map(i => `  • ${i.quantity} ${i.unit || 'ea'}   ${i.description}`).join('\n') +
        `\n\n${separator}\nTotal items: ${items.length}`;

      const emailSubject = encodeURIComponent(`Material List – ${list.title} | ${project.name}`);
      const emailBody = encodeURIComponent(plainTextBody);
      // Escape for embedding in HTML JS string
      const jsBody = plainTextBody.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');

      const html = `<!DOCTYPE html><html><head><title>${list.title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20mm; font-size: 11pt; color: #111; }
          h1 { font-size: 16pt; margin: 0 0 4px 0; }
          h2 { font-size: 13pt; margin: 0 0 4px 0; color: #333; }
          .desc { font-size: 11pt; color: #555; margin: 0 0 16px 0; }
          .meta { font-size: 10pt; color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #1e3a5f; color: #fff; padding: 8px; text-align: left; font-size: 11pt; }
          th.center { text-align: center; }
          tr:nth-child(even) td { background: #f5f7fa; }
          .total-row td { font-weight: bold; border-top: 2px solid #1e3a5f; padding: 8px; font-size: 12pt; }
          .toolbar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:20px; }
          .btn { padding:10px 18px; border:none; border-radius:7px; font-size:14px; font-weight:700; cursor:pointer; }
          .toast { display:none; position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
            background:#0b3ea8; color:#fff; padding:14px 24px; border-radius:10px; font-size:14px;
            font-weight:700; border:2px solid #fc6b04; box-shadow:0 4px 20px rgba(0,0,0,0.3);
            z-index:9999; max-width:480px; text-align:center; }
          @media print { .no-print { display: none; } }
        </style>
        <script>
          function sendEmail() {
            window.location.href = 'mailto:?subject=${emailSubject}&body=${emailBody}';
          }
          async function sendText() {
            try {
              await navigator.clipboard.writeText(\`${jsBody}\`);
            } catch(e) {}
            window.location.href = 'ms-phone-link:';
            var t = document.getElementById('toast');
            t.style.display = 'block';
            setTimeout(function(){ t.style.display = 'none'; }, 12000);
          }
        <\/script>
        </head><body>
        <div class="no-print toolbar">
          <button class="btn" onclick="window.print()" style="background:#0b3ea8;color:#fff;">🖨️ Print / Save PDF</button>
          <button class="btn" onclick="sendEmail()" style="background:#059669;color:#fff;">📧 Send Email</button>
          <button class="btn" onclick="sendText()" style="background:#7c3aed;color:#fff;">📱 Send Text</button>
          <button class="btn" onclick="window.close()" style="background:#666;color:#fff;">Close</button>
        </div>
        <div id="toast" class="toast no-print">
          📋 <strong>Copied to clipboard!</strong><br>
          In Phone Link click <strong>✏️ compose</strong>, pick a contact, then press <strong>Ctrl+V</strong>
        </div>
        <h1>${project.name}</h1>
        <h2>${list.title}</h2>
        ${list.description ? `<p class="desc">${list.description}</p>` : ''}
        <p class="meta">Created: ${formatDate(list.created_at)} &nbsp;|&nbsp; Items: ${items.length} &nbsp;|&nbsp; Status: ${list.status}</p>
        <table>
          <thead>
            <tr>
              <th class="center" style="width:60px">Qty</th>
              <th class="center" style="width:60px">Unit</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body></html>`;

      const w = window.open('', '_blank', 'width=800,height=900');
      w.document.write(html);
      w.document.close();
    } catch (err) {
      console.error("Error printing material list:", err);
      notify("Failed to generate print view: " + err.message);
    }
  }

  async function sendMaterialList(list, toSend) {
    const emailAddr = (toSend?.email || '').trim();
    const isText = toSend?.isText === true;

    if (!emailAddr && !isText) {
      notify('Please enter an email address or choose Text');
      return;
    }
    setSending(true);
    try {
      const { data: items, error } = await supabase
        .from("material_list_items")
        .select("*")
        .eq("material_list_id", list.id)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      if (!items || items.length === 0) { notify("No items to send in this list"); return; }

      const subject = `Material List – ${list.title} | ${project.name}`;

      // Formatted plain-text body (goes directly into Outlook / Phone Link)
      const maxWidth = 60;
      const separator = '─'.repeat(maxWidth);
      const lineItems = items.map(i =>
        `  • ${i.quantity} ${i.unit || 'ea'}   ${i.description}`
      ).join('\n');

      const body =
        `${project.name}\n` +
        `${separator}\n` +
        `${list.title}\n` +
        (list.description ? `${list.description}\n` : '') +
        `${separator}\n\n` +
        lineItems +
        `\n\n${separator}\n` +
        `Total items: ${items.length}`;

      // EMAIL → open Outlook directly, full list in body, no attachment needed
      if (emailAddr) {
        const mailtoUri = `mailto:${encodeURIComponent(emailAddr)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoUri;
      }

      // TEXT → copy to clipboard + open Phone Link + show paste instruction
      if (isText) {
        const smsBody = body.length > 1600 ? body.substring(0, 1597) + '...' : body;
        try { await navigator.clipboard.writeText(smsBody); } catch (_) {}
        // Open Phone Link
        setTimeout(() => { window.location.href = 'ms-phone-link:'; }, emailAddr ? 800 : 0);
        // Show a floating instruction banner
        const banner = document.createElement('div');
        banner.id = 'phone-link-toast';
        banner.style.cssText = `
          position:fixed; bottom:32px; left:50%; transform:translateX(-50%);
          background:#0b3ea8; color:#fff; padding:16px 28px; border-radius:12px;
          font-size:16px; font-weight:700; z-index:99999; box-shadow:0 4px 24px rgba(0,0,0,0.4);
          display:flex; align-items:center; gap:12px; max-width:520px; text-align:center;
          border:2px solid #fc6b04;
        `;
        banner.innerHTML = `
          <span style="font-size:26px">📋</span>
          <span>Message <strong>copied to clipboard!</strong><br>
          In Phone Link, click the <strong>✏️ compose button</strong> (top right of Messages), pick a contact, then press <strong>Ctrl+V</strong> to paste.</span>
          <button onclick="document.getElementById('phone-link-toast').remove()" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;padding:0 4px;line-height:1;flex-shrink:0">×</button>
        `;
        document.body.appendChild(banner);
        setTimeout(() => banner?.remove(), 15000);
      }

      setShowSendModal(false);
      setSendForm({ email: '' });
      setSelectedContact(null);
      setSelectedVendor(null);
      setVendorSearch('');
    } catch (err) {
      console.error("Error preparing send:", err);
      notify("Failed to prepare send: " + err.message);
    } finally {
      setSending(false);
    }
  }

  if (!project) {
    return <div style={styles.error}>Project not found</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>📋 Material Lists</h1>
          <p style={styles.subtitle}>Project: {project.name}</p>
        </div>
        <div style={{display: 'flex', gap: 12}}>
          <button 
            onClick={() => setShowAddListModal(true)}
            style={styles.addButton}
          >
            + New Material List
          </button>
          <button 
            onClick={() => navigate(`/project/${id}`)} 
            style={styles.backButton}
          >
            ← Back to Project
          </button>
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Material Lists ({materialLists.length})</h2>
          
          {materialLists.length === 0 ? (
            <div style={styles.emptyState}>
              <p>No material lists created yet.</p>
              <button 
                onClick={() => setShowAddListModal(true)}
                style={styles.primaryButton}
              >
                Create Your First Material List
              </button>
            </div>
          ) : (
            <div style={styles.listContainer}>
              {materialLists.map((list) => (
                <div key={list.id} style={styles.listCard}>
                  <div style={styles.listHeader}>
                    <div style={styles.listInfo}>
                      <h3 style={styles.listTitle}>{list.title}</h3>
                      <div style={styles.listMeta}>
                        <span style={{...styles.badge, backgroundColor: getBadgeColor(list.status)}}>
                          {list.status}
                        </span>
                        <span style={styles.listDate}>
                          Created {formatDate(list.created_at)}
                        </span>
                      </div>
                      {list.description && (
                        <p style={styles.listDescription}>{list.description}</p>
                      )}
                    </div>
                    <div style={styles.listActions}>
                      <button
                        onClick={() => {
                          setSelectedList(list);
                          setEditingItems([
                            { description: '', quantity: 1, unit: 'ea', unit_cost: 0, vendor: '', category: 'Wire & Cable' },
                            { description: '', quantity: 1, unit: 'ea', unit_cost: 0, vendor: '', category: 'Wire & Cable' },
                            { description: '', quantity: 1, unit: 'ea', unit_cost: 0, vendor: '', category: 'Wire & Cable' },
                            { description: '', quantity: 1, unit: 'ea', unit_cost: 0, vendor: '', category: 'Wire & Cable' },
                            { description: '', quantity: 1, unit: 'ea', unit_cost: 0, vendor: '', category: 'Wire & Cable' }
                          ]);
                          setShowAddItemModal(true);
                        }}
                        style={styles.actionButton}
                      >
                        + Add Items
                      </button>
                      <button
                        onClick={() => printMaterialListPDF(list)}
                        style={{...styles.actionButton, backgroundColor: '#7c3aed'}}
                      >
                        🖨️ Print / PDF
                      </button>
                      <button
                        onClick={() => exportMaterialListCSV(list)}
                        style={{...styles.actionButton, backgroundColor: '#059669'}}
                      >
                        📤 Export CSV
                      </button>
                      <button
                        onClick={() => {
                          setSelectedList(list);
                          setShowUploadModal(true);
                        }}
                        style={{...styles.actionButton, backgroundColor: '#10b981'}}
                      >
                        📎 Upload Files
                      </button>
                      <button
                        onClick={() => setExpandedList(expandedList === list.id ? null : list.id)}
                        style={styles.actionButton}
                      >
                        {expandedList === list.id ? 'Hide' : 'View'} Items
                      </button>
                      <button
                        onClick={() => {
                          setEditingList(list);
                          setEditListForm({ title: list.title, description: list.description || '', status: list.status });
                          setShowEditListModal(true);
                        }}
                        style={{...styles.actionButton, backgroundColor: '#f59e0b'}}
                      >
                        ✏️ Edit List
                      </button>
                      <button
                        onClick={() => handleDeleteList(list)}
                        style={{...styles.actionButton, backgroundColor: '#dc2626'}}
                      >
                        🗑️ Delete List
                      </button>
                    </div>
                  </div>
                  
                  {expandedList === list.id && (
                    <MaterialListItems
                      listId={list.id}
                      refreshKey={itemListRefreshKey[list.id] || 0}
                      onRefresh={() => setItemListRefreshKey(prev => ({ ...prev, [list.id]: (prev[list.id] || 0) + 1 }))}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add List Modal */}
      {showAddListModal && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>Create Material List</h2>
            
            <div style={styles.field}>
              <label style={styles.label}>Title</label>
              <input
                type="text"
                value={listForm.title}
                onChange={(e) => setListForm({...listForm, title: e.target.value})}
                style={styles.input}
                placeholder="e.g., Rough-in Materials, Final Materials"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Description</label>
              <textarea
                value={listForm.description}
                onChange={(e) => setListForm({...listForm, description: e.target.value})}
                style={styles.textarea}
                placeholder="Optional description..."
                rows={3}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Status</label>
              <select
                value={listForm.status}
                onChange={(e) => setListForm({...listForm, status: e.target.value})}
                style={styles.select}
              >
                <option value="draft">Draft</option>
                <option value="ordered">Ordered</option>
                <option value="received">Received</option>
                <option value="complete">Complete</option>
              </select>
            </div>

            <div style={styles.modalActions}>
              <button
                onClick={() => setShowAddListModal(false)}
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateList}
                style={styles.primaryButton}
              >
                Create List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Items Modal - Spreadsheet Style */}
      {showAddItemModal && selectedList && (
        <div style={styles.modal}>
          <div style={{...styles.modalContent, maxWidth: 1200, maxHeight: '90vh', overflow: 'auto'}}>
            <h2 style={styles.modalTitle}>Add Items to {selectedList.title}</h2>
            <p style={{fontSize: 14, color: '#666', marginBottom: 20}}>
              Enter items in the spreadsheet below. Leave description blank to skip a row.
            </p>

            {/* Spreadsheet Header — Qty | Unit | Description */}
            <div style={styles.spreadsheetContainer}>
              <div style={styles.spreadsheetHeader}>
                <div style={{...styles.spreadsheetCell, flex: '0 0 70px'}}>Qty</div>
                <div style={{...styles.spreadsheetCell, flex: '0 0 90px'}}>Unit</div>
                <div style={{...styles.spreadsheetCell, flex: 1}}>Description</div>
              </div>

              {/* Spreadsheet Rows */}
              <div style={styles.spreadsheetBody}>
                {editingItems.map((item, index) => (
                  <div key={index} style={styles.spreadsheetRow}>
                    {/* Qty */}
                    <div style={{...styles.spreadsheetCell, flex: '0 0 70px'}}>
                      <input
                        id={`mat-qty-${index}`}
                        type="text"
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...editingItems];
                          updated[index].quantity = e.target.value;
                          setEditingItems(updated);
                        }}
                        onBlur={(e) => {
                          const updated = [...editingItems];
                          updated[index].quantity = parseFloat(e.target.value) || 0;
                          setEditingItems(updated);
                        }}
                        onFocus={(e) => e.target.select()}
                        style={styles.spreadsheetInput}
                      />
                    </div>
                    {/* Unit */}
                    <div style={{...styles.spreadsheetCell, flex: '0 0 90px'}}>
                      <select
                        value={item.unit}
                        onChange={(e) => {
                          const updated = [...editingItems];
                          updated[index].unit = e.target.value;
                          setEditingItems(updated);
                        }}
                        style={styles.spreadsheetSelect}
                      >
                        <option value="ea">ea</option>
                        <option value="ft">ft</option>
                        <option value="lf">lf</option>
                        <option value="roll">roll</option>
                        <option value="box">box</option>
                        <option value="bag">bag</option>
                        <option value="lb">lb</option>
                        <option value="gal">gal</option>
                        <option value="set">set</option>
                      </select>
                    </div>
                    {/* Description — Enter moves to next row */}
                    <div style={{...styles.spreadsheetCell, flex: 1}}>
                      <input
                        id={`mat-desc-${index}`}
                        type="text"
                        value={item.description}
                        onChange={(e) => {
                          const updated = [...editingItems];
                          updated[index].description = e.target.value;
                          setEditingItems(updated);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const nextIndex = index + 1;
                            if (nextIndex < editingItems.length) {
                              // Jump to Qty of the next row
                              document.getElementById(`mat-qty-${nextIndex}`)?.focus();
                            } else {
                              // At last row — add 5 more rows then jump to next Qty
                              const newRows = Array(5).fill(null).map(() => ({
                                description: '', quantity: 1, unit: 'ea', unit_cost: 0, vendor: '', category: 'Wire & Cable'
                              }));
                              setEditingItems(prev => {
                                const updated = [...prev, ...newRows];
                                setTimeout(() => document.getElementById(`mat-qty-${nextIndex}`)?.focus(), 50);
                                return updated;
                              });
                            }
                          }
                        }}
                        style={{...styles.spreadsheetInput, width: '100%'}}
                        placeholder="e.g., 12 AWG THHN Wire"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add More Rows Button */}
            <div style={{marginTop: 16, marginBottom: 24}}>
              <button
                onClick={() => {
                  const newRows = Array(5).fill(null).map(() => ({
                    description: '', quantity: 1, unit: 'ea', unit_cost: 0, vendor: '', category: 'Wire & Cable'
                  }));
                  setEditingItems([...editingItems, ...newRows]);
                }}
                style={styles.addRowsButton}
              >
                + Add 5 More Rows
              </button>
            </div>

            {/* Total Summary */}
            <div style={styles.totalSummary}>
              <strong>
                Total Items: {editingItems.filter(item => item.description.trim()).length} • 
                Total Cost: ${editingItems.reduce((sum, item) => 
                  sum + (item.description.trim() ? (item.quantity || 0) * (item.unit_cost || 0) : 0), 0
                ).toFixed(2)}
              </strong>
            </div>

            <div style={styles.modalActions}>
              <button
                onClick={() => {
                  setShowAddItemModal(false);
                  setEditingItems([]);
                  setSelectedList(null);
                }}
                style={styles.cancelButton}
                disabled={savingItems}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setSavingItems(true);
                  try {
                    // Filter out empty rows and prepare items for insert
                    const itemsToSave = editingItems
                      .filter(item => item.description.trim())
                      .map((item, index) => ({
                        material_list_id: selectedList.id,
                        description: item.description.trim(),
                        quantity: item.quantity || 1,
                        unit: item.unit || 'ea',
                        unit_cost: item.unit_cost || 0,
                        vendor: item.vendor?.trim() || null,
                        category: item.category || 'Wire & Cable',
                        sort_order: index
                      }));

                    if (itemsToSave.length === 0) {
                      notify('Please enter at least one item with a description');
                      setSavingItems(false);
                      return;
                    }

                    const { error } = await supabase
                      .from("material_list_items")
                      .insert(itemsToSave);

                    if (error) throw error;

                    notify(`Added ${itemsToSave.length} items to the list!`);
                    setShowAddItemModal(false);
                    setEditingItems([]);
                    setSelectedList(null);
                    loadData(); // Refresh the lists
                  } catch (err) {
                    console.error("Error saving items:", err);
                    notify("Failed to save items: " + err.message);
                  } finally {
                    setSavingItems(false);
                  }
                }}
                style={{...styles.primaryButton, opacity: savingItems ? 0.6 : 1}}
                disabled={savingItems}
              >
                {savingItems ? '⏳ Saving...' : `💾 Save Items`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit List Modal */}
      {showEditListModal && editingList && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>✏️ Edit Material List</h2>

            <div style={styles.field}>
              <label style={styles.label}>Title</label>
              <input
                type="text"
                value={editListForm.title}
                onChange={(e) => setEditListForm({...editListForm, title: e.target.value})}
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Description</label>
              <textarea
                value={editListForm.description}
                onChange={(e) => setEditListForm({...editListForm, description: e.target.value})}
                style={styles.textarea}
                placeholder="Optional description..."
                rows={3}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Status</label>
              <select
                value={editListForm.status}
                onChange={(e) => setEditListForm({...editListForm, status: e.target.value})}
                style={styles.select}
              >
                <option value="draft">Draft</option>
                <option value="ordered">Ordered</option>
                <option value="received">Received</option>
                <option value="complete">Complete</option>
              </select>
            </div>

            <div style={styles.modalActions}>
              <button
                onClick={() => { setShowEditListModal(false); setEditingList(null); }}
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateList}
                style={styles.primaryButton}
              >
                💾 Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Upload Modal */}
      {showUploadModal && selectedList && (
        <FileUploadModal
          isOpen={showUploadModal}
          onClose={() => {
            setShowUploadModal(false);
            setSelectedList(null);
          }}
          projectId={id}
          materialListId={selectedList.id}
          listTitle={selectedList.title}
          uploading={uploading}
          setUploading={setUploading}
        />
      )}

      {/* Send Email / Text Modal — Vendor Picker */}
      {showSendModal && sendingList && (
        <div style={styles.modal}>
          <div style={{...styles.modalContent, maxWidth: 520}}>
            <h2 style={styles.modalTitle}>📧 Send Material List</h2>
            <p style={{fontSize: 14, color: '#555', marginBottom: 20}}>
              <strong>{sendingList.title}</strong> — {project.name}
            </p>

            {/* Step 1: Vendor Search */}
            <div style={styles.field}>
              <label style={styles.label}>🏪 Search Vendor</label>
              <div style={{position: 'relative'}}>
                <input
                  type="text"
                  value={vendorSearch}
                  onChange={(e) => {
                    setVendorSearch(e.target.value);
                    setSelectedVendor(null);
                    setSendForm({ email: '', phone: '' });
                    setVendorDropdownOpen(true);
                  }}
                  onFocus={() => setVendorDropdownOpen(true)}
                  style={{...styles.input, paddingRight: vendorSearch ? 36 : 12}}
                  placeholder="Type vendor name..."
                  autoFocus
                  autoComplete="off"
                />
                {vendorSearch && (
                  <button
                    onClick={() => { setVendorSearch(''); setSelectedVendor(null); setSendForm({ email: '', phone: '' }); }}
                    style={{position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#999'}}
                  >×</button>
                )}
                {/* Dropdown */}
                {vendorDropdownOpen && vendorSearch.length > 0 && (() => {
                  const filtered = allVendors.filter(v =>
                    v.vendor_name?.toLowerCase().includes(vendorSearch.toLowerCase()) ||
                    v.contact_person?.toLowerCase().includes(vendorSearch.toLowerCase())
                  ).slice(0, 8);
                  return filtered.length > 0 ? (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 3000,
                      backgroundColor: '#fff', border: '2px solid #d1d5db', borderRadius: 8,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.15)', maxHeight: 240, overflowY: 'auto'
                    }}>
                      {filtered.map(v => (
                        <div
                          key={v.id}
                          onClick={async () => {
                            setSelectedVendor(v);
                            setVendorSearch(v.vendor_name);
                            setVendorDropdownOpen(false);
                            setSelectedContact(null);
                            // Load contacts for this vendor
                            setLoadingContacts(true);
                            const { data: contacts } = await supabase
                              .from('vendor_contacts')
                              .select('*')
                              .eq('vendor_id', v.id)
                              .order('is_primary', { ascending: false })
                              .order('created_at', { ascending: true });
                            setVendorContactsList(contacts || []);
                            setLoadingContacts(false);
                            // Default to vendor's primary email/phone
                            setSendForm({ email: v.email || '', phone: v.phone || '' });
                          }}
                          style={{
                            padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6',
                            transition: 'background 0.1s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0f9ff'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                        >
                          <div style={{fontWeight: 700, fontSize: 14, color: '#111'}}>{v.vendor_name}</div>
                          {v.contact_person && <div style={{fontSize: 13, color: '#555'}}>👤 {v.contact_person}</div>}
                          <div style={{fontSize: 12, color: '#888', display: 'flex', gap: 12, marginTop: 2}}>
                            {v.email && <span>✉ {v.email}</span>}
                            {v.phone && <span>📱 {v.phone}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 3000,
                      backgroundColor: '#fff', border: '2px solid #d1d5db', borderRadius: 8,
                      padding: '12px 14px', color: '#888', fontSize: 14
                    }}>No vendors found</div>
                  );
                })()}
              </div>
            </div>

            {/* Step 2: Pick a Contact */}
            {selectedVendor && (
              <div style={{marginBottom: 20}}>
                <label style={{...styles.label, marginBottom: 10}}>👤 Pick a Contact</label>

                {loadingContacts ? (
                  <p style={{fontSize: 13, color: '#888'}}>Loading contacts...</p>
                ) : (
                  <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                    {/* Primary vendor contact (from vendor record itself) */}
                    {(selectedVendor.contact_person || selectedVendor.email || selectedVendor.phone) && (
                      <div
                        onClick={() => {
                          setSelectedContact({ id: '_primary', name: selectedVendor.contact_person || selectedVendor.vendor_name, email: selectedVendor.email || '', phone: selectedVendor.phone || '' });
                          setSendForm({ email: selectedVendor.email || '', phone: selectedVendor.phone || '' });
                        }}
                        style={{
                          padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                          border: selectedContact?.id === '_primary' ? '2px solid #0891b2' : '1px solid #d1d5db',
                          backgroundColor: selectedContact?.id === '_primary' ? '#e0f2fe' : '#f9fafb',
                        }}
                      >
                        <div style={{fontWeight: 700, fontSize: 14, color: '#111'}}>{selectedVendor.contact_person || selectedVendor.vendor_name} <span style={{fontSize: 11, color: '#888', fontWeight: 400}}>(primary)</span></div>
                        <div style={{fontSize: 12, color: '#555', display: 'flex', gap: 16, marginTop: 2}}>
                          {selectedVendor.email && <span>✉ {selectedVendor.email}</span>}
                          {selectedVendor.phone && <span>📱 {selectedVendor.phone}</span>}
                        </div>
                      </div>
                    )}
                    {/* Additional contacts from vendor_contacts table */}
                    {vendorContactsList.map(contact => (
                      <div
                        key={contact.id}
                        onClick={() => {
                          setSelectedContact(contact);
                          setSendForm({ email: contact.email || '', phone: contact.phone || '' });
                        }}
                        style={{
                          padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                          border: selectedContact?.id === contact.id ? '2px solid #0891b2' : '1px solid #d1d5db',
                          backgroundColor: selectedContact?.id === contact.id ? '#e0f2fe' : '#f9fafb',
                        }}
                      >
                        <div style={{fontWeight: 700, fontSize: 14, color: '#111'}}>
                          {contact.name}
                          {contact.title && <span style={{fontSize: 12, color: '#f97316', fontWeight: 400, marginLeft: 8}}>{contact.title}</span>}
                        </div>
                        <div style={{fontSize: 12, color: '#555', display: 'flex', gap: 16, marginTop: 2}}>
                          {contact.email && <span>✉ {contact.email}</span>}
                          {contact.phone && <span>📱 {contact.phone}</span>}
                        </div>
                      </div>
                    ))}
                    {vendorContactsList.length === 0 && !selectedVendor.email && !selectedVendor.phone && (
                      <p style={{fontSize: 13, color: '#888', margin: 0}}>No contacts on file for this vendor. Add them on the Vendors page.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Send method buttons */}
            <div style={styles.field}>
              <label style={styles.label}>Send As</label>
              <div style={{display: 'flex', gap: 8}}>
                {[
                  { key: 'email', label: '📧 Email' },
                  { key: 'text', label: '📱 Text' },
                  { key: 'both', label: '📧📱 Both' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setSendMethod(opt.key)}
                    style={{
                      flex: 1, padding: '10px 8px', border: '2px solid',
                      borderColor: sendMethod === opt.key ? '#0891b2' : '#d1d5db',
                      backgroundColor: sendMethod === opt.key ? '#e0f2fe' : '#fff',
                      color: sendMethod === opt.key ? '#0369a1' : '#374151',
                      borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700
                    }}
                  >{opt.label}</button>
                ))}
              </div>
            </div>

            {/* Email field (email / both mode) */}
            {(sendMethod === 'email' || sendMethod === 'both') && (
              <div style={styles.field}>
                <label style={styles.label}>Email Address</label>
                <input
                  type="email"
                  value={sendForm.email}
                  onChange={(e) => setSendForm({...sendForm, email: e.target.value})}
                  style={styles.input}
                  placeholder="supplier@example.com"
                />
              </div>
            )}

            {/* Text info (text / both mode) — no number needed, Phone Link picks contact */}
            {(sendMethod === 'text' || sendMethod === 'both') && (
              <div style={{backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '12px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10}}>
                <span style={{fontSize: 22}}>📱</span>
                <div>
                  <div style={{fontWeight: 700, fontSize: 14, color: '#0369a1'}}>Opens Phone Link</div>
                  <div style={{fontSize: 13, color: '#0369a1'}}>You'll pick the contact directly from your phone — no number needed here</div>
                </div>
              </div>
            )}

            <div style={styles.modalActions}>
              <button
                onClick={() => { setShowSendModal(false); setSendingList(null); setVendorDropdownOpen(false); }}
                style={styles.cancelButton}
                disabled={sending}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const toSend = {
                    email: (sendMethod === 'email' || sendMethod === 'both') ? sendForm.email : '',
                    isText: sendMethod === 'text' || sendMethod === 'both',
                  };
                  sendMaterialList(sendingList, toSend);
                }}
                style={{...styles.primaryButton, opacity: sending ? 0.6 : 1, backgroundColor: '#0891b2'}}
                disabled={sending}
              >
                {sending ? '⏳ Opening...' : '📤 Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FileUploadModal({ isOpen, onClose, projectId, materialListId, listTitle, uploading, setUploading }) {
  const { user } = useAuth();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileDescriptions, setFileDescriptions] = useState({});
  const [attachments, setAttachments] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(true);

  useEffect(() => {
    if (isOpen && materialListId) {
      loadAttachments();
    }
  }, [isOpen, materialListId]);

  async function loadAttachments() {
    try {
      const { data, error } = await supabase
        .from("project_file_attachments")
        .select("*")
        .eq("material_list_id", materialListId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (err) {
      console.error("Error loading attachments:", err);
    } finally {
      setLoadingFiles(false);
    }
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    
    // Initialize descriptions for new files
    const descriptions = {};
    files.forEach((file, index) => {
      descriptions[index] = '';
    });
    setFileDescriptions(descriptions);
  }

  async function handleUpload() {
    if (selectedFiles.length === 0) {
      notify('Please select files to upload');
      return;
    }

    setUploading(true);
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `projects/${projectId}/material-lists/${materialListId}/${fileName}`;

        // Upload file to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('project-files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Save file metadata to database
        const { error: dbError } = await supabase
          .from("project_file_attachments")
          .insert({
            project_id: projectId,
            material_list_id: materialListId,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            file_path: filePath,
            description: fileDescriptions[i]?.trim() || null,
            uploaded_by: user?.id
          });

        if (dbError) throw dbError;
      }

      notify(`Successfully uploaded ${selectedFiles.length} file(s)!`);
      setSelectedFiles([]);
      setFileDescriptions({});
      loadAttachments(); // Reload attachments

    } catch (err) {
      console.error("Error uploading files:", err);
      notify("Failed to upload files: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function downloadFile(attachment) {
    try {
      const { data, error } = await supabase.storage
        .from('project-files')
        .download(attachment.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error("Error downloading file:", err);
      notify("Failed to download file: " + err.message);
    }
  }

  async function deleteFile(attachment) {
    if (!await confirmDialog(`Delete "${attachment.file_name}"?`)) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('project-files')
        .remove([attachment.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("project_file_attachments")
        .delete()
        .eq("id", attachment.id);

      if (dbError) throw dbError;

      loadAttachments(); // Reload attachments

    } catch (err) {
      console.error("Error deleting file:", err);
      notify("Failed to delete file: " + err.message);
    }
  }

  if (!isOpen) return null;

  return (
    <div style={styles.modal}>
      <div style={{...styles.modalContent, maxWidth: 700}}>
        <h2 style={styles.modalTitle}>📎 Files for {listTitle}</h2>
        
        {/* Upload Section */}
        <div style={styles.uploadSection}>
          <h3 style={styles.sectionTitle}>Upload New Files</h3>
          
          <div style={styles.field}>
            <label style={styles.label}>Select Files</label>
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              style={styles.fileInput}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt,.csv"
            />
            <p style={styles.fileHint}>
              Supported formats: PDF, Word, Excel, Images, Text, CSV
            </p>
          </div>

          {selectedFiles.length > 0 && (
            <>
              <h4 style={styles.fileListTitle}>Files to Upload:</h4>
              {selectedFiles.map((file, index) => (
                <div key={index} style={styles.fileItem}>
                  <div style={styles.fileName}>
                    📄 {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                  <input
                    type="text"
                    placeholder="Optional description..."
                    value={fileDescriptions[index] || ''}
                    onChange={(e) => setFileDescriptions({
                      ...fileDescriptions,
                      [index]: e.target.value
                    })}
                    style={styles.descriptionInput}
                  />
                </div>
              ))}
              
              <button
                onClick={handleUpload}
                disabled={uploading}
                style={{...styles.uploadButton, opacity: uploading ? 0.6 : 1}}
              >
                {uploading ? '⏳ Uploading...' : '📤 Upload Files'}
              </button>
            </>
          )}
        </div>

        {/* Existing Files Section */}
        <div style={styles.filesSection}>
          <h3 style={styles.sectionTitle}>Attached Files ({attachments.length})</h3>
          
          {loadingFiles ? (
            <div style={styles.loadingFiles}>Loading files...</div>
          ) : attachments.length === 0 ? (
            <div style={styles.emptyFiles}>No files uploaded yet.</div>
          ) : (
            <div style={styles.filesList}>
              {attachments.map((attachment) => (
                <div key={attachment.id} style={styles.attachmentItem}>
                  <div style={styles.attachmentInfo}>
                    <div style={styles.attachmentName}>
                      📄 {attachment.file_name}
                    </div>
                    <div style={styles.attachmentMeta}>
                      {(attachment.file_size / 1024 / 1024).toFixed(2)} MB • 
                      Uploaded {formatDate(attachment.created_at)}
                    </div>
                    {attachment.description && (
                      <div style={styles.attachmentDescription}>
                        {attachment.description}
                      </div>
                    )}
                  </div>
                  <div style={styles.attachmentActions}>
                    <button
                      onClick={() => downloadFile(attachment)}
                      style={styles.downloadButton}
                    >
                      📥 Download
                    </button>
                    <button
                      onClick={() => deleteFile(attachment)}
                      style={styles.deleteFileButton}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={styles.modalActions}>
          <button onClick={onClose} style={styles.cancelButton}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function MaterialListItems({ listId, refreshKey, onRefresh }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editItemForm, setEditItemForm] = useState({});
  const [savingItem, setSavingItem] = useState(false);

  useEffect(() => {
    loadItems();
  }, [listId, refreshKey]);

  async function loadItems() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("material_list_items")
        .select("*")
        .eq("material_list_id", listId)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error("Error loading items:", err);
    } finally {
      setLoading(false);
    }
  }

  function startEditItem(item) {
    setEditingItemId(item.id);
    setEditItemForm({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_cost: item.unit_cost,
      vendor: item.vendor || '',
      category: item.category || 'Wire & Cable',
    });
  }

  function cancelEditItem() {
    setEditingItemId(null);
    setEditItemForm({});
  }

  async function saveEditItem(itemId) {
    if (!editItemForm.description?.trim()) {
      notify('Description is required');
      return;
    }
    setSavingItem(true);
    try {
      const newTotal = (parseFloat(editItemForm.quantity) || 0) * (parseFloat(editItemForm.unit_cost) || 0);
      const { error } = await supabase
        .from("material_list_items")
        .update({
          description: editItemForm.description.trim(),
          quantity: parseFloat(editItemForm.quantity) || 1,
          unit: editItemForm.unit || 'ea',
          unit_cost: parseFloat(editItemForm.unit_cost) || 0,
          total_cost: newTotal,
          vendor: editItemForm.vendor?.trim() || null,
          category: editItemForm.category || 'Wire & Cable',
        })
        .eq("id", itemId);

      if (error) throw error;

      setItems(items.map(i =>
        i.id === itemId
          ? { ...i, ...editItemForm, quantity: parseFloat(editItemForm.quantity) || 1, unit_cost: parseFloat(editItemForm.unit_cost) || 0, total_cost: newTotal }
          : i
      ));
      setEditingItemId(null);
      setEditItemForm({});
    } catch (err) {
      console.error("Error saving item:", err);
      notify("Failed to save item: " + err.message);
    } finally {
      setSavingItem(false);
    }
  }

  async function deleteItem(item) {
    if (!window.await confirmDialog(`Delete "${item.description}"?`)) return;
    try {
      const { error } = await supabase
        .from("material_list_items")
        .delete()
        .eq("id", item.id);

      if (error) throw error;
      setItems(items.filter(i => i.id !== item.id));
    } catch (err) {
      console.error("Error deleting item:", err);
      notify("Failed to delete item: " + err.message);
    }
  }

  if (loading) return <div style={styles.loadingItems}>Loading items...</div>;

  if (items.length === 0) {
    return (
      <div style={styles.emptyItems}>
        <p>No items in this list yet. Click "Add Items" to get started.</p>
      </div>
    );
  }

  const totalCost = items.reduce((sum, item) => sum + (item.total_cost || 0), 0);

  return (
    <div style={styles.itemsContainer}>
      <div style={styles.itemsHeader}>
        <span>Items ({items.length})</span>
        <span style={styles.totalCost}>Total: ${totalCost.toFixed(2)}</span>
      </div>

      <div style={styles.itemsList}>
        {items.map((item) => {
          const isEditing = editingItemId === item.id;
          return (
            <div key={item.id} style={{...styles.itemRow, alignItems: isEditing ? 'flex-start' : 'center', flexWrap: 'wrap', gap: 8}}>
              {isEditing ? (
                <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 8}}>
                  <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
                    <input
                      type="text"
                      value={editItemForm.description}
                      onChange={(e) => setEditItemForm({...editItemForm, description: e.target.value})}
                      style={{...styles.input, flex: 3, minWidth: 160}}
                      placeholder="Description"
                    />
                    <input
                      type="number"
                      value={editItemForm.quantity}
                      onChange={(e) => setEditItemForm({...editItemForm, quantity: e.target.value})}
                      style={{...styles.input, flex: 1, minWidth: 60}}
                      placeholder="Qty"
                      min="0"
                      step="0.01"
                    />
                    <select
                      value={editItemForm.unit}
                      onChange={(e) => setEditItemForm({...editItemForm, unit: e.target.value})}
                      style={{...styles.select, flex: 1, minWidth: 70}}
                    >
                      <option value="ea">ea</option>
                      <option value="ft">ft</option>
                      <option value="lf">lf</option>
                      <option value="roll">roll</option>
                      <option value="box">box</option>
                      <option value="bag">bag</option>
                      <option value="lb">lb</option>
                      <option value="gal">gal</option>
                      <option value="set">set</option>
                    </select>
                    <input
                      type="number"
                      value={editItemForm.unit_cost}
                      onChange={(e) => setEditItemForm({...editItemForm, unit_cost: e.target.value})}
                      style={{...styles.input, flex: 1, minWidth: 80}}
                      placeholder="Unit Cost"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
                    <input
                      type="text"
                      value={editItemForm.vendor}
                      onChange={(e) => setEditItemForm({...editItemForm, vendor: e.target.value})}
                      style={{...styles.input, flex: 2, minWidth: 120}}
                      placeholder="Vendor"
                    />
                    <select
                      value={editItemForm.category}
                      onChange={(e) => setEditItemForm({...editItemForm, category: e.target.value})}
                      style={{...styles.select, flex: 2, minWidth: 140}}
                    >
                      {MATERIAL_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <span style={{...styles.totalCost, alignSelf: 'center', fontSize: 14}}>
                      = ${((parseFloat(editItemForm.quantity) || 0) * (parseFloat(editItemForm.unit_cost) || 0)).toFixed(2)}
                    </span>
                  </div>
                  <div style={{display: 'flex', gap: 8}}>
                    <button
                      onClick={() => saveEditItem(item.id)}
                      disabled={savingItem}
                      style={{...styles.actionButton, backgroundColor: '#16a34a', fontSize: 13, padding: '6px 14px'}}
                    >
                      {savingItem ? '⏳' : '✅ Save'}
                    </button>
                    <button
                      onClick={cancelEditItem}
                      style={{...styles.cancelButton, fontSize: 13, padding: '6px 14px'}}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={styles.itemMain}>
                    <div style={styles.itemDescription}>{item.description}</div>
                    <div style={styles.itemDetails}>
                      {item.quantity} {item.unit} × ${item.unit_cost} = ${item.total_cost?.toFixed(2)}
                    </div>
                    {item.vendor && (
                      <div style={styles.itemVendor}>Vendor: {item.vendor}</div>
                    )}
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8}}>
                    <span style={styles.categoryBadge}>{item.category}</span>
                    <button
                      onClick={() => startEditItem(item)}
                      style={{...styles.actionButton, backgroundColor: '#f59e0b', fontSize: 12, padding: '5px 10px'}}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => deleteItem(item)}
                      style={{...styles.actionButton, backgroundColor: '#dc2626', fontSize: 12, padding: '5px 10px'}}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getBadgeColor(status) {
  switch (status) {
    case 'draft': return '#9ca3af';
    case 'ordered': return '#f59e0b';
    case 'received': return '#10b981';
    case 'complete': return '#3b82f6';
    default: return '#9ca3af';
  }
}

const styles = {
  container: {
    padding: "40px 24px",
    maxWidth: 1400,
    margin: "0 auto",
    minHeight: "100vh",
    backgroundColor: BRAND.bg,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 32,
  },
  title: {
    fontSize: 36,
    color: BRAND.text,
    margin: 0,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#fff",
    margin: "4px 0",
  },
  backButton: {
    padding: "10px 20px",
    backgroundColor: "transparent",
    border: "2px solid #fff",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 15,
  },
  addButton: {
    padding: "10px 20px",
    backgroundColor: BRAND.accent,
    border: "none",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 15,
    fontWeight: "600",
  },
  content: {
    color: "#fff",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 20,
  },
  emptyState: {
    textAlign: "center",
    padding: 40,
    color: "#666",
  },
  primaryButton: {
    padding: "12px 24px",
    backgroundColor: BRAND.accent,
    border: "none",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: "600",
  },
  listContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  listCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 16,
    backgroundColor: "#f9fafb",
  },
  listHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  listInfo: {
    flex: 1,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111",
    margin: "0 0 8px 0",
  },
  listMeta: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  badge: {
    padding: "4px 8px",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: "bold",
    color: "#fff",
    textTransform: "uppercase",
  },
  listDate: {
    fontSize: 14,
    color: "#666",
  },
  listDescription: {
    fontSize: 14,
    color: "#444",
    margin: 0,
  },
  listActions: {
    display: "flex",
    gap: 8,
  },
  actionButton: {
    padding: "8px 16px",
    backgroundColor: "#3b82f6",
    border: "none",
    color: "#fff",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: "600",
  },
  modal: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 32,
    maxWidth: 500,
    width: "90%",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 24,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    display: "block",
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "12px",
    fontSize: 15,
    border: "2px solid #d1d5db",
    borderRadius: 8,
    outline: "none",
    backgroundColor: "#fff",
    color: "#111",
  },
  textarea: {
    width: "100%",
    padding: "12px",
    fontSize: 15,
    border: "2px solid #d1d5db",
    borderRadius: 8,
    outline: "none",
    fontFamily: "inherit",
    resize: "vertical",
    backgroundColor: "#fff",
    color: "#111",
  },
  select: {
    width: "100%",
    padding: "12px",
    fontSize: 15,
    border: "2px solid #d1d5db",
    borderRadius: 8,
    outline: "none",
    backgroundColor: "#fff",
    color: "#111",
    cursor: "pointer",
  },
  modalActions: {
    display: "flex",
    gap: 16,
    justifyContent: "flex-end",
    marginTop: 24,
  },
  cancelButton: {
    padding: "12px 24px",
    backgroundColor: "transparent",
    border: "2px solid #d1d5db",
    color: "#374151",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: "bold",
  },
  loadingItems: {
    padding: 20,
    textAlign: "center",
    color: "#666",
  },
  emptyItems: {
    padding: 20,
    textAlign: "center",
    color: "#666",
    fontSize: 14,
  },
  itemsContainer: {
    marginTop: 16,
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    backgroundColor: "#fff",
  },
  itemsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    backgroundColor: "#f3f4f6",
    borderBottom: "1px solid #e5e7eb",
    fontSize: 14,
    fontWeight: "600",
  },
  totalCost: {
    color: BRAND.accent,
    fontWeight: "bold",
  },
  itemsList: {
    padding: 16,
  },
  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "12px 0",
    borderBottom: "1px solid #f0f0f0",
  },
  itemMain: {
    flex: 1,
  },
  itemDescription: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 13,
    color: "#666",
    marginBottom: 2,
  },
  itemVendor: {
    fontSize: 13,
    color: "#666",
  },
  itemCategory: {
    marginLeft: 16,
  },
  categoryBadge: {
    padding: "4px 8px",
    backgroundColor: "#e5e7eb",
    color: "#374151",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: "600",
  },
  loading: {
    textAlign: "center",
    color: "#fff",
    fontSize: 18,
    padding: 40,
  },
  error: {
    textAlign: "center",
    color: "#ef4444",
    fontSize: 18,
    padding: 40,
  },
  
  // Spreadsheet Styles
  spreadsheetContainer: {
    border: "2px solid #d1d5db",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  spreadsheetHeader: {
    display: "flex",
    backgroundColor: "#374151",
    borderBottom: "2px solid #d1d5db",
    fontWeight: "bold",
    fontSize: 14,
    color: "#fff",
    padding: "12px 0",
  },
  spreadsheetBody: {
    maxHeight: 400,
    overflowY: "auto",
  },
  spreadsheetRow: {
    display: "flex",
    borderBottom: "1px solid #e5e7eb",
    "&:hover": {
      backgroundColor: "#f9fafb",
    },
  },
  spreadsheetCell: {
    flex: 1,
    padding: "2px 6px",
    borderRight: "1px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    minHeight: 28,
  },
  spreadsheetInput: {
    width: "100%",
    padding: "2px 6px",
    fontSize: 13,
    border: "1px solid transparent",
    borderRadius: 3,
    outline: "none",
    backgroundColor: "transparent",
    color: "#111",
    lineHeight: "1.4",
  },
  spreadsheetSelect: {
    width: "100%",
    padding: "2px 4px",
    fontSize: 13,
    border: "1px solid transparent",
    borderRadius: 3,
    outline: "none",
    backgroundColor: "transparent",
    color: "#111",
    cursor: "pointer",
    lineHeight: "1.4",
  },
  totalDisplay: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111",
    textAlign: "right",
    width: "100%",
  },
  addRowsButton: {
    padding: "8px 16px",
    backgroundColor: "#e5e7eb",
    border: "1px solid #d1d5db",
    color: "#374151",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: "500",
  },
  totalSummary: {
    padding: "12px 16px",
    backgroundColor: "#f0f9ff",
    borderRadius: 6,
    color: "#111",
    fontSize: 16,
    textAlign: "center",
    border: "1px solid #bae6fd",
  },

  // File Upload Styles
  uploadSection: {
    marginBottom: 32,
    padding: 20,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
  },
  filesSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 16,
  },
  fileInput: {
    width: "100%",
    padding: "12px",
    fontSize: 14,
    border: "2px solid #d1d5db",
    borderRadius: 8,
    backgroundColor: "#fff",
    cursor: "pointer",
  },
  fileHint: {
    fontSize: 12,
    color: "#666",
    margin: "8px 0 0 0",
  },
  fileListTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
    margin: "16px 0 12px 0",
  },
  fileItem: {
    padding: "12px",
    backgroundColor: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    marginBottom: 8,
  },
  fileName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111",
    marginBottom: 8,
  },
  descriptionInput: {
    width: "100%",
    padding: "8px 12px",
    fontSize: 14,
    border: "1px solid #d1d5db",
    borderRadius: 4,
    outline: "none",
  },
  uploadButton: {
    padding: "12px 24px",
    backgroundColor: "#10b981",
    border: "none",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 16,
  },
  loadingFiles: {
    padding: 20,
    textAlign: "center",
    color: "#666",
  },
  emptyFiles: {
    padding: 20,
    textAlign: "center",
    color: "#666",
    fontSize: 14,
  },
  filesList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  attachmentItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 16,
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
    marginBottom: 4,
  },
  attachmentMeta: {
    fontSize: 13,
    color: "#666",
    marginBottom: 4,
  },
  attachmentDescription: {
    fontSize: 14,
    color: "#374151",
    fontStyle: "italic",
  },
  attachmentActions: {
    display: "flex",
    gap: 8,
  },
  downloadButton: {
    padding: "8px 12px",
    backgroundColor: "#3b82f6",
    border: "none",
    color: "#fff",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: "600",
  },
  deleteFileButton: {
    padding: "8px 12px",
    backgroundColor: "#dc2626",
    border: "none",
    color: "#fff",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: "600",
  },
};
