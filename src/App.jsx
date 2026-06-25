import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./Components/ProtectedRoute";
import CustomerRoute from "./Components/CustomerRoute";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import ProfileSetup from "./pages/ProfileSetup";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import TimeClock from "./pages/TimeClock";
import WeeklyTotals from "./pages/WeeklyTotals";
import EmployeeTimesheets from "./pages/EmployeeTimesheets";
import OvertimeBank from "./pages/OvertimeBank";
import Customers from "./pages/Customers";
import Vendors from "./pages/Vendors";
import Estimate from "./pages/Estimate";
import EstimatesList from "./pages/EstimatesList";
import InvoicesList from "./pages/InvoicesList";
import ServiceCalls from "./pages/ServiceCalls";
import QuickEstimate from "./pages/QuickEstimate";
import QuickInvoice from "./pages/QuickInvoice";
import QuickEstimateView from "./pages/QuickEstimateView";
import ProjectSetup from "./pages/ProjectSetup";
import ProjectsList from "./pages/ProjectsList";
import ProjectDetail from "./pages/ProjectDetail";
import ProjectReportsPhotos from "./pages/ProjectReportsPhotos";
import ProjectMaterialList from "./pages/ProjectMaterialList";
import ProjectInfoSheet from "./pages/ProjectInfoSheet";
import ProjectStatement from "./pages/ProjectStatement";
import Proposal from "./pages/Proposal";
import Invoice from "./pages/Invoice";
import ProgressInvoice from "./pages/ProgressInvoice";
import InvoiceView from "./pages/InvoiceView";
import InvoiceReceipt from "./pages/InvoiceReceipt";
import InvoicePaySuccess from "./pages/InvoicePaySuccess";
import InvoiceDetailedReport from "./pages/InvoiceDetailedReport";
import InvoiceCommercialPublic from "./pages/InvoiceCommercialPublic";
import ProposalCommercialPublic from "./pages/ProposalCommercialPublic";
import ProposalView from "./pages/ProposalView";
import ProgressBilling from "./pages/ProgressBilling";
import Employees from "./pages/Employees";
import Expenses from "./pages/Expenses";
import AccountingDashboard from "./pages/AccountingDashboard";
import ChartOfAccounts from "./pages/ChartOfAccounts";
import GeneralLedger from "./pages/GeneralLedger";
import JournalEntry from "./pages/JournalEntry";
import BankAccounts from "./pages/BankAccounts";
import BankTransactions from "./pages/BankTransactions";
import BankReconciliation from "./pages/BankReconciliation";
import Bills from "./pages/Bills";
import AccountLedger from "./pages/AccountLedger";
import TrialBalance from "./pages/reports/TrialBalance";
import ProfitLoss from "./pages/reports/ProfitLoss";
import BalanceSheet from "./pages/reports/BalanceSheet";
import CashFlow from "./pages/reports/CashFlow";
import WeeklyTimesheet from "./pages/reports/WeeklyTimesheet";
import IndividualWeeklyTimesheet from "./pages/reports/IndividualWeeklyTimesheet";
import AssemblyManager from "./pages/AssemblyManager";
import BaseMaterialsManager from "./pages/BaseMaterialsManager";
import AdminDashboard from "./pages/AdminDashboard";
import TimeOffRequests from "./pages/TimeOffRequests";
import Plans from "./pages/Plans";
import Takeoff from "./pages/Takeoff";
import CheckStubs from "./pages/CheckStubs";
import CheckStubsBrowser from "./pages/CheckStubsBrowser";
import EmployeeLocations from "./pages/EmployeeLocations";
import ProjectGeofence from "./pages/ProjectGeofence";
import GeofenceEvents from "./pages/GeofenceEvents";
import CompanyLocations from "./pages/CompanyLocations";
import ScheduledNotifications from "./pages/ScheduledNotifications";
import PendingJobs from "./pages/PendingJobs";
import DesktopHeader from "./Components/DesktopHeader";
import WebsiteManager from "./pages/WebsiteManager";
import Communications from "./pages/Communications";
import EmailInbox from "./pages/EmailInbox";
import TwilioSettings from "./pages/TwilioSettings";
import SuperAdmin from "./pages/SuperAdmin";
import TimeclockAdmin from "./pages/TimeclockAdmin";
import PayrollApproval from "./pages/PayrollApproval";
import PayrollUpload from "./pages/PayrollUpload";
import PayrollHub from "./pages/PayrollHub";
import PortalLogin from "./pages/portal/PortalLogin";
import PortalDashboard from "./pages/portal/PortalDashboard";
import PortalClock from "./pages/portal/PortalClock";
import PortalBilling from "./pages/portal/PortalBilling";
import SetPassword from "./pages/SetPassword";

// Portal pages
import CustomerLogin from "./pages/customer/CustomerLogin";
import CustomerPortal from "./pages/customer/CustomerPortal";
import CustomerInvoices from "./pages/customer/CustomerInvoices";
import CustomerEstimates from "./pages/customer/CustomerEstimates";
import EmployeePortal from "./pages/employee/EmployeePortal";

// Pages that should never show the DesktopHeader
const NO_HEADER_PATHS = new Set([
  "/set-password",
  "/",
  "/proposal/commercial-public",
  "/invoice/commercial-public",
  "/invoice/view",
  "/invoice/receipt",
  "/invoice/pay-success",
  "/proposal/view",
  "/estimate/quick/view",
  // portal & website pages have their own headers
  "/welcome",
  "/customer/login",
  "/customer/portal",
  "/customer/invoices",
  "/customer/estimates",
  "/employee/portal",
]);

// Known first-level app paths that should NOT be treated as portal slugs
const KNOWN_APP_PATHS = new Set([
  "/signin", "/signup", "/set-password", "/dashboard", "/projects", "/estimates", "/invoices",
  "/expenses", "/accounting", "/customers", "/vendors", "/employees", "/timeclock",
  "/company-locations", "/scheduled-notifications", "/admin", "/assemblies",
  "/base-materials", "/check-stubs", "/employee-locations", "/geofence-events",
  "/communications", "/email-inbox", "/website-manager", "/twilio-settings", "/super-admin",
  "/payroll", "/payroll-approval", "/payroll-upload",
  "/invoice", "/proposal", "/estimate", "/weekly", "/time-off", "/pending-jobs",
  "/profile-setup", "/reports", "/welcome", "/project", "/timeclock-admin", "/service-calls",
]);

function isPortalPath(path) {
  const seg = path.split("/")[1] || "";
  if (!seg || KNOWN_APP_PATHS.has("/" + seg)) return false;
  // single segment (/:slug) or two segments (/:slug/dashboard or /:slug/clock)
  const parts = path.split("/").filter(Boolean);
  const PORTAL_SUB_PAGES = new Set(["dashboard", "clock", "billing"]);
  return parts.length === 1 || (parts.length === 2 && PORTAL_SUB_PAGES.has(parts[1]));
}

function AppContent() {
  const location = useLocation();
  const path = location.pathname;

  const isNoHeader =
    NO_HEADER_PATHS.has(path) ||
    path.startsWith("/customer/") ||
    path.startsWith("/employee/") ||
    isPortalPath(path);

  return (
    <>
      {!isNoHeader && <DesktopHeader />}
      <div className={isNoHeader ? "" : "content"}>
        <Routes>
          {/* ── Public website ──────────────────────────────────────────── */}
          <Route path="/" element={<Landing />} />
          <Route path="/welcome" element={<Landing />} />

          {/* ── Auth (employees/admin) ───────────────────────────────────── */}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/profile-setup" element={<ProfileSetup />} />

          {/* ── Customer Portal ──────────────────────────────────────────── */}
          <Route path="/customer/login" element={<CustomerLogin />} />
          <Route
            path="/customer/portal"
            element={
              <CustomerRoute>
                <CustomerPortal />
              </CustomerRoute>
            }
          />
          <Route
            path="/customer/invoices"
            element={
              <CustomerRoute>
                <CustomerInvoices />
              </CustomerRoute>
            }
          />
          <Route
            path="/customer/estimates"
            element={
              <CustomerRoute>
                <CustomerEstimates />
              </CustomerRoute>
            }
          />

          {/* ── Employee Portal ───────────────────────────────────────────── */}
          <Route
            path="/employee/portal"
            element={
              <ProtectedRoute>
                <EmployeePortal />
              </ProtectedRoute>
            }
          />

          {/* ── Internal App (employees / admin) ─────────────────────────── */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects"
            element={
              <ProtectedRoute>
                <ProjectsList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/project/new"
            element={
              <ProtectedRoute>
                <ProjectSetup />
              </ProtectedRoute>
            }
          />
          <Route
            path="/project/:id"
            element={
              <ProtectedRoute>
                <ProjectDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/project/:id/reports-photos"
            element={
              <ProtectedRoute>
                <ProjectReportsPhotos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/project/:id/material-list"
            element={
              <ProtectedRoute>
                <ProjectMaterialList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/project/:id/info-sheet"
            element={
              <ProtectedRoute>
                <ProjectInfoSheet />
              </ProtectedRoute>
            }
          />
          <Route
            path="/project/:id/statement"
            element={
              <ProtectedRoute>
                <ProjectStatement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/project/:projectId/plans"
            element={
              <ProtectedRoute>
                <Plans />
              </ProtectedRoute>
            }
          />
          <Route
            path="/project/:projectId/takeoff"
            element={
              <ProtectedRoute>
                <Takeoff />
              </ProtectedRoute>
            }
          />
          <Route
            path="/project/:projectId/geofence"
            element={
              <ProtectedRoute>
                <ProjectGeofence />
              </ProtectedRoute>
            }
          />
          <Route
            path="/timeclock"
            element={
              <ProtectedRoute>
                <EmployeeTimesheets />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee-timesheets"
            element={
              <ProtectedRoute>
                <EmployeeTimesheets />
              </ProtectedRoute>
            }
          />
          <Route
            path="/overtime-bank"
            element={
              <ProtectedRoute>
                <OvertimeBank />
              </ProtectedRoute>
            }
          />
          <Route
            path="/weekly"
            element={
              <ProtectedRoute>
                <WeeklyTotals />
              </ProtectedRoute>
            }
          />
          <Route
            path="/timeclock/history"
            element={
              <ProtectedRoute>
                <EmployeeTimesheets />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <ProtectedRoute>
                <Customers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendors"
            element={
              <ProtectedRoute>
                <Vendors />
              </ProtectedRoute>
            }
          />
          <Route
            path="/estimates"
            element={
              <ProtectedRoute>
                <EstimatesList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoices"
            element={
              <ProtectedRoute>
                <InvoicesList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/service-calls"
            element={
              <ProtectedRoute>
                <ServiceCalls />
              </ProtectedRoute>
            }
          />
          <Route
            path="/estimate/new"
            element={
              <ProtectedRoute>
                <Estimate />
              </ProtectedRoute>
            }
          />
          <Route
            path="/estimate/quick"
            element={
              <ProtectedRoute>
                <QuickEstimate />
              </ProtectedRoute>
            }
          />
          <Route path="/estimate/quick/view" element={<QuickEstimateView />} />
          <Route
            path="/project/:id/estimate"
            element={
              <ProtectedRoute>
                <Estimate mode="full" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/project/:id/proposal"
            element={
              <ProtectedRoute>
                <Proposal />
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoice"
            element={
              <ProtectedRoute>
                <Invoice />
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoice/quick"
            element={
              <ProtectedRoute>
                <QuickInvoice />
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoice/progress"
            element={
              <ProtectedRoute>
                <ProgressInvoice />
              </ProtectedRoute>
            }
          />
          <Route path="/invoice/view" element={<InvoiceView />} />
          <Route path="/invoice/receipt" element={<InvoiceReceipt />} />
          <Route path="/invoice/pay-success" element={<InvoicePaySuccess />} />
          <Route
            path="/invoice/detailed-report"
            element={
              <ProtectedRoute>
                <InvoiceDetailedReport />
              </ProtectedRoute>
            }
          />
          <Route path="/invoice/commercial-public" element={<InvoiceCommercialPublic />} />
          <Route path="/proposal/view" element={<ProposalView />} />
          <Route path="/proposal/commercial-public" element={<ProposalCommercialPublic />} />
          <Route
            path="/project/:projectId/progress-billing"
            element={
              <ProtectedRoute>
                <ProgressBilling />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employees"
            element={
              <ProtectedRoute>
                <Employees />
              </ProtectedRoute>
            }
          />
          <Route
            path="/check-stubs"
            element={
              <ProtectedRoute>
                <CheckStubs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/check-stubs/browse"
            element={
              <ProtectedRoute>
                <CheckStubsBrowser />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee-locations"
            element={
              <ProtectedRoute>
                <EmployeeLocations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/geofence-events"
            element={
              <ProtectedRoute>
                <GeofenceEvents />
              </ProtectedRoute>
            }
          />
          <Route
            path="/company-locations"
            element={
              <ProtectedRoute>
                <CompanyLocations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/scheduled-notifications"
            element={
              <ProtectedRoute>
                <ScheduledNotifications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pending-jobs"
            element={
              <ProtectedRoute>
                <PendingJobs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/time-off"
            element={
              <ProtectedRoute>
                <TimeOffRequests />
              </ProtectedRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <ProtectedRoute>
                <Expenses />
              </ProtectedRoute>
            }
          />
          <Route
            path="/website-manager"
            element={
              <ProtectedRoute>
                <WebsiteManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/communications"
            element={
              <ProtectedRoute>
                <Communications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/email-inbox"
            element={
              <ProtectedRoute>
                <EmailInbox />
              </ProtectedRoute>
            }
          />
          <Route
            path="/twilio-settings"
            element={
              <ProtectedRoute>
                <TwilioSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assemblies"
            element={
              <ProtectedRoute>
                <AssemblyManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/base-materials"
            element={
              <ProtectedRoute>
                <BaseMaterialsManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounting"
            element={
              <ProtectedRoute>
                <AccountingDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounting/chart-of-accounts"
            element={
              <ProtectedRoute>
                <ChartOfAccounts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounting/ledger/:accountId"
            element={
              <ProtectedRoute>
                <AccountLedger />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounting/general-ledger"
            element={
              <ProtectedRoute>
                <GeneralLedger />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounting/journal-entry"
            element={
              <ProtectedRoute>
                <JournalEntry />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounting/bank-accounts"
            element={
              <ProtectedRoute>
                <BankAccounts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounting/bank-transactions"
            element={
              <ProtectedRoute>
                <BankTransactions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounting/bank-reconciliation"
            element={
              <ProtectedRoute>
                <BankReconciliation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounting/bills"
            element={
              <ProtectedRoute>
                <Bills />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounting/reports/trial-balance"
            element={
              <ProtectedRoute>
                <TrialBalance />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounting/reports/profit-loss"
            element={
              <ProtectedRoute>
                <ProfitLoss />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounting/reports/balance-sheet"
            element={
              <ProtectedRoute>
                <BalanceSheet />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounting/reports/cash-flow"
            element={
              <ProtectedRoute>
                <CashFlow />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/weekly-timesheet"
            element={
              <ProtectedRoute>
                <WeeklyTimesheet />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/individual-timesheet"
            element={
              <ProtectedRoute>
                <IndividualWeeklyTimesheet />
              </ProtectedRoute>
            }
          />

          {/* ── Payroll Hub ──────────────────────────────────────────────── */}
          <Route
            path="/payroll"
            element={
              <ProtectedRoute>
                <PayrollHub />
              </ProtectedRoute>
            }
          />

          {/* ── Payroll Approval Queue ───────────────────────────────────── */}
          <Route
            path="/payroll-approval"
            element={
              <ProtectedRoute>
                <PayrollApproval />
              </ProtectedRoute>
            }
          />

          {/* ── Pay Stub Upload (SmartVault / manual) ────────────────────── */}
          <Route
            path="/payroll-upload"
            element={
              <ProtectedRoute>
                <PayrollUpload />
              </ProtectedRoute>
            }
          />

          {/* ── Super Admin (platform owner only) ────────────────────────── */}
          <Route
            path="/super-admin"
            element={
              <ProtectedRoute>
                <SuperAdmin />
              </ProtectedRoute>
            }
          />

          {/* ── Timeclock Portal (/:slug, /:slug/dashboard, /:slug/clock, /:slug/billing) ── */}
          {/* These MUST be last so they don't shadow existing routes */}
          <Route path="/:slug" element={<PortalLogin />} />
          <Route path="/:slug/dashboard" element={<PortalDashboard />} />
          <Route path="/:slug/clock" element={<PortalClock />} />
          <Route path="/:slug/billing" element={<PortalBilling />} />

          {/* ── Fallback ─────────────────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}
