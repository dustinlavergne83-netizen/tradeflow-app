import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function PlanUpload({ projectId, onUploadComplete }) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  async function handleFileUpload(file) {
    try {
      setUploading(true);
      setProgress(0);

      if (!file) return;

      // Validate file type
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/tiff'];
      if (!validTypes.includes(file.type)) {
        alert('Please upload PDF or image files only (PDF, PNG, JPEG, TIFF)');
        return;
      }

      // Check file size (max 50MB)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        alert('File size must be less than 50MB');
        return;
      }

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop().toLowerCase();
      const timestamp = Date.now();
      const fileName = `${user.id}/${projectId}/${timestamp}.${fileExt}`;
      
      setProgress(25);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('plans')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      setProgress(50);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('plans')
        .getPublicUrl(fileName);

      setProgress(75);

      // Create plan record in database
      const { data: plan, error: dbError } = await supabase
        .from('plans')
        .insert([{
          project_id: projectId,
          company_id: user.id,
          file_name: file.name,
          file_url: publicUrl,
          file_size: file.size,
          file_type: fileExt,
          plan_name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
          status: 'pending'
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      setProgress(100);
      
      alert('✅ Plan uploaded successfully!');
      if (onUploadComplete) onUploadComplete(plan);
      
    } catch (error) {
      console.error('Error uploading plan:', error);
      alert('❌ Failed to upload plan: ' + error.message);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  function handleDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }

  function handleChange(e) {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  }

  return (
    <div style={{ width: '100%' }}>
      <input
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.tiff"
        onChange={handleChange}
        disabled={uploading}
        style={{ display: 'none' }}
        id="plan-upload-input"
      />
      
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragActive ? '#fc6b04' : '#ddd'}`,
          borderRadius: 8,
          padding: 40,
          textAlign: 'center',
          background: dragActive ? '#fff5f0' : '#f9f9f9',
          cursor: uploading ? 'not-allowed' : 'pointer',
          transition: 'all 0.3s ease'
        }}
        onClick={() => !uploading && document.getElementById('plan-upload-input').click()}
      >
        {uploading ? (
          <div>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <h3 style={{ margin: '8px 0', color: '#333' }}>Uploading...</h3>
            <div style={{
              width: '100%',
              maxWidth: 300,
              height: 8,
              background: '#eee',
              borderRadius: 4,
              margin: '16px auto',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${progress}%`,
                height: '100%',
                background: '#fc6b04',
                transition: 'width 0.3s ease'
              }} />
            </div>
            <p style={{ color: '#666', fontSize: 14 }}>{progress}% complete</p>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
            <h3 style={{ margin: '8px 0', color: '#333' }}>
              {dragActive ? 'Drop file here' : 'Upload Construction Plans'}
            </h3>
            <p style={{ color: '#666', fontSize: 14, margin: '8px 0' }}>
              Drag and drop or click to browse
            </p>
            <p style={{ color: '#999', fontSize: 12, margin: '8px 0' }}>
              Supported formats: PDF, PNG, JPEG, TIFF (max 50MB)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
