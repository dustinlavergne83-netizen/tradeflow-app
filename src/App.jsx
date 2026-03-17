import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./Components/ProtectedRoute";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import ProfileSetup from "./pages/ProfileSetup";
import Home from "./pages/Home";
import TimeClock from "./pages/TimeClock";
import WeeklyTotals from "./pages/WeeklyTotals";
import EmployeeTimesheets from "./pages/EmployeeTimesheets";
import Customers from "./pages/Customers";
import Vendors from "./pages/Vendors";
import Estimate from "./pages/Estimate";
import EstimatesList from "./pages/EstimatesList";
import InvoicesList from "./pages/InvoicesList";
import QuickEstimate from "./pages/QuickEstimate";
import QuickInvoice from "./pages/QuickInvoice";
import QuickEstimateView from "./pages/QuickEstimateView";
import ProjectSetup from "./pages/ProjectSetup";
import ProjectsList from "./pages/ProjectsList";
import ProjectDetail from "./pages/ProjectDetail";
import ProjectReportsPhotos from "./pages/ProjectReportsPhotos";
import ProjectMaterialList from "./pages/ProjectMaterialList";
import ProjectInfoSheet from "./pages/ProjectInfoSheet";
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
import EmployeeLocations from "./pages/EmployeeLocations";
import ProjectGeofence from "./pages/ProjectGeofence";
import GeofenceEvents from "./pages/GeofenceEvents";
import PendingJobs from "./pages/PendingJobs";
import DesktopHeader from "./Components/DesktopHeader";

function AppContent() {
  const location = useLocation();
  
  // Don't show header on public pages
  const isPublicPage = location.pathname === '/proposal/commercial-public' || 
                       location.pathname === '/invoice/commercial-public' ||
                       location.pathname === '/invoice/view' ||
                       location.pathname === '/invoice/receipt' ||
                       location.pathname === '/invoice/pay-success' ||
                       location.pathname === '/proposal/view' ||
                       location.pathname === '/estimate/quick/view';
  
  return (
    <>
      {!isPublicPage && <DesktopHeader />}
      <div className="content">
        <Routes>
                <Route path="/signin" element={<SignIn />} />
                <Route path="/signup" element={<SignUp />} />
                <Route 
                  path="/profile-setup" 
                  element={<ProfileSetup />} 
                />
                <Route
                  path="/"
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
                      <TimeClock />
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
                <Route
                  path="/estimate/quick/view"
                  element={<QuickEstimateView />}
                />
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
                <Route
                  path="/invoice/view"
                  element={<InvoiceView />}
                />
                <Route
                  path="/invoice/receipt"
                  element={<InvoiceReceipt />}
                />
                <Route
                  path="/invoice/pay-success"
                  element={<InvoicePaySuccess />}
                />
                <Route
                  path="/invoice/detailed-report"
                  element={
                    <ProtectedRoute>
                      <InvoiceDetailedReport />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/invoice/commercial-public"
                  element={<InvoiceCommercialPublic />}
                />
                <Route
                  path="/proposal/view"
                  element={<ProposalView />}
                />
                <Route
                  path="/proposal/commercial-public"
                  element={<ProposalCommercialPublic />}
                />
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
