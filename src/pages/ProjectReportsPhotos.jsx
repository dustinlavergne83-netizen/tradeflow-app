  import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { formatDate } from "../utils/dateUtils";
import jsPDF from "jspdf";

const BRAND = {
  bg: "#0b3ea8",
  text: "#f97316",
  accent: "#fc6b04ff",
  primary: "#2563eb",
};

// Common electrical job sections for photo organization
const JOB_SECTIONS = [
  { id: 'rough-in', name: 'Rough-in', color: '#EF4444', icon: '🔌' },
  { id: 'final', name: 'Final', color: '#10B981', icon: '✅' },
  { id: 'panel', name: 'Panel Installation', color: '#3B82F6', icon: '⚡' },
  { id: 'service', name: 'Service Installation', color: '#8B5CF6', icon: '🏠' },
  { id: 'fixtures', name: 'Fixtures', color: '#F59E0B', icon: '💡' },
  { id: 'troubleshooting', name: 'Troubleshooting', color: '#EF4444', icon: '🔧' },
  { id: 'testing', name: 'Testing & Inspection', color: '#06B6D4', icon: '📋' },
  { id: 'cleanup', name: 'Cleanup', color: '#6B7280', icon: '🧹' },
  { id: 'other', name: 'Other', color: '#9CA3AF', icon: '📷' },
];

export default function ProjectReportsPhotos() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  // Photos & Reports state
  const [projectPhotos, setProjectPhotos] = useState([]);
  const [projectReports, setProjectReports] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showAddReportModal, setShowAddReportModal] = useState(false);
  const [reportForm, setReportForm] = useState({ title: '', content: '', report_date: new Date().toISOString().split('T')[0] });
  const [reportPhotos, setReportPhotos] = useState([]); // {file, preview, caption}
  const [reportContent, setReportContent] = useState([]); // Array of content blocks: {type: 'text'|'photo', content: string|photo}
  const [draggedPhoto, setDraggedPhoto] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [annotatingPhoto, setAnnotatingPhoto] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [annotationText, setAnnotationText] = useState('');
  const [showAnnotationInput, setShowAnnotationInput] = useState(false);
  const [pendingAnnotation, setPendingAnnotation] = useState(null);
  const [expandedReport, setExpandedReport] = useState(null);
  const [editingReport, setEditingReport] = useState(null);
  const [savingReport, setSavingReport] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null);
  const [sectionPhotos, setSectionPhotos] = useState({});

  useEffect(() => {
    if (id) loadProjectData();
  }, [id]);

  async function loadProjectData() {
    try {
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      // Load project photos from storage
      try {
        const { data: photoFiles } = await supabase.storage.from('project-photos').list(id, { sortBy: { column: 'created_at', order: 'desc' } });
        if (photoFiles && photoFiles.length > 0) {
          const photos = photoFiles.filter(f => f.name !== '.emptyFolderPlaceholder').map(f => {
            const { data: urlData } = supabase.storage.from('project-photos').getPublicUrl(`${id}/${f.name}`);
            return { name: f.name, url: urlData.publicUrl, created_at: f.created_at, size: f.metadata?.size };
          });
          setProjectPhotos(photos);
        } else {
          setProjectPhotos([]);
        }
      } catch (photoErr) {
        console.log("Photos storage not available yet:", photoErr);
        setProjectPhotos([]);
      }

      // Load project reports
      try {
        const { data: reportsData } = await supabase.from('project_reports').select('*').eq('project_id', id).order('report_date', { ascending: false });
        setProjectReports(reportsData || []);
      } catch (reportErr) {
        console.log("Reports table not available yet:", reportErr);
        setProjectReports([]);
      }

    } catch (err) {
      console.error("Error loading project:", err);
    } finally {
      setLoading(false);
    }
  }

  // Handle photo upload
  async function handlePhotoUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    // Validate file types and sizes
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    for (const file of files) {
      if (!validTypes.includes(file.type)) {
        alert(`Invalid file type: ${file.name}. Please upload JPEG, PNG, WebP, or HEIC images only.`);
        return;
      }
      if (file.size > maxSize) {
        alert(`File too large: ${file.name}. Please upload images smaller than 10MB.`);
        return;
      }
    }
    
    setUploadingPhoto(true);
    let successCount = 0;
    let errorCount = 0;
    
    try {
      for (const file of files) {
        try {
          const ext = file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;
          
          const { data, error } = await supabase.storage
            .from('project-photos')
            .upload(`${id}/${fileName}`, file, { 
              contentType: file.type,
              upsert: false
            });
          
          if (error) {
            console.error('Upload error for', file.name, ':', error);
            errorCount++;
            
            // Specific error handling
            if (error.message?.includes('Bucket not found')) {
              throw new Error('Storage bucket not found. Please run the SETUP_STORAGE_BUCKET_FIX.sql script first, or create the "project-photos" bucket manually in your Supabase Dashboard under Storage.');
            } else if (error.message?.includes('not allowed')) {
              throw new Error('Permission denied. Please check your Supabase storage policies.');
            } else {
              throw error;
            }
          } else {
            successCount++;
          }
        } catch (fileError) {
          console.error(`Error uploading ${file.name}:`, fileError);
          errorCount++;
          if (fileError.message.includes('Storage bucket')) {
            throw fileError; // Re-throw bucket errors to show the helpful message
          }
        }
      }
      
      if (successCount > 0) {
        loadProjectData();
      }
      
      if (successCount > 0 && errorCount === 0) {
        // All successful
        alert(`✅ Successfully uploaded ${successCount} photo${successCount !== 1 ? 's' : ''}!`);
      } else if (successCount > 0 && errorCount > 0) {
        // Partial success
        alert(`⚠️ Uploaded ${successCount} photo${successCount !== 1 ? 's' : ''}, but ${errorCount} failed. Check console for details.`);
      } else if (errorCount > 0 && successCount === 0) {
        // All failed - error will be thrown above
        alert(`❌ Failed to upload any photos. Please check your connection and try again.`);
      }
      
    } catch (err) {
      console.error('Error uploading photos:', err);
      alert('Failed to upload photos: ' + err.message);
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  }

  // Handle delete photo
  const handleDeletePhoto = (photo) => async (e) => {
    e.stopPropagation();
    if (confirm('Delete this photo?')) {
      try {
        await supabase.storage.from('project-photos').remove([`${id}/${photo.name}`]);
        loadProjectData();
      } catch (err) {
        alert('Failed to delete');
      }
    }
  };

  // Toggle report expansion and load photos
  async function toggleReport(reportId) {
    if (expandedReport === reportId) {
      setExpandedReport(null);
      return;
    }
    setExpandedReport(reportId);
    // Load photos for this report
    try {
      const { data: photos } = await supabase.from('report_photos').select('*').eq('report_id', reportId).order('sort_order');
      const report = projectReports.find(r => r.id === reportId);
      if (report) {
        report._photos = photos || [];
        setProjectReports([...projectReports]);
      }
    } catch (err) {
      console.log('Could not load report photos');
    }
  }

  // Delete report
  async function handleDeleteReport(reportId) {
    if (confirm('Delete this report and all its photos?')) {
      try {
        await supabase.from('report_photos').delete().eq('report_id', reportId);
        await supabase.from('project_reports').delete().eq('id', reportId);
        loadProjectData();
      } catch (err) {
        alert('Failed to delete report');
      }
    }
  }

  // Generate PDF report with photos and captions
  async function generateReportPDF(report) {
    setGeneratingPdf(true);
    try {
      // Load photos if not loaded yet
      let photos = report._photos || [];
      if (!report._photos) {
        const { data } = await supabase.from('report_photos').select('*').eq('report_id', report.id).order('sort_order');
        photos = data || [];
      }

      const doc = new jsPDF('p', 'mm', 'letter');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      // Helper: check if we need a new page
      const checkPage = (needed) => {
        if (y + needed > pageHeight - margin) {
          doc.addPage();
          y = margin;
          return true;
        }
        return false;
      };

      // ===== HEADER =====
      // Company header bar
      doc.setFillColor(11, 62, 168); // brand blue
      doc.rect(0, 0, pageWidth, 28, 'F');
      doc.setTextColor(249, 115, 22); // brand orange
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('DML ELECTRICAL SERVICE LLC', margin, 12);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('DONE RIGHT. FIRST TIME. EVERY TIME.', margin, 20);

      // Report title
      y = 38;
      doc.setTextColor(11, 62, 168);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(report.title || 'Project Report', margin, y);
      y += 10;

      // Date & Project info
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${report.report_date || 'N/A'}`, margin, y);
      y += 6;
      if (project) {
        doc.text(`Project: ${project.name || ''}`, margin, y);
        y += 6;
        if (project.address) {
          doc.text(`Location: ${project.address}`, margin, y);
          y += 6;
        }
        if (project.customer) {
          doc.text(`Customer: ${project.customer}`, margin, y);
          y += 6;
        }
      }

      // Divider line
      y += 4;
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      // ===== REPORT CONTENT =====
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Report Notes:', margin, y);
      y += 7;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      const contentLines = doc.splitTextToSize(report.content || '', contentWidth);
      for (const line of contentLines) {
        checkPage(6);
        doc.text(line, margin, y);
        y += 5.5;
      }
      y += 8;

      // ===== PHOTOS =====
      if (photos.length > 0) {
        checkPage(20);
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;
        doc.setTextColor(11, 62, 168);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`Photos (${photos.length})`, margin, y);
        y += 10;

        for (let i = 0; i < photos.length; i++) {
          const photo = photos[i];
          try {
            // Fetch image as base64
            const response = await fetch(photo.file_url);
            const blob = await response.blob();
            const base64 = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });

            // Calculate image dimensions - fit within page width, max height 120mm
            const imgProps = doc.getImageProperties(base64);
            const maxImgWidth = contentWidth;
            const maxImgHeight = 120;
            let imgWidth = maxImgWidth;
            let imgHeight = (imgProps.height / imgProps.width) * imgWidth;
            if (imgHeight > maxImgHeight) {
              imgHeight = maxImgHeight;
              imgWidth = (imgProps.width / imgProps.height) * imgHeight;
            }

            // Check if photo + caption fits on current page
            const captionHeight = photo.caption ? 8 : 0;
            checkPage(imgHeight + captionHeight + 15);

            // Center the image
            const imgX = margin + (contentWidth - imgWidth) / 2;

            // Add photo border
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.3);
            doc.rect(imgX - 1, y - 1, imgWidth + 2, imgHeight + 2);

            doc.addImage(base64, 'JPEG', imgX, y, imgWidth, imgHeight);
            y += imgHeight + 3;

            // Caption
            if (photo.caption) {
              doc.setTextColor(80, 80, 80);
              doc.setFontSize(10);
              doc.setFont('helvetica', 'italic');
              const captionLines = doc.splitTextToSize(photo.caption, contentWidth);
              for (const cLine of captionLines) {
                checkPage(5);
                doc.text(cLine, margin, y);
                y += 4.5;
              }
            }

            y += 10; // spacing between photos
          } catch (imgErr) {
            console.error('Error loading image for PDF:', imgErr);
            checkPage(10);
            doc.setTextColor(200, 0, 0);
            doc.setFontSize(10);
            doc.text(`[Image could not be loaded: ${photo.file_name || 'unknown'}]`, margin, y);
            y += 8;
          }
        }
      }

      // ===== FOOTER =====
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.setFont('helvetica', 'normal');
        doc.text(`Page ${p} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        doc.text(`Generated: ${new Date().toLocaleString()}`, margin, pageHeight - 10);
      }

      // Save with a nice filename
      const safeName = (report.title || 'Report').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40);
      doc.save(`${safeName}_${report.report_date || 'report'}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF: ' + err.message);
    } finally {
      setGeneratingPdf(false);
    }
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
          <h1 style={styles.title}>📸 Reports & Photos</h1>
          <p style={styles.subtitle}>Project: {project.name}</p>
        </div>
        <button onClick={() => navigate(`/project/${id}`)} style={styles.backButton}>
          ← Back to Project
        </button>
      </div>

      <div style={styles.content}>
        {/* 📸 Reports & Photos Card */}
        <div style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ ...styles.cardTitle, marginBottom: 0 }}>📸 Reports & Photos</h2>
            <div style={{display: 'flex', gap: 8}}>
              <label style={{...styles.addButton, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', opacity: uploadingPhoto ? 0.6 : 1}}>
                {uploadingPhoto ? '⏳ Uploading...' : '📷 Upload Photos'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{display: 'none'}}
                  disabled={uploadingPhoto}
                  onChange={handlePhotoUpload}
                />
              </label>
              <button onClick={() => { setReportForm({ title: '', content: '', report_date: new Date().toISOString().split('T')[0] }); setShowAddReportModal(true); }} style={{...styles.addButton, backgroundColor: '#3b82f6'}}>
                📝 Add Report
              </button>
            </div>
          </div>

          {/* Job Sections */}
          {projectPhotos.length > 0 ? (
            <>
              <div style={{fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 8}}>Job Sections ({projectPhotos.length} total photos)</div>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 20}}>
                {JOB_SECTIONS.map((section) => {
                  let sectionPhotoCount;
                  
                  if (section.id === 'other') {
                    // For "Other" section, include all photos that don't match any other section
                    sectionPhotoCount = projectPhotos.filter(photo => {
                      const photoName = photo.name.toLowerCase();
                      const matchesAnySection = JOB_SECTIONS
                        .filter(s => s.id !== 'other')
                        .some(s => 
                          photoName.includes(s.id) || 
                          photoName.includes(s.name.toLowerCase().replace(/\s+/g, '-'))
                        );
                      return !matchesAnySection;
                    }).length;
                  } else {
                    // For other sections, only include photos that specifically match
                    sectionPhotoCount = projectPhotos.filter(photo => 
                      photo.name.toLowerCase().includes(section.id) || 
                      photo.name.toLowerCase().includes(section.name.toLowerCase().replace(/\s+/g, '-'))
                    ).length;
                  }
                  
                  return (
                    <div 
                      key={section.id} 
                      style={{
                        padding: 16,
                        border: selectedSection === section.id ? `3px solid ${section.color}` : '2px solid #e5e7eb',
                        borderRadius: 12,
                        cursor: 'pointer',
                        backgroundColor: selectedSection === section.id ? `${section.color}15` : '#f9fafb',
                        transition: 'all 0.2s',
                        textAlign: 'center'
                      }}
                      onClick={() => setSelectedSection(selectedSection === section.id ? null : section.id)}
                    >
                      <div style={{fontSize: 32, marginBottom: 8}}>{section.icon}</div>
                      <div style={{fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 4}}>{section.name}</div>
                      <div style={{fontSize: 12, color: '#666'}}>{sectionPhotoCount} photo{sectionPhotoCount !== 1 ? 's' : ''}</div>
                    </div>
                  );
                })}
              </div>

              {/* Photos for Selected Section */}
              {selectedSection && (
                <>
                  <div style={{
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 8, 
                    marginBottom: 16,
                    paddingBottom: 8,
                    borderBottom: '2px solid #e5e7eb'
                  }}>
                    <span style={{fontSize: 24}}>{JOB_SECTIONS.find(s => s.id === selectedSection)?.icon}</span>
                    <h3 style={{fontSize: 18, fontWeight: '700', color: '#111', margin: 0}}>
                      {JOB_SECTIONS.find(s => s.id === selectedSection)?.name} Photos
                    </h3>
                    <button 
                      onClick={() => setSelectedSection(null)}
                      style={{
                        marginLeft: 'auto',
                        padding: '4px 12px',
                        backgroundColor: '#f3f4f6',
                        border: 'none',
                        borderRadius: 6,
                        color: '#666',
                        cursor: 'pointer',
                        fontSize: 12
                      }}
                    >
                      ✕ Close
                    </button>
                  </div>
                  
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 20}}>
                    {projectPhotos
                      .filter(photo => {
                        if (selectedSection === 'other') {
                          // For "Other" section, show photos that don't match any other section
                          const photoName = photo.name.toLowerCase();
                          const matchesAnySection = JOB_SECTIONS
                            .filter(s => s.id !== 'other')
                            .some(s => 
                              photoName.includes(s.id) || 
                              photoName.includes(s.name.toLowerCase().replace(/\s+/g, '-'))
                            );
                          return !matchesAnySection;
                        } else {
                          // For other sections, show photos that match this specific section
                          return photo.name.toLowerCase().includes(selectedSection) || 
                                 photo.name.toLowerCase().includes(JOB_SECTIONS.find(s => s.id === selectedSection)?.name.toLowerCase().replace(/\s+/g, '-'));
                        }
                      })
                      .map((photo, idx) => (
                        <div key={idx} style={{position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb', aspectRatio: '1', cursor: 'pointer'}} onClick={() => setSelectedPhoto(photo)}>
                          <img src={photo.url} alt={photo.name} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                          <button onClick={handleDeletePhoto(photo)} style={{position: 'absolute', top: 4, right: 4, background: 'rgba(239,68,68,0.9)', border: 'none', color: '#fff', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>✕</button>
                        </div>
                      ))}
                  </div>
                  
                  {projectPhotos.filter(photo => {
                    if (selectedSection === 'other') {
                      const photoName = photo.name.toLowerCase();
                      const matchesAnySection = JOB_SECTIONS
                        .filter(s => s.id !== 'other')
                        .some(s => 
                          photoName.includes(s.id) || 
                          photoName.includes(s.name.toLowerCase().replace(/\s+/g, '-'))
                        );
                      return !matchesAnySection;
                    } else {
                      return photo.name.toLowerCase().includes(selectedSection) || 
                             photo.name.toLowerCase().includes(JOB_SECTIONS.find(s => s.id === selectedSection)?.name.toLowerCase().replace(/\s+/g, '-'));
                    }
                  }).length === 0 && (
                    <div style={{textAlign: 'center', padding: 40, color: '#999'}}>
                      {selectedSection === 'other' 
                        ? 'No uncategorized photos found. All photos have been organized into specific job sections.'
                        : `No photos in this section yet. Upload photos with "${selectedSection}" in the filename to organize them here.`
                      }
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div style={{textAlign: 'center', padding: 40, color: '#999'}}>
              No photos uploaded yet. Start by uploading photos for different job sections!
            </div>
          )}

          {/* Reports List */}
          {projectReports.length > 0 && (
            <>
              <div style={{fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 8}}>Reports ({projectReports.length})</div>
              <div style={{...styles.reportsList, maxHeight: 'none'}}>
                {projectReports.map((report) => (
                  <div key={report.id} style={{...styles.reportRow, flexDirection: 'column', alignItems: 'stretch'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                      <div style={{flex: 1, cursor: 'pointer'}} onClick={() => toggleReport(report.id)}>
                        <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                          <span style={{fontSize: 16}}>{expandedReport === report.id ? '▼' : '▶'}</span>
                          <div style={{fontSize: 15, fontWeight: '700', color: '#111'}}>{report.title}</div>
                        </div>
                        <div style={{fontSize: 12, color: '#999', marginTop: 2, marginLeft: 24}}>{formatDate(report.report_date)}</div>
                      </div>
                      <div style={{display: 'flex', gap: 8}}>
                        <button onClick={() => generateReportPDF(report)} disabled={generatingPdf} style={{...styles.pdfButton, opacity: generatingPdf ? 0.6 : 1}}>
                          {generatingPdf ? '⏳' : '📄'} PDF
                        </button>
                        <button onClick={() => handleDeleteReport(report.id)} style={styles.deleteButton}>✕</button>
                      </div>
                    </div>
                    {expandedReport === report.id && (
                      <div style={{marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb'}}>
                        <div style={{fontSize: 14, color: '#333', whiteSpace: 'pre-wrap', lineHeight: 1.6, marginBottom: 12}}>{report.content}</div>
                        {report._photos && report._photos.length > 0 && (
                          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16}}>
                            {report._photos.map((photo, idx) => (
                              <div key={idx} style={{borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb', backgroundColor: '#fff'}}>
                                <img src={photo.file_url} alt={photo.caption || ''} style={{width: '100%', height: 180, objectFit: 'cover', cursor: 'pointer', display: 'block'}} onClick={() => setSelectedPhoto({url: photo.file_url, name: photo.caption || photo.file_name})} />
                                {photo.caption && <div style={{padding: '8px 10px', fontSize: 13, color: '#444', fontStyle: 'italic', borderTop: '1px solid #f0f0f0'}}>{photo.caption}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {projectPhotos.length === 0 && projectReports.length === 0 && (
            <p style={styles.emptyText}>No photos or reports yet. Upload job site photos or create daily reports!</p>
          )}
        </div>

        {/* Add Report Modal */}
        {showAddReportModal && (
          <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20}} onClick={() => setShowAddReportModal(false)}>
            <div style={{backgroundColor: '#fff', borderRadius: 12, maxWidth: 800, width: '100%', maxHeight: '90vh', overflow: 'auto'}} onClick={(e) => e.stopPropagation()}>
              <div style={{padding: 24, borderBottom: '2px solid #e5e7eb', position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 10}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <h2 style={{margin: 0, fontSize: 24, fontWeight: 700, color: '#111'}}>📝 Create Project Report</h2>
                  <button onClick={() => setShowAddReportModal(false)} style={{padding: '8px 16px', fontSize: 20, fontWeight: 700, color: '#666', backgroundColor: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer'}}>✕</button>
                </div>
              </div>

              <div style={{padding: 24}}>
                <div style={{marginBottom: 20}}>
                  <label style={{display: 'block', fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 8}}>Report Title</label>
                  <input
                    type="text"
                    value={reportForm.title}
                    onChange={(e) => setReportForm({...reportForm, title: e.target.value})}
                    placeholder="e.g., Daily Progress Report, Installation Complete, etc."
                    style={{width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: 8, fontSize: 14}}
                  />
                </div>

                <div style={{marginBottom: 20}}>
                  <label style={{display: 'block', fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 8}}>Report Date</label>
                  <input
                    type="date"
                    value={reportForm.report_date}
                    onChange={(e) => setReportForm({...reportForm, report_date: e.target.value})}
                    style={{padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: 8, fontSize: 14}}
                  />
                </div>

                <div style={{marginBottom: 20}}>
                  <label style={{display: 'block', fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 8}}>Report Content</label>
                  <p style={{fontSize: 12, color: '#666', marginBottom: 12}}>Build your report by adding text blocks and dragging photos between them. Each photo can have its own caption and annotations.</p>
                  
                  {/* Advanced Report Content Builder */}
                  <div style={{border: '2px solid #e5e7eb', borderRadius: 8, padding: 16, backgroundColor: '#fafafa'}}>
                    {reportContent.length === 0 ? (
                      <div style={{textAlign: 'center', padding: 40, color: '#999'}}>
                        <p>Start building your report by adding content blocks below</p>
                      </div>
                    ) : (
                      reportContent.map((block, blockIndex) => (
                        <div key={blockIndex} style={{marginBottom: 12, position: 'relative'}}>
                          {block.type === 'text' ? (
                            <div style={{position: 'relative'}}>
                              <textarea
                                value={block.content}
                                onChange={(e) => {
                                  const updated = [...reportContent];
                                  updated[blockIndex].content = e.target.value;
                                  setReportContent(updated);
                                }}
                                placeholder="Enter text for this section..."
                                rows={4}
                                style={{
                                  width: '100%', 
                                  padding: '12px', 
                                  border: '1px solid #d1d5db', 
                                  borderRadius: 6, 
                                  fontSize: 14, 
                                  resize: 'vertical',
                                  backgroundColor: '#fff',
                                  color: '#111'
                                }}
                              />
                              <div style={{position: 'absolute', top: 8, right: 8}}>
                                <button
                                  onClick={() => {
                                    const updated = reportContent.filter((_, i) => i !== blockIndex);
                                    setReportContent(updated);
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#ef4444',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    fontSize: 12
                                  }}
                                >
                                  ✕ Remove Text Block
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{
                              border: '2px solid #e5e7eb',
                              borderRadius: 8,
                              padding: 12,
                              backgroundColor: '#fff',
                              position: 'relative'
                            }}>
                              <div style={{display: 'flex', gap: 12, alignItems: 'flex-start'}}>
                                <img
                                  src={block.content.preview || block.content.url}
                                  alt={block.content.name}
                                  style={{
                                    width: 120,
                                    height: 120,
                                    objectFit: 'cover',
                                    borderRadius: 6,
                                    flexShrink: 0
                                  }}
                                />
                                <div style={{flex: 1}}>
                                  <div style={{fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 8}}>
                                    📷 {block.content.isExisting ? block.content.name : (block.content.file ? block.content.file.name : 'Photo')}
                                  </div>
                                  <textarea
                                    value={block.content.caption || ''}
                                    onChange={(e) => {
                                      const updated = [...reportContent];
                                      updated[blockIndex].content.caption = e.target.value;
                                      setReportContent(updated);
                                    }}
                                    placeholder="Add caption and annotations for this photo..."
                                    rows={3}
                                    style={{
                                      width: '100%',
                                      padding: '8px',
                                      border: '1px solid #d1d5db',
                                      borderRadius: 4,
                                      fontSize: 13,
                                      resize: 'vertical',
                                      color: '#111'
                                    }}
                                  />
                                  <div style={{marginTop: 8, display: 'flex', gap: 8}}>
                                    <button
                                      onClick={() => {
                                        if (blockIndex > 0) {
                                          const updated = [...reportContent];
                                          [updated[blockIndex - 1], updated[blockIndex]] = [updated[blockIndex], updated[blockIndex - 1]];
                                          setReportContent(updated);
                                        }
                                      }}
                                      disabled={blockIndex === 0}
                                      style={{
                                        padding: '4px 8px',
                                        backgroundColor: blockIndex === 0 ? '#f3f4f6' : '#3b82f6',
                                        color: blockIndex === 0 ? '#9ca3af' : '#fff',
                                        border: 'none',
                                        borderRadius: 4,
                                        cursor: blockIndex === 0 ? 'not-allowed' : 'pointer',
                                        fontSize: 11
                                      }}
                                    >
                                      ↑ Move Up
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (blockIndex < reportContent.length - 1) {
                                          const updated = [...reportContent];
                                          [updated[blockIndex], updated[blockIndex + 1]] = [updated[blockIndex + 1], updated[blockIndex]];
                                          setReportContent(updated);
                                        }
                                      }}
                                      disabled={blockIndex === reportContent.length - 1}
                                      style={{
                                        padding: '4px 8px',
                                        backgroundColor: blockIndex === reportContent.length - 1 ? '#f3f4f6' : '#3b82f6',
                                        color: blockIndex === reportContent.length - 1 ? '#9ca3af' : '#fff',
                                        border: 'none',
                                        borderRadius: 4,
                                        cursor: blockIndex === reportContent.length - 1 ? 'not-allowed' : 'pointer',
                                        fontSize: 11
                                      }}
                                    >
                                      ↓ Move Down
                                    </button>
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  const updated = reportContent.filter((_, i) => i !== blockIndex);
                                  setReportContent(updated);
                                }}
                                style={{
                                  position: 'absolute',
                                  top: 8,
                                  right: 8,
                                  padding: '4px 8px',
                                  backgroundColor: '#ef4444',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  fontSize: 11
                                }}
                              >
                                ✕ Remove Photo
                              </button>
                            </div>
                          )}
                          
                          {/* Drop Zone Between Blocks */}
                          <div
                            style={{
                              height: 20,
                              backgroundColor: draggedPhoto ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                              border: draggedPhoto ? '2px dashed #3b82f6' : '1px dashed transparent',
                              borderRadius: 4,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 11,
                              color: '#3b82f6',
                              fontWeight: 600,
                              cursor: draggedPhoto ? 'pointer' : 'default',
                              marginTop: 8
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (draggedPhoto) {
                                const updated = [...reportContent];
                                updated.splice(blockIndex + 1, 0, {
                                  type: 'photo',
                                  content: {...draggedPhoto, caption: ''}
                                });
                                setReportContent(updated);
                                setDraggedPhoto(null);
                              }
                            }}
                          >
                            {draggedPhoto && 'Drop photo here'}
                          </div>
                        </div>
                      ))
                    )}
                    
                    {/* Final Drop Zone */}
                    <div
                      style={{
                        height: 30,
                        backgroundColor: draggedPhoto ? 'rgba(59, 130, 246, 0.1)' : 'rgba(243, 244, 246, 0.5)',
                        border: draggedPhoto ? '2px dashed #3b82f6' : '2px dashed #d1d5db',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        color: draggedPhoto ? '#3b82f6' : '#9ca3af',
                        fontWeight: 600,
                        cursor: draggedPhoto ? 'pointer' : 'default',
                        marginTop: 8
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedPhoto) {
                          setReportContent([...reportContent, {
                            type: 'photo',
                            content: {...draggedPhoto, caption: ''}
                          }]);
                          setDraggedPhoto(null);
                        }
                      }}
                    >
                      {draggedPhoto ? 'Drop photo here' : 'Drag photos here or add content blocks below'}
                    </div>
                  </div>
                  
                  {/* Content Builder Controls */}
                  <div style={{marginTop: 12, display: 'flex', gap: 8}}>
                    <button
                      onClick={() => {
                        setReportContent([...reportContent, {
                          type: 'text',
                          content: ''
                        }]);
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#6b7280',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600
                      }}
                    >
                      ➕ Add Text Block
                    </button>
                    <button
                      onClick={() => {
                        document.getElementById('photo-selector-advanced').style.display = 
                          document.getElementById('photo-selector-advanced').style.display === 'none' ? 'block' : 'none';
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#10b981',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600
                      }}
                    >
                      📷 Browse Photos to Add
                    </button>
                  </div>

                  {/* Advanced Photo Selector for Drag and Drop */}
                  <div id="photo-selector-advanced" style={{display: 'none', marginTop: 12}}>
                    <div style={{padding: 16, backgroundColor: '#f8f9fa', borderRadius: 8, border: '2px solid #e5e7eb'}}>
                      <div style={{fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 12}}>Drag photos to position them in your report:</div>
                      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 12, maxHeight: 200, overflowY: 'auto'}}>
                        {projectPhotos.map((photo, idx) => (
                          <div
                            key={idx}
                            draggable
                            onDragStart={() => setDraggedPhoto(photo)}
                            onDragEnd={() => setDraggedPhoto(null)}
                            style={{
                              position: 'relative',
                              borderRadius: 6,
                              overflow: 'hidden',
                              border: '2px solid #e5e7eb',
                              cursor: 'grab',
                              aspectRatio: '1',
                              transition: 'transform 0.2s'
                            }}
                            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                          >
                            <img src={photo.url} alt={photo.name} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                            <div style={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              backgroundColor: 'rgba(0,0,0,0.7)',
                              color: '#fff',
                              padding: '2px 4px',
                              fontSize: 10,
                              textAlign: 'center',
                              textOverflow: 'ellipsis',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap'
                            }}>
                              📷 Drag to add
                            </div>
                          </div>
                        ))}
                      </div>
                      {projectPhotos.length === 0 && (
                        <p style={{textAlign: 'center', color: '#666', margin: 20}}>No photos available. Upload some photos first.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{marginBottom: 20}}>
                  <label style={{display: 'block', fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 8}}>Report Photos</label>
                  <div style={{display: 'flex', gap: 8, marginBottom: 12}}>
                    <button
                      type="button"
                      onClick={() => {
                        // Show existing project photos for selection
                        if (projectPhotos.length === 0) {
                          alert('No existing photos to select from. Upload some photos first.');
                          return;
                        }
                        // Toggle photo selector
                        document.getElementById('photo-selector').style.display = 
                          document.getElementById('photo-selector').style.display === 'none' ? 'block' : 'none';
                      }}
                      style={{display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', backgroundColor: '#10b981', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, border: 'none'}}
                    >
                      📂 Select Existing Photos ({projectPhotos.length})
                    </button>
                    <label style={{display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', backgroundColor: '#3b82f6', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600}}>
                      📷 + Upload New
                      <input type="file" accept="image/*" multiple style={{display: 'none'}} onChange={(e) => {
                        const files = Array.from(e.target.files);
                        const newPhotos = files.map(file => ({
                          file,
                          preview: URL.createObjectURL(file),
                          caption: '',
                          isNew: true
                        }));
                        setReportPhotos([...reportPhotos, ...newPhotos]);
                      }} />
                    </label>
                  </div>

                  {/* Existing Photo Selector */}
                  <div id="photo-selector" style={{display: 'none', marginBottom: 12}}>
                    <div style={{padding: 16, backgroundColor: '#f8f9fa', borderRadius: 8, border: '2px solid #e5e7eb'}}>
                      <div style={{fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 12}}>Select from Existing Photos:</div>
                      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12, maxHeight: 300, overflowY: 'auto'}}>
                        {projectPhotos.map((photo, idx) => {
                          const isSelected = reportPhotos.some(rp => rp.url === photo.url);
                          return (
                            <div
                              key={idx}
                              style={{
                                position: 'relative',
                                borderRadius: 8,
                                overflow: 'hidden',
                                border: isSelected ? '3px solid #10b981' : '2px solid #e5e7eb',
                                cursor: 'pointer',
                                aspectRatio: '1'
                              }}
                              onClick={() => {
                                if (isSelected) {
                                  // Remove from report
                                  setReportPhotos(reportPhotos.filter(rp => rp.url !== photo.url));
                                } else {
                                  // Add to report
                                  setReportPhotos([...reportPhotos, {
                                    url: photo.url,
                                    name: photo.name,
                                    caption: '',
                                    isExisting: true
                                  }]);
                                }
                              }}
                            >
                              <img src={photo.url} alt={photo.name} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                              {isSelected && (
                                <div style={{
                                  position: 'absolute',
                                  top: 4,
                                  right: 4,
                                  backgroundColor: '#10b981',
                                  color: '#fff',
                                  borderRadius: '50%',
                                  width: 24,
                                  height: 24,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 12,
                                  fontWeight: 'bold'
                                }}>
                                  ✓
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {projectPhotos.length === 0 && (
                        <p style={{textAlign: 'center', color: '#666', margin: 20}}>No existing photos available. Upload some photos first.</p>
                      )}
                    </div>
                  </div>

                  <p style={{fontSize: 12, color: '#666', margin: '8px 0 0 0'}}>Select existing photos or upload new ones to document your work</p>
                </div>

                {reportPhotos.length > 0 ? (
                  <div style={{display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20}}>
                    {reportPhotos.map((photo, idx) => (
                      <div key={idx} style={{display: 'flex', gap: 12, padding: 12, backgroundColor: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb'}}>
                        <img 
                          src={photo.preview || photo.url} 
                          alt="" 
                          style={{width: 100, height: 100, objectFit: 'cover', borderRadius: 6, flexShrink: 0}} 
                        />
                        <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 8}}>
                          <div style={{fontSize: 12, color: '#666', fontWeight: 600}}>
                            {photo.isExisting ? photo.name : (photo.file ? photo.file.name : 'Unknown')}
                          </div>
                          <textarea
                            value={photo.caption}
                            onChange={(e) => {
                              const updated = [...reportPhotos];
                              updated[idx].caption = e.target.value;
                              setReportPhotos(updated);
                            }}
                            placeholder="Add a caption describing what this photo shows..."
                            rows={3}
                            style={{width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, resize: 'none'}}
                          />
                        </div>
                        <button
                          onClick={() => {
                            if (photo.preview) URL.revokeObjectURL(photo.preview);
                            setReportPhotos(reportPhotos.filter((_, i) => i !== idx));
                          }}
                          style={{alignSelf: 'flex-start', padding: '4px 8px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600}}
                        >
                          ✕ Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{padding: 20, border: '2px dashed #d1d5db', borderRadius: 8, textAlign: 'center', color: '#999', fontSize: 14, marginBottom: 20}}>
                    No photos added yet. Click "+ Add Photos" to include images in this report.
                  </div>
                )}

                <div style={{display: 'flex', gap: 12, justifyContent: 'flex-end'}}>
                  <button onClick={() => setShowAddReportModal(false)} style={{padding: '10px 20px', backgroundColor: 'transparent', border: '2px solid #d1d5db', color: '#666', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600}}>
                    Cancel
                  </button>
                  <button 
                    onClick={async () => {
                      if (!reportForm.title.trim()) {
                        alert('Please enter a report title');
                        return;
                      }
                      if (reportContent.length === 0) {
                        alert('Please add some content blocks to your report');
                        return;
                      }
                      
                      setSavingReport(true);
                      try {
                        // Build content from blocks - convert to structured format
                        let contentText = '';
                        const contentPhotos = [];
                        let photoIndex = 0;

                        for (const block of reportContent) {
                          if (block.type === 'text') {
                            if (block.content.trim()) {
                              contentText += block.content.trim() + '\n\n';
                            }
                          } else if (block.type === 'photo') {
                            contentPhotos.push({
                              ...block.content,
                              sort_order: photoIndex++,
                              insertionPoint: contentText.length // Remember where this photo should be inserted
                            });
                            contentText += `[PHOTO:${photoIndex - 1}]${block.content.caption ? ` - ${block.content.caption}` : ''}\n\n`;
                          }
                        }

                        // 1. Create the report record
                        const { data: newReport, error: reportError } = await supabase
                          .from('project_reports')
                          .insert([{
                            project_id: id,
                            title: reportForm.title,
                            content: contentText.trim(),
                            report_date: reportForm.report_date,
                            created_by: user?.id
                          }])
                          .select()
                          .single();

                        if (reportError) throw reportError;

                        // 2. Handle photos from content blocks
                        if (contentPhotos.length > 0) {
                          for (let i = 0; i < contentPhotos.length; i++) {
                            const photo = contentPhotos[i];
                            let fileUrl, fileName;

                            if (photo.isExisting || photo.url) {
                              // For existing photos, just use the existing URL
                              fileUrl = photo.url;
                              fileName = photo.name || `photo_${i}`;
                            } else if (photo.file) {
                              // For new photos, upload them first
                              const ext = photo.file.name.split('.').pop();
                              fileName = `reports/${newReport.id}/${Date.now()}-${i}.${ext}`;
                              
                              const { error: uploadError } = await supabase.storage
                                .from('project-photos')
                                .upload(`${id}/${fileName}`, photo.file, { contentType: photo.file.type });

                              if (uploadError) {
                                console.error('Photo upload error:', uploadError);
                                continue; // Skip this photo but continue with others
                              }

                              // Get public URL
                              const { data: urlData } = supabase.storage
                                .from('project-photos')
                                .getPublicUrl(`${id}/${fileName}`);
                              fileUrl = urlData.publicUrl;
                            } else {
                              continue; // Skip invalid photos
                            }

                            // Save report_photos record with precise positioning
                            await supabase.from('report_photos').insert([{
                              report_id: newReport.id,
                              file_url: fileUrl,
                              file_name: fileName,
                              caption: photo.caption || '',
                              sort_order: photo.sort_order,
                            }]);
                          }
                        }

                        // 3. Also handle any legacy photos from the old selector (if any)
                        if (reportPhotos.length > 0) {
                          for (let i = 0; i < reportPhotos.length; i++) {
                            const photo = reportPhotos[i];
                            let fileUrl, fileName;

                            if (photo.isExisting) {
                              fileUrl = photo.url;
                              fileName = photo.name;
                            } else if (photo.file) {
                              const ext = photo.file.name.split('.').pop();
                              fileName = `reports/${newReport.id}/legacy_${Date.now()}-${i}.${ext}`;
                              
                              const { error: uploadError } = await supabase.storage
                                .from('project-photos')
                                .upload(`${id}/${fileName}`, photo.file, { contentType: photo.file.type });

                              if (uploadError) {
                                console.error('Legacy photo upload error:', uploadError);
                                continue;
                              }

                              const { data: urlData } = supabase.storage
                                .from('project-photos')
                                .getPublicUrl(`${id}/${fileName}`);
                              fileUrl = urlData.publicUrl;
                            } else {
                              continue;
                            }

                            await supabase.from('report_photos').insert([{
                              report_id: newReport.id,
                              file_url: fileUrl,
                              file_name: fileName,
                              caption: photo.caption || '',
                              sort_order: contentPhotos.length + i,
                            }]);
                          }
                        }

                        // Clean up
                        reportPhotos.forEach(photo => { if (photo.preview) URL.revokeObjectURL(photo.preview); });
                        reportContent.forEach(block => { 
                          if (block.type === 'photo' && block.content.preview) {
                            URL.revokeObjectURL(block.content.preview);
                          }
                        });
                        
                        // Reset form
                        setReportPhotos([]);
                        setReportContent([]);
                        setReportForm({ title: '', content: '', report_date: new Date().toISOString().split('T')[0] });
                        setShowAddReportModal(false);
                        loadProjectData();
                        
                        const totalPhotos = contentPhotos.length + reportPhotos.length;
                        alert(`✅ Report "${newReport.title}" created successfully with ${totalPhotos} photo(s) positioned throughout the content!`);

                      } catch (err) {
                        console.error('Error creating report:', err);
                        alert('Failed to save report: ' + err.message + '\n\nMake sure you have run the SETUP_REPORTS_PHOTOS_FINAL.sql in Supabase.');
                      } finally {
                        setSavingReport(false);
                      }
                    }}
                    disabled={savingReport || !reportForm.title.trim() || reportContent.length === 0}
                    style={{
                      padding: '10px 20px', 
                      backgroundColor: savingReport ? '#9CA3AF' : '#10b981', 
                      border: 'none', 
                      color: '#fff', 
                      borderRadius: 8, 
                      cursor: savingReport ? 'not-allowed' : 'pointer', 
                      fontSize: 14, 
                      fontWeight: 600
                    }}
                  >
                    {savingReport ? '⏳ Saving...' : `📝 Save Report${reportPhotos.length > 0 ? ` (${reportPhotos.length} photos)` : ''}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Photo Lightbox & Annotation */}
      {selectedPhoto && !annotatingPhoto && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000}} onClick={(e) => { if (e.target === e.currentTarget) setSelectedPhoto(null); }}>
          <div style={{position: 'relative', maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            <img src={selectedPhoto.url} alt={selectedPhoto.name} style={{maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8}} />
            <div style={{marginTop: 16, display: 'flex', gap: 12}}>
              <button 
                onClick={() => {
                  setAnnotatingPhoto(selectedPhoto);
                  setAnnotations([]);
                  setSelectedPhoto(null);
                }}
                style={{
                  padding: '12px 24px', 
                  backgroundColor: '#10b981', 
                  border: 'none', 
                  color: '#fff', 
                  borderRadius: 8, 
                  cursor: 'pointer', 
                  fontSize: 16, 
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                ✏️ Add Annotations & Arrows
              </button>
              <button 
                onClick={() => setSelectedPhoto(null)}
                style={{
                  padding: '12px 24px', 
                  backgroundColor: 'rgba(255,255,255,0.2)', 
                  border: 'none', 
                  color: '#fff', 
                  borderRadius: 8, 
                  cursor: 'pointer', 
                  fontSize: 16, 
                  fontWeight: 600
                }}
              >
                ✕ Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Annotation Interface */}
      {annotatingPhoto && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 4000, overflow: 'auto'}}>
          <div style={{padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh'}}>
            {/* Annotation Header */}
            <div style={{backgroundColor: 'rgba(255,255,255,0.95)', padding: 16, borderRadius: 8, marginBottom: 20, color: '#111', textAlign: 'center', minWidth: 400}}>
              <h3 style={{margin: '0 0 8px 0', fontSize: 18, fontWeight: 700}}>📝 Annotate Photo</h3>
              <p style={{margin: '0 0 12px 0', fontSize: 14, color: '#666'}}>Click anywhere on the photo to add annotation points with arrows and comments</p>
              <div style={{display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap'}}>
                <button
                  onClick={() => setIsAnnotating(!isAnnotating)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: isAnnotating ? '#ef4444' : '#10b981',
                    border: 'none',
                    color: '#fff',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600
                  }}
                >
                  {isAnnotating ? '🛑 Stop Adding' : '➕ Add Points'}
                </button>
                <button
                  onClick={() => setAnnotations([])}
                  disabled={annotations.length === 0}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: annotations.length === 0 ? '#9ca3af' : '#f59e0b',
                    border: 'none',
                    color: '#fff',
                    borderRadius: 6,
                    cursor: annotations.length === 0 ? 'not-allowed' : 'pointer',
                    fontSize: 14,
                    fontWeight: 600
                  }}
                >
                  🗑️ Clear All
                </button>
                <button
                  onClick={() => {
                    // Save annotations and return to photo view
                    // For now, we'll just add them to the photo object
                    const updatedPhoto = {...annotatingPhoto, annotations: annotations};
                    setSelectedPhoto(updatedPhoto);
                    setAnnotatingPhoto(null);
                    setAnnotations([]);
                    setIsAnnotating(false);
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#3b82f6',
                    border: 'none',
                    color: '#fff',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600
                  }}
                >
                  💾 Save Annotations ({annotations.length})
                </button>
                <button
                  onClick={() => {
                    setAnnotatingPhoto(null);
                    setAnnotations([]);
                    setIsAnnotating(false);
                    setShowAnnotationInput(false);
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#6b7280',
                    border: 'none',
                    color: '#fff',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600
                  }}
                >
                  ↩️ Cancel
                </button>
              </div>
            </div>

            {/* Annotatable Photo Container */}
            <div 
              style={{
                position: 'relative', 
                display: 'inline-block',
                border: '3px solid rgba(255,255,255,0.3)',
                borderRadius: 8,
                cursor: isAnnotating ? 'crosshair' : 'default'
              }}
              onClick={(e) => {
                if (!isAnnotating) return;
                
                const rect = e.currentTarget.getBoundingClientRect();
                const img = e.currentTarget.querySelector('img');
                const imgRect = img.getBoundingClientRect();
                
                // Calculate relative position on the image
                const x = ((e.clientX - imgRect.left) / imgRect.width) * 100;
                const y = ((e.clientY - imgRect.top) / imgRect.height) * 100;
                
                // Add new annotation point
                const newAnnotation = {
                  id: Date.now(),
                  x: x,
                  y: y,
                  text: '',
                  color: '#ef4444'
                };
                
                setAnnotations([...annotations, newAnnotation]);
                setPendingAnnotation(newAnnotation);
                setShowAnnotationInput(true);
                setAnnotationText('');
              }}
            >
              <img 
                src={annotatingPhoto.url} 
                alt={annotatingPhoto.name} 
                style={{
                  maxWidth: '80vw', 
                  maxHeight: '60vh', 
                  objectFit: 'contain',
                  display: 'block'
                }} 
              />
              
              {/* Render annotation points and arrows */}
              {annotations.map((annotation, idx) => (
                <div key={annotation.id} style={{position: 'absolute', left: `${annotation.x}%`, top: `${annotation.y}%`, transform: 'translate(-50%, -50%)'}}>
                  {/* Annotation Point */}
                  <div style={{
                    width: 24,
                    height: 24,
                    backgroundColor: annotation.color,
                    border: '3px solid #fff',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 'bold',
                    color: '#fff',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    zIndex: 10
                  }}>
                    {idx + 1}
                  </div>
                  
                  {/* Callout box */}
                  {annotation.text && (
                    <div style={{
                      position: 'absolute',
                      top: -8,
                      left: 32,
                      minWidth: 200,
                      maxWidth: 300,
                      backgroundColor: 'rgba(0,0,0,0.9)',
                      color: '#fff',
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 13,
                      lineHeight: 1.4,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                      border: `2px solid ${annotation.color}`,
                      zIndex: 11
                    }}>
                      <div style={{fontWeight: 600, marginBottom: 4, color: annotation.color}}>
                        Point {idx + 1}:
                      </div>
                      {annotation.text}
                      
                      {/* Arrow pointing to the annotation point */}
                      <div style={{
                        position: 'absolute',
                        left: -8,
                        top: 12,
                        width: 0,
                        height: 0,
                        borderTop: '6px solid transparent',
                        borderBottom: '6px solid transparent',
                        borderRight: `8px solid ${annotation.color}`
                      }}></div>
                      
                      {/* Edit/Delete buttons */}
                      <div style={{marginTop: 8, display: 'flex', gap: 4, justifyContent: 'flex-end'}}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingAnnotation(annotation);
                            setAnnotationText(annotation.text);
                            setShowAnnotationInput(true);
                          }}
                          style={{
                            padding: '2px 6px',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            color: '#fff',
                            borderRadius: 3,
                            cursor: 'pointer',
                            fontSize: 10
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAnnotations(annotations.filter(a => a.id !== annotation.id));
                          }}
                          style={{
                            padding: '2px 6px',
                            backgroundColor: 'rgba(239,68,68,0.8)',
                            border: 'none',
                            color: '#fff',
                            borderRadius: 3,
                            cursor: 'pointer',
                            fontSize: 10
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Annotation List */}
            {annotations.length > 0 && (
              <div style={{backgroundColor: 'rgba(255,255,255,0.95)', padding: 16, borderRadius: 8, marginTop: 20, minWidth: 400, maxWidth: 600, color: '#111'}}>
                <h4 style={{margin: '0 0 12px 0', fontSize: 16, fontWeight: 700}}>📍 Annotation Points ({annotations.length})</h4>
                <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                  {annotations.map((annotation, idx) => (
                    <div key={annotation.id} style={{display: 'flex', alignItems: 'flex-start', gap: 12, padding: 8, backgroundColor: '#f9fafb', borderRadius: 6, border: `2px solid ${annotation.color}`}}>
                      <div style={{
                        width: 20,
                        height: 20,
                        backgroundColor: annotation.color,
                        border: '2px solid #fff',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 'bold',
                        color: '#fff',
                        flexShrink: 0
                      }}>
                        {idx + 1}
                      </div>
                      <div style={{flex: 1}}>
                        <div style={{fontSize: 13, color: annotation.text ? '#111' : '#999', fontStyle: annotation.text ? 'normal' : 'italic'}}>
                          {annotation.text || 'Click to add comment...'}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setPendingAnnotation(annotation);
                          setAnnotationText(annotation.text);
                          setShowAnnotationInput(true);
                        }}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#3b82f6',
                          border: 'none',
                          color: '#fff',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 600
                        }}
                      >
                        ✏️ Edit
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Annotation Text Input Modal */}
      {showAnnotationInput && pendingAnnotation && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000, padding: 20}}>
          <div style={{backgroundColor: '#fff', borderRadius: 12, padding: 24, minWidth: 400, maxWidth: 500}}>
            <h3 style={{margin: '0 0 16px 0', fontSize: 18, fontWeight: 700, color: '#111'}}>
              💬 Add Comment for Point {annotations.findIndex(a => a.id === pendingAnnotation.id) + 1}
            </h3>
            <textarea
              value={annotationText}
              onChange={(e) => setAnnotationText(e.target.value)}
              placeholder="Describe what you want to point out in this area of the photo..."
              rows={4}
              autoFocus
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e5e7eb',
                borderRadius: 8,
                fontSize: 14,
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
            <div style={{display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16}}>
              <button
                onClick={() => {
                  setShowAnnotationInput(false);
                  setPendingAnnotation(null);
                  setAnnotationText('');
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  border: '2px solid #d1d5db',
                  color: '#666',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Update the annotation with the text
                  const updatedAnnotations = annotations.map(a => 
                    a.id === pendingAnnotation.id 
                      ? {...a, text: annotationText.trim()}
                      : a
                  );
                  setAnnotations(updatedAnnotations);
                  setShowAnnotationInput(false);
                  setPendingAnnotation(null);
                  setAnnotationText('');
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#10b981',
                  border: 'none',
                  color: '#fff',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600
                }}
              >
                💾 Save Comment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
  reportsList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  reportRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px",
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    marginBottom: 8,
  },
  pdfButton: {
    padding: "4px 12px",
    backgroundColor: "#10b981",
    border: "none",
    color: "#fff",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: "600",
  },
  deleteButton: {
    padding: "4px 8px",
    backgroundColor: "transparent",
    border: "none",
    color: "#ef4444",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: "bold",
    borderRadius: 4,
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    padding: 20,
    fontSize: 14,
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
};
