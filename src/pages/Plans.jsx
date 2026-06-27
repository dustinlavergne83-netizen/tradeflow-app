import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import PlanUpload from '../Components/PlanUpload';
import { notify, confirmDialog, promptDialog } from '../lib/notify';

export default function Plans() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [project, setProject] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (projectId) {
      loadProjectAndPlans();
    }
  }, [projectId]);

  async function loadProjectAndPlans() {
    try {
      setLoading(true);

      // Load project details
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      // Load plans
      const { data: plansData, error: plansError } = await supabase
        .from('plans')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (plansError) throw plansError;
      setPlans(plansData || []);

    } catch (error) {
      console.error('Error loading plans:', error);
      notify('Error loading plans: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePlan(planId, fileUrl) {
    if (!await confirmDialog('Are you sure you want to delete this plan? This cannot be undone.')) {
      return;
    }

    try {
      // Extract file path from URL
      const urlParts = fileUrl.split('/plans/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        
        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from('plans')
          .remove([filePath]);

        if (storageError) console.error('Storage deletion error:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('plans')
        .delete()
        .eq('id', planId);

      if (dbError) throw dbError;

      notify('✅ Plan deleted successfully');
      loadProjectAndPlans();

    } catch (error) {
      console.error('Error deleting plan:', error);
      notify('❌ Error deleting plan: ' + error.message);
    }
  }

  async function handleUpdatePlanName(planId, currentName) {
    const newName = await promptDialog('Enter new plan name:', currentName);
    if (!newName || newName === currentName) return;

    try {
      const { error } = await supabase
        .from('plans')
        .update({ plan_name: newName })
        .eq('id', planId);

      if (error) throw error;

      notify('✅ Plan name updated');
      loadProjectAndPlans();

    } catch (error) {
      console.error('Error updating plan name:', error);
      notify('❌ Error updating plan name: ' + error.message);
    }
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 30 }}>
        <button 
          onClick={() => navigate('/projects')}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fc6b04',
            cursor: 'pointer',
            fontSize: 14,
            marginBottom: 10
          }}
        >
          ← Back to Projects
        </button>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 32, color: '#333' }}>📐 Plans & Takeoffs</h1>
            <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: 16 }}>
              {project?.name || 'Project'}
            </p>
          </div>
          
          <button
            onClick={() => setShowUpload(!showUpload)}
            style={{
              padding: '12px 24px',
              background: '#fc6b04',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 'bold'
            }}
          >
            {showUpload ? '✕ Cancel' : '+ Upload Plan'}
          </button>
        </div>
      </div>

      {/* Upload Section */}
      {showUpload && (
        <div style={{ marginBottom: 30 }}>
          <PlanUpload
            projectId={projectId}
            onUploadComplete={() => {
              setShowUpload(false);
              loadProjectAndPlans();
            }}
          />
        </div>
      )}

      {/* Plans Grid */}
      {plans.length === 0 ? (
        <div style={{
          border: '2px dashed #ddd',
          borderRadius: 8,
          padding: 60,
          textAlign: 'center',
          background: '#f9f9f9'
        }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>📄</div>
          <h3 style={{ color: '#333', marginBottom: 8 }}>No Plans Yet</h3>
          <p style={{ color: '#666', marginBottom: 20 }}>
            Upload construction plans to start performing takeoffs
          </p>
          <button
            onClick={() => setShowUpload(true)}
            style={{
              padding: '12px 24px',
              background: '#fc6b04',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 'bold'
            }}
          >
            + Upload Your First Plan
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 20
        }}>
          {plans.map(plan => (
            <div
              key={plan.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: 8,
                padding: 20,
                background: '#fff',
                transition: 'box-shadow 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
            >
              {/* Plan Icon/Preview */}
              <div style={{
                width: '100%',
                height: 150,
                background: '#f5f5f5',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                fontSize: 64
              }}>
                {plan.file_type === 'pdf' ? '📄' : '🖼️'}
              </div>

              {/* Plan Info */}
              <h3 style={{ 
                margin: '0 0 8px 0', 
                fontSize: 18, 
                color: '#333',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {plan.plan_name}
              </h3>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                  <strong>File:</strong> {plan.file_name}
                </div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                  <strong>Size:</strong> {formatFileSize(plan.file_size)}
                </div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                  <strong>Type:</strong> {plan.plan_type || 'Not specified'}
                </div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                  <strong>Status:</strong> 
                  <span style={{
                    marginLeft: 6,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: plan.is_calibrated ? '#d4edda' : '#fff3cd',
                    color: plan.is_calibrated ? '#155724' : '#856404',
                    fontSize: 11,
                    fontWeight: 'bold'
                  }}>
                    {plan.is_calibrated ? '✓ Calibrated' : 'Pending'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
                  Uploaded {formatDate(plan.created_at)}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ 
                display: 'flex', 
                gap: 8,
                borderTop: '1px solid #eee',
                paddingTop: 12
              }}>
                <button
                  onClick={() => navigate(`/project/${projectId}/takeoff?planId=${plan.id}`)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: '#fc6b04',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 'bold'
                  }}
                >
                  📐 View
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdatePlanName(plan.id, plan.plan_name);
                  }}
                  style={{
                    padding: '8px 12px',
                    background: '#f0f0f0',
                    color: '#333',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 14
                  }}
                  title="Rename"
                >
                  ✏️
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePlan(plan.id, plan.file_url);
                  }}
                  style={{
                    padding: '8px 12px',
                    background: '#f0f0f0',
                    color: '#dc3545',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 14
                  }}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
