import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { formatDate } from "../utils/dateUtils";
import jsPDF from "jspdf";
import { getNextJournalEntryNumber, createInvoicePaymentJournalEntry } from "../utils/accountingJournals";

const BRAND = {
  bg: "#0b3ea8",
  text: "#f97316",
  accent: "#fc6b04ff",
  primary: "#2563eb",
};

const PROJECT_TYPES = [
  {
    value: "commercial-public",
    icon: "🏢",
    label: "Commercial Public",
    color: "#1d4ed8",
  },
  {
    value: "commercial-private",
    icon: "🏗️",
    label: "Commercial Private",
    color: "#7c3aed",
  },
  {
    value: "residential-contractor",
    icon: "👷",
    label: "Residential Contractor",
    color: "#d97706",
  },
  {
    value: "residential-owner",
    icon: "🏡",
    label: "Residential Owner",
    desc: "Working directly with the homeowner",
    color: "#059669",
  },
  {
    value: "lighting-project",
    icon: "💡",
    label: "Lighting Project",
    desc: "Out-of-town lighting jobs — OT Bank auto-enabled",
    color: "#f59e0b",
    ot_bank_auto: true,
  },
];

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [timeEntries, setTimeEntries] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [changeOrders, setChangeOrders] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [showAddContractorModal, setShowAddContractorModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [projectExpenses, setProjectExpenses] = useState([]);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    vendor: '',
    amount: '',
    category: 'material',
    expense_date: new Date().toISOString().split('T')[0],
  });
  const [savingExpense, setSavingExpense] = useState(false);
  const [showMaterialFilterModal, setShowMaterialFilterModal] = useState(false);
  const [materialReportCategories, setMaterialReportCategories] = useState([]);
  const [includeLaborInMaterialReport, setIncludeLaborInMaterialReport] = useState(false);
  const [showProposalTypeModal, setShowProposalTypeModal] = useState(false);
  const [selectedEstimateForProposal, setSelectedEstimateForProposal] = useState(null);
  const [proposalType, setProposalType] = useState("commercial-public");
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState({});
  const [showProposalsModal, setShowProposalsModal] = useState(false);
  const [selectedEstimateProposals, setSelectedEstimateProposals] = useState([]);
  const [showInvoiceEditModal, setShowInvoiceEditModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [showProgressBillingModal, setShowProgressBillingModal] = useState(false);
  const [selectedEstimateForProgressBilling, setSelectedEstimateForProgressBilling] = useState(null);
  const [showWinningProposalModal, setShowWinningProposalModal] = useState(false);
  const [selectedWinningProposal, setSelectedWinningProposal] = useState(null);
  const [allProjectProposals, setAllProjectProposals] = useState([]);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editProjectForm, setEditProjectForm] = useState({
    name: '',
    customer: '',
    contractor: '',
    address: '',
    description: '',
    start_date: '',
    end_date: '',
    labor_rate: 50,
    percent_complete: 0,
    project_type: 'commercial-public',
    sq_ft: '',
    ot_bank_enabled: false,
  });
  const [showChangeOrderModal, setShowChangeOrderModal] = useState(false);
  const [changeOrderForm, setChangeOrderForm] = useState({
    title: '',
    description: '',
    change_order_number: ''
  });
  const [showChangeOrderProposalTypeModal, setShowChangeOrderProposalTypeModal] = useState(false);
  const [selectedChangeOrderForProposal, setSelectedChangeOrderForProposal] = useState(null);
  const [changeOrderProposalType, setChangeOrderProposalType] = useState("commercial-public");
  const [showAlternateTypeModal, setShowAlternateTypeModal] = useState(false);
  const [selectedEstimateForAlternate, setSelectedEstimateForAlternate] = useState(null);
  // Attach existing quick estimate to this project
  const [showAttachEstimateModal, setShowAttachEstimateModal] = useState(false);
  const [unlinkedEstimates, setUnlinkedEstimates] = useState([]);
  const [attachEstimateSearch, setAttachEstimateSearch] = useState('');
  const [attachingEstimate, setAttachingEstimate] = useState(false);
  // Set Active Estimate confirmation modal
  const [showSetActiveModal, setShowSetActiveModal] = useState(false);
  const [setActiveModalEstimate, setSetActiveModalEstimate] = useState(null);
  const [setActiveEstWorthInput, setSetActiveEstWorthInput] = useState('');
  const [setActiveEstBudgetInput, setSetActiveEstBudgetInput] = useState('');
  // Attach existing invoice to this project
  const [showAttachInvoiceModal, setShowAttachInvoiceModal] = useState(false);
  const [unlinkedInvoices, setUnlinkedInvoices] = useState([]);
  const [attachInvoiceSearch, setAttachInvoiceSearch] = useState('');
  const [attachingInvoice, setAttachingInvoice] = useState(false);
  const [showInvoiceTypeModal, setShowInvoiceTypeModal] = useState(false);
  const [showApplyDepositsModal, setShowApplyDepositsModal] = useState(false);
  const [pendingInvoiceForDeposit, setPendingInvoiceForDeposit] = useState(null);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [editingActiveWorth, setEditingActiveWorth] = useState(false);
  const [activeWorthInput, setActiveWorthInput] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);
  const [editingSqFt, setEditingSqFt] = useState(false);
  const [sqFtInput, setSqFtInput] = useState('');
  const [editingSqFtLiving, setEditingSqFtLiving] = useState(false);
  const [sqFtLivingInput, setSqFtLivingInput] = useState('');
  const [selectedDepositsToApply, setSelectedDepositsToApply] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [timeEntriesExpanded, setTimeEntriesExpanded] = useState(false);
  const [expensesExpanded, setExpensesExpanded] = useState(false);
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('all');
  const [showAddDepositModal, setShowAddDepositModal] = useState(false);
  const [depositForm, setDepositForm] = useState({
    deposit_amount: '',
    deposit_date: new Date().toISOString().split('T')[0],
    reference_notes: '',
  });


  // Photos & Reports state
  const [projectPhotos, setProjectPhotos] = useState([]);
  const [projectReports, setProjectReports] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showAddReportModal, setShowAddReportModal] = useState(false);
  const [reportForm, setReportForm] = useState({ title: '', content: '', report_date: new Date().toISOString().split('T')[0] });
  const [reportPhotos, setReportPhotos] = useState([]); // {file, preview, caption}
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [expandedReport, setExpandedReport] = useState(null);
  const [editingReport, setEditingReport] = useState(null);
  const [savingReport, setSavingReport] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // ── Invoice Payment Modal state ──────────────────────────────────────────
  const [showInvoicePayModal, setShowInvoicePayModal] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [pdCashAccounts, setPdCashAccounts] = useState([]);
  const [pdHoldingAccounts, setPdHoldingAccounts] = useState([]);
  const [pdPaymentForm, setPdPaymentForm] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    method: 'check',
    deposit_type: 'bank',
    bank_account_id: '',
    holding_account_id: '',
    processing_fee: '',
    notes: '',
  });

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

  useEffect(() => {
    if (id) loadProjectData();
  }, [id]);

  // Refresh data when the tab becomes visible again (user navigates back from estimate/invoice).
  // We intentionally do NOT listen to the window 'focus' event because prompt() dialogs
  // cause focus to fire on every dialog dismiss, which would trigger multiple simultaneous
  // loadProjectData() calls and freeze the browser.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 Tab became visible, refreshing project data...');
        loadProjectData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [id]);

  async function handleSaveProjectEdits() {
    if (!editProjectForm.name.trim()) {
      alert("Project name is required");
      return;
    }

    try {
      const { error } = await supabase
        .from("projects")
        .update({
          name: editProjectForm.name.trim(),
          customer: editProjectForm.customer.trim() || null,
          contractor: editProjectForm.contractor.trim() || null,
          address: editProjectForm.address.trim() || null,
          description: editProjectForm.description.trim() || null,
          start_date: editProjectForm.start_date || null,
          end_date: editProjectForm.end_date || null,
          labor_rate: parseFloat(editProjectForm.labor_rate) || 50,
          percent_complete: parseInt(editProjectForm.percent_complete) || 0,
          project_type: editProjectForm.project_type || 'commercial-public',
          sq_ft: editProjectForm.sq_ft ? parseFloat(editProjectForm.sq_ft) : null,
          ot_bank_enabled: !!editProjectForm.ot_bank_enabled,
        })
        .eq("id", id);

      if (error) throw error;

      alert("Project updated successfully!");
      setShowEditProjectModal(false);
      loadProjectData();
    } catch (err) {
      console.error("Error updating project:", err);
      alert("Failed to update project: " + err.message);
    }
  }

  async function handleCreateAlternate(parentEstimateId) {
    const title = prompt("Enter alternate title (e.g., 'Exterior Lighting Package'):");
    if (!title) return;
    
    try {
      // Get parent estimate to copy settings
      const { data: parent, error: parentError } = await supabase
        .from("estimates")
        .select("*")
        .eq("id", parentEstimateId)
        .single();
      
      if (parentError) throw parentError;
      
      // Get next alternate number
      const { data: existingAlts } = await supabase
        .from("estimates")
        .select("alternate_number")
        .eq("parent_estimate_id", parentEstimateId)
        .order("alternate_number", { ascending: false })
        .limit(1);
      
      const nextAltNumber = existingAlts && existingAlts.length > 0 
        ? existingAlts[0].alternate_number + 1 
        : 1;
      
      // Create alternate estimate
      const { data: newAlt, error: createError } = await supabase
        .from("estimates")
        .insert([{
          company_id: user.id,
          project_name: parent.project_name,
          customer_name: parent.customer_name,
          project_location: parent.project_location,
          estimate_date: new Date().toISOString().split('T')[0],
          estimate_number: `${parent.estimate_number}-ALT${nextAltNumber}`,
          parent_estimate_id: parentEstimateId,
          alternate_number: nextAltNumber,
          alternate_title: title,
          default_labor_rate: parent.default_labor_rate,
          overhead_percent: parent.overhead_percent,
          profit_percent: parent.profit_percent,
          status: 'draft'
        }])
        .select()
        .single();
      
      if (createError) throw createError;
      
      // Navigate to edit the new alternate
      navigate(`/project/${id}/estimate?estimateId=${newAlt.id}`);
    } catch (err) {
      console.error("Error creating alternate:", err);
      alert("Failed to create alternate");
    }
  }
async function handleAddContractor() {
  if (!selectedCustomer) {
    alert("Please select a customer");
    return;
  }

  try {
    const { error } = await supabase
      .from("project_contractors")
      .insert([{
        project_id: id,
        contractor_name: selectedCustomer.customer,
        company_name: selectedCustomer.customer,
        email: selectedCustomer.email,
        phone: selectedCustomer.phone
      }]);

    if (error) throw error;
    
    setShowAddContractorModal(false);
    setSelectedCustomer(null);
    loadProjectData();
  } catch (err) {
    console.error("Error adding contractor:", err);
    alert("Failed to add contractor");
  }
}

  function handleAddExpense() {
    setExpenseForm({
      description: '',
      vendor: '',
      amount: '',
      category: 'material',
      expense_date: new Date().toISOString().split('T')[0],
    });
    setShowAddExpenseModal(true);
  }

  async function handleSaveExpense() {
    if (!expenseForm.description.trim()) {
      alert('Please enter a description');
      return;
    }
    const amount = parseFloat(expenseForm.amount);
    if (!expenseForm.amount || isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    setSavingExpense(true);
    try {
      const { error } = await supabase
        .from('project_expenses')
        .insert([{
          project_id: id,
          expense_date: expenseForm.expense_date || new Date().toISOString().split('T')[0],
          description: expenseForm.description.trim(),
          vendor: expenseForm.vendor.trim() || null,
          amount: amount,
          category: expenseForm.category || 'material',
          created_by: user.id,
        }]);
      if (error) throw error;
      setShowAddExpenseModal(false);
      loadProjectData();
    } catch (err) {
      console.error('Error adding expense:', err);
      alert('Failed to add expense: ' + err.message);
    } finally {
      setSavingExpense(false);
    }
  }

  async function handleCreateInvoice(changeOrderId = null) {
    console.log("🔵 handleCreateInvoice called with changeOrderId:", changeOrderId);
    
    try {
      let invoiceNumber;
      
      if (changeOrderId) {
        console.log("📋 Creating CHANGE ORDER invoice...");
        // CHANGE ORDER INVOICE: Use format 1007-CO1, 1007-CO2
        // The CO suffix should match the actual change order number
        
        // Get the change order to find its CO number
        const { data: coRecord, error: coRecordError } = await supabase
          .from('change_orders')
          .select('change_order_number')
          .eq('id', changeOrderId)
          .single();
        
        if (coRecordError) {
          console.error("❌ Error fetching change order:", coRecordError);
          throw coRecordError;
        }
        
        // Extract CO suffix from change_order_number (e.g., "1010-CO1" → "CO1")
        const coMatch = coRecord.change_order_number.match(/(CO\d+)$/);
        const coSuffix = coMatch ? coMatch[1] : `CO1`;
        
        // Get project's base invoice number (from first invoice for this project)
        const { data: projectInvoices, error: piError } = await supabase
          .from('invoices')
          .select('invoice_number')
          .eq('project_name', project.name)
          .order('created_at', { ascending: true });
        
        if (piError) {
          console.error("❌ Error fetching project invoices:", piError);
          throw piError;
        }
        
        let baseNumber = 1001;
        if (projectInvoices && projectInvoices.length > 0) {
          // Extract base number from first invoice (e.g., "1007" or "1007-1")
          const firstInvoiceNum = projectInvoices[0].invoice_number;
          const match = firstInvoiceNum.match(/^(\d+)/);
          if (match) {
            baseNumber = parseInt(match[1]);
          }
        } else {
          // No invoices yet - get next available number
          const { data: allInvoices } = await supabase
            .from('invoices')
            .select('invoice_number')
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (allInvoices && allInvoices.length > 0) {
            const lastNum = parseInt(allInvoices[0].invoice_number) || 1000;
            baseNumber = lastNum + 1;
          }
        }
        
        console.log("📊 Base number:", baseNumber, "CO suffix:", coSuffix);
        invoiceNumber = `${baseNumber}-${coSuffix}`;
        console.log("✅ Generated CO invoice number:", invoiceNumber);
      } else {
        console.log("📋 Creating REGULAR invoice...");
        // REGULAR INVOICE: Use simple sequential numbering
        const { data: existingInvoices, error: eiError } = await supabase
          .from('invoices')
          .select('invoice_number')
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (eiError) {
          console.error("❌ Error fetching existing invoices:", eiError);
          throw eiError;
        }
        
        let nextNumber = 1001;
        if (existingInvoices && existingInvoices.length > 0) {
          const lastNum = parseInt(existingInvoices[0].invoice_number) || 1000;
          nextNumber = lastNum + 1;
        }
        invoiceNumber = nextNumber.toString();
        console.log("✅ Generated regular invoice number:", invoiceNumber);
      }
      
      // Look up customer email from customers table
      // For commercial projects, use contractor as customer
      const customerName = project.contractor || project.customer || "";
      let customerEmail = "";
      
      console.log("👤 Looking up customer:", customerName);
      
      if (customerName) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('email, phone, address')
          .ilike('customer', customerName)
          .limit(1);

        if (customerData?.[0]?.email) {
          customerEmail = customerData[0].email;
          console.log("✅ Found customer email");
        } else {
          console.log("⚠️ Customer not found in database, continuing without email");
        }
      }
      
      // Create the invoice
      const invoiceData = {
        invoice_number: invoiceNumber,
        project_name: project.name,
        customer_name: customerName || project.name,
        customer_email: customerEmail || null,
        invoice_date: new Date().toISOString().split('T')[0],
        subtotal: 0,
        total: 0,
        balance_due: 0,
        amount_paid: 0,
        status: 'draft',
        notes: changeOrderId ? `Change Order Invoice` : '',
        created_by: user.id
      };
      
      // Add change_order_id if this is for a change order
      if (changeOrderId) {
        invoiceData.change_order_id = changeOrderId;
      }
      
      console.log("💾 Inserting invoice data:", invoiceData);
      
      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([invoiceData])
        .select()
        .single();
      
      if (invoiceError) {
        console.error("❌ Invoice insert error:", invoiceError);
        throw invoiceError;
      }
      
      console.log("✅ Invoice created successfully:", newInvoice);
      
      // Check for unapplied deposits before navigating
      const availableDeposits = deposits.filter(d => d.status === 'received' || d.status === 'deposited');
      if (availableDeposits.length > 0) {
        // Show deposit application modal
        setPendingInvoiceForDeposit({ ...newInvoice, changeOrderId });
        setSelectedDepositsToApply(availableDeposits.map(d => d.id)); // Select all by default
        setShowApplyDepositsModal(true);
      } else {
        // No deposits, navigate directly
        if (changeOrderId) {
          navigate(`/invoice?invoiceId=${newInvoice.id}&coId=${changeOrderId}&projectId=${id}`);
        } else {
          navigate(`/invoice?invoiceId=${newInvoice.id}&projectId=${id}`);
        }
      }
    } catch (err) {
      console.error("❌ FULL ERROR:", err);
      console.error("Error details:", JSON.stringify(err, null, 2));
      alert(`Failed to create invoice: ${err.message}\n\nCheck browser console for details.`);
    }
  }

  async function generateChangeOrderNumber() {
    try {
      // First, get the original estimate number for this project
      const { data: originalEstimate, error: estError } = await supabase
        .from("estimates")
        .select("estimate_number")
        .eq("project_name", project.name)
        .is("parent_estimate_id", null) // Only get base estimates, not alternates
        .order("created_at", { ascending: true }) // Get the first/original estimate
        .limit(1);

      if (estError) throw estError;

      let baseNumber = "1010"; // fallback
      if (originalEstimate && originalEstimate.length > 0 && originalEstimate[0].estimate_number) {
        // Extract the base number (e.g., "1010" from "1010" or "1010-ALT1")
        const match = originalEstimate[0].estimate_number.match(/^(\d+)/);
        if (match) {
          baseNumber = match[1];
        }
      }

      // Now get existing change orders for this project to determine next CO number
      const { data: existingCOs, error: coError } = await supabase
        .from("change_orders")
        .select("change_order_number")
        .eq("project_name", project.name)
        .like("change_order_number", `${baseNumber}-CO%`)
        .order("created_at", { ascending: false });

      if (coError) throw coError;

      // Find the highest CO number
      let nextCONum = 1;
      if (existingCOs && existingCOs.length > 0) {
        const coNumbers = existingCOs
          .map(co => {
            const match = co.change_order_number.match(/-CO(\d+)$/);
            return match ? parseInt(match[1]) : 0;
          })
          .filter(num => num > 0);
        
        if (coNumbers.length > 0) {
          nextCONum = Math.max(...coNumbers) + 1;
        }
      }

      return `${baseNumber}-CO${nextCONum}`;
    } catch (err) {
      console.error("Error generating CO number:", err);
      return "1010-CO1"; // fallback
    }
  }

  async function handleCreateChangeOrder() {
    if (!changeOrderForm.title.trim()) {
      alert("Please enter a title for the change order");
      return;
    }

    try {
      // Generate CO number
      const coNumber = await generateChangeOrderNumber();
      
      // Create change order record
      const { data: newCO, error } = await supabase
        .from("change_orders")
        .insert([{
          project_name: project.name,
          change_order_number: coNumber,
          title: changeOrderForm.title.trim(),
          description: changeOrderForm.description.trim() || null,
          change_order_date: new Date().toISOString().split('T')[0],
          status: 'pending',
          total: 0,
          created_by: user.id
        }])
        .select()
        .single();

      if (error) throw error;

      // Close modal and reset form
      setShowChangeOrderModal(false);
      setChangeOrderForm({ title: '', description: '', change_order_number: '' });

      // Navigate to estimate with change order ID
      navigate(`/project/${id}/estimate?type=changeorder&coId=${newCO.id}&coNumber=${coNumber}`);
    } catch (err) {
      console.error("Error creating change order:", err);
      alert("Failed to create change order: " + err.message);
    }
  }

  // ── Invoice Payment helpers ──────────────────────────────────────────────
  async function openInvoicePaymentModal(invoice) {
    // Pre-fill balance due
    const trueBalance = Math.max(0, (invoice.total || 0) - (invoice.amount_paid || 0) - (invoice.deposit_received || 0));
    setPdPaymentForm({
      amount: trueBalance > 0 ? trueBalance.toFixed(2) : '',
      date: new Date().toISOString().split('T')[0],
      method: 'check',
      deposit_type: 'bank',
      bank_account_id: '',
      holding_account_id: '',
      processing_fee: '',
      notes: '',
    });
    setPayingInvoice(invoice);

    // Load bank accounts on demand — same tables InvoicesList uses
    const { data: accts } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('company_id', user.id)
      .eq('is_active', true)
      .order('account_name');
    setPdCashAccounts(accts || []);

    const { data: holdAccts } = await supabase
      .from('accounts')
      .select('id, account_name, account_number, account_type, is_active')
      .order('account_name');
    setPdHoldingAccounts((holdAccts || []).filter(a => a.is_active !== false));

    setShowInvoicePayModal(true);
  }

  async function handleInvoicePayment() {
    if (!payingInvoice) return;
    const amount = parseFloat(pdPaymentForm.amount);
    if (!amount || amount <= 0) { alert('Please enter a valid payment amount'); return; }
    if (pdPaymentForm.deposit_type === 'bank' && !pdPaymentForm.bank_account_id) {
      alert('Please select a bank account'); return;
    }
    if (pdPaymentForm.deposit_type === 'holding_account' && !pdPaymentForm.holding_account_id) {
      alert('Please select a holding account'); return;
    }

    try {
      const fee = parseFloat(pdPaymentForm.processing_fee) || 0;
      const netAmount = amount - fee;
      const totalPaid = (payingInvoice.amount_paid || 0) + amount;
      const trueBalance = Math.max(0, (payingInvoice.total || 0) - totalPaid - (payingInvoice.deposit_received || 0));
      const newStatus = trueBalance <= 0.01 ? 'paid' : 'partial';

      // 1. Record in invoice_payments
      await supabase.from('invoice_payments').insert([{
        invoice_id: payingInvoice.id,
        payment_date: pdPaymentForm.date,
        payment_method: pdPaymentForm.method,
        amount,
        processing_fee: fee || null,
        net_amount: netAmount,
        bank_account_id: pdPaymentForm.deposit_type === 'bank' ? pdPaymentForm.bank_account_id : null,
        holding_account_id: pdPaymentForm.deposit_type === 'holding_account' ? pdPaymentForm.holding_account_id : null,
        notes: pdPaymentForm.notes || null,
        created_by: user.id,
      }]);

      // 2. Update invoice
      await supabase.from('invoices').update({
        amount_paid: totalPaid,
        payment_date: pdPaymentForm.date,
        payment_method: pdPaymentForm.method,
        net_deposit_amount: netAmount,
        processing_fee: fee || null,
        status: newStatus,
        balance_due: trueBalance,
      }).eq('id', payingInvoice.id);

      // 3. Journal entry
      try {
        const bankAccountId = pdPaymentForm.deposit_type === 'bank'
          ? pdPaymentForm.bank_account_id
          : pdPaymentForm.holding_account_id;
        await createInvoicePaymentJournalEntry(
          { ...payingInvoice, amount_paid: totalPaid, status: newStatus },
          amount, user.id, user.id, bankAccountId
        );
      } catch (jeErr) {
        console.warn('Journal entry failed (non-critical):', jeErr);
      }

      setShowInvoicePayModal(false);
      setPayingInvoice(null);
      loadProjectData();
      alert(`✅ Payment of $${amount.toFixed(2)} recorded!\nInvoice #${payingInvoice.invoice_number} is now ${newStatus}.`);
    } catch (err) {
      console.error('Error recording payment:', err);
      alert('Failed to record payment: ' + err.message);
    }
  }

  // ── Set Active Estimate — opens confirmation modal so user can review/edit values ──
  function handleSetActiveEstimate(estimate) {
    const total = estimate.total || 0;
    // Only use subtotal as budget if it's meaningfully less than total (markup was applied)
    const hasMarkupDiff = estimate.subtotal > 0 && estimate.subtotal < total * 0.999;
    const suggestedBudget = hasMarkupDiff ? estimate.subtotal : 0;
    setSetActiveModalEstimate(estimate);
    setSetActiveEstWorthInput(total.toFixed(2));
    setSetActiveEstBudgetInput(suggestedBudget > 0 ? suggestedBudget.toFixed(2) : '');
    setShowSetActiveModal(true);
  }

  async function confirmSetActiveEstimate() {
    if (!setActiveModalEstimate) return;
    const newWorth = parseFloat(setActiveEstWorthInput);
    const newBudget = parseFloat(setActiveEstBudgetInput) || 0;
    if (isNaN(newWorth) || newWorth < 0) { alert("Please enter a valid Contract Value."); return; }
    try {
      const { error } = await supabase
        .from("projects")
        .update({
          active_estimate_id: setActiveModalEstimate.id,
          active_worth: newWorth,
          budget: newBudget,
        })
        .eq("id", id);
      if (error) throw error;
      setProject(prev => ({ ...prev, active_estimate_id: setActiveModalEstimate.id, active_worth: newWorth, budget: newBudget }));
      setShowSetActiveModal(false);
      setSetActiveModalEstimate(null);
    } catch (err) {
      console.error("Error setting active estimate:", err);
      alert("Failed to set active estimate: " + err.message);
    }
  }

  // ── Set Active Invoice (drives active_worth from invoice total) ──────────
  async function handleSetActiveInvoice(invoice) {
    const newWorth = invoice.total || 0;
    try {
      const { error } = await supabase
        .from("projects")
        .update({
          active_invoice_id: invoice.id,
          active_worth: newWorth,
        })
        .eq("id", id);
      if (error) throw error;
      setProject(prev => ({ ...prev, active_invoice_id: invoice.id, active_worth: newWorth }));
      alert(`✅ Invoice #${invoice.invoice_number} set as primary!\nContract Value: $${newWorth.toFixed(2)}`);
    } catch (err) {
      console.error("Error setting active invoice:", err);
      alert("Failed to set active invoice: " + err.message);
    }
  }

  async function loadProjectData() {
    try {
      // Load project details
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      // Load time entries from shift_segments linked to this project
      // Query by BOTH project_id AND project_task name to catch all entries
      console.log("🔍 Loading time entries for project:", id, "name:", projectData.name);
      
      // Query WITHOUT the employees join (which causes 400 errors)
      const { data: timeByIdData, error: timeByIdError } = await supabase
        .from("shift_segments")
        .select("id, user_id, start_at, end_at, project_task, is_lunch")
        .eq("project_id", id)
        .not("end_at", "is", null)
        .order("start_at", { ascending: false });

      console.log("📊 Time entries by project_id:", timeByIdData?.length || 0, "error:", timeByIdError);

      // Also query by project_task name
      const { data: timeByNameData, error: timeByNameError } = await supabase
        .from("shift_segments")
        .select("id, user_id, start_at, end_at, project_task, is_lunch")
        .ilike("project_task", `%${projectData.name}%`)
        .not("end_at", "is", null)
        .order("start_at", { ascending: false });

      console.log("📊 Time entries by project_task name:", timeByNameData?.length || 0, "error:", timeByNameError);

      // Merge and deduplicate by id
      const allTimeData = [...(timeByIdData || []), ...(timeByNameData || [])];
      const uniqueTimeMap = new Map();
      allTimeData.forEach(entry => uniqueTimeMap.set(entry.id, entry));
      const mergedTimeData = Array.from(uniqueTimeMap.values())
        .sort((a, b) => new Date(b.start_at) - new Date(a.start_at));

      // Also try to fix any unlinked entries by updating their project_id
      const unlinkedIds = mergedTimeData
        .filter(e => !timeByIdData?.find(t => t.id === e.id))
        .map(e => e.id);
      
      if (unlinkedIds.length > 0) {
        console.log(`🔗 Auto-linking ${unlinkedIds.length} shift_segments to project ${id}`);
        await supabase
          .from("shift_segments")
          .update({ project_id: id })
          .in("id", unlinkedIds);
      }

      // Fetch employee names AND hourly_rate for all unique user_ids
      const uniqueUserIds = [...new Set(mergedTimeData.map(e => e.user_id).filter(Boolean))];
      let employeeMap = {};
      if (uniqueUserIds.length > 0) {
        const { data: empData } = await supabase
          .from("employees")
          .select("user_id, first_name, last_name, hourly_rate")
          .in("user_id", uniqueUserIds);
        
        if (empData) {
          empData.forEach(emp => {
            employeeMap[emp.user_id] = emp;
          });
        }
        console.log("👥 Found employees:", Object.keys(employeeMap).length, "for", uniqueUserIds.length, "user_ids");
      }

      // Transform shift_segments data to match time_entries format
      const transformedTimeData = mergedTimeData.map(segment => ({
        ...segment,
        clock_in: segment.start_at,
        clock_out: segment.end_at,
        employees: employeeMap[segment.user_id] || null
      }));

      console.log("✅ Final time entries count:", transformedTimeData.length);
      setTimeEntries(transformedTimeData);

      // Load expenses for this project (you may need to create this table)
      // For now, we'll just use an empty array
      setExpenses([]);

      // Load estimates for this project (exclude change orders - they have CO- prefix)
      const { data: estimatesData, error: estimatesError } = await supabase
        .from("estimates")
        .select("*")
        .eq("project_name", projectData.name)
        .order("created_at", { ascending: false });

      if (!estimatesError) {
        // Filter out any estimates that are actually change orders (start with "CO-")
        const realEstimates = (estimatesData || []).filter(est => 
          !est.estimate_number || !est.estimate_number.startsWith('CO-')
        );
        setEstimates(realEstimates);
      }

      // Load invoices for this project
      const { data: invoicesData, error: invoicesError } = await supabase
        .from("invoices")
        .select("*")
        .eq("project_name", projectData.name)
        .order("created_at", { ascending: false });

      if (!invoicesError) {
        // Auto-fix invoice statuses: if fully paid but status isn't "paid", update it
        const invoicesToFix = (invoicesData || []).filter(inv => {
          const totalPaid = (inv.amount_paid || 0) + (inv.deposit_received || 0);
          const total = inv.total || 0;
          return total > 0 && totalPaid >= total - 0.01 && inv.status !== 'paid';
        });
        
        if (invoicesToFix.length > 0) {
          console.log(`🔧 Auto-fixing ${invoicesToFix.length} invoice(s) status to 'paid'`);
          for (const inv of invoicesToFix) {
            await supabase.from('invoices').update({ status: 'paid' }).eq('id', inv.id);
            inv.status = 'paid';
          }
        }
        
        setInvoices(invoicesData || []);
      }

      // Load change orders for this project
      const { data: changeOrdersData, error: changeOrdersError } = await supabase
        .from("change_orders")
        .select("*")
        .eq("project_name", projectData.name)
        .order("created_at", { ascending: false });

      if (!changeOrdersError) setChangeOrders(changeOrdersData || []);

      // Load contractors for this project
      const { data: contractorsData, error: contractorsError} = await supabase
        .from("project_contractors")
        .select("*")
        .eq("project_id", id)
        .order("contractor_name");

      if (!contractorsError) setContractors(contractorsData || []);

      // Load customers for autocomplete
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("*")
        .order("customer");

      if (!customersError) setCustomers(customersData || []);

      // Load project expenses from BOTH tables
      const { data: oldExpensesData, error: oldExpensesError } = await supabase
        .from("project_expenses")
        .select("*")
        .eq("project_id", id)
        .order("expense_date", { ascending: false });

      const { data: newExpensesData, error: newExpensesError } = await supabase
        .from("expenses")
        .select("*")
        .eq("project_id", id)
        .order("expense_date", { ascending: false });

      // Combine both expense sources
      const allExpenses = [
        ...(oldExpensesData || []),
        ...(newExpensesData || [])
      ].sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date));

      setProjectExpenses(allExpenses);

      // Load deposits for this project
      const { data: depositsData, error: depositsError } = await supabase
        .from("project_deposits")
        .select("*")
        .eq("project_id", id)
        .order("deposit_date", { ascending: false });

      if (!depositsError) {
        // Auto-fix: any deposit with invoice_id that's not "applied" should be "applied"
        const depositsToFix = (depositsData || []).filter(d => d.invoice_id && d.status !== 'applied' && d.status !== 'cancelled');
        if (depositsToFix.length > 0) {
          console.log(`🔧 Auto-fixing ${depositsToFix.length} deposit(s) with invoice_id but wrong status`);
          for (const dep of depositsToFix) {
            await supabase.from('project_deposits').update({ status: 'applied' }).eq('id', dep.id);
            dep.status = 'applied';
          }
        }
        setDeposits(depositsData || []);
      }

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

      // Load proposals for estimates AND change orders
      const { data: proposalsData } = await supabase
        .from("proposals")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false });

      if (proposalsData) {
        const groupedProposals = {};
        proposalsData.forEach(p => {
          // Group by estimate ID or change order ID
          const key = p.base_estimate_id || p.change_order_id;
          if (key) {
            if (!groupedProposals[key]) {
              groupedProposals[key] = [];
            }
            groupedProposals[key].push(p);
          }
        });
        setProposals(groupedProposals);
      }

      // Sync percent_complete to DB based on actual invoices
      // This ensures the Dashboard shows the correct percentage
      const aw = projectData.active_worth || 0;
      // For progress billing invoices, use only the draw amount from notes (not inv.total)
      // because extra line items (credits/surcharges) don't count toward contract progress %.
      const billed = (invoicesData || []).reduce((sum, inv) => {
        if (inv.notes && inv.notes.includes('Progress billing')) {
          const drawMatch = inv.notes.match(/This draw: \$([0-9,.]+)/);
          if (drawMatch) return sum + parseFloat(drawMatch[1].replace(/,/g, ''));
        }
        return sum + (inv.total || 0);
      }, 0);
      const realPercent = aw > 0 ? Math.min(Math.round((billed / aw) * 100), 100) : (projectData.percent_complete || 0);
      
      if (realPercent !== (projectData.percent_complete || 0)) {
        console.log(`🔧 Syncing percent_complete: ${projectData.percent_complete}% → ${realPercent}%`);
        await supabase
          .from("projects")
          .update({ percent_complete: realPercent, billed_amount: billed })
          .eq("id", id);
        setProject(prev => ({ ...prev, percent_complete: realPercent, billed_amount: billed }));
      }

    } catch (err) {
      console.error("Error loading project:", err);
      alert("Failed to load project data");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading project...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Project not found</div>
        <button onClick={() => navigate("/projects")} style={styles.button}>
          Back to Projects
        </button>
      </div>
    );
  }

  // Calculate labor costs (deduct 30 min for entries where employee took lunch)
  const laborHours = timeEntries.reduce((sum, entry) => {
    if (!entry.clock_out) return sum;
    const start = new Date(entry.clock_in).getTime();
    const end = new Date(entry.clock_out).getTime();
    let hours = (end - start) / (1000 * 60 * 60); // Convert to hours
    if (entry.is_lunch) hours = Math.max(0, hours - 0.5); // Deduct 30 min lunch
    return sum + hours;
  }, 0);

  // Per-employee labor cost: use each employee's hourly_rate * 1.4 (40% burden for taxes/benefits).
  // Falls back to project.labor_rate (or $50) for entries where the employee has no rate set.
  const BURDEN_MULTIPLIER = 1.4;
  const fallbackRate = project.labor_rate || 50;
  const laborCost = timeEntries.reduce((sum, entry) => {
    if (!entry.clock_out) return sum;
    const start = new Date(entry.clock_in).getTime();
    const end = new Date(entry.clock_out).getTime();
    let hours = (end - start) / (1000 * 60 * 60);
    if (entry.is_lunch) hours = Math.max(0, hours - 0.5);
    const empRate = entry.employees?.hourly_rate;
    const costRate = empRate > 0 ? empRate * BURDEN_MULTIPLIER : fallbackRate;
    return sum + hours * costRate;
  }, 0);
  // Keep a display-only blended rate for the UI label
  const laborRate = laborHours > 0 ? laborCost / laborHours : fallbackRate;

  // Calculate material costs from project_expenses
  const expensesCost = projectExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

  // Unique categories present on this project (for dynamic filter buttons)
  const expenseCategories = ['all', ...Array.from(new Set(
    projectExpenses.map(e => e.category).filter(Boolean)
  )).sort()];
  const filteredProjectExpenses = expenseCategoryFilter === 'all'
    ? projectExpenses
    : projectExpenses.filter(e => e.category === expenseCategoryFilter);
  const filteredExpensesCost = filteredProjectExpenses.reduce((s, e) => s + (e.amount || 0), 0);

  // Materials allocated to the job via negative extra items on progress billing invoices.
  // e.g. "Material Coburns Ticket -$3,684.29" is a credit given to the customer but
  // represents a real cost to the company — show it in cost tracking.
  const invoiceAllocatedMaterials = invoices.reduce((sum, inv) => {
    if (inv.notes && inv.notes.includes('Progress billing')) {
      const drawMatch = inv.notes.match(/This draw: \$([0-9,.]+)/);
      const drawAmount = drawMatch ? parseFloat(drawMatch[1].replace(/,/g, '')) : 0;
      const extraTotal = (inv.total || 0) - drawAmount; // negative when credits were given
      // Only count negative extras (credits to customer = material cost to company)
      if (extraTotal < 0) return sum + Math.abs(extraTotal);
    }
    return sum;
  }, 0);

  const materialCost = expensesCost + invoiceAllocatedMaterials;

  // Total costs
  const totalCost = laborCost + materialCost;

  async function saveSqFtField(field, value) {
    const numVal = parseFloat(value);
    if (isNaN(numVal) || numVal < 0) { alert("Please enter a valid number."); return; }
    setSavingBudget(true);
    try {
      const { error } = await supabase.from("projects").update({ [field]: numVal }).eq("id", id);
      if (error) throw error;
      setProject(prev => ({ ...prev, [field]: numVal }));
      if (field === "sq_ft") setEditingSqFt(false);
      if (field === "sq_ft_living") setEditingSqFtLiving(false);
    } catch (err) {
      alert("Failed to save: " + err.message);
    } finally {
      setSavingBudget(false);
    }
  }

  async function saveBudgetField(field, value) {
    const numVal = parseFloat(value);
    if (isNaN(numVal) || numVal < 0) { alert("Please enter a valid number."); return; }
    setSavingBudget(true);
    try {
      const { error } = await supabase.from("projects").update({ [field]: numVal }).eq("id", id);
      if (error) throw error;
      setProject(prev => ({ ...prev, [field]: numVal }));
      if (field === "budget") setEditingBudget(false);
      if (field === "active_worth") setEditingActiveWorth(false);
    } catch (err) {
      alert("Failed to save: " + err.message);
    } finally {
      setSavingBudget(false);
    }
  }

  // Budget info
  const budget = project.budget || 0;
  const remaining = budget - totalCost;
  const percentUsed = budget > 0 ? (totalCost / budget) * 100 : 0;

  // Progress billing - calculate from actual invoices
  const activeWorth = project.active_worth || 0;
  // For progress billing invoices use the draw amount from notes, not inv.total,
  // so extra line items (credits, surcharges) don't distort the contract progress %.
  const billedAmount = invoices.reduce((sum, inv) => {
    if (inv.notes && inv.notes.includes('Progress billing')) {
      const drawMatch = inv.notes.match(/This draw: \$([0-9,.]+)/);
      if (drawMatch) return sum + parseFloat(drawMatch[1].replace(/,/g, ''));
    }
    return sum + (inv.total || 0);
  }, 0) || project.billed_amount || 0;
  const percentComplete = activeWorth > 0 ? Math.round((billedAmount / activeWorth) * 100) : (project.percent_complete || 0);
  const remainingToBill = activeWorth - billedAmount;

  // ───── Quick Action Button Style ─────
  function qaBtn(color) {
    return {
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '8px 16px', borderRadius: 8, border: `2px solid ${color}`,
      backgroundColor: color + '18', color, fontWeight: '700', fontSize: 14,
      cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
    };
  }

  // ───── PDF REPORT GENERATORS ─────

  function generateCostReport() {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = margin;
    const safeName = project.name.replace(/[^a-zA-Z0-9]/g, '_');

    doc.setFillColor(11,62,168); doc.rect(0,0,pageWidth,28,'F');
    doc.setTextColor(249,115,22); doc.setFontSize(16); doc.setFont('helvetica','bold');
    doc.text('DML ELECTRICAL SERVICE LLC', margin, 12);
    doc.setTextColor(255,255,255); doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text('Project Cost Report', margin, 20);

    y = 38;
    doc.setTextColor(11,62,168); doc.setFontSize(16); doc.setFont('helvetica','bold');
    doc.text(project.name, margin, y); y += 8;
    doc.setTextColor(80,80,80); doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, y); y += 14;

    const section = (title) => {
      doc.setFillColor(240,240,240); doc.rect(margin, y-4, pageWidth-margin*2, 10, 'F');
      doc.setTextColor(11,62,168); doc.setFontSize(12); doc.setFont('helvetica','bold');
      doc.text(title, margin, y+3); y += 14;
    };
    const row = (label, value, color) => {
      doc.setTextColor(...(color || [50,50,50])); doc.setFontSize(11); doc.setFont('helvetica','normal');
      doc.text(label, margin, y);
      doc.text(value, pageWidth-margin, y, {align:'right'}); y += 8;
    };

    section('LABOR COSTS');
    row('Total Hours', `${laborHours.toFixed(2)} hrs`);
    row('Avg Effective Rate', `$${laborRate.toFixed(2)}/hr`);
    row('Labor Cost (burdened @ 1.4×)', `$${laborCost.toFixed(2)}`);
    y += 4;

    section('MATERIAL & EXPENSE COSTS');
    row('Direct Expenses', `$${expensesCost.toFixed(2)}`);
    if (invoiceAllocatedMaterials > 0) row('Materials via Invoice Credits', `$${invoiceAllocatedMaterials.toFixed(2)}`);
    row('Total Material Cost', `$${materialCost.toFixed(2)}`);
    y += 4;

    doc.setFillColor(252,107,4); doc.rect(margin, y-4, pageWidth-margin*2, 12, 'F');
    doc.setTextColor(255,255,255); doc.setFontSize(13); doc.setFont('helvetica','bold');
    doc.text(`TOTAL PROJECT COST: $${totalCost.toFixed(2)}`, margin, y+4); y += 20;

    if (budget > 0) {
      doc.setFontSize(11); doc.setFont('helvetica','normal');
      const rem = budget - totalCost;
      doc.setTextColor(50,50,50); doc.text(`Budget: $${budget.toFixed(2)}   Used: ${((totalCost/budget)*100).toFixed(1)}%`, margin, y); y += 8;
      doc.setTextColor(...(rem < 0 ? [220,38,38] : [16,185,129]));
      doc.text(`${rem >= 0 ? 'Remaining Budget' : 'Over Budget'}: $${Math.abs(rem).toFixed(2)}`, margin, y);
    }

    doc.save(`${safeName}_Cost_Report.pdf`);
  }

  function generateCostVsPriceReport() {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = margin;
    const safeName = project.name.replace(/[^a-zA-Z0-9]/g, '_');

    doc.setFillColor(11,62,168); doc.rect(0,0,pageWidth,28,'F');
    doc.setTextColor(249,115,22); doc.setFontSize(16); doc.setFont('helvetica','bold');
    doc.text('DML ELECTRICAL SERVICE LLC', margin, 12);
    doc.setTextColor(255,255,255); doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text('Cost vs. Price Report', margin, 20);

    y = 38;
    doc.setTextColor(11,62,168); doc.setFontSize(16); doc.setFont('helvetica','bold');
    doc.text(project.name, margin, y); y += 8;
    doc.setTextColor(80,80,80); doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, y); y += 14;

    const profit = activeWorth - totalCost;
    const marginPct = activeWorth > 0 ? (profit / activeWorth * 100) : 0;
    const markupPct = totalCost > 0 ? (profit / totalCost * 100) : 0;

    const rows = [
      ['Contract Value (Active Worth)', `$${activeWorth.toFixed(2)}`, 'bold', null],
      ['  Labor Cost', `$${laborCost.toFixed(2)}`, 'normal', null],
      ['  Material Cost', `$${materialCost.toFixed(2)}`, 'normal', null],
      ['Total Cost', `$${totalCost.toFixed(2)}`, 'bold', null],
      ['', '', 'normal', null],
      ['Gross Profit', `$${profit.toFixed(2)}`, 'bold', profit >= 0 ? [16,185,129] : [220,38,38]],
      ['Profit Margin', `${marginPct.toFixed(1)}%`, 'normal', null],
      ['Markup', `${markupPct.toFixed(1)}%`, 'normal', null],
      ['', '', 'normal', null],
      ['Amount Billed', `$${billedAmount.toFixed(2)}`, 'normal', null],
      ['Remaining to Bill', `$${remainingToBill.toFixed(2)}`, 'normal', null],
      ['% Complete', `${percentComplete}%`, 'normal', null],
    ];
    rows.forEach(([label, value, weight, color]) => {
      if (!label) { y += 4; return; }
      doc.setFont('helvetica', weight);
      doc.setFontSize(11);
      doc.setTextColor(...(color || [50,50,50]));
      doc.text(label, margin, y);
      doc.text(value, pageWidth-margin, y, {align:'right'});
      y += 8;
    });

    doc.save(`${safeName}_Cost_vs_Price.pdf`);
  }

  function generateLaborReport() {
    const doc = new jsPDF('l', 'mm', 'letter');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = margin;
    const safeName = project.name.replace(/[^a-zA-Z0-9]/g, '_');

    doc.setFillColor(11,62,168); doc.rect(0,0,pageWidth,28,'F');
    doc.setTextColor(249,115,22); doc.setFontSize(16); doc.setFont('helvetica','bold');
    doc.text('DML ELECTRICAL SERVICE LLC', margin, 12);
    doc.setTextColor(255,255,255); doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text('Labor Report', margin, 20);

    y = 38;
    doc.setTextColor(11,62,168); doc.setFontSize(14); doc.setFont('helvetica','bold');
    doc.text(project.name, margin, y); y += 8;
    doc.setTextColor(80,80,80); doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text(`Generated: ${new Date().toLocaleDateString()}  |  Total Hours: ${laborHours.toFixed(2)} hrs  |  Total Cost: $${laborCost.toFixed(2)}`, margin, y); y += 14;

    const colX = [margin, margin+55, margin+100, margin+130, margin+160, margin+185, margin+220];
    const cols = ['Employee','Date','Clock In','Clock Out','Hours','Rate','Cost'];
    doc.setFillColor(11,62,168); doc.rect(margin, y-5, pageWidth-margin*2, 10, 'F');
    doc.setTextColor(255,255,255); doc.setFontSize(10); doc.setFont('helvetica','bold');
    cols.forEach((c, i) => doc.text(c, colX[i]+1, y+1)); y += 10;
    doc.setFont('helvetica','normal'); doc.setFontSize(9);

    timeEntries.forEach((entry, idx) => {
      if (!entry.clock_out) return;
      if (y > pageHeight - margin - 10) { doc.addPage(); y = margin; }
      const ci = new Date(entry.clock_in), co = new Date(entry.clock_out);
      let hrs = (co-ci)/(1000*60*60); if (entry.is_lunch) hrs = Math.max(0,hrs-0.5);
      const empRate = entry.employees?.hourly_rate;
      const costRate = empRate > 0 ? empRate*1.4 : (project.labor_rate||50);
      const cost = hrs * costRate;
      const empName = entry.employees ? `${entry.employees.first_name} ${entry.employees.last_name}` : 'Unknown';
      if (idx%2===0) { doc.setFillColor(248,250,252); doc.rect(margin,y-5,pageWidth-margin*2,8,'F'); }
      doc.setTextColor(50,50,50);
      const vals = [empName, ci.toLocaleDateString(),
        ci.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),
        co.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),
        hrs.toFixed(2), `$${costRate.toFixed(0)}/hr`, `$${cost.toFixed(2)}`];
      vals.forEach((v,i) => doc.text(String(v), colX[i]+1, y)); y += 8;
    });

    y += 4;
    doc.setFillColor(252,107,4); doc.rect(margin,y-5,pageWidth-margin*2,10,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.text(`TOTAL: ${laborHours.toFixed(2)} hrs`, margin+1, y+1);
    doc.text(`$${laborCost.toFixed(2)}`, pageWidth-margin-2, y+1, {align:'right'});
    doc.save(`${safeName}_Labor_Report.pdf`);
  }

  function generateMaterialReport(categoriesToInclude) {
    // categoriesToInclude: array of category strings, or null/empty = all
    const filteredExps = (categoriesToInclude && categoriesToInclude.length > 0)
      ? projectExpenses.filter(e => categoriesToInclude.includes(e.category || 'material'))
      : projectExpenses;
    const filteredTotal = filteredExps.reduce((s, e) => s + (e.amount || 0), 0);

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = margin;
    const safeName = project.name.replace(/[^a-zA-Z0-9]/g, '_');
    const catLabel = (categoriesToInclude && categoriesToInclude.length > 0 && categoriesToInclude.length < expenseCategories.length - 1)
      ? categoriesToInclude.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')
      : 'All Categories';

    doc.setFillColor(11,62,168); doc.rect(0,0,pageWidth,28,'F');
    doc.setTextColor(249,115,22); doc.setFontSize(16); doc.setFont('helvetica','bold');
    doc.text('DML ELECTRICAL SERVICE LLC', margin, 12);
    doc.setTextColor(255,255,255); doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text(`Material & Expense Report — ${catLabel}`, margin, 20);

    y = 38;
    doc.setTextColor(11,62,168); doc.setFontSize(14); doc.setFont('helvetica','bold');
    doc.text(project.name, margin, y); y += 8;
    doc.setTextColor(80,80,80); doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text(`Generated: ${new Date().toLocaleDateString()}  |  Total: $${filteredTotal.toFixed(2)}  |  ${filteredExps.length} item(s)`, margin, y); y += 14;

    if (filteredExps.length === 0) {
      doc.setTextColor(150,150,150); doc.text('No expenses match the selected filters.', margin, y);
    } else {
      doc.setFillColor(11,62,168); doc.rect(margin,y-5,pageWidth-margin*2,10,'F');
      doc.setTextColor(255,255,255); doc.setFontSize(10); doc.setFont('helvetica','bold');
      doc.text('Date', margin+1, y+1);
      doc.text('Category', margin+22, y+1);
      doc.text('Description', margin+52, y+1);
      doc.text('Vendor', margin+118, y+1);
      doc.text('Amount', pageWidth-margin-2, y+1, {align:'right'}); y += 10;
      doc.setFont('helvetica','normal'); doc.setFontSize(10);

      filteredExps.forEach((exp, idx) => {
        if (y > pageHeight-margin-10) { doc.addPage(); y = margin; }
        if (idx%2===0) { doc.setFillColor(248,250,252); doc.rect(margin,y-5,pageWidth-margin*2,8,'F'); }
        doc.setTextColor(50,50,50);
        doc.text(exp.expense_date||'', margin+1, y);
        doc.text(doc.splitTextToSize(exp.category||'—',26)[0], margin+22, y);
        doc.text(doc.splitTextToSize(exp.description||'',62)[0], margin+52, y);
        doc.text(doc.splitTextToSize(exp.vendor||'—',40)[0], margin+118, y);
        doc.text(`$${(exp.amount||0).toFixed(2)}`, pageWidth-margin-2, y, {align:'right'}); y += 8;
      });

      y += 4;
      doc.setFillColor(252,107,4); doc.rect(margin,y-5,pageWidth-margin*2,10,'F');
      doc.setTextColor(255,255,255); doc.setFontSize(11); doc.setFont('helvetica','bold');
      doc.text(`${filteredExps.length} items`, margin+1, y+1);
      doc.text(`TOTAL: $${filteredTotal.toFixed(2)}`, pageWidth-margin-2, y+1, {align:'right'});
    }
    const catSuffix = (categoriesToInclude && categoriesToInclude.length > 0 && categoriesToInclude.length < expenseCategories.length - 1)
      ? '_' + categoriesToInclude.join('-')
      : '';
    doc.save(`${safeName}_Material_Report${catSuffix}.pdf`);
  }

  // ── Combined Labor + Selected Expense Categories PDF ─────────────────────
  function generateLaborAndExpensesReport(categoriesToInclude) {
    const filteredExps = (categoriesToInclude && categoriesToInclude.length > 0)
      ? projectExpenses.filter(e => categoriesToInclude.includes(e.category || 'material'))
      : projectExpenses;
    const expTotal = filteredExps.reduce((s, e) => s + (e.amount || 0), 0);
    const combinedTotal = laborCost + expTotal;

    const doc = new jsPDF('l', 'mm', 'letter');
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = margin;
    const safeName = project.name.replace(/[^a-zA-Z0-9]/g, '_');
    const catLabel = (categoriesToInclude && categoriesToInclude.length > 0)
      ? categoriesToInclude.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')
      : 'All Categories';

    const checkPage = (needed) => {
      if (y + needed > pageHeight - margin) { doc.addPage(); y = margin; }
    };

    // ─── Header ───
    doc.setFillColor(11, 62, 168); doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setTextColor(249, 115, 22); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('DML ELECTRICAL SERVICE LLC', margin, 12);
    doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Labor & Expense Report — ${catLabel}`, margin, 20);

    y = 38;
    doc.setTextColor(11, 62, 168); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(project.name, margin, y); y += 8;
    doc.setTextColor(80, 80, 80); doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(
      `Generated: ${new Date().toLocaleDateString()}  |  Labor: $${laborCost.toFixed(2)}  |  Expenses: $${expTotal.toFixed(2)}  |  Combined: $${combinedTotal.toFixed(2)}`,
      margin, y
    ); y += 14;

    // ─── LABOR SECTION ───
    doc.setFillColor(11, 62, 168); doc.rect(margin, y - 5, pageWidth - margin * 2, 12, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text(`👷 LABOR  (${laborHours.toFixed(2)} hrs · $${laborCost.toFixed(2)})`, margin + 2, y + 3); y += 14;

    if (timeEntries.length === 0) {
      doc.setTextColor(150, 150, 150); doc.setFontSize(10); doc.setFont('helvetica', 'italic');
      doc.text('No time entries for this project.', margin, y); y += 12;
    } else {
      // Column headers
      const lColX = [margin, margin + 52, margin + 95, margin + 125, margin + 155, margin + 178, margin + 210];
      const lCols = ['Employee', 'Date', 'Clock In', 'Clock Out', 'Hours', 'Rate', 'Cost'];
      doc.setFillColor(230, 237, 255); doc.rect(margin, y - 5, pageWidth - margin * 2, 10, 'F');
      doc.setTextColor(11, 62, 168); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      lCols.forEach((c, i) => doc.text(c, lColX[i] + 1, y + 1)); y += 10;

      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      timeEntries.forEach((entry, idx) => {
        if (!entry.clock_out) return;
        checkPage(10);
        const ci = new Date(entry.clock_in), co = new Date(entry.clock_out);
        let hrs = (co - ci) / (1000 * 60 * 60); if (entry.is_lunch) hrs = Math.max(0, hrs - 0.5);
        const empRate = entry.employees?.hourly_rate;
        const costRate = empRate > 0 ? empRate * 1.4 : fallbackRate;
        const cost = hrs * costRate;
        const empName = entry.employees ? `${entry.employees.first_name} ${entry.employees.last_name}` : 'Unknown';
        if (idx % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(margin, y - 5, pageWidth - margin * 2, 8, 'F'); }
        doc.setTextColor(50, 50, 50);
        const vals = [
          empName,
          ci.toLocaleDateString(),
          ci.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          co.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          hrs.toFixed(2),
          `$${costRate.toFixed(0)}/hr`,
          `$${cost.toFixed(2)}`,
        ];
        vals.forEach((v, i) => doc.text(String(v), lColX[i] + 1, y)); y += 8;
      });

      // Labor subtotal row
      checkPage(12);
      doc.setFillColor(11, 62, 168); doc.rect(margin, y - 4, pageWidth - margin * 2, 10, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text(`Labor Total: ${laborHours.toFixed(2)} hrs`, margin + 2, y + 2);
      doc.text(`$${laborCost.toFixed(2)}`, pageWidth - margin - 2, y + 2, { align: 'right' });
      y += 18;
    }

    // ─── EXPENSE SECTION ───
    checkPage(20);
    doc.setFillColor(252, 107, 4); doc.rect(margin, y - 5, pageWidth - margin * 2, 12, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text(
      `📦 EXPENSES — ${catLabel}  (${filteredExps.length} items · $${expTotal.toFixed(2)})`,
      margin + 2, y + 3
    ); y += 14;

    if (filteredExps.length === 0) {
      doc.setTextColor(150, 150, 150); doc.setFontSize(10); doc.setFont('helvetica', 'italic');
      doc.text('No expenses match the selected categories.', margin, y); y += 12;
    } else {
      const eColX = [margin, margin + 22, margin + 52, margin + 118, margin + 198];
      const eCols = ['Date', 'Category', 'Description', 'Vendor', 'Amount'];
      doc.setFillColor(255, 243, 230); doc.rect(margin, y - 5, pageWidth - margin * 2, 10, 'F');
      doc.setTextColor(180, 80, 0); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      eCols.forEach((c, i) => doc.text(c, eColX[i] + 1, y + 1)); y += 10;

      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      filteredExps.forEach((exp, idx) => {
        checkPage(10);
        if (idx % 2 === 0) { doc.setFillColor(255, 248, 240); doc.rect(margin, y - 5, pageWidth - margin * 2, 8, 'F'); }
        doc.setTextColor(50, 50, 50);
        doc.text(exp.expense_date || '', eColX[0] + 1, y);
        doc.text(doc.splitTextToSize(exp.category || '—', 28)[0], eColX[1] + 1, y);
        doc.text(doc.splitTextToSize(exp.description || '', 62)[0], eColX[2] + 1, y);
        doc.text(doc.splitTextToSize(exp.vendor || '—', 76)[0], eColX[3] + 1, y);
        doc.text(`$${(exp.amount || 0).toFixed(2)}`, pageWidth - margin - 2, y, { align: 'right' }); y += 8;
      });

      checkPage(12);
      doc.setFillColor(252, 107, 4); doc.rect(margin, y - 4, pageWidth - margin * 2, 10, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text(`${filteredExps.length} items`, margin + 2, y + 2);
      doc.text(`$${expTotal.toFixed(2)}`, pageWidth - margin - 2, y + 2, { align: 'right' });
      y += 18;
    }

    // ─── Grand Total ───
    checkPage(16);
    doc.setFillColor(16, 185, 129); doc.rect(margin, y - 5, pageWidth - margin * 2, 14, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text('COMBINED TOTAL', margin + 2, y + 4);
    doc.text(`$${combinedTotal.toFixed(2)}`, pageWidth - margin - 2, y + 4, { align: 'right' });

    // ─── Footer ───
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(8); doc.setTextColor(150, 150, 150); doc.setFont('helvetica', 'normal');
      doc.text(`Page ${p} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    }

    const catSuffix = categoriesToInclude && categoriesToInclude.length > 0
      ? '_' + categoriesToInclude.join('-')
      : '_All';
    doc.save(`${safeName}_Labor_Expenses${catSuffix}.pdf`);
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{project.name}</h1>
          {project.customer && (
            <p style={styles.subtitle}>👤 {project.customer}</p>
          )}
          {project.contractor && (
            <p style={styles.subtitle}>🔨 {project.contractor}</p>
          )}
          {project.address && (
            <p style={styles.subtitle}>📍 {project.address}</p>
          )}
        </div>
        <div style={{display: 'flex', gap: 12}}>
          <button 
            onClick={() => {
              // Pre-populate form with current project data
              setEditProjectForm({
                name: project.name || '',
                customer: project.customer || '',
                contractor: project.contractor || '',
                address: project.address || '',
                description: project.description || '',
                start_date: project.start_date || '',
                end_date: project.end_date || '',
                labor_rate: project.labor_rate || 50,
                percent_complete: project.percent_complete || 0,
                project_type: project.project_type || 'commercial-public',
                ot_bank_enabled: project.ot_bank_enabled || false,
                sq_ft: project.sq_ft || '',
              });
              setShowEditProjectModal(true);
            }}
            style={{...styles.backButton, background: '#10b981', color: '#fff', border: 'none'}}
          >
            ✏️ Edit Project
          </button>
          {!["residential-contractor", "commercial-private", "residential-owner"].includes(project.project_type) && (
            <button 
              onClick={() => navigate(`/project/${id}/plans`)} 
              style={{...styles.backButton, background: '#8b5cf6', color: '#fff', border: 'none'}}
            >
              📐 Plans & Takeoffs
            </button>
          )}
          {!["residential-contractor", "commercial-private", "residential-owner"].includes(project.project_type) && (
            <button onClick={() => navigate(`/project/${id}/estimate`)} style={{...styles.backButton, background: BRAND.accent, color: '#fff', border: 'none'}}>
              Bid Project
            </button>
          )}
          <button onClick={() => navigate(`/project/${id}/geofence`)} style={{...styles.backButton, background: '#10b981', color: '#fff', border: 'none'}}>
            📍 Geofence
          </button>
          <button onClick={() => navigate(`/geofence-events?projectId=${id}`)} style={{...styles.backButton, background: '#059669', color: '#fff', border: 'none'}}>
            🔔 Geofence Events
          </button>
          {!["residential-contractor", "commercial-private", "residential-owner"].includes(project.project_type) && (
            <button onClick={() => navigate(`/project/${id}/reports-photos`)} style={{...styles.backButton, background: '#6366f1', color: '#fff', border: 'none'}}>
              📸 Reports & Photos
            </button>
          )}
          {!["residential-contractor", "commercial-private", "residential-owner"].includes(project.project_type) && (
            <button onClick={() => navigate(`/project/${id}/material-list`)} style={{...styles.backButton, background: '#f59e0b', color: '#fff', border: 'none'}}>
              📋 Material Lists
            </button>
          )}
          {!["residential-contractor", "commercial-private", "residential-owner"].includes(project.project_type) && (
            <button onClick={() => navigate(`/project/${id}/info-sheet`)} style={{...styles.backButton, background: '#8b5cf6', color: '#fff', border: 'none'}}>
              📄 Project Info Sheet
            </button>
          )}
          <button onClick={() => setShowReportsModal(true)} style={{...styles.backButton, background: '#f97316', color: '#fff', border: 'none'}}>
            📊 Reports
          </button>
          <button onClick={() => navigate("/projects")} style={styles.backButton}>
            ← Back to Projects
          </button>
        </div>
      </div>

      <div style={styles.grid}>
        {/* Progress & Billing Card */}
        <div style={{...styles.card, order: -2}}>
          <h2 style={styles.cardTitle}>Progress & Billing</h2>
          
          <div style={styles.progressSection}>
            <div style={styles.progressHeader}>
              <span style={styles.label}>Project Complete</span>
              <span style={styles.value}>{percentComplete}%</span>
            </div>
            <div style={styles.progressBar}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${percentComplete}%`,
                  backgroundColor: BRAND.accent,
                }}
              />
            </div>
          </div>

          <div style={styles.divider} />

          <div style={styles.row}>
            <span style={styles.label}>Active Worth (Contract Value)</span>
            {editingActiveWorth ? (
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="number"
                  step="0.01"
                  value={activeWorthInput}
                  onChange={e => setActiveWorthInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveBudgetField("active_worth", activeWorthInput); if (e.key === "Escape") setEditingActiveWorth(false); }}
                  autoFocus
                  style={{ width: 110, padding: "3px 6px", border: "2px solid #0b3ea8", borderRadius: 6, fontSize: 14, fontWeight: 700 }}
                />
                <button onClick={() => saveBudgetField("active_worth", activeWorthInput)} disabled={savingBudget} style={{ padding: "3px 8px", background: "#10b981", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✓</button>
                <button onClick={() => setEditingActiveWorth(false)} style={{ padding: "3px 6px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 12 }}>✕</button>
              </span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={styles.value}>${(project.active_worth || 0).toFixed(2)}</span>
                <button onClick={() => { setActiveWorthInput((project.active_worth || 0).toFixed(2)); setEditingActiveWorth(true); }} title="Edit contract value" style={{ padding: "2px 6px", background: "none", border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer", fontSize: 11, color: "#6b7280" }}>✏️</button>
              </span>
            )}
          </div>

          <div style={styles.row}>
            <span style={styles.label}>Project Budget (Cost)</span>
            {editingBudget ? (
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="number"
                  step="0.01"
                  value={budgetInput}
                  onChange={e => setBudgetInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveBudgetField("budget", budgetInput); if (e.key === "Escape") setEditingBudget(false); }}
                  autoFocus
                  style={{ width: 110, padding: "3px 6px", border: "2px solid #0b3ea8", borderRadius: 6, fontSize: 14, fontWeight: 700 }}
                />
                <button onClick={() => saveBudgetField("budget", budgetInput)} disabled={savingBudget} style={{ padding: "3px 8px", background: "#10b981", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✓</button>
                <button onClick={() => setEditingBudget(false)} style={{ padding: "3px 6px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 12 }}>✕</button>
              </span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={styles.value}>${budget.toFixed(2)}</span>
                <button onClick={() => { setBudgetInput(budget.toFixed(2)); setEditingBudget(true); }} title="Edit budget" style={{ padding: "2px 6px", background: "none", border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer", fontSize: 11, color: "#6b7280" }}>✏️</button>
              </span>
            )}
          </div>

          <div style={styles.row}>
            <span style={styles.label}>Earned to Date ({percentComplete}%)</span>
            <span style={styles.value}>${billedAmount.toFixed(2)}</span>
          </div>

          <div style={styles.row}>
            <span style={styles.label}>Already Billed</span>
            <span style={styles.value}>${billedAmount.toFixed(2)}</span>
          </div>

          <div style={styles.divider} />

          <div style={styles.row}>
            <span style={{...styles.label, fontWeight: "bold"}}>Available to Bill</span>
            <span style={{...styles.value, fontWeight: "bold", color: BRAND.accent}}>
              ${remainingToBill.toFixed(2)}
            </span>
          </div>

          <div style={styles.divider} />

          {/* Payment Progress */}
          <div style={styles.progressSection}>
            {(() => {
              const totalAmountPaid = invoices.reduce((sum, inv) => sum + (inv.amount_paid || 0) + (inv.deposit_received || 0), 0);
              const aw = project.active_worth || 0;
              const materialCredits = invoiceAllocatedMaterials; // only actual material credits from progress billing
              const paidPct = aw > 0 ? Math.min((totalAmountPaid / aw) * 100, 100) : 0;
              const creditsPct = aw > 0 ? Math.min((materialCredits / aw) * 100, 100 - paidPct) : 0;
              return (
                <>
                  <div style={styles.progressHeader}>
                    <span style={styles.label}>Payment Collected</span>
                    <span style={styles.value}>
                      ${totalAmountPaid.toFixed(2)} / ${aw.toFixed(2)}
                    </span>
                  </div>
                  <div style={{...styles.progressBar, display: 'flex', overflow: 'hidden'}}>
                    {paidPct > 0 && (
                      <div style={{width: `${paidPct}%`, height: '100%', backgroundColor: '#10b981', transition: 'width 0.3s ease'}} />
                    )}
                    {creditsPct > 0 && (
                      <div style={{width: `${creditsPct}%`, height: '100%', backgroundColor: '#8b5cf6', transition: 'width 0.3s ease'}} />
                    )}
                  </div>
                  <div style={{display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#555'}}>
                      <span style={{width: 12, height: 12, borderRadius: 2, backgroundColor: '#10b981', display: 'inline-block'}} />
                      Cash Collected: ${totalAmountPaid.toFixed(2)}
                    </div>
                    {materialCredits > 0 && (
                      <div style={{display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#555'}}>
                        <span style={{width: 12, height: 12, borderRadius: 2, backgroundColor: '#8b5cf6', display: 'inline-block'}} />
                        Material Credits: ${materialCredits.toFixed(2)}
                      </div>
                    )}
                  </div>
                  <div style={{fontSize: 12, color: '#666', marginTop: 6}}>
                    Remaining to Bill: <strong>${Math.max(0, aw - billedAmount).toFixed(2)}</strong>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Cost Tracking Card */}
        <div style={{...styles.card, order: -1}}>
          <h2 style={styles.cardTitle}>Cost Tracking</h2>
          
          <div style={styles.row}>
            <span style={styles.label}>Labor Hours</span>
            <span style={styles.value}>{laborHours.toFixed(2)} hrs</span>
          </div>

          <div style={styles.row}>
            <span style={styles.label}>Labor Cost (burdened @ 1.4×)</span>
            <span style={styles.value}>${laborCost.toFixed(2)}</span>
          </div>
          <div style={{...styles.row, paddingLeft: 12, opacity: 0.8}}>
            <span style={{...styles.label, fontSize: 13}}>Avg effective rate</span>
            <span style={{...styles.value, fontSize: 13}}>${laborRate.toFixed(2)}/hr</span>
          </div>

          <div style={styles.row}>
            <span style={styles.label}>Materials & Expenses</span>
            <span style={styles.value}>${expensesCost.toFixed(2)}</span>
          </div>
          {invoiceAllocatedMaterials > 0 && (
            <div style={{...styles.row, paddingLeft: 12, opacity: 0.85}}>
              <span style={{...styles.label, fontSize: 13}}>
                📋 Materials via Invoice Credits
              </span>
              <span style={{...styles.value, fontSize: 14, color: '#f97316'}}>
                +${invoiceAllocatedMaterials.toFixed(2)}
              </span>
            </div>
          )}

          <div style={styles.divider} />

          <div style={styles.row}>
            <span style={{...styles.label, fontWeight: "bold"}}>Total Cost</span>
            <span style={{...styles.value, fontWeight: "bold"}}>
              ${totalCost.toFixed(2)}
            </span>
          </div>

          <div style={styles.divider} />

          <div style={styles.progressHeader}>
            <span style={styles.label}>Budget Used</span>
            <span style={styles.value}>{percentUsed.toFixed(1)}%</span>
          </div>
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                width: `${Math.min(percentUsed, 100)}%`,
                backgroundColor: percentUsed > 100 ? "#ef4444" : percentUsed > 80 ? "#f59e0b" : "#10b981",
              }}
            />
          </div>

          <div style={styles.row}>
            <span style={styles.label}>Remaining Budget</span>
            <span style={{
              ...styles.value,
              color: remaining < 0 ? "#ef4444" : "#10b981",
              fontWeight: "bold",
            }}>
              ${remaining.toFixed(2)}
            </span>
          </div>

          {/* $/sq ft calculations */}
          {project.sq_ft && (project.active_worth > 0 || totalCost > 0) && (
            <>
              <div style={styles.divider} />
              {project.active_worth > 0 && (
                <>
                  <div style={styles.row}>
                    <span style={styles.label}>Contract $/total sq ft</span>
                    <span style={styles.value}>${(project.active_worth / project.sq_ft).toFixed(2)}</span>
                  </div>
                  {project.sq_ft_living && (
                    <div style={styles.row}>
                      <span style={styles.label}>Contract $/living sq ft</span>
                      <span style={styles.value}>${(project.active_worth / project.sq_ft_living).toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}
              {totalCost > 0 && (
                <>
                  <div style={styles.row}>
                    <span style={styles.label}>Cost $/total sq ft</span>
                    <span style={styles.value}>${(totalCost / project.sq_ft).toFixed(2)}</span>
                  </div>
                  {project.sq_ft_living && (
                    <div style={styles.row}>
                      <span style={styles.label}>Cost $/living sq ft</span>
                      <span style={styles.value}>${(totalCost / project.sq_ft_living).toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Project Info Card */}
        <div style={{...styles.card, order: -3}}>
          <h2 style={styles.cardTitle}>Project Details</h2>
          
          <div style={styles.row}>
            <span style={styles.label}>Status</span>
              <select
              value={project.status || "active"}
              onChange={async (e) => {
                const newStatus = e.target.value;
                
                // If changing to "active", check if we have proposals to select from
                if (newStatus === "active" && project.status !== "active") {
                  // Load all proposals for this project
                  const { data: allProposals } = await supabase
                    .from("proposals")
                    .select("*")
                    .eq("project_id", id);
                  
                  if (allProposals && allProposals.length > 0) {
                    // Show winning proposal modal
                    setAllProjectProposals(allProposals);
                    // Auto-select if only one proposal
                    if (allProposals.length === 1) {
                      setSelectedWinningProposal(allProposals[0]);
                    }
                    setShowWinningProposalModal(true);
                    return; // Don't update status yet
                  }
                }
                
                try {
                  const updateData = { status: newStatus };
                  
                  // If changing FROM active TO another status, reset budget to 0
                  if (project.status === "active" && newStatus !== "active") {
                    updateData.budget = 0;
                  }
                  
                  // If changing TO bidding status, reset active_worth to 0
                  if (newStatus === "bidding") {
                    updateData.active_worth = 0;
                    updateData.budget = 0; // Also reset budget when going back to bidding
                  }
                  
                  const { error } = await supabase
                    .from("projects")
                    .update(updateData)
                    .eq("id", id);
                  
                  if (error) throw error;
                  setProject({ ...project, ...updateData });
                } catch (err) {
                  console.error("Error updating status:", err);
                  alert("Failed to update status");
                }
              }}
              style={{
                ...styles.statusSelect,
                backgroundColor: 
                  project.status === "bidding" ? "#fef3c7" :
                  project.status === "pending" ? "#dbeafe" :
                  project.status === "approved" ? "#d1fae5" :
                  project.status === "active" ? "#10b981" :
                  project.status === "canceled" ? "#fee2e2" :
                  project.status === "postponed" ? "#e5e7eb" :
                  project.status === "completed" ? "#6b7280" : "#fff",
                color:
                  project.status === "active" ? "#fff" :
                  project.status === "completed" ? "#fff" : "#111",
                fontWeight: "bold",
              }}
            >
              <option value="bidding">Bidding</option>
              <option value="pending">Pending Bid Sent</option>
              <option value="approved">Bid Approved</option>
              <option value="active">Active</option>
              <option value="completed">Complete</option>
              <option value="bid_lost">Bid Lost</option>
              <option value="canceled">Canceled</option>
              <option value="postponed">Postponed</option>
            </select>
          </div>

          {project.project_type && (() => {
            const pt = PROJECT_TYPES.find(t => t.value === project.project_type);
            return pt ? (
              <div style={styles.row}>
                <span style={styles.label}>Project Type</span>
                <span style={{fontSize: 14, fontWeight: '700', color: pt.color, backgroundColor: pt.color + '18', borderRadius: 6, padding: '4px 10px'}}>
                  {pt.icon} {pt.label}
                </span>
              </div>
            ) : null;
          })()}

          {project.start_date && (
            <div style={styles.row}>
              <span style={styles.label}>Start Date</span>
              <span style={styles.value}>
                {formatDate(project.start_date)}
              </span>
            </div>
          )}

          {project.end_date && (
            <div style={styles.row}>
              <span style={styles.label}>Target End Date</span>
              <span style={styles.value}>
                {formatDate(project.end_date)}
              </span>
            </div>
          )}

          {(project.sq_ft || project.sq_ft_living) && (
            <>
              <div style={styles.divider} />
              {/* Living Sq Ft row */}
              <div style={styles.row}>
                <span style={styles.label}>🏠 Living Sq Ft</span>
                {editingSqFtLiving ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="number" step="1" value={sqFtLivingInput} onChange={e => setSqFtLivingInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") saveSqFtField("sq_ft_living", sqFtLivingInput); if (e.key === "Escape") setEditingSqFtLiving(false); }}
                      autoFocus style={{ width: 90, padding: "3px 6px", border: "2px solid #0b3ea8", borderRadius: 6, fontSize: 14, fontWeight: 700 }} />
                    <button onClick={() => saveSqFtField("sq_ft_living", sqFtLivingInput)} disabled={savingBudget} style={{ padding: "3px 8px", background: "#10b981", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✓</button>
                    <button onClick={() => setEditingSqFtLiving(false)} style={{ padding: "3px 6px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 12 }}>✕</button>
                  </span>
                ) : (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={styles.value}>{project.sq_ft_living ? Number(project.sq_ft_living).toLocaleString() + " sq ft" : "—"}</span>
                    <button onClick={() => { setSqFtLivingInput((project.sq_ft_living || '').toString()); setEditingSqFtLiving(true); }} title="Edit living sq ft" style={{ padding: "2px 6px", background: "none", border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer", fontSize: 11, color: "#6b7280" }}>✏️</button>
                  </span>
                )}
              </div>
              {/* Total Sq Ft row */}
              <div style={styles.row}>
                <span style={styles.label}>📐 Total Sq Ft</span>
                {editingSqFt ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="number" step="1" value={sqFtInput} onChange={e => setSqFtInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") saveSqFtField("sq_ft", sqFtInput); if (e.key === "Escape") setEditingSqFt(false); }}
                      autoFocus style={{ width: 90, padding: "3px 6px", border: "2px solid #0b3ea8", borderRadius: 6, fontSize: 14, fontWeight: 700 }} />
                    <button onClick={() => saveSqFtField("sq_ft", sqFtInput)} disabled={savingBudget} style={{ padding: "3px 8px", background: "#10b981", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✓</button>
                    <button onClick={() => setEditingSqFt(false)} style={{ padding: "3px 6px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 12 }}>✕</button>
                  </span>
                ) : (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={styles.value}>{project.sq_ft ? Number(project.sq_ft).toLocaleString() + " sq ft" : "—"}</span>
                    <button onClick={() => { setSqFtInput((project.sq_ft || '').toString()); setEditingSqFt(true); }} title="Edit total sq ft" style={{ padding: "2px 6px", background: "none", border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer", fontSize: 11, color: "#6b7280" }}>✏️</button>
                  </span>
                )}
              </div>
            </>
          )}

          {project.description && (
            <>
              <div style={styles.divider} />
              <div>
                <span style={styles.label}>Description</span>
                <p style={styles.description}>{project.description}</p>
              </div>
            </>
          )}
        </div>

        {/* Quick Actions Toolbar — full width, horizontal */}
        <div style={{...styles.card, gridColumn: '1 / -1', padding: '16px 24px', order: 0}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'}}>
            <span style={{fontSize: 14, fontWeight: '700', color: '#555', marginRight: 4, whiteSpace: 'nowrap'}}>⚡ Quick Actions:</span>

            {["residential-contractor", "commercial-private", "residential-owner"].includes(project.project_type) && (<>
              <button onClick={() => navigate(`/project/${id}/reports-photos`)} style={qaBtn('#3b82f6')}>📸 Reports & Photos</button>
              <button onClick={() => navigate(`/project/${id}/material-list`)} style={qaBtn('#f97316')}>📋 Material Lists</button>
              <button onClick={() => navigate(`/project/${id}/info-sheet`)} style={qaBtn('#8b5cf6')}>📄 Info Sheet</button>
            </>)}

            {!["residential-contractor", "commercial-private", "residential-owner"].includes(project.project_type) && (<>
              <button onClick={() => navigate(`/project/${id}/plans`)} style={qaBtn('#8b5cf6')}>📐 Plans & Takeoffs</button>
              <button onClick={() => navigate(`/project/${id}/reports-photos`)} style={qaBtn('#6366f1')}>📸 Reports & Photos</button>
              <button onClick={() => navigate(`/project/${id}/material-list`)} style={qaBtn('#f59e0b')}>📋 Material Lists</button>
              <button onClick={() => navigate(`/project/${id}/info-sheet`)} style={qaBtn('#8b5cf6')}>📄 Info Sheet</button>
            </>)}

            <div style={{width: 1, height: 32, backgroundColor: '#e5e7eb', margin: '0 4px'}} />

            <button onClick={() => setShowChangeOrderModal(true)} style={qaBtn('#f97316')}>🔄 Add Change Order</button>
            <button onClick={() => setShowAddDepositModal(true)} style={qaBtn('#10b981')}>💰 Add Deposit</button>
          </div>
        </div>

        {/* Contractors Card - hidden for residential/lighting types */}
        {!["residential-contractor", "commercial-private", "residential-owner", "lighting-project"].includes(project.project_type) && (
        <div style={{...styles.card, order: 1}}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ ...styles.cardTitle, marginBottom: 0 }}>Proposal Contractors</h2>
            <button 
              onClick={() => setShowAddContractorModal(true)} 
              style={styles.addEstimateButton}
            >
              + Add Contractor
            </button>
          </div>
          
          {contractors.length === 0 ? (
            <p style={styles.emptyText}>No contractors added yet. Click "+ Add Contractor" to add one for proposal selection!</p>
          ) : (
            <div style={{...styles.contractorCompactList, maxHeight: 260, overflowY: 'auto'}}>
              {contractors.map((contractor) => {
                const allProposals = Object.values(proposals).flat();
                const hasSent = allProposals.some(p => p.contractor_name === contractor.contractor_name && p.status === 'sent');
                const hasProposal = allProposals.some(p => p.contractor_name === contractor.contractor_name);
                return (
                <div key={contractor.id} style={styles.contractorCompactRow}>
                  <div style={{display: 'flex', alignItems: 'center', gap: 8, flex: 1}}>
                    <span style={styles.contractorCompactName}>{contractor.contractor_name}</span>
                    {hasSent ? (
                      <span style={{fontSize: 11, fontWeight: '700', backgroundColor: '#d1fae5', color: '#065f46', borderRadius: 20, padding: '2px 8px'}}>✅ Sent</span>
                    ) : hasProposal ? (
                      <span style={{fontSize: 11, fontWeight: '700', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: 20, padding: '2px 8px'}}>⏳ Not Sent</span>
                    ) : (
                      <span style={{fontSize: 11, fontWeight: '700', backgroundColor: '#f3f4f6', color: '#9ca3af', borderRadius: 20, padding: '2px 8px'}}>No Proposal</span>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      if (confirm(`Delete contractor ${contractor.contractor_name}?`)) {
                        try {
                          const { error } = await supabase
                            .from("project_contractors")
                            .delete()
                            .eq("id", contractor.id);
                          
                          if (error) throw error;
                          loadProjectData();
                        } catch (err) {
                          console.error("Error deleting contractor:", err);
                          alert("Failed to delete contractor");
                        }
                      }
                    }}
                    style={styles.contractorDeleteButton}
                  >
                    ✕
                  </button>
                </div>
                );
              })}
            </div>
          )}
        </div>
        )}

        {/* Time Entries Card — full-width table */}
        <div style={{...styles.card, gridColumn: '1 / -1', order: 6}}>
          <div
            onClick={() => timeEntries.length > 0 && setTimeEntriesExpanded(e => !e)}
            style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 20, cursor: timeEntries.length > 0 ? 'pointer' : 'default', userSelect:'none'}}
            title={timeEntries.length > 0 ? (timeEntriesExpanded ? 'Collapse list' : 'Expand to see all entries') : ''}
          >
            <h2 style={{...styles.cardTitle, marginBottom: 0}}>
              Time Entries
              <span style={{marginLeft: 10, fontSize: 14, fontWeight: '500', color: '#666'}}>
                ({timeEntries.length} entries · {laborHours.toFixed(2)} hrs · ${laborCost.toFixed(2)})
              </span>
            </h2>
            {timeEntries.length > 0 && (
              <span style={{fontSize: 18, color: '#9ca3af', marginLeft: 12, transition: 'transform 0.2s', display:'inline-block', transform: timeEntriesExpanded ? 'rotate(180deg)' : 'rotate(0deg)'}}>▼</span>
            )}
          </div>

          {timeEntries.length === 0 ? (
            <p style={styles.emptyText}>No time entries yet for this project.</p>
          ) : (
            <div style={{overflowX: 'auto', maxHeight: timeEntriesExpanded ? 'none' : 210, overflowY: timeEntriesExpanded ? 'visible' : 'auto', border: '1px solid #e5e7eb', borderRadius: 8}}>
              <table style={{width:'100%', borderCollapse:'collapse', fontSize: 14}}>
                <thead>
                  <tr style={{backgroundColor:'#f3f4f6', position:'sticky', top:0, zIndex:1}}>
                    {['Employee','Date','Day','Clock In','Clock Out','Hrs','Lunch','Rate (burdened)','Cost'].map(h => (
                      <th key={h} style={{padding:'10px 12px', textAlign:'left', fontSize:12, fontWeight:'700', color:'#555', textTransform:'uppercase', borderBottom:'2px solid #e5e7eb', whiteSpace:'nowrap', backgroundColor:'#f3f4f6'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeEntries.map((entry, idx) => {
                    const ci = new Date(entry.clock_in);
                    const co = entry.clock_out ? new Date(entry.clock_out) : null;
                    let hrs = co ? (co - ci) / (1000*60*60) : 0;
                    if (entry.is_lunch && hrs > 0) hrs = Math.max(0, hrs - 0.5);
                    const empRate = entry.employees?.hourly_rate;
                    const costRate = empRate > 0 ? empRate * 1.4 : fallbackRate;
                    const cost = hrs * costRate;
                    const empName = entry.employees ? `${entry.employees.first_name} ${entry.employees.last_name}` : 'Unknown';
                    const dayName = ci.toLocaleDateString([], {weekday:'short'});
                    const rowBg = idx % 2 === 0 ? '#fff' : '#f9fafb';
                    return (
                      <tr key={entry.id} style={{backgroundColor: rowBg, borderBottom:'1px solid #e5e7eb'}}>
                        <td style={{padding:'10px 12px', fontWeight:'600', color:'#111'}}>{empName}</td>
                        <td style={{padding:'10px 12px', color:'#444'}}>{ci.toLocaleDateString()}</td>
                        <td style={{padding:'10px 12px', color:'#666'}}>{dayName}</td>
                        <td style={{padding:'10px 12px', color:'#444'}}>{ci.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</td>
                        <td style={{padding:'10px 12px', color:'#444'}}>{co ? co.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : <span style={{color:'#f59e0b',fontWeight:'600'}}>In Progress</span>}</td>
                        <td style={{padding:'10px 12px', fontWeight:'700', color: co ? '#111' : '#999'}}>{co ? hrs.toFixed(2) : '—'}</td>
                        <td style={{padding:'10px 12px', textAlign:'center'}}>{entry.is_lunch ? <span style={{color:'#10b981',fontWeight:'700'}}>-0.5h</span> : <span style={{color:'#d1d5db'}}>—</span>}</td>
                        <td style={{padding:'10px 12px', color:'#666'}}>${costRate.toFixed(2)}/hr{empRate > 0 ? '' : <span style={{fontSize:11, color:'#f59e0b'}}> (default)</span>}</td>
                        <td style={{padding:'10px 12px', fontWeight:'700', color: BRAND.accent}}>{co ? `$${cost.toFixed(2)}` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{backgroundColor:'#0b3ea8'}}>
                    <td colSpan={5} style={{padding:'12px', color:'#fff', fontWeight:'700', fontSize:14}}>TOTALS</td>
                    <td style={{padding:'12px', color:'#fff', fontWeight:'700', fontSize:14}}>{laborHours.toFixed(2)} hrs</td>
                    <td style={{padding:'12px'}}></td>
                    <td style={{padding:'12px', color:'#fff', fontSize:13}}>avg ${laborRate.toFixed(2)}/hr</td>
                    <td style={{padding:'12px', color:'#f97316', fontWeight:'700', fontSize:15}}>${laborCost.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Materials & Expenses Card — full-width table */}
        <div style={{...styles.card, gridColumn: '1 / -1', order: 7}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 20}}>
            <h2
              onClick={() => projectExpenses.length > 0 && setExpensesExpanded(e => !e)}
              style={{...styles.cardTitle, marginBottom: 0, cursor: projectExpenses.length > 0 ? 'pointer' : 'default', userSelect:'none', display:'flex', alignItems:'center', gap: 8}}
              title={projectExpenses.length > 0 ? (expensesExpanded ? 'Collapse list' : 'Expand to see all expenses') : ''}
            >
              Materials & Expenses
              {projectExpenses.length > 0 && (
                <span style={{fontSize: 14, fontWeight: '500', color: '#666'}}>
                  ({projectExpenses.length} items · ${expensesCost.toFixed(2)})
                </span>
              )}
              {projectExpenses.length > 0 && (
                <span style={{fontSize: 16, color: '#9ca3af', transition: 'transform 0.2s', display:'inline-block', transform: expensesExpanded ? 'rotate(180deg)' : 'rotate(0deg)'}}>▼</span>
              )}
            </h2>
            <button onClick={handleAddExpense} style={styles.addEstimateButton}>+ Add Expense</button>
          </div>

          {/* Category filter buttons — only shown when there are 2+ categories */}
          {projectExpenses.length > 0 && expenseCategories.length > 2 && (
            <div style={{display:'flex', flexWrap:'wrap', gap:8, marginBottom:12}}>
              {expenseCategories.map(cat => {
                const catTotal = cat === 'all' ? expensesCost : projectExpenses.filter(e => e.category === cat).reduce((s,e) => s+(e.amount||0), 0);
                return (
                  <button key={cat} onClick={() => setExpenseCategoryFilter(cat)} style={{
                    padding: '5px 14px', borderRadius: 20, border: '2px solid',
                    borderColor: expenseCategoryFilter === cat ? '#0b3ea8' : '#e5e7eb',
                    backgroundColor: expenseCategoryFilter === cat ? '#0b3ea8' : '#fff',
                    color: expenseCategoryFilter === cat ? '#fff' : '#555',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize',
                  }}>
                    {cat === 'all' ? '📋 All' : cat}
                    <span style={{marginLeft:6, opacity:0.8}}>${catTotal.toFixed(0)}</span>
                  </button>
                );
              })}
            </div>
          )}

          {projectExpenses.length === 0 ? (
            <p style={styles.emptyText}>No expenses yet. Click "+ Add Expense" to track materials and costs!</p>
          ) : (
            <div style={{overflowX: 'auto', maxHeight: expensesExpanded ? 'none' : 172, overflowY: expensesExpanded ? 'visible' : 'auto', border: '1px solid #e5e7eb', borderRadius: 8}}>
              <table style={{width:'100%', borderCollapse:'collapse', fontSize: 14}}>
                <thead>
                  <tr style={{backgroundColor:'#f3f4f6', position:'sticky', top:0, zIndex:1}}>
                    {['Date','Description','Vendor','Category','Amount',''].map((h,i) => (
                      <th key={i} style={{padding:'10px 12px', textAlign: h === 'Amount' ? 'right' : 'left', fontSize:12, fontWeight:'700', color:'#555', textTransform:'uppercase', borderBottom:'2px solid #e5e7eb', whiteSpace:'nowrap', backgroundColor:'#f3f4f6'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProjectExpenses.map((expense, idx) => (
                    <tr key={expense.id} style={{backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb', borderBottom:'1px solid #e5e7eb'}}>
                      <td style={{padding:'4px 10px', color:'#555', whiteSpace:'nowrap', fontSize:13}}>{formatDate(expense.expense_date) || '—'}</td>
                      <td style={{padding:'4px 10px', fontWeight:'600', color:'#111', maxWidth: 320, fontSize:13}}>{expense.description}</td>
                      <td style={{padding:'4px 10px', color:'#555', fontSize:13}}>{expense.vendor || <span style={{color:'#ccc'}}>—</span>}</td>
                      <td style={{padding:'4px 10px'}}>
                        {expense.category ? (
                          <span style={{backgroundColor:'#e0f2fe', color:'#0369a1', borderRadius: 20, padding:'2px 8px', fontSize:11, fontWeight:'600', textTransform:'capitalize'}}>
                            {expense.category}
                          </span>
                        ) : <span style={{color:'#ccc'}}>—</span>}
                      </td>
                      <td style={{padding:'4px 10px', fontWeight:'700', color: BRAND.accent, textAlign:'right', whiteSpace:'nowrap', fontSize:13}}>${(expense.amount || 0).toFixed(2)}</td>
                      <td style={{padding:'4px 6px', textAlign:'center'}}>
                        <button
                          onClick={async () => {
                            if (confirm(`Delete expense "${expense.description}"?`)) {
                              try {
                                let { error } = await supabase.from("project_expenses").delete().eq("id", expense.id);
                                if (error || !error) {
                                  const { error: error2 } = await supabase.from("expenses").delete().eq("id", expense.id);
                                  if (error2 && error) throw error2;
                                }
                                loadProjectData();
                              } catch (err) {
                                console.error("Error deleting expense:", err);
                                alert("Failed to delete expense");
                              }
                            }
                          }}
                          style={styles.contractorDeleteButton}
                        >✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{backgroundColor:'#0b3ea8'}}>
                    <td colSpan={4} style={{padding:'12px', color:'#fff', fontWeight:'700', fontSize:14}}>
                      {expenseCategoryFilter === 'all'
                        ? `TOTAL (${filteredProjectExpenses.length} items)`
                        : `${expenseCategoryFilter.toUpperCase()} (${filteredProjectExpenses.length} of ${projectExpenses.length})`}
                    </td>
                    <td style={{padding:'12px', color:'#f97316', fontWeight:'700', fontSize:15, textAlign:'right'}}>${filteredExpensesCost.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
        {/* Estimates Card */}
        <div style={{...styles.card, gridColumn: "1 / -1", order: 2}}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ ...styles.cardTitle, marginBottom: 0 }}>Project Bids</h2>
            <div style={{ display: "flex", gap: 12 }}>
              <button 
                onClick={() => navigate(`/estimate/quick?projectId=${id}&projectName=${encodeURIComponent(project.name)}&customer=${encodeURIComponent(project.contractor || project.customer || '')}`)} 
                style={{...styles.addEstimateButton, backgroundColor: "#10b981"}}
              >
                ⚡ Quick Estimate
              </button>
              <button
                onClick={async () => {
                  const { data } = await supabase
                    .from("estimates")
                    .select("id, estimate_number, customer_name, project_name, total, estimate_date")
                    .is("project_id", null)
                    .not("estimate_number", "is", null)
                    .order("created_at", { ascending: false });
                  setUnlinkedEstimates(data || []);
                  setAttachEstimateSearch('');
                  setShowAttachEstimateModal(true);
                }}
                style={{...styles.addEstimateButton, backgroundColor: "#6366f1"}}
              >
                📎 Attach Existing
              </button>
              <button 
                onClick={() => navigate(`/project/${id}/estimate`)} 
                style={styles.addEstimateButton}
              >
                + New Bid
              </button>
            </div>
          </div>
          
          {estimates.length === 0 ? (
            <p style={styles.emptyText}>No bids created yet. Click "New Bid" to get started!</p>
          ) : (
            <div style={styles.table}>
              <div style={styles.estimateHeader}>
                <div style={styles.th}>Estimate #</div>
                <div style={styles.th}>Date</div>
                <div style={styles.th}>Status</div>
                <div style={styles.th}>Total</div>
              </div>
              {estimates.filter(e => !e.parent_estimate_id).map((estimate) => (
                <div key={estimate.id} style={{marginBottom: 16}}>
                  {/* BASE ESTIMATE ROW */}
                  <div style={styles.estimateRow}>
                    <div style={styles.td}>{estimate.estimate_number || "N/A"}</div>
                    <div style={styles.td}>
                      {formatDate(estimate.estimate_date)}
                    </div>
                    <div style={styles.td}>
                      <span
                        style={{
                          ...styles.badge,
                          backgroundColor:
                            estimate.status === "approved"
                              ? "#10b981"
                              : estimate.status === "sent"
                              ? "#3b82f6"
                              : estimate.status === "rejected"
                              ? "#ef4444"
                              : "#f59e0b",
                        }}
                      >
                        {estimate.status || "draft"}
                      </span>
                    </div>
                    <div style={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong>${(estimate.total || 0).toFixed(2)}</strong>
                        {estimate.price_adjustment_applied && (
                          <span
                            style={{
                              background: '#f59e0b',
                              color: '#000',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 'bold'
                            }}
                            title="Price has been adjusted from calculated total"
                          >
                            ADJUSTED
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* BUTTONS ROW BELOW ESTIMATE */}
                  <div style={{padding: "12px 16px", display: "flex", gap: 8, flexWrap: "wrap", borderBottom: "1px solid #e5e7eb"}}>
                    <button
                      onClick={() => {
                        // Use estimate_type to determine which editor to open
                        // 'full' → Full Estimate editor, 'quick' (or null for old estimates) → Quick Estimate editor
                        if (estimate.estimate_type === 'full') {
                          navigate(`/project/${id}/estimate?estimateId=${estimate.id}`);
                        } else {
                          navigate(`/estimate/quick?estimateId=${estimate.id}&projectId=${id}`);
                        }
                      }}
                      style={styles.estimateButton}
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`Delete estimate ${estimate.estimate_number}? This cannot be undone.`)) {
                          try {
                            await supabase.from("estimate_items").delete().eq("estimate_id", estimate.id);
                            const { error } = await supabase.from("estimates").delete().eq("id", estimate.id);
                            if (error) throw error;
                            loadProjectData();
                          } catch (err) {
                            console.error("Error deleting estimate:", err);
                            alert("Failed to delete estimate");
                          }
                        }
                      }}
                      style={{...styles.estimateButton, backgroundColor: "#ef4444"}}
                    >
                      Delete
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Copy estimate ${estimate.estimate_number}?`)) return;
                        try {
                          // Get next estimate number
                          const { data: allEsts } = await supabase
                            .from("estimates")
                            .select("estimate_number")
                            .eq("company_id", user.id)
                            .not("estimate_number", "is", null);
                          let maxNum = 1000;
                          (allEsts || []).forEach(e => {
                            const m = (e.estimate_number || '').match(/^(\d+)/);
                            if (m && parseInt(m[1]) > maxNum) maxNum = parseInt(m[1]);
                          });
                          const newNumber = String(maxNum + 1);

                          // Copy the estimate record
                          const { data: newEst, error: estErr } = await supabase
                            .from("estimates")
                            .insert([{
                              company_id: estimate.company_id || user.id,
                              estimate_number: newNumber,
                              project_name: estimate.project_name,
                              customer_name: estimate.customer_name,
                              estimate_date: new Date().toISOString().split('T')[0],
                              subtotal: estimate.subtotal,
                              total: estimate.total,
                              status: 'draft',
                              notes: estimate.notes ? `${estimate.notes} (Copy of #${estimate.estimate_number})` : `Copy of #${estimate.estimate_number}`,
                              estimate_type: estimate.estimate_type,
                              project_id: estimate.project_id,
                            }])
                            .select()
                            .single();
                          if (estErr) throw estErr;

                          // Copy all line items
                          const { data: items } = await supabase
                            .from("estimate_items")
                            .select("*")
                            .eq("estimate_id", estimate.id)
                            .order("sequence");

                          if (items && items.length > 0) {
                            const copiedItems = items.map(item => ({
                              estimate_id: newEst.id,
                              line_type: item.line_type,
                              description: item.description,
                              quantity: item.quantity,
                              unit: item.unit,
                              material_unit_cost: item.material_unit_cost,
                              material_total: item.material_total,
                              labor_hours: item.labor_hours,
                              labor_rate: item.labor_rate,
                              labor_total: item.labor_total,
                              line_total: item.line_total,
                              sequence: item.sequence,
                            }));
                            const { error: itemsErr } = await supabase
                              .from("estimate_items")
                              .insert(copiedItems);
                            if (itemsErr) throw itemsErr;
                          }

                          alert(`Estimate copied as #${newNumber}`);
                          loadProjectData();
                        } catch (err) {
                          console.error("Error copying estimate:", err);
                          alert("Failed to copy estimate: " + err.message);
                        }
                      }}
                      style={{...styles.estimateButton, backgroundColor: "#6366f1"}}
                    >
                      📋 Copy
                    </button>
                    <button
                      onClick={() => {
                        setSelectedEstimateForAlternate(estimate.id);
                        setShowAlternateTypeModal(true);
                      }}
                      style={{...styles.estimateButton, backgroundColor: "#8b5cf6"}}
                    >
                      + Add Alt
                    </button>
                    <button
                      onClick={() => {
                        const projectType = project?.project_type || 'commercial-public';
                        const contractorParam = project?.project_type === 'lighting-project' && project?.contractor
                          ? `&contractor=${encodeURIComponent(project.contractor)}`
                          : '';
                        navigate(`/project/${id}/proposal?estimateId=${estimate.id}&type=${projectType}${contractorParam}`);
                      }}
                      style={{...styles.estimateButton, backgroundColor: "#10b981"}}
                    >
                      📋 Proposal
                    </button>
                    {proposals[estimate.id] && proposals[estimate.id].length > 0 && (
                      <button
                        onClick={() => {
                          setSelectedEstimateProposals(proposals[estimate.id]);
                          setShowProposalsModal(true);
                        }}
                        style={{...styles.estimateButton, backgroundColor: "#3b82f6"}}
                      >
                        📄 View Proposals ({proposals[estimate.id].length})
                      </button>
                    )}
                    {/* ⭐ Set as Active Bid */}
                    <button
                      onClick={() => handleSetActiveEstimate(estimate)}
                      title="Set this estimate as the active bid — updates Contract Value and Budget"
                      style={{
                        ...styles.estimateButton,
                        backgroundColor: project.active_estimate_id === estimate.id ? '#f59e0b' : '#6b7280',
                        border: project.active_estimate_id === estimate.id ? '2px solid #d97706' : '2px solid transparent',
                      }}
                    >
                      {project.active_estimate_id === estimate.id ? '⭐ Active Bid' : '☆ Set Active'}
                    </button>
                  </div>

                  {/* ALTERNATES ROWS (indented) */}
                  {estimates
                    .filter(alt => alt.parent_estimate_id === estimate.id)
                    .map((alternate) => (
                      <div 
                        key={alternate.id} 
                        style={{
                          ...styles.estimateRow,
                          backgroundColor: "#f9fafb",
                          paddingLeft: 40
                        }}
                      >
                        <div style={{...styles.td, display: 'flex', alignItems: 'center', gap: 8, gridColumn: '1 / 3'}}>
                          <span style={{ color: "#8b5cf6" }}>└─</span>
                          <span>{alternate.alternate_title || `Alt ${alternate.alternate_number}`}</span>
                      <button
                            onClick={() => {
                              if (alternate.estimate_type === 'full') {
                                navigate(`/project/${id}/estimate?estimateId=${alternate.id}`);
                              } else {
                                navigate(`/estimate/quick?estimateId=${alternate.id}&projectId=${id}`);
                              }
                            }}
                            style={{...styles.estimateButton, fontSize: 11, padding: '4px 8px'}}
                          >
                            Edit
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`Delete alternate ${alternate.alternate_title}? This cannot be undone.`)) {
                                try {
                                  await supabase.from("estimate_items").delete().eq("estimate_id", alternate.id);
                                  const { error } = await supabase.from("estimates").delete().eq("id", alternate.id);
                                  if (error) throw error;
                                  loadProjectData();
                                } catch (err) {
                                  console.error("Error deleting alternate:", err);
                                  alert("Failed to delete alternate");
                                }
                              }
                            }}
                            style={{...styles.estimateButton, backgroundColor: "#ef4444", fontSize: 11, padding: '4px 8px'}}
                          >
                            Delete
                          </button>
                        </div>
                        <div style={styles.td}>${(alternate.subtotal || 0).toFixed(2)}</div>
                        <div style={styles.td}>
                          <strong>${(alternate.total || 0).toFixed(2)}</strong>
                        </div>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Change Orders Card — only shown when there are change orders */}
        {changeOrders.length > 0 && <div style={{...styles.card, gridColumn: "1 / -1", order: 4}}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ ...styles.cardTitle, marginBottom: 0 }}>Change Orders</h2>
            <div style={{ display: "flex", gap: 12 }}>
              <button 
                onClick={() => navigate(`/estimate/quick?coId=new&projectId=${id}&projectName=${encodeURIComponent(project.name)}&customer=${encodeURIComponent(project.contractor || project.customer || '')}&type=changeorder`)} 
                style={{...styles.addEstimateButton, backgroundColor: "#10b981"}}
              >
                ⚡ Quick Change Order
              </button>
              <button 
                onClick={() => setShowChangeOrderModal(true)} 
                style={styles.addEstimateButton}
              >
                + New Change Order
              </button>
            </div>
          </div>
          
          {changeOrders.length === 0 ? (
            <p style={styles.emptyText}>No change orders yet. Click "New Change Order" to create one!</p>
          ) : (
            <div style={styles.table}>
              <div style={styles.changeOrderHeader}>
                <div style={styles.th}>CO #</div>
                <div style={styles.th}>Title</div>
                <div style={styles.th}>Date</div>
                <div style={styles.th}>Status</div>
                <div style={styles.th}>Total</div>
              </div>
              {changeOrders.map((changeOrder) => (
                <div key={changeOrder.id} style={{marginBottom: 16}}>
                  {/* CHANGE ORDER ROW */}
                  <div style={styles.changeOrderRow}>
                    <div style={styles.td}>{changeOrder.change_order_number || "N/A"}</div>
                    <div style={styles.td}>{changeOrder.title}</div>
                    <div style={styles.td}>
                      {formatDate(changeOrder.change_order_date)}
                    </div>
                    <div style={styles.td}>
                      <select
                        value={changeOrder.status || "pending"}
                        onClick={(e) => e.stopPropagation()}
                        onChange={async (e) => {
                          const newStatus = e.target.value;
                          const oldStatus = changeOrder.status;
                          
                          try {
                            // Update change order status
                            const { error: coError } = await supabase
                              .from("change_orders")
                              .update({ status: newStatus })
                              .eq("id", changeOrder.id);
                            
                            if (coError) throw coError;

                            // If approving, add CO total to project's active_worth
                            if (newStatus === "approved" && oldStatus !== "approved") {
                              const coTotal = changeOrder.total || 0;
                              const currentWorth = project.active_worth || 0;
                              const newWorth = currentWorth + coTotal;
                              
                              const { error: projError } = await supabase
                                .from("projects")
                                .update({ active_worth: newWorth })
                                .eq("id", id);
                              
                              if (projError) throw projError;
                              
                              setProject({ ...project, active_worth: newWorth });
                              alert(`Change order approved! Contract value updated:\n$${currentWorth.toFixed(2)} + $${coTotal.toFixed(2)} = $${newWorth.toFixed(2)}`);
                            }
                            
                            // If un-approving (changing from approved to something else), subtract CO total
                            if (oldStatus === "approved" && newStatus !== "approved") {
                              const coTotal = changeOrder.total || 0;
                              const currentWorth = project.active_worth || 0;
                              const newWorth = Math.max(0, currentWorth - coTotal);
                              
                              const { error: projError } = await supabase
                                .from("projects")
                                .update({ active_worth: newWorth })
                                .eq("id", id);
                              
                              if (projError) throw projError;
                              
                              setProject({ ...project, active_worth: newWorth });
                            }
                            
                            loadProjectData();
                          } catch (err) {
                            console.error("Error updating change order status:", err);
                            alert("Failed to update status: " + err.message);
                          }
                        }}
                        style={{
                          padding: "4px 8px",
                          fontSize: 12,
                          fontWeight: "bold",
                          border: "2px solid #d1d5db",
                          borderRadius: 6,
                          cursor: "pointer",
                          backgroundColor:
                            changeOrder.status === "approved"
                              ? "#d1fae5"
                              : changeOrder.status === "completed"
                              ? "#dbeafe"
                              : changeOrder.status === "rejected"
                              ? "#fee2e2"
                              : "#fef3c7",
                          color:
                            changeOrder.status === "approved"
                              ? "#065f46"
                              : changeOrder.status === "completed"
                              ? "#1e40af"
                              : changeOrder.status === "rejected"
                              ? "#991b1b"
                              : "#92400e",
                        }}
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                    <div style={styles.td}>
                      <strong>${(changeOrder.total || 0).toFixed(2)}</strong>
                    </div>
                  </div>
                  
                  {/* BUTTONS ROW BELOW CHANGE ORDER */}
                  <div style={{padding: "12px 16px", display: "flex", gap: 8, flexWrap: "wrap", borderBottom: "1px solid #e5e7eb"}}>
                    <button
                      onClick={async () => {
                        // Check BOTH tables for change order items
                        // Full Estimate page saves to change_order_items table
                        // Quick Estimate page saves to estimate_items table with change_order_id
                        const { data: coTableItems } = await supabase
                          .from("change_order_items")
                          .select("id")
                          .eq("change_order_id", changeOrder.id);
                        
                        const { data: estTableItems } = await supabase
                          .from("estimate_items")
                          .select("id")
                          .eq("change_order_id", changeOrder.id);
                        
                        const totalCoTableItems = coTableItems?.length || 0;
                        const totalEstTableItems = estTableItems?.length || 0;
                        
                        if (totalCoTableItems > 0) {
                          // Items in change_order_items = created with full Estimate page
                          navigate(`/project/${id}/estimate?type=changeorder&coId=${changeOrder.id}&coNumber=${changeOrder.change_order_number}`);
                        } else if (totalEstTableItems > 0) {
                          // Items in estimate_items = created with Quick Change Order (any number of items)
                          navigate(`/estimate/quick?coId=${changeOrder.id}&type=changeorder&projectId=${id}`);
                        } else {
                          // No items found in either table - default to Quick editor
                          navigate(`/estimate/quick?coId=${changeOrder.id}&type=changeorder&projectId=${id}`);
                        }
                      }}
                      style={styles.estimateButton}
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`Delete change order ${changeOrder.change_order_number}? This cannot be undone.`)) {
                          try {
                            const { error } = await supabase
                              .from("change_orders")
                              .delete()
                              .eq("id", changeOrder.id);
                            
                            if (error) throw error;
                            loadProjectData();
                          } catch (err) {
                            console.error("Error deleting change order:", err);
                            alert("Failed to delete change order");
                          }
                        }
                      }}
                      style={{...styles.estimateButton, backgroundColor: "#ef4444"}}
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => {
                        const projectType = project?.project_type || 'commercial-public';
                        navigate(`/project/${id}/proposal?coId=${changeOrder.id}&type=${projectType}`);
                      }}
                      style={{...styles.estimateButton, backgroundColor: "#10b981"}}
                    >
                      📋 Proposal
                    </button>
                    {proposals[changeOrder.id] && proposals[changeOrder.id].length > 0 && (
                      <>
                        <button
                          onClick={() => handleCreateInvoice(changeOrder.id)}
                          style={{...styles.estimateButton, backgroundColor: "#3b82f6"}}
                        >
                          📄 Full Invoice
                        </button>
                        <button
                          onClick={() => navigate(`/project/${id}/progress-billing?coId=${changeOrder.id}`)}
                          style={{...styles.estimateButton, backgroundColor: "#8b5cf6"}}
                        >
                          📊 Progress Invoice
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>}

        {/* Deposits Card — only shown when there are deposits */}
        {deposits.length > 0 && <div style={{...styles.card, gridColumn: "1 / -1", order: 5}}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ ...styles.cardTitle, marginBottom: 0 }}>💰 Project Deposits</h2>
            <button onClick={() => setShowAddDepositModal(true)} style={styles.addEstimateButton}>
              + Record Deposit
            </button>
          </div>

          {/* Deposits Total */}
          {deposits.length > 0 && (
            <div style={{marginBottom: 16, padding: 12, backgroundColor: '#f0fdf4', borderRadius: 6}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <span style={{fontSize: 14, color: '#666'}}>Total Deposits Received:</span>
                <span style={{fontSize: 18, fontWeight: 'bold', color: '#10b981'}}>
                  ${deposits.filter(d => d.status !== 'cancelled').reduce((sum, d) => sum + (d.deposit_amount || 0), 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {deposits.length === 0 ? (
            <p style={styles.emptyText}>No deposits recorded yet. Click "+ Record Deposit" when a customer pays a deposit!</p>
          ) : (
            <div style={{...styles.contractorCompactList, maxHeight: 300, overflowY: 'auto'}}>
              {deposits.map((dep) => (
                <div key={dep.id} style={styles.expenseRow}>
                  <div style={{flex: 1}}>
                    <div style={{fontSize: 14, fontWeight: '500', color: '#111'}}>
                      ${(dep.deposit_amount || 0).toFixed(2)}
                      <span style={{
                        marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 4,
                        backgroundColor: dep.status === 'applied' ? '#d1fae5' : dep.status === 'cancelled' ? '#fee2e2' : '#dbeafe',
                        color: dep.status === 'applied' ? '#065f46' : dep.status === 'cancelled' ? '#991b1b' : '#1e40af',
                      }}>
                        {dep.status || 'received'}
                      </span>
                    </div>
                    <div style={{fontSize: 12, color: '#666'}}>
                      {formatDate(dep.deposit_date)}
                      {dep.reference_notes && ` • ${dep.reference_notes}`}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (confirm('Delete this deposit record?')) {
                        try {
                          const { error } = await supabase.from('project_deposits').delete().eq('id', dep.id);
                          if (error) throw error;
                          loadProjectData();
                        } catch (err) {
                          console.error('Error deleting deposit:', err);
                          alert('Failed to delete deposit');
                        }
                      }
                    }}
                    style={styles.contractorDeleteButton}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>}

        {/* Invoices Card */}
        <div style={{...styles.card, gridColumn: "1 / -1", order: 3}}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ ...styles.cardTitle, marginBottom: 0 }}>Project Invoices</h2>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={async () => {
                  // Load invoices not linked to any project (or linked to a different project)
                  const { data } = await supabase
                    .from("invoices")
                    .select("id, invoice_number, customer_name, project_name, total, invoice_date, status")
                    .or("project_name.is.null,project_name.eq.")
                    .order("created_at", { ascending: false });
                  setUnlinkedInvoices(data || []);
                  setAttachInvoiceSearch('');
                  setShowAttachInvoiceModal(true);
                }}
                style={{...styles.addEstimateButton, backgroundColor: "#6366f1"}}
              >
                📎 Link Existing Invoice
              </button>
              <button 
                onClick={() => setShowInvoiceTypeModal(true)} 
                style={styles.addEstimateButton}
              >
                + New Invoice
              </button>
            </div>
          </div>
          
          {invoices.length === 0 ? (
            <p style={styles.emptyText}>No invoices created yet. Click "New Invoice" to create one!</p>
          ) : (
            <div style={styles.table}>
              <div style={styles.invoiceHeader}>
                <div style={styles.th}>Invoice #</div>
                <div style={styles.th}>Date</div>
                <div style={styles.th}>Due Date</div>
                <div style={styles.th}>Status</div>
                <div style={styles.th}>Total</div>
                <div style={styles.th}>Paid</div>
                <div style={styles.th}>Balance</div>
                <div style={styles.th}>Actions</div>
              </div>
              {invoices.map((invoice) => (
                <div key={invoice.id} style={styles.invoiceRow}>
                  <div style={styles.td}>{invoice.invoice_number || "N/A"}</div>
                  <div style={styles.td}>
                    {formatDate(invoice.invoice_date)}
                  </div>
                  <div style={styles.td}>
                    {invoice.due_date ? formatDate(invoice.due_date) : "—"}
                  </div>
                  <div style={styles.td}>
                    <span
                      style={{
                        ...styles.badge,
                        backgroundColor:
                          invoice.status === "paid"
                            ? "#10b981"
                            : invoice.status === "sent"
                            ? "#3b82f6"
                            : invoice.status === "overdue"
                            ? "#ef4444"
                            : invoice.status === "partial"
                            ? "#f59e0b"
                            : "#9ca3af",
                      }}
                    >
                      {invoice.status || "draft"}
                    </span>
                  </div>
                  <div style={styles.td}>${(invoice.total || 0).toFixed(2)}</div>
                  <div style={styles.td}>${((invoice.amount_paid || 0) + (invoice.deposit_received || 0)).toFixed(2)}</div>
                  <div style={styles.td}>
                    {(() => {
                      const trueBalance = Math.max(0, (invoice.total || 0) - (invoice.amount_paid || 0) - (invoice.deposit_received || 0));
                      return (
                        <strong style={{ color: trueBalance > 0 ? "#ef4444" : "#10b981" }}>
                          ${trueBalance.toFixed(2)}
                        </strong>
                      );
                    })()}
                  </div>
                  <div style={styles.td}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => navigate(`/invoice?invoiceId=${invoice.id}&projectId=${id}`)}
                        style={styles.estimateButton}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => window.open(`/invoice/view?invoiceId=${invoice.id}`, '_blank')}
                        style={{...styles.estimateButton, backgroundColor: "#3b82f6"}}
                      >
                        👁️ View
                      </button>
                      {(() => {
                        const trueBalance = Math.max(0, (invoice.total || 0) - (invoice.amount_paid || 0) - (invoice.deposit_received || 0));
                        return trueBalance > 0 ? (
                          <button
                            onClick={() => openInvoicePaymentModal(invoice)}
                            style={{...styles.estimateButton, backgroundColor: "#10b981"}}
                          >
                            💰 Pay
                          </button>
                        ) : null;
                      })()}
                      {invoice.status === 'paid' && (
                        <button
                          onClick={() => navigate(`/invoice?invoiceId=${invoice.id}`)}
                          style={{...styles.estimateButton, backgroundColor: "#8b5cf6"}}
                        >
                          📧 Receipt
                        </button>
                      )}
                      {/* ⭐ Set as Primary Invoice */}
                      <button
                        onClick={() => handleSetActiveInvoice(invoice)}
                        title="Set this invoice as primary — updates Contract Value"
                        style={{
                          ...styles.estimateButton,
                          backgroundColor: project.active_invoice_id === invoice.id ? '#f59e0b' : '#6b7280',
                          border: project.active_invoice_id === invoice.id ? '2px solid #d97706' : '2px solid transparent',
                        }}
                      >
                        {project.active_invoice_id === invoice.id ? '⭐ Primary' : '☆ Set Primary'}
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`Delete invoice ${invoice.invoice_number}? This cannot be undone.`)) {
                            try {
                              // Revert any deposits linked to this invoice back to "received"
                              await supabase
                                .from("project_deposits")
                                .update({ status: "received", invoice_id: null, applied_date: null })
                                .eq("invoice_id", invoice.id);

                              const { error } = await supabase
                                .from("invoices")
                                .delete()
                                .eq("id", invoice.id);
                              
                              if (error) throw error;
                              loadProjectData();
                            } catch (err) {
                              console.error("Error deleting invoice:", err);
                              alert("Failed to delete invoice");
                            }
                          }
                        }}
                        style={{...styles.estimateButton, backgroundColor: "#ef4444"}}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Add Contractor Modal */}
      {showAddContractorModal && (
        <div style={styles.modalOverlay} onClick={() => setShowAddContractorModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Add Contractor from Customer List</h2>
            
            <div style={styles.field}>
              <label style={styles.modalLabel}>Select Customer</label>
              <select
                value={selectedCustomer?.id || ""}
                onChange={(e) => {
                  const customer = customers.find(c => c.id === e.target.value);
                  setSelectedCustomer(customer);
                }}
                style={styles.select}
              >
                <option value="">-- Select a customer --</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.customer}
                  </option>
                ))}
              </select>
            </div>

            {selectedCustomer && (
              <div style={styles.selectedInfo}>
                <div><strong>Company:</strong> {selectedCustomer.customer}</div>
                <div><strong>Email:</strong> {selectedCustomer.email || "N/A"}</div>
                <div><strong>Phone:</strong> {selectedCustomer.phone || "N/A"}</div>
              </div>
            )}

            <div style={styles.modalActions}>
              <button onClick={() => {
                setShowAddContractorModal(false);
                setSelectedCustomer(null);
              }} style={styles.cancelButton}>Cancel</button>
              <button onClick={handleAddContractor} style={styles.submitButton}>
                Add Contractor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proposal Type Modal */}
      {showProposalTypeModal && (
        <div style={styles.modalOverlay} onClick={() => setShowProposalTypeModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Select Proposal Type</h2>
            <p style={{fontSize: 14, color: '#666', marginBottom: 24}}>Choose the type of proposal you want to generate:</p>
            
            <div style={styles.field}>
              <label style={styles.modalLabel}>Proposal Type</label>
              <select
                value={proposalType}
                onChange={(e) => setProposalType(e.target.value)}
                style={styles.select}
              >
                <option value="commercial-public">Commercial Public</option>
                <option value="commercial-private">Commercial Private</option>
                <option value="residential-contractor">Residential Contractor</option>
                <option value="residential-owner">Residential Owner</option>
                <option value="lighting-project">💡 Lighting Project</option>
              </select>
            </div>

            <div style={styles.modalActions}>
              <button onClick={() => {
                setShowProposalTypeModal(false);
              }} style={styles.cancelButton}>Cancel</button>
              <button onClick={() => {
                navigate(`/project/${id}/proposal?estimateId=${selectedEstimateForProposal}&type=${proposalType}`);
              }} style={styles.submitButton}>
                Create Proposal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Billing - Select Proposal Modal */}
      {showProgressBillingModal && proposals[selectedEstimateForProgressBilling] && (
        <div style={styles.modalOverlay} onClick={() => setShowProgressBillingModal(false)}>
          <div style={{...styles.modal, maxWidth: 700}} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>📊 Select Proposal for Progress Billing</h2>
            <p style={{fontSize: 14, color: '#666', marginBottom: 20}}>
              Choose which proposal you want to create a progress invoice from
            </p>
            
            <div style={{maxHeight: 400, overflowY: 'auto', marginBottom: 20}}>
              {proposals[selectedEstimateForProgressBilling].map((proposal) => (
                <div 
                  key={proposal.id} 
                  onClick={() => {
                    // Navigate to progress billing with this proposal
                    navigate(`/project/${id}/progress-billing?proposalId=${proposal.id}`);
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 16,
                    backgroundColor: '#f9fafb',
                    borderRadius: 8,
                    marginBottom: 12,
                    border: '2px solid #e5e7eb',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e0f2fe';
                    e.currentTarget.style.border = '2px solid #3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                    e.currentTarget.style.border = '2px solid #e5e7eb';
                  }}
                >
                  <div style={{flex: 1}}>
                    <div style={{fontWeight: 'bold', fontSize: 16, color: '#111', marginBottom: 4}}>
                      {proposal.contractor_name || 'No Contractor'}
                    </div>
                    <div style={{fontSize: 13, color: '#666', marginBottom: 2}}>
                      {proposal.contractor_email || 'No email'}
                    </div>
                    <div style={{fontSize: 12, color: '#999'}}>
                      Created: {new Date(proposal.created_at).toLocaleDateString()} • 
                      Status: <span style={{textTransform: 'capitalize', fontWeight: '600'}}>{proposal.status}</span>
                    </div>
                  </div>
                  <div style={{textAlign: 'right'}}>
                    <div style={{fontSize: 18, fontWeight: 'bold', color: BRAND.accent}}>
                      ${(proposal.total_amount || 0).toFixed(2)}
                    </div>
                    <div style={{fontSize: 12, color: '#666', marginTop: 4}}>
                      Base: ${(proposal.base_bid_amount || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div style={styles.modalActions}>
              <button 
                onClick={() => setShowProgressBillingModal(false)} 
                style={styles.cancelButton}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Proposals Modal */}
      {showProposalsModal && (
        <div style={styles.modalOverlay} onClick={() => setShowProposalsModal(false)}>
          <div style={{...styles.modal, maxWidth: 700}} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>📄 Saved Proposals</h2>
            <p style={{fontSize: 14, color: '#666', marginBottom: 20}}>
              Proposals saved for this estimate
            </p>
            
            <div style={{maxHeight: 400, overflowY: 'auto', marginBottom: 20}}>
              {selectedEstimateProposals.map((proposal) => (
                <div 
                  key={proposal.id} 
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 16,
                    backgroundColor: '#f9fafb',
                    borderRadius: 8,
                    marginBottom: 12,
                    border: '1px solid #e5e7eb',
                    transition: 'all 0.2s',
                    position: 'relative',
                  }}
                >
                  <div 
                    onClick={() => {
                      const projType = project?.project_type || 'commercial-public';
                      navigate(`/project/${id}/proposal?estimateId=${proposal.base_estimate_id}&proposalId=${proposal.id}&type=${projType}`);
                    }}
                    style={{
                      flex: 1,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.parentElement.style.backgroundColor = '#e0f2fe';
                      e.currentTarget.parentElement.style.border = '2px solid #3b82f6';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.parentElement.style.backgroundColor = '#f9fafb';
                      e.currentTarget.parentElement.style.border = '1px solid #e5e7eb';
                    }}
                  >
                    <div style={{flex: 1}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4}}>
                        <span style={{fontWeight: 'bold', fontSize: 16, color: '#111'}}>
                          {proposal.contractor_name || 'No Contractor'}
                        </span>
                        {proposal.status === 'sent' && (
                          <span style={{display: 'inline-flex', alignItems: 'center', gap: 4, backgroundColor: '#d1fae5', color: '#065f46', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: '700'}}>
                            ✅ SENT
                          </span>
                        )}
                      </div>
                      <div style={{fontSize: 13, color: '#666', marginBottom: 2}}>
                        {proposal.contractor_email || 'No email'}
                      </div>
                      <div style={{fontSize: 12, color: '#999'}}>
                        Saved: {new Date(proposal.created_at).toLocaleDateString()} • 
                        Status: <span style={{textTransform: 'capitalize', fontWeight: '600', color: proposal.status === 'sent' ? '#10b981' : '#666'}}>{proposal.status}</span>
                        {proposal.sent_at && <span> • Sent: {new Date(proposal.sent_at).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div style={{textAlign: 'right', marginRight: 12}}>
                      <div style={{fontSize: 18, fontWeight: 'bold', color: BRAND.accent}}>
                        ${(proposal.total_amount || 0).toFixed(2)}
                      </div>
                      <div style={{fontSize: 12, color: '#666', marginTop: 4}}>
                        Base: ${(proposal.base_bid_amount || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/project/${id}/progress-billing?proposalId=${proposal.id}`);
                    }}
                    style={{
                      padding: '4px 12px',
                      backgroundColor: '#3b82f6',
                      border: 'none',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: '600',
                      borderRadius: 4,
                      marginRight: 8,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#2563eb";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#3b82f6";
                    }}
                  >
                
                
                
                
                
                
                
                
                
                
                
                    📊 Progress Invoice
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (confirm(`Convert proposal for ${proposal.contractor_name} to invoice?`)) {
                        try {
                          // Get the next invoice number
                          const { data: existingInvoices } = await supabase
                            .from('invoices')
                            .select('invoice_number')
                            .order('created_at', { ascending: false })
                            .limit(1);
                          
                          let nextNumber = 1001;
                          if (existingInvoices && existingInvoices.length > 0) {
                            const lastNum = parseInt(existingInvoices[0].invoice_number) || 1000;
                            nextNumber = lastNum + 1;
                          }
                          
                          // Create the invoice
                          const { data: newInvoice, error: invoiceError } = await supabase
                            .from('invoices')
                            .insert([{
                              invoice_number: nextNumber.toString(),
                              project_name: project.name,
                              customer_name: proposal.contractor_name,
                              invoice_date: new Date().toISOString().split('T')[0],
                              subtotal: proposal.total_amount,
                              total: proposal.total_amount,
                              balance_due: proposal.total_amount,
                              status: 'draft',
                              notes: `Created from proposal. Base bid: $${proposal.base_bid_amount}`,
                              created_by: user.id
                            }])
                            .select()
                            .single();
                          
                          if (invoiceError) throw invoiceError;
                          
                          // Create invoice items (base bid + selected alternates)
                          const items = [];
                          
                          // Add base bid as line item
                          items.push({
                            invoice_id: newInvoice.id,
                            description: 'Base Bid',
                            quantity: 1,
                            unit_price: proposal.base_bid_amount,
                            total: proposal.base_bid_amount
                          });
                          
                          // Add selected alternates
                          if (proposal.selected_alternates && proposal.selected_alternates.length > 0) {
                            const { data: alternateDetails } = await supabase
                              .from('estimates')
                              .select('alternate_title, total')
                              .in('id', proposal.selected_alternates);
                            
                            if (alternateDetails) {
                              alternateDetails.forEach(alt => {
                                items.push({
                                  invoice_id: newInvoice.id,
                                  description: alt.alternate_title || 'Alternate',
                                  quantity: 1,
                                  unit_price: alt.total,
                                  total: alt.total
                                });
                              });
                            }
                          }
                          
                          // Insert all invoice items
                          const { error: itemsError } = await supabase
                            .from('invoice_items')
                            .insert(items);
                          
                          if (itemsError) throw itemsError;
                          
                          alert(`Invoice #${nextNumber} created successfully!`);
                          loadProjectData();
                          setShowProposalsModal(false);
                        } catch (err) {
                          console.error("Error converting to invoice:", err);
                          alert("Failed to convert proposal to invoice");
                        }
                      }
                    }}
                    style={{
                      padding: '4px 12px',
                      backgroundColor: '#10b981',
                      border: 'none',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: '600',
                      borderRadius: 4,
                      marginRight: 8,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#059669";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#10b981";
                    }}
                  >
                    📄 Invoice
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (confirm(`Delete proposal for ${proposal.contractor_name}?`)) {
                        try {
                          // Delete proposal alternates first
                          await supabase
                            .from('proposal_alternates')
                            .delete()
                            .eq('proposal_id', proposal.id);
                          
                          // Delete proposal
                          const { error } = await supabase
                            .from('proposals')
                            .delete()
                            .eq('id', proposal.id);
                          
                          if (error) throw error;
                          
                          // Refresh the proposals list
                          setSelectedEstimateProposals(prev => prev.filter(p => p.id !== proposal.id));
                          
                          // Also update the main proposals state
                          loadProjectData();
                        } catch (err) {
                          console.error("Error deleting proposal:", err);
                          alert("Failed to delete proposal");
                        }
                      }
                    }}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontSize: 18,
                      fontWeight: 'bold',
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#fee2e2';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            
            <div style={styles.modalActions}>
              <button 
                onClick={() => setShowProposalsModal(false)} 
                style={styles.submitButton}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}{/* Winning Proposal Selection Modal */}
{showWinningProposalModal && (
  <div style={styles.modalOverlay} onClick={() => setShowWinningProposalModal(false)}>
    <div style={{...styles.modal, maxWidth: 700}} onClick={(e) => e.stopPropagation()}>
      <h2 style={styles.modalTitle}>🏆 Select Winning Proposal</h2>
      <p style={{fontSize: 14, color: '#666', marginBottom: 20}}>
        Which contractor/proposal won this job? This will set the project budget and contractor.
      </p>
      
      <div style={{maxHeight: 400, overflowY: 'auto', marginBottom: 20}}>
        {allProjectProposals.map((proposal) => (
          <div 
            key={proposal.id}
            onClick={() => setSelectedWinningProposal(proposal)}
            style={{
              padding: 16,
              backgroundColor: selectedWinningProposal?.id === proposal.id ? '#e0f2fe' : '#f9fafb',
              borderRadius: 8,
              marginBottom: 12,
              border: selectedWinningProposal?.id === proposal.id ? '2px solid #3b82f6' : '1px solid #e5e7eb',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div style={{flex: 1}}>
                <div style={{fontWeight: 'bold', fontSize: 16, color: '#111', marginBottom: 4}}>
                  {proposal.contractor_name || 'No Contractor'}
                </div>
                <div style={{fontSize: 13, color: '#666'}}>
                  {proposal.contractor_email || 'No email'}
                </div>
              </div>
              <div style={{textAlign: 'right'}}>
                <div style={{fontSize: 20, fontWeight: 'bold', color: BRAND.accent}}>
                  ${(proposal.total_amount || 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div style={styles.modalActions}>
        <button 
          onClick={() => {
            setShowWinningProposalModal(false);
            setSelectedWinningProposal(null);
          }} 
          style={styles.cancelButton}
        >
          Cancel
        </button>
        <button 
          onClick={async () => {
            if (!selectedWinningProposal) {
              alert("Please select a proposal");
              return;
            }
            
            try {
              // Get the base estimate to calculate internal cost (budget)
              const { data: baseEstimate, error: estimateError } = await supabase
                .from("estimates")
                .select("*")
                .eq("id", selectedWinningProposal.base_estimate_id)
                .single();
              
              if (estimateError) throw estimateError;
              
              // Calculate internal budget (costs without markup)
              const materialsCost = baseEstimate.material_subtotal || 0;
              const laborCost = (baseEstimate.labor_hours_total || 0) * (baseEstimate.labor_cost_rate || 25);
              const feesCost = (baseEstimate.mobilization || 0) + 
                              (baseEstimate.room_board || 0) + 
                              (baseEstimate.equipment_rental || 0) + 
                              (baseEstimate.material_storage || 0) + 
                              (baseEstimate.misc_expenses || 0) + 
                              (baseEstimate.permit_fees || 0);
              const packagesCost = (baseEstimate.lighting_package_cost || 0) + 
                                  (baseEstimate.switchgear_package_cost || 0) + 
                                  (baseEstimate.special_systems_cost || 0) + 
                                  (baseEstimate.subcontractors_cost || 0);
              
              let internalBudget = materialsCost + laborCost + feesCost + packagesCost;
              
              // If estimate-level cost fields are empty, calculate from estimate items
              if (internalBudget === 0) {
                const { data: estItems } = await supabase
                  .from("estimate_items")
                  .select("material_cost, labor_cost, line_total, quantity, unit_price")
                  .eq("estimate_id", selectedWinningProposal.base_estimate_id);
                
                if (estItems && estItems.length > 0) {
                  internalBudget = estItems.reduce((sum, item) => {
                    // Use material_cost + labor_cost if available, otherwise use line_total as cost
                    const itemCost = (item.material_cost || 0) + (item.labor_cost || 0);
                    return sum + (itemCost > 0 ? itemCost : (item.line_total || (item.quantity || 0) * (item.unit_price || 0)));
                  }, 0);
                }
                
                // If still 0, use estimate subtotal (cost before markup) or half the total as rough estimate
                if (internalBudget === 0) {
                  internalBudget = baseEstimate.subtotal || baseEstimate.cost_subtotal || (baseEstimate.total * 0.5) || 0;
                }
              }
              
              const { error } = await supabase
                .from("projects")
                .update({
                  status: 'active',
                  budget: internalBudget, // Use internal cost as budget
                  active_worth: selectedWinningProposal.total_amount, // What customer will pay
                  contractor: selectedWinningProposal.contractor_name,
                  winning_proposal_id: selectedWinningProposal.id
                })
                .eq("id", id);
              
              if (error) throw error;
              
              setProject({
                ...project,
                status: 'active',
                budget: internalBudget,
                active_worth: selectedWinningProposal.total_amount,
                contractor: selectedWinningProposal.contractor_name,
                winning_proposal_id: selectedWinningProposal.id
              });
              
              setShowWinningProposalModal(false);
              setSelectedWinningProposal(null);
              
              alert(`Project activated!\nActive Worth: $${selectedWinningProposal.total_amount.toFixed(2)}\nBudget (Cost): $${internalBudget.toFixed(2)}`);
            } catch (err) {
              console.error("Error setting winning proposal:", err);
              alert("Failed to set winning proposal");
            }
          }}
          style={styles.submitButton}
          disabled={!selectedWinningProposal}
        >
          Confirm Winner
        </button>
      </div>
    </div>
  </div>
)}

      {/* Edit Project Modal */}
      {showEditProjectModal && (
        <div style={{...styles.modalOverlay, alignItems: 'flex-start', overflowY: 'auto', padding: '40px 0'}} onClick={() => setShowEditProjectModal(false)}>
          <div style={{...styles.modal, maxWidth: 600, margin: '0 auto', maxHeight: 'none'}} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>✏️ Edit Project Details</h2>
            
            <div style={styles.field}>
              <label style={styles.modalLabel}>Project Name *</label>
              <input
                type="text"
                value={editProjectForm.name}
                onChange={(e) => setEditProjectForm({...editProjectForm, name: e.target.value})}
                style={{...styles.select, padding: '10px'}}
                placeholder="Enter project name"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.modalLabel}>Customer</label>
              <input
                type="text"
                list="customer-list-edit"
                value={editProjectForm.customer}
                onChange={(e) => setEditProjectForm({...editProjectForm, customer: e.target.value})}
                style={{...styles.select, padding: '10px'}}
                placeholder="Start typing to search customers..."
              />
              <datalist id="customer-list-edit">
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.customer} />
                ))}
              </datalist>
            </div>

            <div style={styles.field}>
              <label style={styles.modalLabel}>Contractor</label>
              <input
                type="text"
                list="contractor-list-edit"
                value={editProjectForm.contractor}
                onChange={(e) => setEditProjectForm({...editProjectForm, contractor: e.target.value})}
                style={{...styles.select, padding: '10px'}}
                placeholder="Start typing to search customers..."
              />
              <datalist id="contractor-list-edit">
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.customer} />
                ))}
              </datalist>
            </div>

            <div style={styles.field}>
              <label style={styles.modalLabel}>Address</label>
              <input
                type="text"
                value={editProjectForm.address}
                onChange={(e) => setEditProjectForm({...editProjectForm, address: e.target.value})}
                style={{...styles.select, padding: '10px'}}
                placeholder="Project address"
              />
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16}}>
              <div style={styles.field}>
                <label style={styles.modalLabel}>Start Date</label>
                <input
                  type="date"
                  value={editProjectForm.start_date}
                  onChange={(e) => setEditProjectForm({...editProjectForm, start_date: e.target.value})}
                  style={{...styles.select, padding: '10px'}}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.modalLabel}>End Date</label>
                <input
                  type="date"
                  value={editProjectForm.end_date}
                  onChange={(e) => setEditProjectForm({...editProjectForm, end_date: e.target.value})}
                  style={{...styles.select, padding: '10px'}}
                />
              </div>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16}}>
              <div style={styles.field}>
                <label style={styles.modalLabel}>Labor Rate ($/hr)</label>
                <input
                  type="number"
                  value={editProjectForm.labor_rate}
                  onChange={(e) => setEditProjectForm({...editProjectForm, labor_rate: e.target.value})}
                  style={{...styles.select, padding: '10px'}}
                  min="0"
                  step="0.01"
                />
              </div>

              <div style={styles.field}>
                <label style={styles.modalLabel}>% Complete</label>
                <input
                  type="number"
                  value={editProjectForm.percent_complete}
                  onChange={(e) => setEditProjectForm({...editProjectForm, percent_complete: e.target.value})}
                  style={{...styles.select, padding: '10px'}}
                  min="0"
                  max="100"
                />
              </div>
            </div>

            <div style={styles.field}>
              <label style={styles.modalLabel}>Project Type</label>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4}}>
                {PROJECT_TYPES.map((type) => {
                  const isSelected = editProjectForm.project_type === type.value;
                  return (
                    <div
                      key={type.value}
                      onClick={() => setEditProjectForm({
                        ...editProjectForm,
                        project_type: type.value,
                        // Auto-enable OT Bank when Lighting Project is selected
                        ot_bank_enabled: type.ot_bank_auto ? true : editProjectForm.ot_bank_enabled,
                      })}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '12px 14px',
                        border: isSelected ? `2px solid ${type.color}` : '2px solid #e5e7eb',
                        borderRadius: 10,
                        cursor: 'pointer',
                        backgroundColor: isSelected ? type.color + '12' : '#fafafa',
                        transition: 'all 0.15s',
                        boxShadow: isSelected ? `0 0 0 3px ${type.color}22` : 'none',
                      }}
                    >
                      <span style={{fontSize: 26, lineHeight: 1, flexShrink: 0}}>{type.icon}</span>
                      <div>
                        <div style={{
                          fontSize: 13,
                          fontWeight: '700',
                          color: isSelected ? type.color : '#374151',
                          lineHeight: 1.2,
                        }}>
                          {type.label}
                        </div>
                        {isSelected && (
                          <div style={{fontSize: 11, color: type.color, fontWeight: '600', marginTop: 2}}>
                            ✓ Selected
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{fontSize: 11, color: '#888', marginTop: 8}}>
                This type will be used for all estimates, proposals, and invoices for this project
              </div>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16}}>
              <div style={styles.field}>
                <label style={styles.modalLabel}>🏠 Living Sq Ft</label>
                <input type="number" value={editProjectForm.sq_ft_living}
                  onChange={(e) => setEditProjectForm({...editProjectForm, sq_ft_living: e.target.value})}
                  style={{...styles.select, padding: '10px'}} placeholder="e.g., 1800" min="0" step="1" />
              </div>
              <div style={styles.field}>
                <label style={styles.modalLabel}>📐 Total Sq Ft</label>
                <input type="number" value={editProjectForm.sq_ft}
                  onChange={(e) => setEditProjectForm({...editProjectForm, sq_ft: e.target.value})}
                  style={{...styles.select, padding: '10px'}} placeholder="e.g., 2500" min="0" step="1" />
              </div>
            </div>

            {/* ── OT Bank Toggle (Edit Modal) ── */}
            <div
              onClick={() => setEditProjectForm(prev => ({ ...prev, ot_bank_enabled: !prev.ot_bank_enabled }))}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "16px 20px",
                borderRadius: 12,
                border: `2px solid ${editProjectForm.ot_bank_enabled ? "#f59e0b" : "#e5e7eb"}`,
                backgroundColor: editProjectForm.ot_bank_enabled ? "#fffbeb" : "#f9fafb",
                cursor: "pointer",
                marginBottom: 20,
                transition: "all 0.2s",
              }}
            >
              <div style={{
                width: 48, height: 28, borderRadius: 14,
                backgroundColor: editProjectForm.ot_bank_enabled ? "#f59e0b" : "#d1d5db",
                position: "relative", flexShrink: 0, transition: "background-color 0.2s",
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", backgroundColor: "#fff",
                  position: "absolute", top: 3,
                  left: editProjectForm.ot_bank_enabled ? 23 : 3,
                  transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>🏦 OT Bank Job</div>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
                  Bank overtime hours (over 40/wk) and pay out at 1.5× when project is collected.
                </div>
              </div>
            </div>

            <div style={styles.field}>
              <label style={styles.modalLabel}>Description</label>
              <textarea
                value={editProjectForm.description}
                onChange={(e) => setEditProjectForm({...editProjectForm, description: e.target.value})}
                style={{...styles.select, padding: '10px', minHeight: 100, resize: 'vertical'}}
                placeholder="Project description..."
              />
            </div>

            <div style={styles.modalActions}>
              <button 
                onClick={() => setShowEditProjectModal(false)} 
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveProjectEdits}
                style={styles.submitButton}
              >
                💾 Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Order Modal */}
      {showChangeOrderModal && (
        <div style={styles.modalOverlay} onClick={() => setShowChangeOrderModal(false)}>
          <div style={{...styles.modal, maxWidth: 600}} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>🔄 Create Change Order</h2>
            <p style={{fontSize: 14, color: '#666', marginBottom: 20}}>
              Enter the details for this change order. A unique CO number will be generated automatically.
            </p>
            
            <div style={styles.field}>
              <label style={styles.modalLabel}>Title *</label>
              <input
                type="text"
                value={changeOrderForm.title}
                onChange={(e) => setChangeOrderForm({...changeOrderForm, title: e.target.value})}
                style={{...styles.select, padding: '10px'}}
                placeholder="e.g., Additional Outlets in Kitchen"
                autoFocus
              />
            </div>

            <div style={styles.field}>
              <label style={styles.modalLabel}>Description</label>
              <textarea
                value={changeOrderForm.description}
                onChange={(e) => setChangeOrderForm({...changeOrderForm, description: e.target.value})}
                style={{...styles.select, padding: '10px', minHeight: 120, resize: 'vertical'}}
                placeholder="Describe what changed and why..."
              />
            </div>

            <div style={{padding: 12, backgroundColor: '#f0f9ff', borderRadius: 6, marginBottom: 20}}>
              <div style={{fontSize: 13, color: '#666', marginBottom: 4}}>
                A unique CO number will be assigned automatically (e.g., CO-01, CO-02, etc.)
              </div>
            </div>

            <div style={styles.modalActions}>
              <button 
                onClick={() => {
                  setShowChangeOrderModal(false);
                  setChangeOrderForm({ title: '', description: '', change_order_number: '' });
                }} 
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateChangeOrder}
                style={styles.submitButton}
                disabled={!changeOrderForm.title.trim()}
              >
                🔄 Create & Start Estimating
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Type Selection Modal */}
      {showInvoiceTypeModal && (
        <div style={styles.modalOverlay} onClick={() => setShowInvoiceTypeModal(false)}>
          <div style={{...styles.modal, maxWidth: 500}} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>📄 Create New Invoice</h2>
            <p style={{fontSize: 14, color: '#666', marginBottom: 24}}>What type of invoice do you want to create?</p>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
              <button
                onClick={() => {
                  setShowInvoiceTypeModal(false);
                  handleCreateInvoice();
                }}
                style={{padding: 20, backgroundColor: '#f9fafb', border: '2px solid #e5e7eb', borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s'}}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.backgroundColor = '#e0f2fe'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = '#f9fafb'; }}
              >
                <div style={{fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 4}}>📋 Regular Invoice</div>
                <div style={{fontSize: 13, color: '#666'}}>Create a blank invoice and add line items manually</div>
              </button>

              <button
                onClick={async () => {
                  setShowInvoiceTypeModal(false);
                  // Look up customer name and email from project
                  const customerName = project.contractor || project.customer || "";
                  let customerEmail = "";
                  if (customerName) {
                    const { data: customerData } = await supabase
                      .from('customers')
                      .select('email')
                      .ilike('customer', customerName)
                      .limit(1);
                    if (customerData?.[0]?.email) customerEmail = customerData[0].email;
                  }
                  const params = new URLSearchParams();
                  params.set('projectId', id);
                  params.set('projectName', project.name);
                  if (customerName) params.set('customerName', customerName);
                  if (customerEmail) params.set('customerEmail', customerEmail);
                  navigate(`/invoice/quick?${params.toString()}`);
                }}
                style={{padding: 20, backgroundColor: '#f9fafb', border: '2px solid #e5e7eb', borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s'}}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.backgroundColor = '#f5f3ff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = '#f9fafb'; }}
              >
                <div style={{fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 4}}>⚡ Quick Invoice</div>
                <div style={{fontSize: 13, color: '#666'}}>Simple invoice with custom line items — customer name &amp; email auto-filled from project</div>
              </button>

              <button
                onClick={() => {
                  setShowInvoiceTypeModal(false);
                  // Check for unapplied deposits before navigating to T&M invoice
                  const availableDeposits = deposits.filter(d => d.status === 'received' || d.status === 'deposited');
                  if (availableDeposits.length > 0) {
                    setPendingInvoiceForDeposit({ id: null, invoice_number: 'T&M', tmProjectId: id });
                    setSelectedDepositsToApply(availableDeposits.map(d => d.id));
                    setShowApplyDepositsModal(true);
                  } else {
                    navigate(`/invoice?projectId=${id}&type=tm`);
                  }
                }}
                style={{padding: 20, backgroundColor: '#f9fafb', border: '2px solid #e5e7eb', borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s'}}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#f97316'; e.currentTarget.style.backgroundColor = '#fff7ed'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = '#f9fafb'; }}
              >
                <div style={{fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 4}}>⏱️ Time & Materials Invoice</div>
                <div style={{fontSize: 13, color: '#666'}}>Pull in unbilled labor hours and material expenses from this project</div>
              </button>
            </div>

            <div style={{...styles.modalActions, marginTop: 24}}>
              <button onClick={() => setShowInvoiceTypeModal(false)} style={styles.cancelButton}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Deposit Modal */}
      {showAddDepositModal && (
        <div style={styles.modalOverlay} onClick={() => setShowAddDepositModal(false)}>
          <div style={{...styles.modal, maxWidth: 500}} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>💰 Record Deposit</h2>
            <p style={{fontSize: 14, color: '#666', marginBottom: 20}}>
              Record a deposit payment received from the customer.
            </p>

            <div style={styles.field}>
              <label style={styles.modalLabel}>Deposit Amount *</label>
              <input
                type="number"
                value={depositForm.deposit_amount}
                onChange={(e) => setDepositForm({...depositForm, deposit_amount: e.target.value})}
                style={{...styles.select, padding: '10px'}}
                placeholder="0.00"
                min="0"
                step="0.01"
                autoFocus
              />
            </div>

            <div style={styles.field}>
              <label style={styles.modalLabel}>Date Received</label>
              <input
                type="date"
                value={depositForm.deposit_date}
                onChange={(e) => setDepositForm({...depositForm, deposit_date: e.target.value})}
                style={{...styles.select, padding: '10px'}}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.modalLabel}>Reference / Notes</label>
              <input
                type="text"
                value={depositForm.reference_notes}
                onChange={(e) => setDepositForm({...depositForm, reference_notes: e.target.value})}
                style={{...styles.select, padding: '10px'}}
                placeholder="e.g., Check #1234, Wire transfer, etc."
              />
            </div>

            <div style={styles.modalActions}>
              <button
                onClick={() => {
                  setShowAddDepositModal(false);
                  setDepositForm({ deposit_amount: '', deposit_date: new Date().toISOString().split('T')[0], reference_notes: '' });
                }}
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const amount = parseFloat(depositForm.deposit_amount);
                  if (!amount || amount <= 0) {
                    alert('Please enter a valid deposit amount');
                    return;
                  }
                  try {
                    const { error } = await supabase
                      .from('project_deposits')
                      .insert([{
                        project_id: id,
                        deposit_amount: amount,
                        deposit_date: depositForm.deposit_date,
                        reference_notes: depositForm.reference_notes || null,
                        status: 'received',
                        created_by: user.id,
                      }]);
                    if (error) throw error;
                    setShowAddDepositModal(false);
                    setDepositForm({ deposit_amount: '', deposit_date: new Date().toISOString().split('T')[0], reference_notes: '' });
                    loadProjectData();
                  } catch (err) {
                    console.error('Error saving deposit:', err);
                    alert('Failed to save deposit: ' + err.message);
                  }
                }}
                style={styles.submitButton}
              >
                💰 Save Deposit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply Deposits to Invoice Modal */}
      {showApplyDepositsModal && pendingInvoiceForDeposit && (
        <div style={styles.modalOverlay} onClick={() => {}}>
          <div style={{...styles.modal, maxWidth: 550}} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>💰 Apply Deposits to Invoice?</h2>
            <p style={{fontSize: 14, color: '#666', marginBottom: 20}}>
              This project has unapplied deposits. Select which ones to apply to Invoice #{pendingInvoiceForDeposit.invoice_number}:
            </p>

            <div style={{maxHeight: 300, overflowY: 'auto', marginBottom: 20}}>
              {deposits.filter(d => d.status === 'received' || d.status === 'deposited').map((dep) => (
                <label key={dep.id} style={{display: 'flex', alignItems: 'center', gap: 12, padding: 12, backgroundColor: selectedDepositsToApply.includes(dep.id) ? '#f0fdf4' : '#f9fafb', border: selectedDepositsToApply.includes(dep.id) ? '2px solid #10b981' : '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8, cursor: 'pointer'}}>
                  <input
                    type="checkbox"
                    checked={selectedDepositsToApply.includes(dep.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedDepositsToApply([...selectedDepositsToApply, dep.id]);
                      } else {
                        setSelectedDepositsToApply(selectedDepositsToApply.filter(id => id !== dep.id));
                      }
                    }}
                    style={{width: 20, height: 20}}
                  />
                  <div style={{flex: 1}}>
                    <div style={{fontSize: 16, fontWeight: 'bold', color: '#111'}}>${(dep.deposit_amount || 0).toFixed(2)}</div>
                    <div style={{fontSize: 12, color: '#666'}}>{formatDate(dep.deposit_date)}{dep.reference_notes && ` • ${dep.reference_notes}`}</div>
                  </div>
                </label>
              ))}
            </div>

            {selectedDepositsToApply.length > 0 && (
              <div style={{padding: 12, backgroundColor: '#f0fdf4', borderRadius: 6, marginBottom: 20}}>
                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                  <span style={{fontWeight: '600', color: '#111'}}>Total to Apply:</span>
                  <span style={{fontWeight: 'bold', fontSize: 18, color: '#10b981'}}>
                    ${deposits.filter(d => selectedDepositsToApply.includes(d.id)).reduce((sum, d) => sum + (d.deposit_amount || 0), 0).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <div style={styles.modalActions}>
              <button
                onClick={() => {
                  // Skip - navigate without applying
                  const inv = pendingInvoiceForDeposit;
                  setShowApplyDepositsModal(false);
                  setPendingInvoiceForDeposit(null);
                  if (inv.tmProjectId) {
                    navigate(`/invoice?projectId=${inv.tmProjectId}&type=tm`);
                  } else if (inv.changeOrderId) {
                    navigate(`/invoice?invoiceId=${inv.id}&coId=${inv.changeOrderId}&projectId=${id}`);
                  } else {
                    navigate(`/invoice?invoiceId=${inv.id}&projectId=${id}`);
                  }
                }}
                style={styles.cancelButton}
              >
                Skip
              </button>
              <button
                onClick={async () => {
                  try {
                    const selectedDeps = deposits.filter(d => selectedDepositsToApply.includes(d.id));
                    const totalDeposit = selectedDeps.reduce((sum, d) => sum + (d.deposit_amount || 0), 0);

                    // Update invoice with deposit_received
                    await supabase.from('invoices').update({ deposit_received: totalDeposit }).eq('id', pendingInvoiceForDeposit.id);

                    // Mark deposits as applied
                    for (const dep of selectedDeps) {
                      await supabase.from('project_deposits').update({
                        status: 'applied',
                        invoice_id: pendingInvoiceForDeposit.id,
                        applied_date: new Date().toISOString(),
                      }).eq('id', dep.id);
                    }

                    const inv = pendingInvoiceForDeposit;
                    setShowApplyDepositsModal(false);
                    setPendingInvoiceForDeposit(null);
                    if (inv.tmProjectId) {
                      navigate(`/invoice?projectId=${inv.tmProjectId}&type=tm&depositApplied=${totalDeposit}`);
                    } else if (inv.changeOrderId) {
                      navigate(`/invoice?invoiceId=${inv.id}&coId=${inv.changeOrderId}&projectId=${id}`);
                    } else {
                      navigate(`/invoice?invoiceId=${inv.id}&projectId=${id}`);
                    }
                  } catch (err) {
                    console.error('Error applying deposits:', err);
                    alert('Failed to apply deposits: ' + err.message);
                  }
                }}
                style={styles.submitButton}
                disabled={selectedDepositsToApply.length === 0}
              >
                ✅ Apply & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reports Modal */}
      {showReportsModal && (
        <div style={styles.modalOverlay} onClick={() => setShowReportsModal(false)}>
          <div style={{...styles.modal, maxWidth: 520}} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>📊 Project Reports</h2>
            <p style={{fontSize: 14, color: '#666', marginBottom: 20}}>Choose a report to view or download.</p>
            <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>

              <button
                onClick={() => { setShowReportsModal(false); navigate(`/project/${id}/statement`); }}
                style={styles.toolButton}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fff7ed'; e.currentTarget.style.borderColor = '#f97316'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; e.currentTarget.style.borderColor = '#e5e7eb'; }}>
                <span style={styles.toolButtonIcon}>📑</span>
                <div>
                  <div style={styles.toolButtonTitle}>Account Statement</div>
                  <div style={styles.toolButtonDesc}>Full project account statement with all invoices and payments</div>
                </div>
                <span style={styles.toolButtonArrow}>→</span>
              </button>

              <button
                onClick={() => { setShowReportsModal(false); generateCostReport(); }}
                style={styles.toolButton}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fff7ed'; e.currentTarget.style.borderColor = '#f97316'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; e.currentTarget.style.borderColor = '#e5e7eb'; }}>
                <span style={styles.toolButtonIcon}>💰</span>
                <div>
                  <div style={styles.toolButtonTitle}>Cost Report</div>
                  <div style={styles.toolButtonDesc}>Labor + material breakdown, budget vs actual</div>
                </div>
                <span style={styles.toolButtonArrow}>↓ PDF</span>
              </button>

              <button
                onClick={() => { setShowReportsModal(false); generateCostVsPriceReport(); }}
                style={styles.toolButton}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f0fdf4'; e.currentTarget.style.borderColor = '#10b981'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; e.currentTarget.style.borderColor = '#e5e7eb'; }}>
                <span style={styles.toolButtonIcon}>📊</span>
                <div>
                  <div style={styles.toolButtonTitle}>Cost vs. Price Report</div>
                  <div style={styles.toolButtonDesc}>Profit margin, markup, billing progress</div>
                </div>
                <span style={styles.toolButtonArrow}>↓ PDF</span>
              </button>

              <button
                onClick={() => { setShowReportsModal(false); generateLaborReport(); }}
                style={styles.toolButton}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; e.currentTarget.style.borderColor = '#3b82f6'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; e.currentTarget.style.borderColor = '#e5e7eb'; }}>
                <span style={styles.toolButtonIcon}>👷</span>
                <div>
                  <div style={styles.toolButtonTitle}>Labor Report</div>
                  <div style={styles.toolButtonDesc}>All time entries by employee with hours & cost</div>
                </div>
                <span style={styles.toolButtonArrow}>↓ PDF</span>
              </button>

              <button
                onClick={() => {
                  // Pre-check all available categories
                  const cats = [...new Set(projectExpenses.map(e => e.category).filter(Boolean))].sort();
                  setMaterialReportCategories(cats.length > 0 ? cats : ['material']);
                  setShowReportsModal(false);
                  setShowMaterialFilterModal(true);
                }}
                style={styles.toolButton}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f5f3ff'; e.currentTarget.style.borderColor = '#8b5cf6'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; e.currentTarget.style.borderColor = '#e5e7eb'; }}>
                <span style={styles.toolButtonIcon}>📦</span>
                <div>
                  <div style={styles.toolButtonTitle}>Material Report</div>
                  <div style={styles.toolButtonDesc}>Choose which expense categories to include in the PDF</div>
                </div>
                <span style={styles.toolButtonArrow}>↓ PDF</span>
              </button>

            </div>
            <div style={{...styles.modalActions, marginTop: 20}}>
              <button onClick={() => setShowReportsModal(false)} style={styles.cancelButton}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Material Report Filter Modal ─────────────────────────────────── */}
      {showMaterialFilterModal && (
        <div style={styles.modalOverlay} onClick={() => setShowMaterialFilterModal(false)}>
          <div style={{...styles.modal, maxWidth: 500}} onClick={(e) => e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 6}}>
              <h2 style={{...styles.modalTitle, marginBottom: 0}}>📦 Report Filter</h2>
              <button onClick={() => setShowMaterialFilterModal(false)} style={{background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#666'}}>×</button>
            </div>
            <p style={{fontSize: 14, color: '#666', marginBottom: 20}}>Choose what to include in the PDF report:</p>

            {/* ── Include Labor toggle ── */}
            <div
              onClick={() => setIncludeLaborInMaterialReport(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', marginBottom: 16, borderRadius: 10,
                border: `2px solid ${includeLaborInMaterialReport ? '#0b3ea8' : '#e5e7eb'}`,
                backgroundColor: includeLaborInMaterialReport ? '#e0f0ff' : '#f9fafb',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <div style={{
                width: 42, height: 24, borderRadius: 12, flexShrink: 0, position: 'relative', transition: 'background 0.2s',
                backgroundColor: includeLaborInMaterialReport ? '#0b3ea8' : '#d1d5db',
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', backgroundColor: '#fff',
                  position: 'absolute', top: 3,
                  left: includeLaborInMaterialReport ? 21 : 3,
                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
              <div style={{flex: 1}}>
                <div style={{fontSize: 14, fontWeight: 700, color: '#111'}}>👷 Include Labor Section</div>
                <div style={{fontSize: 12, color: '#666', marginTop: 2}}>
                  {laborHours.toFixed(2)} hrs · ${laborCost.toFixed(2)} · {timeEntries.length} entries
                </div>
              </div>
            </div>

            {/* ── Expense category header + select all/none ── */}
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
              <span style={{fontSize: 14, fontWeight: 700, color: '#111'}}>📦 Expense Categories</span>
              <div style={{display: 'flex', gap: 8}}>
                <button
                  onClick={() => {
                    const allCats = [...new Set(projectExpenses.map(e => e.category).filter(Boolean))].sort();
                    setMaterialReportCategories(allCats);
                  }}
                  style={{padding: '4px 12px', background: '#e0f2fe', border: '1px solid #93c5fd', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#0369a1'}}
                >
                  ✓ All
                </button>
                <button
                  onClick={() => setMaterialReportCategories([])}
                  style={{padding: '4px 12px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#374151'}}
                >
                  ✕ None
                </button>
              </div>
            </div>

            {/* ── Category checkboxes ── */}
            <div style={{maxHeight: 260, overflowY: 'auto', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8}}>
              {[...new Set(projectExpenses.map(e => e.category).filter(Boolean))].sort().map(cat => {
                const catTotal = projectExpenses.filter(e => e.category === cat).reduce((s, e) => s + (e.amount || 0), 0);
                const catCount = projectExpenses.filter(e => e.category === cat).length;
                const isChecked = materialReportCategories.includes(cat);
                return (
                  <div
                    key={cat}
                    onClick={() => {
                      if (isChecked) {
                        setMaterialReportCategories(materialReportCategories.filter(c => c !== cat));
                      } else {
                        setMaterialReportCategories([...materialReportCategories, cat]);
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 8,
                      border: `2px solid ${isChecked ? '#0b3ea8' : '#e5e7eb'}`,
                      backgroundColor: isChecked ? '#e0f0ff' : '#f9fafb',
                      cursor: 'pointer', transition: 'all 0.12s',
                    }}
                  >
                    <div style={{
                      width: 20, height: 20, borderRadius: 4, border: `2px solid ${isChecked ? '#0b3ea8' : '#d1d5db'}`,
                      backgroundColor: isChecked ? '#0b3ea8' : '#fff', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isChecked && <span style={{color: '#fff', fontSize: 13, fontWeight: 800}}>✓</span>}
                    </div>
                    <span style={{flex: 1, fontSize: 14, fontWeight: 600, color: '#111', textTransform: 'capitalize'}}>{cat}</span>
                    <span style={{fontSize: 12, color: '#888', marginRight: 4}}>{catCount} item{catCount !== 1 ? 's' : ''}</span>
                    <span style={{fontSize: 14, fontWeight: 700, color: '#f97316'}}>${catTotal.toFixed(2)}</span>
                  </div>
                );
              })}
              {projectExpenses.length === 0 && (
                <div style={{padding: 20, textAlign: 'center', color: '#999', fontSize: 13, border: '2px dashed #e5e7eb', borderRadius: 8}}>
                  No expenses recorded for this project yet.
                </div>
              )}
            </div>

            {/* ── Summary totals ── */}
            {(materialReportCategories.length > 0 || includeLaborInMaterialReport) && (
              <div style={{padding: 12, backgroundColor: '#f0fdf4', borderRadius: 8, marginBottom: 16, border: '1px solid #d1fae5'}}>
                {includeLaborInMaterialReport && (
                  <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5}}>
                    <span style={{color: '#555'}}>👷 Labor ({laborHours.toFixed(1)} hrs):</span>
                    <span style={{fontWeight: 700, color: '#0b3ea8'}}>${laborCost.toFixed(2)}</span>
                  </div>
                )}
                {materialReportCategories.length > 0 && (
                  <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5}}>
                    <span style={{color: '#555'}}>
                      📦 Expenses ({materialReportCategories.length} {materialReportCategories.length === 1 ? 'category' : 'categories'}):
                    </span>
                    <span style={{fontWeight: 700, color: '#f97316'}}>
                      ${projectExpenses.filter(e => materialReportCategories.includes(e.category)).reduce((s, e) => s + (e.amount || 0), 0).toFixed(2)}
                    </span>
                  </div>
                )}
                {(includeLaborInMaterialReport && materialReportCategories.length > 0) && (
                  <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 14, borderTop: '1px solid #d1fae5', paddingTop: 7, marginTop: 4}}>
                    <span style={{fontWeight: 700, color: '#111'}}>Total in Report:</span>
                    <span style={{fontWeight: 700, color: '#10b981', fontSize: 16}}>
                      ${(laborCost + projectExpenses.filter(e => materialReportCategories.includes(e.category)).reduce((s, e) => s + (e.amount || 0), 0)).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div style={styles.modalActions}>
              <button onClick={() => setShowMaterialFilterModal(false)} style={styles.cancelButton}>Cancel</button>
              <button
                onClick={() => {
                  setShowMaterialFilterModal(false);
                  if (includeLaborInMaterialReport) {
                    // Generate combined labor + expenses PDF
                    generateLaborAndExpensesReport(materialReportCategories);
                  } else {
                    generateMaterialReport(materialReportCategories);
                  }
                }}
                disabled={materialReportCategories.length === 0 && !includeLaborInMaterialReport}
                style={{
                  ...styles.submitButton,
                  opacity: (materialReportCategories.length === 0 && !includeLaborInMaterialReport) ? 0.4 : 1,
                  cursor: (materialReportCategories.length === 0 && !includeLaborInMaterialReport) ? 'not-allowed' : 'pointer',
                }}
              >
                ↓ Generate PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Report Modal */}
      {showAddReportModal && (
        <div style={styles.modalOverlay} onClick={() => { setShowAddReportModal(false); setReportPhotos([]); }}>
          <div style={{...styles.modal, maxWidth: 700, maxHeight: '90vh', overflowY: 'auto'}} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>📝 Create Report</h2>
            <p style={{fontSize: 14, color: '#666', marginBottom: 20}}>
              Create a report with photos and captions to document job progress.
            </p>

            <div style={styles.field}>
              <label style={styles.modalLabel}>Report Title *</label>
              <input
                type="text"
                value={reportForm.title}
                onChange={(e) => setReportForm({...reportForm, title: e.target.value})}
                style={{...styles.select, padding: '10px'}}
                placeholder="e.g., Daily Progress Report, Site Inspection Notes"
                autoFocus
              />
            </div>

            <div style={styles.field}>
              <label style={styles.modalLabel}>Date</label>
              <input
                type="date"
                value={reportForm.report_date}
                onChange={(e) => setReportForm({...reportForm, report_date: e.target.value})}
                style={{...styles.select, padding: '10px'}}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.modalLabel}>Report Notes *</label>
              <textarea
                value={reportForm.content}
                onChange={(e) => setReportForm({...reportForm, content: e.target.value})}
                style={{...styles.select, padding: '10px', minHeight: 120, resize: 'vertical'}}
                placeholder="Describe work completed, observations, issues, weather conditions, etc..."
              />
            </div>

            {/* Photos Section */}
            <div style={{marginBottom: 20}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
                <label style={{...styles.modalLabel, marginBottom: 0}}>📸 Report Photos</label>
                <label style={{padding: '6px 14px', backgroundColor: '#3b82f6', color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: '600'}}>
                  + Add Photos
                  <input type="file" accept="image/*" multiple style={{display: 'none'}} onChange={(e) => {
                    const files = Array.from(e.target.files);
                    const newPhotos = files.map(file => ({
                      file,
                      preview: URL.createObjectURL(file),
                      caption: ''
                    }));
                    setReportPhotos([...reportPhotos, ...newPhotos]);
                    e.target.value = '';
                  }} />
                </label>
              </div>

              {reportPhotos.length === 0 && (
                <div style={{padding: 20, border: '2px dashed #d1d5db', borderRadius: 8, textAlign: 'center', color: '#999', fontSize: 14}}>
                  No photos added yet. Click "+ Add Photos" to include images in this report.
                </div>
              )}

              {reportPhotos.length > 0 && (
                <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
                  {reportPhotos.map((photo, idx) => (
                    <div key={idx} style={{display: 'flex', gap: 12, padding: 12, backgroundColor: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb'}}>
                      <img src={photo.preview} alt="" style={{width: 100, height: 100, objectFit: 'cover', borderRadius: 6, flexShrink: 0}} />
                      <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 6}}>
                        <div style={{fontSize: 12, color: '#666'}}>{photo.file.name}</div>
                        <input
                          type="text"
                          value={photo.caption}
                          onChange={(e) => {
                            const updated = [...reportPhotos];
                            updated[idx].caption = e.target.value;
                            setReportPhotos(updated);
                          }}
                          style={{...styles.select, padding: '8px', fontSize: 13}}
                          placeholder="Add a caption for this photo..."
                        />
                      </div>
                      <button
                        onClick={() => {
                          URL.revokeObjectURL(photo.preview);
                          setReportPhotos(reportPhotos.filter((_, i) => i !== idx));
                        }}
                        style={{...styles.contractorDeleteButton, alignSelf: 'flex-start', fontSize: 18}}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.modalActions}>
              <button
                onClick={() => { setShowAddReportModal(false); setReportPhotos([]); }}
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!reportForm.title.trim() || !reportForm.content.trim()) {
                    alert('Please enter a title and content for the report');
                    return;
                  }
                  setSavingReport(true);
                  try {
                    // 1. Create the report
                    const { data: newReport, error: reportError } = await supabase
                      .from('project_reports')
                      .insert([{
                        project_id: id,
                        title: reportForm.title.trim(),
                        content: reportForm.content.trim(),
                        report_date: reportForm.report_date,
                        created_by: user.id,
                      }])
                      .select()
                      .single();
                    if (reportError) throw reportError;

                    // 2. Upload photos and create report_photos records
                    if (reportPhotos.length > 0) {
                      for (let i = 0; i < reportPhotos.length; i++) {
                        const photo = reportPhotos[i];
                        const ext = photo.file.name.split('.').pop();
                        const fileName = `reports/${newReport.id}/${Date.now()}-${i}.${ext}`;
                        
                        // Upload to storage
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
                        
                        // Save report_photos record
                        await supabase.from('report_photos').insert([{
                          report_id: newReport.id,
                          file_name: fileName,
                          file_url: urlData.publicUrl,
                          caption: photo.caption || '',
                          sort_order: i,
                        }]);
                      }
                    }

                    // Cleanup previews
                    reportPhotos.forEach(p => URL.revokeObjectURL(p.preview));
                    setReportPhotos([]);
                    setShowAddReportModal(false);
                    setReportForm({ title: '', content: '', report_date: new Date().toISOString().split('T')[0] });
                    loadProjectData();
                  } catch (err) {
                    console.error('Error saving report:', err);
                    alert('Failed to save report: ' + err.message + '\n\nMake sure you have run the SETUP_REPORTS_PHOTOS.sql in Supabase.');
                  } finally {
                    setSavingReport(false);
                  }
                }}
                style={{...styles.submitButton, opacity: savingReport ? 0.6 : 1}}
                disabled={!reportForm.title.trim() || !reportForm.content.trim() || savingReport}
              >
                {savingReport ? '⏳ Saving...' : `📝 Save Report${reportPhotos.length > 0 ? ` (${reportPhotos.length} photos)` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Alternate Type Selection Modal */}
      {showAlternateTypeModal && (
        <div style={styles.modalOverlay} onClick={() => setShowAlternateTypeModal(false)}>
          <div style={{...styles.modal, maxWidth: 500}} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>🔄 Create Alternate Estimate</h2>
            <p style={{fontSize: 14, color: '#666', marginBottom: 24}}>What type of alternate estimate do you want to create?</p>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
              <button
                onClick={async () => {
                  setShowAlternateTypeModal(false);
                  
                  try {
                    // Get parent estimate to copy settings
                    const { data: parent, error: parentError } = await supabase
                      .from("estimates")
                      .select("*")
                      .eq("id", selectedEstimateForAlternate)
                      .single();
                    
                    if (parentError) throw parentError;
                    
                    // Get next alternate number
                    const { data: existingAlts } = await supabase
                      .from("estimates")
                      .select("alternate_number")
                      .eq("parent_estimate_id", selectedEstimateForAlternate)
                      .order("alternate_number", { ascending: false })
                      .limit(1);
                    
                    const nextAltNumber = existingAlts && existingAlts.length > 0 
                      ? existingAlts[0].alternate_number + 1 
                      : 1;
                    
                    // Create alternate estimate with proper parent-child relationship and default title
                    const { data: newAlt, error: createError } = await supabase
                      .from("estimates")
                      .insert([{
                        company_id: user.id,
                        project_name: parent.project_name,
                        customer_name: parent.customer_name,
                        project_location: parent.project_location,
                        estimate_date: new Date().toISOString().split('T')[0],
                        estimate_number: `${parent.estimate_number}-ALT${nextAltNumber}`,
                        parent_estimate_id: selectedEstimateForAlternate,
                        alternate_number: nextAltNumber,
                        alternate_title: `Alternate ${nextAltNumber}`,
                        default_labor_rate: parent.default_labor_rate,
                        overhead_percent: parent.overhead_percent,
                        profit_percent: parent.profit_percent,
                        status: 'draft'
                      }])
                      .select()
                      .single();
                    
                    if (createError) throw createError;
                    
                    // Navigate to Quick Estimate to edit the new alternate
                    navigate(`/estimate/quick?estimateId=${newAlt.id}&projectId=${id}`);
                  } catch (err) {
                    console.error("Error creating quick alternate:", err);
                    alert("Failed to create alternate: " + err.message);
                  }
                }}
                style={{padding: 20, backgroundColor: '#f9fafb', border: '2px solid #e5e7eb', borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s'}}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.backgroundColor = '#f0fdf4'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = '#f9fafb'; }}
              >
                <div style={{fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 4}}>⚡ Quick Alternate</div>
                <div style={{fontSize: 13, color: '#666'}}>Create a simple alternate with basic line items - perfect for add-on packages</div>
              </button>

              <button
                onClick={() => {
                  setShowAlternateTypeModal(false);
                  // Navigate directly to Full Estimate editor with parent estimate ID
                  navigate(`/project/${id}/estimate?parentEstimateId=${selectedEstimateForAlternate}`);
                }}
                style={{padding: 20, backgroundColor: '#f9fafb', border: '2px solid #e5e7eb', borderRadius: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s'}}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = BRAND.accent; e.currentTarget.style.backgroundColor = '#fff7ed'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = '#f9fafb'; }}
              >
                <div style={{fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 4}}>📊 Full Alternate</div>
                <div style={{fontSize: 13, color: '#666'}}>Create a detailed alternate with full estimating capabilities, assemblies, and materials</div>
              </button>
            </div>

            <div style={{...styles.modalActions, marginTop: 24}}>
              <button onClick={() => setShowAlternateTypeModal(false)} style={styles.cancelButton}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invoice Payment Modal ────────────────────────────────────────── */}
      {showInvoicePayModal && payingInvoice && (
        <div style={styles.modalOverlay} onClick={() => setShowInvoicePayModal(false)}>
          <div style={{...styles.modal, maxWidth: 560}} onClick={(e) => e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 20}}>
              <h2 style={{...styles.modalTitle, marginBottom: 0}}>💰 Record Payment</h2>
              <button onClick={() => setShowInvoicePayModal(false)} style={{background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#666'}}>×</button>
            </div>

            {/* Invoice summary */}
            <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20}}>
              {[
                ['Invoice', `#${payingInvoice.invoice_number}`, '#111'],
                ['Total', `$${(payingInvoice.total||0).toFixed(2)}`, '#111'],
                ['Balance Due', `$${Math.max(0,(payingInvoice.total||0)-(payingInvoice.amount_paid||0)-(payingInvoice.deposit_received||0)).toFixed(2)}`, '#ef4444'],
              ].map(([lbl, val, color]) => (
                <div key={lbl} style={{backgroundColor:'#f9fafb', borderRadius:8, padding:'10px 14px', textAlign:'center'}}>
                  <div style={{fontSize:11, color:'#666', fontWeight:600, textTransform:'uppercase', marginBottom:4}}>{lbl}</div>
                  <div style={{fontSize:16, fontWeight:700, color}}>{val}</div>
                </div>
              ))}
            </div>

            <div style={styles.field}>
              <label style={styles.modalLabel}>Payment Amount *</label>
              <input type="number" value={pdPaymentForm.amount}
                onChange={(e) => setPdPaymentForm({...pdPaymentForm, amount: e.target.value})}
                style={{...styles.select, padding:'10px'}} placeholder="0.00" min="0" step="0.01" autoFocus />
            </div>

            <div style={styles.field}>
              <label style={styles.modalLabel}>Payment Date *</label>
              <input type="date" value={pdPaymentForm.date}
                onChange={(e) => setPdPaymentForm({...pdPaymentForm, date: e.target.value})}
                style={{...styles.select, padding:'10px'}} />
            </div>

            <div style={styles.field}>
              <label style={styles.modalLabel}>Payment Method *</label>
              <select value={pdPaymentForm.method}
                onChange={(e) => setPdPaymentForm({...pdPaymentForm, method: e.target.value})}
                style={{...styles.select, padding:'10px'}}>
                <option value="check">Check</option>
                <option value="cash">Cash</option>
                <option value="venmo">Venmo</option>
                <option value="paypal">PayPal</option>
                <option value="credit_card">Credit Card</option>
                <option value="ach">ACH/Bank Transfer</option>
                <option value="wire">Wire Transfer</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.modalLabel}>Processing Fee (Optional)</label>
              <input type="number" value={pdPaymentForm.processing_fee}
                onChange={(e) => setPdPaymentForm({...pdPaymentForm, processing_fee: e.target.value})}
                style={{...styles.select, padding:'10px'}} placeholder="0.00" min="0" step="0.01" />
              {pdPaymentForm.processing_fee && pdPaymentForm.amount && (
                <div style={{marginTop:6, padding:'8px 12px', backgroundColor:'#f0f9ff', borderRadius:6, fontSize:13, color:'#0369a1', fontWeight:600}}>
                  💰 Net Deposit: ${(parseFloat(pdPaymentForm.amount||0) - parseFloat(pdPaymentForm.processing_fee||0)).toFixed(2)}
                </div>
              )}
            </div>

            <div style={styles.field}>
              <label style={styles.modalLabel}>Deposit To</label>
              <div style={{display:'flex', gap:20, marginBottom:10}}>
                {[['bank','Bank Account'],['holding_account','Holding Account']].map(([val,lbl]) => (
                  <label key={val} style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontWeight:600, color:'#111'}}>
                    <input type="radio" name="pd_deposit_type" value={val}
                      checked={pdPaymentForm.deposit_type === val}
                      onChange={() => setPdPaymentForm({...pdPaymentForm, deposit_type: val})} />
                    {lbl}
                  </label>
                ))}
              </div>
              {pdPaymentForm.deposit_type === 'bank' ? (
                <select value={pdPaymentForm.bank_account_id}
                  onChange={(e) => setPdPaymentForm({...pdPaymentForm, bank_account_id: e.target.value})}
                  style={{...styles.select, padding:'10px'}}>
                  <option value="">Select Bank Account…</option>
                  {pdCashAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.account_name}{a.bank_name ? ` (${a.bank_name})` : ''}</option>
                  ))}
                </select>
              ) : (
                <select value={pdPaymentForm.holding_account_id}
                  onChange={(e) => setPdPaymentForm({...pdPaymentForm, holding_account_id: e.target.value})}
                  style={{...styles.select, padding:'10px'}}>
                  <option value="">Select Holding Account…</option>
                  {pdHoldingAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.account_name}</option>
                  ))}
                </select>
              )}
            </div>

            <div style={styles.field}>
              <label style={styles.modalLabel}>Notes</label>
              <textarea value={pdPaymentForm.notes}
                onChange={(e) => setPdPaymentForm({...pdPaymentForm, notes: e.target.value})}
                style={{...styles.select, padding:'10px', minHeight:70, resize:'vertical'}}
                placeholder="Any notes about this payment…" />
            </div>

            <div style={styles.modalActions}>
              <button onClick={() => setShowInvoicePayModal(false)} style={styles.cancelButton}>Cancel</button>
              <button onClick={handleInvoicePayment} style={styles.submitButton}>💰 Record Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Expense Modal ─────────────────────────────────────────── */}
      {showAddExpenseModal && (
        <div style={styles.modalOverlay} onClick={() => setShowAddExpenseModal(false)}>
          <div style={{...styles.modal, maxWidth: 520}} onClick={(e) => e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 20}}>
              <h2 style={{...styles.modalTitle, marginBottom: 0}}>➕ Add Expense</h2>
              <button onClick={() => setShowAddExpenseModal(false)} style={{background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#666'}}>×</button>
            </div>

            {/* Category Selector */}
            <div style={styles.field}>
              <label style={styles.modalLabel}>Category *</label>
              <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8}}>
                {[
                  {value:'material',    icon:'🧱', label:'Material'},
                  {value:'tool',        icon:'🔧', label:'Tool / Equipment'},
                  {value:'subcontractor', icon:'👷', label:'Subcontractor'},
                  {value:'fuel',        icon:'⛽', label:'Fuel'},
                  {value:'permit',      icon:'📋', label:'Permit / Fee'},
                  {value:'other',       icon:'📦', label:'Other'},
                ].map(cat => {
                  const selected = expenseForm.category === cat.value;
                  return (
                    <button key={cat.value} type="button"
                      onClick={() => setExpenseForm({...expenseForm, category: cat.value})}
                      style={{
                        padding:'10px 6px', borderRadius:8, border:'2px solid',
                        borderColor: selected ? '#0b3ea8' : '#e5e7eb',
                        backgroundColor: selected ? '#e0f0ff' : '#f9fafb',
                        color: selected ? '#0b3ea8' : '#555',
                        fontWeight: selected ? 700 : 500,
                        fontSize:12, cursor:'pointer', textAlign:'center',
                        transition:'all 0.12s',
                      }}>
                      <div style={{fontSize:20, marginBottom:3}}>{cat.icon}</div>
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={styles.field}>
              <label style={styles.modalLabel}>Description *</label>
              <input
                type="text"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})}
                style={{...styles.select, padding:'10px'}}
                placeholder="e.g., 100ft 12/2 Romex, Fuel for job site, Permit fee"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveExpense(); }}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.modalLabel}>Vendor</label>
              <input
                type="text"
                value={expenseForm.vendor}
                onChange={(e) => setExpenseForm({...expenseForm, vendor: e.target.value})}
                style={{...styles.select, padding:'10px'}}
                placeholder="e.g., Home Depot, Coburn's, Fastenal"
              />
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
              <div style={styles.field}>
                <label style={styles.modalLabel}>Amount *</label>
                <input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})}
                  style={{...styles.select, padding:'10px'}}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.modalLabel}>Date</label>
                <input
                  type="date"
                  value={expenseForm.expense_date}
                  onChange={(e) => setExpenseForm({...expenseForm, expense_date: e.target.value})}
                  style={{...styles.select, padding:'10px'}}
                />
              </div>
            </div>

            <div style={styles.modalActions}>
              <button onClick={() => setShowAddExpenseModal(false)} style={styles.cancelButton}>Cancel</button>
              <button
                onClick={handleSaveExpense}
                style={{...styles.submitButton, opacity: savingExpense ? 0.6 : 1}}
                disabled={savingExpense}
              >
                {savingExpense ? '⏳ Saving...' : '💾 Save Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Attach Existing Quick Estimate Modal ─────────────────────── */}
      {showAttachEstimateModal && (
        <div style={styles.modalOverlay} onClick={() => setShowAttachEstimateModal(false)}>
          <div style={{...styles.modal, maxWidth: 600}} onClick={(e) => e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 16}}>
              <h2 style={{...styles.modalTitle, marginBottom: 0}}>📎 Attach Existing Quick Estimate</h2>
              <button onClick={() => setShowAttachEstimateModal(false)} style={{background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#666'}}>×</button>
            </div>
            <p style={{fontSize: 14, color: '#666', marginBottom: 16}}>
              Select an unlinked Quick Estimate to attach to <strong>{project.name}</strong>.
            </p>

            {/* Search */}
            <input
              type="text"
              value={attachEstimateSearch}
              onChange={(e) => setAttachEstimateSearch(e.target.value)}
              placeholder="Search by estimate #, customer or project name..."
              style={{...styles.select, padding: '10px', marginBottom: 16}}
              autoFocus
            />

            {/* List */}
            <div style={{maxHeight: 380, overflowY: 'auto', marginBottom: 16}}>
              {unlinkedEstimates.length === 0 ? (
                <div style={{textAlign:'center', padding: 32, color: '#999', fontSize: 14}}>
                  No unlinked Quick Estimates found.
                </div>
              ) : (
                unlinkedEstimates
                  .filter(est => {
                    const q = attachEstimateSearch.toLowerCase();
                    return !q ||
                      (est.estimate_number || '').toLowerCase().includes(q) ||
                      (est.customer_name || '').toLowerCase().includes(q) ||
                      (est.project_name || '').toLowerCase().includes(q);
                  })
                  .map(est => (
                    <div
                      key={est.id}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '14px 16px', borderRadius: 8, marginBottom: 8,
                        border: '2px solid #e5e7eb', backgroundColor: '#f9fafb',
                        cursor: attachingEstimate ? 'default' : 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => { if (!attachingEstimate) { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.backgroundColor = '#eef2ff'; }}}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                      onClick={async () => {
                        if (attachingEstimate) return;
                        setAttachingEstimate(true);
                        try {
                          const { error } = await supabase
                            .from("estimates")
                            .update({
                              project_id: id,
                              project_name: project.name,
                            })
                            .eq("id", est.id);
                          if (error) throw error;
                          setShowAttachEstimateModal(false);
                          loadProjectData();
                          alert(`✅ Estimate #${est.estimate_number} attached to ${project.name}!`);
                        } catch (err) {
                          console.error("Error attaching estimate:", err);
                          alert("Failed to attach estimate: " + err.message);
                        } finally {
                          setAttachingEstimate(false);
                        }
                      }}
                    >
                      <div style={{flex: 1}}>
                        <div style={{fontWeight: '700', fontSize: 15, color: '#111'}}>
                          #{est.estimate_number}
                          {est.customer_name && (
                            <span style={{fontWeight: 400, fontSize: 13, color: '#666', marginLeft: 8}}>— {est.customer_name}</span>
                          )}
                        </div>
                        {est.project_name && (
                          <div style={{fontSize: 12, color: '#888', marginTop: 2}}>{est.project_name}</div>
                        )}
                        {est.estimate_date && (
                          <div style={{fontSize: 11, color: '#aaa', marginTop: 2}}>{est.estimate_date}</div>
                        )}
                      </div>
                      <div style={{fontSize: 16, fontWeight: '700', color: '#fc6b04', marginLeft: 16, whiteSpace: 'nowrap'}}>
                        ${(est.total || 0).toFixed(2)}
                      </div>
                    </div>
                  ))
              )}
            </div>

            <div style={styles.modalActions}>
              <button onClick={() => setShowAttachEstimateModal(false)} style={styles.cancelButton}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Attach Existing Invoice Modal ───────────────────────────── */}
      {showAttachInvoiceModal && (
        <div style={styles.modalOverlay} onClick={() => setShowAttachInvoiceModal(false)}>
          <div style={{...styles.modal, maxWidth: 660}} onClick={(e) => e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 16}}>
              <h2 style={{...styles.modalTitle, marginBottom: 0}}>📎 Link Existing Invoice</h2>
              <button onClick={() => setShowAttachInvoiceModal(false)} style={{background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#666'}}>×</button>
            </div>
            <p style={{fontSize: 14, color: '#666', marginBottom: 16}}>
              Select an invoice to link to <strong>{project.name}</strong>. Only invoices not already linked to a project are shown.
            </p>

            {/* Search */}
            <input
              type="text"
              value={attachInvoiceSearch}
              onChange={(e) => setAttachInvoiceSearch(e.target.value)}
              placeholder="Search by invoice #, customer name..."
              style={{...styles.select, padding: '10px', marginBottom: 16}}
              autoFocus
            />

            {/* List */}
            <div style={{maxHeight: 400, overflowY: 'auto', marginBottom: 16}}>
              {unlinkedInvoices.length === 0 ? (
                <div style={{textAlign:'center', padding: 32, color: '#999', fontSize: 14}}>
                  No unlinked invoices found. All invoices are already linked to a project.
                </div>
              ) : (
                unlinkedInvoices
                  .filter(inv => {
                    const q = attachInvoiceSearch.toLowerCase();
                    return !q ||
                      (inv.invoice_number || '').toLowerCase().includes(q) ||
                      (inv.customer_name || '').toLowerCase().includes(q);
                  })
                  .map(inv => (
                    <div
                      key={inv.id}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '14px 16px', borderRadius: 8, marginBottom: 8,
                        border: '2px solid #e5e7eb', backgroundColor: '#f9fafb',
                        cursor: attachingInvoice ? 'default' : 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => { if (!attachingInvoice) { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.backgroundColor = '#eef2ff'; }}}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                      onClick={async () => {
                        if (attachingInvoice) return;
                        setAttachingInvoice(true);
                        try {
                          const { error } = await supabase
                            .from("invoices")
                            .update({ project_name: project.name })
                            .eq("id", inv.id);
                          if (error) throw error;
                          setShowAttachInvoiceModal(false);
                          loadProjectData();
                          alert(`✅ Invoice #${inv.invoice_number} linked to ${project.name}!`);
                        } catch (err) {
                          console.error("Error linking invoice:", err);
                          alert("Failed to link invoice: " + err.message);
                        } finally {
                          setAttachingInvoice(false);
                        }
                      }}
                    >
                      <div style={{flex: 1}}>
                        <div style={{fontWeight: '700', fontSize: 15, color: '#111', display: 'flex', alignItems: 'center', gap: 8}}>
                          #{inv.invoice_number}
                          <span style={{
                            fontSize: 11, fontWeight: '700', borderRadius: 20, padding: '2px 8px',
                            backgroundColor:
                              inv.status === 'paid' ? '#d1fae5' :
                              inv.status === 'sent' ? '#dbeafe' :
                              inv.status === 'partial' ? '#fef3c7' : '#f3f4f6',
                            color:
                              inv.status === 'paid' ? '#065f46' :
                              inv.status === 'sent' ? '#1e40af' :
                              inv.status === 'partial' ? '#92400e' : '#6b7280',
                          }}>
                            {inv.status || 'draft'}
                          </span>
                        </div>
                        {inv.customer_name && (
                          <div style={{fontSize: 13, color: '#666', marginTop: 2}}>{inv.customer_name}</div>
                        )}
                        {inv.invoice_date && (
                          <div style={{fontSize: 11, color: '#aaa', marginTop: 2}}>{inv.invoice_date}</div>
                        )}
                      </div>
                      <div style={{fontSize: 16, fontWeight: '700', color: '#fc6b04', marginLeft: 16, whiteSpace: 'nowrap'}}>
                        ${(inv.total || 0).toFixed(2)}
                      </div>
                    </div>
                  ))
              )}
            </div>

            <div style={styles.modalActions}>
              <button onClick={() => setShowAttachInvoiceModal(false)} style={styles.cancelButton}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Set Active Estimate Confirmation Modal ───────────────────── */}
      {showSetActiveModal && setActiveModalEstimate && (
        <div style={styles.modalOverlay} onClick={() => setShowSetActiveModal(false)}>
          <div style={{...styles.modal, maxWidth: 500}} onClick={(e) => e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 16}}>
              <h2 style={{...styles.modalTitle, marginBottom: 0}}>⭐ Set as Active Bid</h2>
              <button onClick={() => setShowSetActiveModal(false)} style={{background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#666'}}>×</button>
            </div>
            <p style={{fontSize: 14, color: '#666', marginBottom: 20}}>
              Review and adjust the values pulled from estimate <strong>#{setActiveModalEstimate.estimate_number}</strong> before committing.
            </p>

            <div style={styles.field}>
              <label style={styles.modalLabel}>📄 Contract Value (Active Worth)</label>
              <p style={{fontSize: 12, color: '#888', margin: '0 0 6px'}}>What the customer pays — the selling price with markup.</p>
              <input
                type="number"
                value={setActiveEstWorthInput}
                onChange={(e) => setSetActiveEstWorthInput(e.target.value)}
                style={{...styles.select, padding: '10px', fontWeight: '700', fontSize: 16, borderColor: '#0b3ea8'}}
                placeholder="0.00"
                min="0"
                step="0.01"
                autoFocus
              />
            </div>

            <div style={styles.field}>
              <label style={styles.modalLabel}>💰 Budget / Cost (Pre-Markup)</label>
              <p style={{fontSize: 12, color: '#888', margin: '0 0 6px'}}>Your internal cost before markup — used for cost tracking and profit margin.</p>
              <input
                type="number"
                value={setActiveEstBudgetInput}
                onChange={(e) => setSetActiveEstBudgetInput(e.target.value)}
                style={{...styles.select, padding: '10px', fontWeight: '700', fontSize: 16, borderColor: '#10b981'}}
                placeholder="Enter your cost (before markup)"
                min="0"
                step="0.01"
              />
              {setActiveEstWorthInput && setActiveEstBudgetInput && parseFloat(setActiveEstWorthInput) > 0 && parseFloat(setActiveEstBudgetInput) > 0 && (
                <div style={{marginTop: 8, padding: '10px 14px', backgroundColor: '#f0fdf4', borderRadius: 8, border: '1px solid #d1fae5'}}>
                  <div style={{fontSize: 13, color: '#065f46', fontWeight: '600'}}>
                    Profit: ${(parseFloat(setActiveEstWorthInput) - parseFloat(setActiveEstBudgetInput)).toFixed(2)}
                    {' · '}
                    Margin: {((1 - parseFloat(setActiveEstBudgetInput) / parseFloat(setActiveEstWorthInput)) * 100).toFixed(1)}%
                    {' · '}
                    Markup: {((parseFloat(setActiveEstWorthInput) / parseFloat(setActiveEstBudgetInput) - 1) * 100).toFixed(1)}%
                  </div>
                </div>
              )}
            </div>

            <div style={styles.modalActions}>
              <button onClick={() => setShowSetActiveModal(false)} style={styles.cancelButton}>Cancel</button>
              <button
                onClick={confirmSetActiveEstimate}
                style={styles.submitButton}
                disabled={!setActiveEstWorthInput || parseFloat(setActiveEstWorthInput) <= 0}
              >
                ⭐ Set as Active Bid
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Order Proposal Type Modal */}
      {showChangeOrderProposalTypeModal && (
        <div style={styles.modalOverlay} onClick={() => setShowChangeOrderProposalTypeModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Select Proposal Type</h2>
            <p style={{fontSize: 14, color: '#666', marginBottom: 24}}>Choose the type of proposal you want to generate:</p>
            
            <div style={styles.field}>
              <label style={styles.modalLabel}>Proposal Type</label>
              <select
                value={changeOrderProposalType}
                onChange={(e) => setChangeOrderProposalType(e.target.value)}
                style={styles.select}
              >
                <option value="commercial-public">Commercial Public</option>
                <option value="commercial-private">Commercial Private</option>
                <option value="residential-contractor">Residential Contractor</option>
                <option value="residential-owner">Residential Owner</option>
                <option value="lighting-project">💡 Lighting Project</option>
              </select>
            </div>

            <div style={styles.modalActions}>
              <button onClick={() => {
                setShowChangeOrderProposalTypeModal(false);
              }} style={styles.cancelButton}>Cancel</button>
              <button onClick={() => {
                navigate(`/project/${id}/proposal?coId=${selectedChangeOrderForProposal}&type=${changeOrderProposalType}`);
              }} style={styles.submitButton}>
                Create Proposal
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
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
    gap: 24,
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
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  label: {
    fontSize: 15,
    color: "#666",
  },
  value: {
    fontSize: 16,
    color: "#111",
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    margin: "16px 0",
  },
  progressSection: {
    marginBottom: 20,
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressBar: {
    width: "100%",
    height: 24,
    backgroundColor: "#e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    transition: "width 0.3s ease",
  },
  badge: {
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: "bold",
    color: "#fff",
    textTransform: "uppercase",
  },
  description: {
    fontSize: 14,
    color: "#444",
    lineHeight: 1.6,
    marginTop: 8,
  },
  table: {
    width: "100%",
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr",
    gap: 16,
    padding: "12px 16px",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    marginBottom: 8,
  },
  th: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#666",
    textTransform: "uppercase",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr",
    gap: 16,
    padding: "12px 16px",
    borderBottom: "1px solid #e5e7eb",
  },
  td: {
    fontSize: 14,
    color: "#111",
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    padding: 20,
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
  button: {
    padding: "14px 28px",
    backgroundColor: BRAND.accent,
    border: "none",
    color: "#fff",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: "bold",
    margin: "0 auto",
    display: "block",
  },
  addEstimateButton: {
    padding: "10px 20px",
    backgroundColor: BRAND.accent,
    border: "none",
    color: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 15,
    fontWeight: "600",
  },
  estimateHeader: {
    display: "grid",
    gridTemplateColumns: "2fr 1.5fr 1fr 1fr",
    gap: 16,
    padding: "12px 16px",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    marginBottom: 8,
  },
  estimateRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1.5fr 1fr 1fr",
    gap: 16,
    padding: "12px 16px",
    borderBottom: "1px solid #e5e7eb",
    alignItems: "center",
  },
  estimateButton: {
    padding: "6px 12px",
    backgroundColor: BRAND.accent,
    border: "none",
    color: "#fff",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: "600",
  },
  invoiceHeader: {
    display: "grid",
    gridTemplateColumns: "1.5fr 1.2fr 1.2fr 1fr 1fr 1fr 1fr 160px",
    gap: 12,
    padding: "12px 16px",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    marginBottom: 8,
  },
  invoiceRow: {
    display: "grid",
    gridTemplateColumns: "1.5fr 1.2fr 1.2fr 1fr 1fr 1fr 1fr 160px",
    gap: 12,
    padding: "12px 16px",
    borderBottom: "1px solid #e5e7eb",
    alignItems: "center",
  },
  changeOrderHeader: {
    display: "grid",
    gridTemplateColumns: "1fr 2fr 1.5fr 1fr 1fr",
    gap: 16,
    padding: "12px 16px",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    marginBottom: 8,
  },
  changeOrderRow: {
    display: "grid",
    gridTemplateColumns: "1fr 2fr 1.5fr 1fr 1fr",
    gap: 16,
    padding: "12px 16px",
    borderBottom: "1px solid #e5e7eb",
    alignItems: "center",
  },
  contractorList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: 16,
  },
  contractorCard: {
    padding: 16,
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: "#f9fafb",
  },
  contractorInfo: {
    flex: 1,
  },
  contractorName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 8,
  },
  contractorDetail: {
    fontSize: 13,
    color: "#666",
    marginBottom: 4,
  },
  contractorCompactList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  contractorCompactRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
  },
  contractorCompactName: {
    fontSize: 14,
    color: "#111",
    fontWeight: "500",
  },
  contractorDeleteButton: {
    padding: "4px 8px",
    backgroundColor: "transparent",
    border: "none",
    color: "#ef4444",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: "bold",
    borderRadius: 4,
  },
  modalOverlay: {
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
  modal: {
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
  modalLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
    display: "block",
  },
  field: {
    marginBottom: 20,
  },
  select: {
    width: "100%",
    padding: "12px",
    fontSize: 15,
    border: "2px solid #d1d5db",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#111",
  },
  selectedInfo: {
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 1.8,
  },
  modalActions: {
    display: "flex",
    gap: 16,
    justifyContent: "flex-end",
  },
  cancelButton: {
    padding: "14px 28px",
    backgroundColor: "transparent",
    border: "2px solid #d1d5db",
    color: "#374151",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: "bold",
  },
  submitButton: {
    padding: "14px 28px",
    backgroundColor: BRAND.accent,
    border: "none",
    color: "#fff",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: "bold",
  },

expenseRow: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px",
  backgroundColor: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  marginBottom: 8,
},
statusSelect: {
  padding: "8px 12px",
  fontSize: 14,
  border: "2px solid #d1d5db",
  borderRadius: 6,
  backgroundColor: "#fff",
  color: "#111",
  fontWeight: "600",
  cursor: "pointer",
  outline: "none",
},
toolButton: {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "16px 18px",
  backgroundColor: "#f9fafb",
  border: "2px solid #e5e7eb",
  borderRadius: 12,
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
  transition: "background-color 0.2s, border-color 0.2s",
},
toolButtonIcon: {
  fontSize: 32,
  lineHeight: 1,
  flexShrink: 0,
},
toolButtonTitle: {
  fontSize: 15,
  fontWeight: "700",
  color: "#111",
  marginBottom: 3,
},
toolButtonDesc: {
  fontSize: 12,
  color: "#666",
  lineHeight: 1.4,
},
toolButtonArrow: {
  fontSize: 18,
  color: "#9ca3af",
  marginLeft: "auto",
  flexShrink: 0,
},
};
