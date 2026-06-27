import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { confirmDialog } from '../lib/notify';

const BRAND = { blue: "#0b3ea8", orange: "#fc6b04", dark: "#092d7e" };
const TABS = ["🖼️ Gallery", "📢 Announcements", "✏️ Page Text"];
const CATEGORIES = ["work", "residential", "commercial", "industrial", "team", "equipment"];

export default function WebsiteManager() {
  const navigate = useNavigate();
  const { employee } = useAuth();
  const [tab, setTab] = useState(0);
  const [gallery, setGallery] = useState([]);
  const [content, setContent] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [editPhoto, setEditPhoto] = useState(null); // photo being edited
  const [showAddPhoto, setShowAddPhoto] = useState(false);
  const fileInputRef = useRef();

  // New photo form
  const [newPhoto, setNewPhoto] = useState({ title: "", description: "", category: "work", file: null, preview: null });
  // Announcement form
  const [announcement, setAnnouncement] = useState({ text: "", active: false });
  // Text content form
  const [textContent, setTextContent] = useState({ hero_tagline: "", about_text: "" });

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadGallery(), loadContent()]);
    setLoading(false);
  }

  async function loadGallery() {
    const { data } = await supabase
      .from("website_gallery")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });
    setGallery(data || []);
  }

  async function loadContent() {
    const { data } = await supabase.from("website_content").select("*");
    const map = {};
    (data || []).forEach((row) => { map[row.content_key] = row; });
    setContent(map);
    setAnnouncement({
      text: map.announcement?.content_value || "",
      active: map.announcement?.active || false,
    });
    setTextContent({
      hero_tagline: map.hero_tagline?.content_value || "Residential • Commercial • Industrial",
      about_text: map.about_text?.content_value || "",
    });
  }

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── GALLERY UPLOAD ──────────────────────────────────────────────────────────
  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setNewPhoto((p) => ({ ...p, file, preview }));
    setShowAddPhoto(true);
  }

  async function handleUploadPhoto() {
    if (!newPhoto.file) return;
    setUploading(true);
    try {
      const ext = newPhoto.file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("website-gallery")
        .upload(fileName, newPhoto.file, { contentType: newPhoto.file.type, upsert: false });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("website-gallery").getPublicUrl(fileName);
      const imageUrl = urlData.publicUrl;

      const { error: dbErr } = await supabase.from("website_gallery").insert({
        title: newPhoto.title,
        description: newPhoto.description,
        category: newPhoto.category,
        image_url: imageUrl,
        visible: true,
        created_by: employee?.full_name || employee?.first_name || "admin",
        display_order: gallery.length,
      });
      if (dbErr) throw dbErr;

      showToast("Photo added to website! ✅");
      setNewPhoto({ title: "", description: "", category: "work", file: null, preview: null });
      setShowAddPhoto(false);
      fileInputRef.current.value = "";
      await loadGallery();
    } catch (err) {
      console.error(err);
      showToast("Upload failed: " + err.message, "error");
    } finally {
      setUploading(false);
    }
  }

  async function toggleVisible(photo) {
    const { error } = await supabase
      .from("website_gallery")
      .update({ visible: !photo.visible })
      .eq("id", photo.id);
    if (!error) {
      setGallery((g) => g.map((p) => p.id === photo.id ? { ...p, visible: !p.visible } : p));
      showToast(photo.visible ? "Photo hidden from website" : "Photo shown on website");
    }
  }

  async function deletePhoto(photo) {
    if (!await confirmDialog(`Delete "${photo.title || "this photo"}" from the website?`)) return;
    // Delete from storage
    const pathParts = photo.image_url.split("/website-gallery/");
    if (pathParts[1]) {
      await supabase.storage.from("website-gallery").remove([pathParts[1]]);
    }
    await supabase.from("website_gallery").delete().eq("id", photo.id);
    setGallery((g) => g.filter((p) => p.id !== photo.id));
    showToast("Photo deleted");
  }

  async function saveEditPhoto() {
    if (!editPhoto) return;
    setSaving(true);
    const { error } = await supabase
      .from("website_gallery")
      .update({ title: editPhoto.title, description: editPhoto.description, category: editPhoto.category })
      .eq("id", editPhoto.id);
    setSaving(false);
    if (!error) {
      setGallery((g) => g.map((p) => p.id === editPhoto.id ? { ...p, ...editPhoto } : p));
      setEditPhoto(null);
      showToast("Photo details saved ✅");
    }
  }

  // ── ANNOUNCEMENT ──────────────────────────────────────────────────────────
  async function saveAnnouncement() {
    setSaving(true);
    const { error } = await supabase
      .from("website_content")
      .upsert({ content_key: "announcement", content_value: announcement.text, content_type: "announcement", active: announcement.active, updated_at: new Date().toISOString() }, { onConflict: "content_key" });
    setSaving(false);
    if (!error) showToast("Announcement saved! ✅");
    else showToast("Save failed: " + error.message, "error");
  }

  // ── TEXT CONTENT ────────────────────────────────────────────────────────────
  async function saveTextContent() {
    setSaving(true);
    try {
      await Promise.all([
        supabase.from("website_content").upsert({ content_key: "hero_tagline", content_value: textContent.hero_tagline, updated_at: new Date().toISOString() }, { onConflict: "content_key" }),
        supabase.from("website_content").upsert({ content_key: "about_text", content_value: textContent.about_text, updated_at: new Date().toISOString() }, { onConflict: "content_key" }),
      ]);
      showToast("Website text saved! ✅");
    } catch (err) {
      showToast("Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  const visibleCount = gallery.filter((p) => p.visible).length;
  const hiddenCount = gallery.filter((p) => !p.visible).length;

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>🌐 Website Manager</h1>
          <p style={styles.headerSub}>Add photos, announcements, and content to dmlelectrical.com</p>
        </div>
        <button style={styles.previewBtn} onClick={() => window.open("/", "_blank")}>
          👁️ Preview Website
        </button>
      </div>

      {/* Stats */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={styles.statNum}>{gallery.length}</div>
          <div style={styles.statLabel}>Total Photos</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statNum, color: "#16a34a" }}>{visibleCount}</div>
          <div style={styles.statLabel}>Showing on Site</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statNum, color: "#9ca3af" }}>{hiddenCount}</div>
          <div style={styles.statLabel}>Hidden</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statNum, color: announcement.active ? "#16a34a" : "#9ca3af" }}>
            {announcement.active ? "ON" : "OFF"}
          </div>
          <div style={styles.statLabel}>Announcement</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {TABS.map((t, i) => (
          <button
            key={i}
            style={{ ...styles.tabBtn, ...(tab === i ? styles.tabBtnActive : {}) }}
            onClick={() => setTab(i)}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>Loading...</div>
      ) : (
        <div style={styles.tabContent}>

          {/* ── GALLERY TAB ── */}
          {tab === 0 && (
            <div>
              {/* Upload zone */}
              <div style={styles.uploadZone}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📷</div>
                <div style={styles.uploadTitle}>Add Photos to Website Gallery</div>
                <div style={styles.uploadSub}>Upload photos of your work, projects, team, and equipment. They'll appear in the "Our Work" section on dmlelectrical.com.</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleFileSelect}
                />
                <button style={styles.uploadBtn} onClick={() => fileInputRef.current?.click()}>
                  📁 Choose Photo to Upload
                </button>
              </div>

              {/* Add photo form (shown after file selected) */}
              {showAddPhoto && newPhoto.preview && (
                <div style={styles.addPhotoForm}>
                  <h3 style={styles.formTitle}>📋 Photo Details</h3>
                  <div style={styles.addPhotoGrid}>
                    <img src={newPhoto.preview} alt="preview" style={styles.previewImg} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div>
                        <label style={styles.label}>Photo Title (optional)</label>
                        <input
                          style={styles.input}
                          value={newPhoto.title}
                          onChange={(e) => setNewPhoto((p) => ({ ...p, title: e.target.value }))}
                          placeholder="e.g. Panel Upgrade in Lake Charles"
                        />
                      </div>
                      <div>
                        <label style={styles.label}>Description (optional)</label>
                        <textarea
                          style={{ ...styles.input, minHeight: 80, resize: "vertical" }}
                          value={newPhoto.description}
                          onChange={(e) => setNewPhoto((p) => ({ ...p, description: e.target.value }))}
                          placeholder="Brief description of the job..."
                        />
                      </div>
                      <div>
                        <label style={styles.label}>Category</label>
                        <select
                          style={styles.input}
                          value={newPhoto.category}
                          onChange={(e) => setNewPhoto((p) => ({ ...p, category: e.target.value }))}
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button
                          style={{ ...styles.saveBtn, flex: 1 }}
                          onClick={handleUploadPhoto}
                          disabled={uploading}
                        >
                          {uploading ? "⏳ Uploading..." : "✅ Add to Website"}
                        </button>
                        <button
                          style={styles.cancelBtn}
                          onClick={() => { setShowAddPhoto(false); setNewPhoto({ title: "", description: "", category: "work", file: null, preview: null }); fileInputRef.current.value = ""; }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Gallery Grid */}
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>Website Gallery ({gallery.length} photos)</h2>
                <span style={styles.sectionHint}>Click the eye icon to show/hide. Changes take effect immediately on the website.</span>
              </div>

              {gallery.length === 0 ? (
                <div style={styles.empty}>No photos yet. Upload your first photo above!</div>
              ) : (
                <div style={styles.galleryGrid}>
                  {gallery.map((photo) => (
                    <div key={photo.id} style={{ ...styles.photoCard, opacity: photo.visible ? 1 : 0.55 }}>
                      <div style={styles.photoImgWrap}>
                        <img src={photo.image_url} alt={photo.title} style={styles.photoImg} />
                        {!photo.visible && (
                          <div style={styles.hiddenOverlay}>HIDDEN</div>
                        )}
                        <div style={styles.photoCategoryBadge}>{photo.category}</div>
                      </div>
                      <div style={styles.photoMeta}>
                        <div style={styles.photoTitle}>{photo.title || "(no title)"}</div>
                        {photo.description && <div style={styles.photoDesc}>{photo.description}</div>}
                      </div>
                      <div style={styles.photoActions}>
                        <button
                          style={photo.visible ? styles.actionBtnHide : styles.actionBtnShow}
                          onClick={() => toggleVisible(photo)}
                          title={photo.visible ? "Hide from website" : "Show on website"}
                        >
                          {photo.visible ? "👁️ Showing" : "🚫 Hidden"}
                        </button>
                        <button
                          style={styles.actionBtnEdit}
                          onClick={() => setEditPhoto({ ...photo })}
                          title="Edit details"
                        >
                          ✏️
                        </button>
                        <button
                          style={styles.actionBtnDelete}
                          onClick={() => deletePhoto(photo)}
                          title="Delete photo"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── ANNOUNCEMENTS TAB ── */}
          {tab === 1 && (
            <div style={styles.contentSection}>
              <div style={styles.announcementPreview}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>📢</div>
                <h3 style={styles.formTitle}>Website Announcement Banner</h3>
                <p style={styles.formHint}>
                  This shows as a colored banner at the very top of your public website. Use it for promotions, seasonal offers, emergency alerts, or any important message.
                </p>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Announcement Message</label>
                <textarea
                  style={{ ...styles.input, minHeight: 100, fontSize: 16, resize: "vertical" }}
                  value={announcement.text}
                  onChange={(e) => setAnnouncement((a) => ({ ...a, text: e.target.value }))}
                  placeholder="e.g. 🎉 Summer Special: 10% off panel upgrades through August! Call (337) 288-0395 to schedule."
                />
              </div>

              <div style={styles.toggleRow}>
                <div>
                  <div style={styles.toggleLabel}>Show announcement on website</div>
                  <div style={styles.toggleSub}>Turn this on to make the banner visible to all visitors</div>
                </div>
                <button
                  style={announcement.active ? styles.toggleOn : styles.toggleOff}
                  onClick={() => setAnnouncement((a) => ({ ...a, active: !a.active }))}
                >
                  {announcement.active ? "✅ ON" : "⭕ OFF"}
                </button>
              </div>

              {/* Live Preview */}
              {announcement.text && (
                <div style={styles.previewBox}>
                  <div style={styles.previewLabel}>Preview:</div>
                  <div style={{
                    backgroundColor: announcement.active ? BRAND.orange : "#9ca3af",
                    color: "#fff",
                    padding: "12px 24px",
                    borderRadius: 8,
                    fontSize: 15,
                    fontWeight: 700,
                    textAlign: "center",
                  }}>
                    {announcement.text}
                    {!announcement.active && <span style={{ marginLeft: 12, opacity: 0.7 }}>(Hidden)</span>}
                  </div>
                </div>
              )}

              <button style={styles.saveBtn} onClick={saveAnnouncement} disabled={saving}>
                {saving ? "⏳ Saving..." : "💾 Save Announcement"}
              </button>
            </div>
          )}

          {/* ── PAGE TEXT TAB ── */}
          {tab === 2 && (
            <div style={styles.contentSection}>
              <h3 style={styles.formTitle}>Edit Website Text</h3>
              <p style={styles.formHint}>Update key text on your public website. Changes are live immediately after saving.</p>

              <div style={styles.formGroup}>
                <label style={styles.label}>Hero Tagline</label>
                <div style={styles.labelHint}>The subtitle shown in the big hero section on your homepage</div>
                <input
                  style={styles.input}
                  value={textContent.hero_tagline}
                  onChange={(e) => setTextContent((t) => ({ ...t, hero_tagline: e.target.value }))}
                  placeholder="Residential • Commercial • Industrial"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>About Us Text</label>
                <div style={styles.labelHint}>The description shown in the "About" section</div>
                <textarea
                  style={{ ...styles.input, minHeight: 140, resize: "vertical" }}
                  value={textContent.about_text}
                  onChange={(e) => setTextContent((t) => ({ ...t, about_text: e.target.value }))}
                  placeholder="DML Electrical Service is a locally owned..."
                />
              </div>

              <button style={styles.saveBtn} onClick={saveTextContent} disabled={saving}>
                {saving ? "⏳ Saving..." : "💾 Save Text Changes"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Edit Photo Modal */}
      {editPhoto && (
        <div style={styles.modalOverlay} onClick={() => setEditPhoto(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>✏️ Edit Photo Details</h3>
            <img src={editPhoto.image_url} alt="edit" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8, marginBottom: 16 }} />
            <div style={styles.formGroup}>
              <label style={styles.label}>Title</label>
              <input style={styles.input} value={editPhoto.title || ""} onChange={(e) => setEditPhoto((p) => ({ ...p, title: e.target.value }))} placeholder="Photo title..." />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Description</label>
              <textarea style={{ ...styles.input, minHeight: 80, resize: "vertical" }} value={editPhoto.description || ""} onChange={(e) => setEditPhoto((p) => ({ ...p, description: e.target.value }))} placeholder="Description..." />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Category</label>
              <select style={styles.input} value={editPhoto.category || "work"} onChange={(e) => setEditPhoto((p) => ({ ...p, category: e.target.value }))}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ ...styles.saveBtn, flex: 1 }} onClick={saveEditPhoto} disabled={saving}>
                {saving ? "Saving..." : "✅ Save Changes"}
              </button>
              <button style={styles.cancelBtn} onClick={() => setEditPhoto(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          backgroundColor: toast.type === "error" ? "#dc2626" : "#16a34a",
          color: "#fff", padding: "14px 20px", borderRadius: 10, fontSize: 15, fontWeight: 700,
          boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { maxWidth: 1100, margin: "0 auto", paddingTop: 8 },
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 },
  headerTitle: { fontSize: 28, fontWeight: 900, color: "#111", margin: "0 0 4px 0" },
  headerSub: { fontSize: 15, color: "#6b7280", margin: 0 },
  previewBtn: { padding: "10px 20px", backgroundColor: BRAND.blue, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16, marginBottom: 24 },
  statCard: { backgroundColor: "#fff", borderRadius: 12, padding: "16px 20px", textAlign: "center", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" },
  statNum: { fontSize: 28, fontWeight: 900, color: BRAND.blue, lineHeight: 1 },
  statLabel: { fontSize: 12, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", marginTop: 4 },
  tabs: { display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" },
  tabBtn: { padding: "10px 20px", backgroundColor: "#f3f4f6", border: "2px solid #e5e7eb", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", color: "#374151" },
  tabBtnActive: { backgroundColor: BRAND.blue, color: "#fff", borderColor: BRAND.blue },
  tabContent: { backgroundColor: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 1px 8px rgba(0,0,0,0.06)" },
  uploadZone: { border: "3px dashed #d1d5db", borderRadius: 16, padding: "40px 24px", textAlign: "center", marginBottom: 28, backgroundColor: "#f9fafb" },
  uploadTitle: { fontSize: 18, fontWeight: 800, color: "#111", marginBottom: 8 },
  uploadSub: { fontSize: 14, color: "#6b7280", maxWidth: 480, margin: "0 auto 20px" },
  uploadBtn: { padding: "12px 28px", backgroundColor: BRAND.blue, color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" },
  addPhotoForm: { backgroundColor: "#f0f9ff", border: "2px solid #bae6fd", borderRadius: 14, padding: 24, marginBottom: 28 },
  addPhotoGrid: { display: "grid", gridTemplateColumns: "200px 1fr", gap: 24, alignItems: "start" },
  previewImg: { width: "100%", height: 180, objectFit: "cover", borderRadius: 10 },
  sectionHeader: { display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 800, color: "#111", margin: 0 },
  sectionHint: { fontSize: 13, color: "#9ca3af" },
  galleryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20 },
  photoCard: { backgroundColor: "#f8fafc", borderRadius: 14, overflow: "hidden", border: "2px solid #e5e7eb", transition: "opacity 0.2s" },
  photoImgWrap: { position: "relative", height: 180, overflow: "hidden" },
  photoImg: { width: "100%", height: "100%", objectFit: "cover" },
  hiddenOverlay: { position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, letterSpacing: 2 },
  photoCategoryBadge: { position: "absolute", bottom: 8, left: 8, backgroundColor: "rgba(0,0,0,0.6)", color: "#fff", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: "uppercase" },
  photoMeta: { padding: "10px 14px 6px" },
  photoTitle: { fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 3 },
  photoDesc: { fontSize: 12, color: "#9ca3af", lineHeight: 1.4 },
  photoActions: { display: "flex", gap: 6, padding: "8px 14px 12px" },
  actionBtnShow: { flex: 1, padding: "6px 0", backgroundColor: "#dcfce7", border: "1px solid #86efac", color: "#16a34a", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" },
  actionBtnHide: { flex: 1, padding: "6px 0", backgroundColor: "#f0f9ff", border: "1px solid #bae6fd", color: "#0284c7", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" },
  actionBtnEdit: { padding: "6px 10px", backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 16, cursor: "pointer" },
  actionBtnDelete: { padding: "6px 10px", backgroundColor: "#fff7f7", border: "1px solid #fecaca", borderRadius: 6, fontSize: 16, cursor: "pointer" },
  empty: { textAlign: "center", padding: "48px 24px", color: "#9ca3af", fontSize: 15 },
  contentSection: { maxWidth: 680 },
  announcementPreview: { backgroundColor: "#fffbeb", border: "2px solid #fde68a", borderRadius: 12, padding: "20px 24px", marginBottom: 24 },
  formGroup: { marginBottom: 20 },
  formTitle: { fontSize: 20, fontWeight: 800, color: "#111", margin: "0 0 8px 0" },
  formHint: { fontSize: 14, color: "#6b7280", marginBottom: 20 },
  label: { display: "block", fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 6 },
  labelHint: { fontSize: 12, color: "#9ca3af", marginBottom: 6 },
  input: { width: "100%", padding: "11px 14px", fontSize: 14, border: "2px solid #e5e7eb", borderRadius: 8, color: "#111", backgroundColor: "#fff", boxSizing: "border-box", outline: "none" },
  toggleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderTop: "1px solid #f3f4f6", borderBottom: "1px solid #f3f4f6", marginBottom: 20 },
  toggleLabel: { fontSize: 15, fontWeight: 700, color: "#111" },
  toggleSub: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  toggleOn: { padding: "10px 20px", backgroundColor: "#16a34a", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: "pointer" },
  toggleOff: { padding: "10px 20px", backgroundColor: "#f3f4f6", color: "#6b7280", border: "2px solid #e5e7eb", borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: "pointer" },
  previewBox: { backgroundColor: "#f8fafc", borderRadius: 10, padding: 16, marginBottom: 20 },
  previewLabel: { fontSize: 11, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  saveBtn: { padding: "13px 28px", backgroundColor: BRAND.orange, color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" },
  cancelBtn: { padding: "13px 20px", backgroundColor: "#f3f4f6", color: "#374151", border: "2px solid #e5e7eb", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" },
  modalOverlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  modal: { backgroundColor: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, boxShadow: "0 8px 40px rgba(0,0,0,0.2)" },
  modalTitle: { fontSize: 20, fontWeight: 800, color: "#111", margin: "0 0 16px 0" },
};
