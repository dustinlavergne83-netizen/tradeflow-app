export default function DeleteAccount() {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-orange-400">
          <div className="w-10 h-10 bg-blue-800 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">TF</span>
          </div>
          <h1 className="text-2xl font-bold text-blue-900">
            TradeFlow — Account & Data Deletion
          </h1>
        </div>

        <p className="text-gray-700 mb-6">
          This page explains how to request deletion of your TradeFlow account
          and associated personal data.
        </p>

        {/* How to request */}
        <h2 className="text-xl font-semibold text-blue-900 mt-6 mb-3">
          How to Request Account Deletion
        </h2>
        <div className="bg-blue-50 border-l-4 border-blue-800 p-4 rounded mb-6">
          <p className="font-semibold text-gray-800 mb-2">
            Send an email to:
          </p>
          <a
            href="mailto:dmlelectricalcontractor@gmail.com"
            className="text-blue-800 font-bold text-lg hover:underline"
          >
            dmlelectricalcontractor@gmail.com
          </a>
          <p className="text-gray-700 mt-3 mb-1">
            Please include the following in your email:
          </p>
          <ul className="list-disc pl-5 text-gray-700 space-y-1">
            <li>Your full name</li>
            <li>The email address associated with your TradeFlow account</li>
            <li>
              Subject line: <strong>"Account Deletion Request"</strong>
            </li>
          </ul>
        </div>

        {/* What gets deleted */}
        <h2 className="text-xl font-semibold text-blue-900 mt-6 mb-3">
          What Data Will Be Deleted
        </h2>
        <p className="text-gray-700 mb-2">
          Upon receiving your request, we will permanently delete:
        </p>
        <ul className="list-disc pl-5 text-gray-700 space-y-1 mb-6">
          <li>
            <strong>Account Information:</strong> Your name, email address, and
            login credentials
          </li>
          <li>
            <strong>Time Clock Entries:</strong> All clock-in/out records and
            time tracking data
          </li>
          <li>
            <strong>Location Data:</strong> Any GPS coordinates associated with
            your time entries
          </li>
          <li>
            <strong>Project Assignments:</strong> Your assigned jobs and work
            history
          </li>
          <li>
            <strong>Profile Information:</strong> Any personal information
            stored in your profile
          </li>
        </ul>

        {/* Important notice */}
        <div className="bg-yellow-50 border-l-4 border-orange-400 p-4 rounded mb-6">
          <p className="font-semibold text-gray-800 mb-2">Important:</p>
          <ul className="list-disc pl-5 text-gray-700 space-y-1">
            <li>
              Account deletion is <strong>permanent and cannot be undone</strong>
            </li>
            <li>
              Data will be deleted within <strong>30 days</strong> of your
              request
            </li>
            <li>
              Your employer may retain anonymized timesheet records for payroll
              and legal compliance
            </li>
            <li>We do not sell or share your personal data with third parties</li>
          </ul>
        </div>

        {/* Partial deletion */}
        <h2 className="text-xl font-semibold text-blue-900 mt-6 mb-3">
          Partial Data Deletion
        </h2>
        <p className="text-gray-700 mb-6">
          If you want to delete only specific data (for example, removing old
          location history while keeping your account active), email us at the
          address above and specify what you'd like removed.
        </p>

        {/* Response time */}
        <h2 className="text-xl font-semibold text-blue-900 mt-6 mb-3">
          Response Time
        </h2>
        <p className="text-gray-700 mb-6">
          We will respond within <strong>7 business days</strong> and complete
          the deletion within <strong>30 days</strong> of your request.
        </p>

        {/* Footer */}
        <hr className="my-8 border-gray-200" />
        <p className="text-center text-sm text-gray-500">
          TradeFlow by DML Electrical Contractor
          <br />
          Last Updated: May 2026
        </p>
      </div>
    </div>
  );
}
