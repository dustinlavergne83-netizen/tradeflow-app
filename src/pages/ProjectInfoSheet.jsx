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

export default function ProjectInfoSheet() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [project, setProject] = useState(null);
  const [infoSheets, setInfoSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddSheetModal, setShowAddSheetModal] = useState(false);
  const [editingSheet, setEditingSheet] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const [sheetForm, setSheetForm] = useState({
    title: '',
    content: '',
    sheet_date: new Date().toISOString().split('T')[0]
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

      // Load info sheets for this project
      const { data: sheetsData, error: sheetsError } = await supabase
        .from("project_info_sheets")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false });

      if (sheetsError && sheetsError.code !== 'PGRST116') {
        throw sheetsError;
      }

      setInfoSheets(sheetsData || []);

    } catch (err) {
      console.error("Error loading data:", err);
      notify("Failed to load project info sheets: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSheet() {
    if (!sheetForm.title.trim() || !sheetForm.content.trim()) {
      notify('Title and content are required');
      return;
    }

    setSaving(true);
    try {
      if (editingSheet) {
        // Update existing sheet
        const { error } = await supabase
          .from("project_info_sheets")
          .update({
            title: sheetForm.title.trim(),
            content: sheetForm.content.trim(),
            sheet_date: sheetForm.sheet_date,
            updated_at: new Date().toISOString()
          })
          .eq("id", editingSheet.id);
        
        if (error) throw error;
      } else {
        // Create new sheet
        const { error } = await supabase
          .from("project_info_sheets")
          .insert([{
            project_id: id,
            title: sheetForm.title.trim(),
            content: sheetForm.content.trim(),
            sheet_date: sheetForm.sheet_date,
            created_by: user?.id
          }]);
        
        if (error) throw error;
      }

      setShowAddSheetModal(false);
      setEditingSheet(null);
      setSheetForm({ title: '', content: '', sheet_date: new Date().toISOString().split('T')[0] });
      loadData(); // Reload sheets
    } catch (err) {
      console.error("Error saving sheet:", err);
      notify("Failed to save sheet: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSheet(sheet) {
    if (!await confirmDialog(`Delete "${sheet.title}"?`)) return;
    
    try {
      const { error } = await supabase
        .from("project_info_sheets")
        .delete()
        .eq("id", sheet.id);
      
      if (error) throw error;
      loadData(); // Reload sheets
    } catch (err) {
      console.error("Error deleting sheet:", err);
      notify("Failed to delete sheet: " + err.message);
    }
  }

  function startEdit(sheet) {
    setEditingSheet(sheet);
    setSheetForm({
      title: sheet.title,
      content: sheet.content,
      sheet_date: sheet.sheet_date || new Date().toISOString().split('T')[0]
    });
    setShowAddSheetModal(true);
  }

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  if (!project) {
    return <div style={styles.error}>Project not found</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>📄 Info Sheets</h1>
          <p style={styles.subtitle}>Project: {project.name}</p>
        </div>
        <div style={{display: 'flex', gap: 12}}>
          <button 
            onClick={() => {
              setEditingSheet(null);
              setSheetForm({ title: '', content: '', sheet_date: new Date().toISOString().split('T')[0] });
              setShowAddSheetModal(true);
            }}
            style={styles.addButton}
          >
            + New Info Sheet
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
          <h2 style={styles.cardTitle}>Project Info Sheets ({infoSheets.length})</h2>
          
          {infoSheets.length === 0 ? (
            <div style={styles.emptyState}>
              <p>No info sheets created yet.</p>
              <button 
                onClick={() => {
                  setEditingSheet(null);
                  setSheetForm({ title: '', content: '', sheet_date: new Date().toISOString().split('T')[0] });
                  setShowAddSheetModal(true);
                }}
                style={styles.primaryButton}
              >
                Create Your First Info Sheet
              </button>
            </div>
          ) : (
            <div style={styles.sheetContainer}>
              {infoSheets.map((sheet) => (
                <div key={sheet.id} style={styles.sheetCard}>
                  <div style={styles.sheetHeader}>
                    <div style={styles.sheetInfo}>
                      <h3 style={styles.sheetTitle}>{sheet.title}</h3>
                      <div style={styles.sheetMeta}>
                        {sheet.sheet_date && (
                          <span style={styles.sheetDate}>
                            Date: {formatDate(sheet.sheet_date)}
                          </span>
                        )}
                        <span style={styles.sheetCreated}>
                          Created {formatDate(sheet.created_at)}
                        </span>
                      </div>
                    </div>
                    <div style={styles.sheetActions}>
                      <button
                        onClick={() => startEdit(sheet)}
                        style={styles.actionButton}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => {
                          setSelectedSheet(sheet);
                          setShowUploadModal(true);
                        }}
                        style={{...styles.actionButton, backgroundColor: '#10b981'}}
                      >
                        📎 Upload Files
                      </button>
                      <button
                        onClick={() => deleteSheet(sheet)}
                        style={{...styles.actionButton, backgroundColor: '#dc2626'}}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                  
                  <div style={styles.sheetContent}>
                    <div style={styles.contentPreview}>
                      {sheet.content.split('\n').slice(0, 5).map((line, index) => (
                        <p key={index} style={styles.contentLine}>
                          {line.trim() || '\u00A0'}
                        </p>
                      ))}
                      {sheet.content.split('\n').length > 5 && (
                        <p style={styles.moreIndicator}>...</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Sheet Modal */}
      {showAddSheetModal && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>
              {editingSheet ? 'Edit Info Sheet' : 'Create Info Sheet'}
            </h2>
            
            <div style={styles.field}>
              <label style={styles.label}>Title</label>
              <input
                type="text"
                value={sheetForm.title}
                onChange={(e) => setSheetForm({...sheetForm, title: e.target.value})}
                style={styles.input}
                placeholder="e.g., Daily Notes, Site Inspection, Issues Log"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Date</label>
              <input
                type="date"
                value={sheetForm.sheet_date}
                onChange={(e) => setSheetForm({...sheetForm, sheet_date: e.target.value})}
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Content</label>
              <textarea
                value={sheetForm.content}
                onChange={(e) => setSheetForm({...sheetForm, content: e.target.value})}
                style={styles.contentTextarea}
                placeholder="Write your info sheet content here..."
                rows={15}
              />
            </div>

            <div style={styles.modalActions}>
              <button
                onClick={() => {
                  setShowAddSheetModal(false);
                  setEditingSheet(null);
                  setSheetForm({ title: '', content: '', sheet_date: new Date().toISOString().split('T')[0] });
                }}
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSheet}
                style={{...styles.primaryButton, opacity: saving ? 0.6 : 1}}
                disabled={saving}
              >
                {saving ? '⏳ Saving...' : (editingSheet ? '💾 Update Sheet' : '💾 Create Sheet')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Upload Modal */}
      {showUploadModal && selectedSheet && (
        <InfoSheetFileUploadModal
          isOpen={showUploadModal}
          onClose={() => {
            setShowUploadModal(false);
            setSelectedSheet(null);
          }}
          projectId={id}
          infoSheetId={selectedSheet.id}
          sheetTitle={selectedSheet.title}
          uploading={uploading}
          setUploading={setUploading}
        />
      )}
    </div>
  );
}

function InfoSheetFileUploadModal({ isOpen, onClose, projectId, infoSheetId, sheetTitle, uploading, setUploading }) {
  const { user } = useAuth();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileDescriptions, setFileDescriptions] = useState({});
  const [attachments, setAttachments] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(true);

  useEffect(() => {
    if (isOpen && infoSheetId) {
      loadAttachments();
    }
  }, [isOpen, infoSheetId]);

  async function loadAttachments() {
    try {
      const { data, error } = await supabase
        .from("project_file_attachments")
        .select("*")
        .eq("info_sheet_id", infoSheetId)
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
        const filePath = `projects/${projectId}/info-sheets/${infoSheetId}/${fileName}`;

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
            info_sheet_id: infoSheetId,
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
        <h2 style={styles.modalTitle}>📎 Files for {sheetTitle}</h2>
        
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

const styles = {
  container: {
    padding: "40px 24px",
    maxWidth: 1200,
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
  sheetContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  sheetCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 20,
    backgroundColor: "#f9fafb",
  },
  sheetHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  sheetInfo: {
    flex: 1,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111",
    margin: "0 0 8px 0",
  },
  sheetMeta: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 8,
  },
  sheetDate: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },
  sheetCreated: {
    fontSize: 14,
    color: "#999",
  },
  sheetActions: {
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
  sheetContent: {
    backgroundColor: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    padding: 16,
  },
  contentPreview: {
    color: "#374151",
    lineHeight: 1.6,
  },
  contentLine: {
    margin: "0 0 4px 0",
    fontSize: 14,
  },
  moreIndicator: {
    color: "#999",
    fontStyle: "italic",
    margin: "8px 0 0 0",
    fontSize: 14,
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
    maxWidth: 800,
    width: "90%",
    maxHeight: "90vh",
    overflow: "auto",
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
  contentTextarea: {
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
    minHeight: 300,
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
