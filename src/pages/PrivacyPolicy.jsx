import { useSearchParams } from "react-router-dom";

// Public, no-auth legal page — required for Google Play, App Store, and
// Twilio A2P 10DLC campaign registration (all of which require a live,
// publicly reachable Privacy Policy URL).
//
// Shared by every company in the platform (DML, DT Specialties, future
// companies) rather than duplicated per-app: pass ?company=<slug> to render
// the right name/contact info. Defaults to DML if omitted, since that's the
// original TradeFlow/Comms app's identity.
//
// URLs:
//   https://tradeflow-app.vercel.app/privacy?company=dml
//   https://tradeflow-app.vercel.app/privacy?company=dt-specialties

const COMPANIES = {
  dml: {
    name: "DML Electrical Service, LLC",
    appName: "TradeFlow / DML Comms",
    email: "dustin@dmlelectrical.com",
    phone: "(337) 288-0395",
  },
  "dt-specialties": {
    name: "DT Specialties",
    appName: "DT Specialties Comms",
    email: "dustin@dtspecialties.com",
    phone: "(337) 288-0395",
  },
};

const BRAND = { blue: "#0b3ea8", orange: "#fc6b04", textDark: "#111827", textMid: "#374151" };

export default function PrivacyPolicy() {
  const [params] = useSearchParams();
  const key = (params.get("company") || "dml").toLowerCase();
  const company = COMPANIES[key] || COMPANIES.dml;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px", fontFamily: "Arial, sans-serif", lineHeight: 1.6, color: BRAND.textMid }}>
      <h1 style={{ color: BRAND.blue }}>{company.appName} Privacy Policy</h1>
      <p><strong>Effective Date:</strong> January 1, 2026</p>
      <p><strong>Last Updated:</strong> {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

      <h2 style={{ color: BRAND.orange, marginTop: 30 }}>1. Introduction</h2>
      <p>
        Welcome to {company.appName}, operated by {company.name} ("we," "us," or "our").
        This Privacy Policy explains how we collect, use, disclose, and protect your
        information when you use our mobile application and communications platform,
        including phone calls, SMS text messages, and related account services.
      </p>
      <p>By using {company.appName}, you agree to the collection and use of information in accordance with this policy.</p>

      <h2 style={{ color: BRAND.orange, marginTop: 30 }}>2. Information We Collect</h2>
      <h3 style={{ color: BRAND.textDark }}>2.1 Personal Information</h3>
      <p>When you create an account or interact with us, we may collect:</p>
      <ul>
        <li><strong>Name and email address</strong> — used for account creation and login</li>
        <li><strong>Phone number</strong> — used to place/receive calls and text messages, and for account recovery</li>
        <li><strong>Company/employee role</strong> — to determine access within the app</li>
      </ul>

      <h3 style={{ color: BRAND.textDark }}>2.2 Communications Data</h3>
      <p>When you use our calling and texting features:</p>
      <ul>
        <li><strong>Call and text metadata</strong> — phone numbers, timestamps, and duration</li>
        <li><strong>Message content</strong> — the text of SMS messages sent and received</li>
        <li><strong>Call recordings and transcripts</strong> (when enabled) — used for quality, dispute resolution, and AI-assisted call summaries</li>
      </ul>

      <h3 style={{ color: BRAND.textDark }}>2.3 Time Clock &amp; Location Data</h3>
      <p>When you use time clock features (if applicable to your role):</p>
      <ul>
        <li><strong>Clock in/out times</strong> — to track work hours</li>
        <li><strong>Location data (GPS)</strong> — to verify job site locations, only when clocking in/out</li>
        <li><strong>Project assignments</strong> — to associate time entries with specific jobs</li>
      </ul>

      <h3 style={{ color: BRAND.textDark }}>2.4 Automatically Collected Information</h3>
      <ul>
        <li>Device model and operating system version</li>
        <li>App usage and performance data</li>
        <li>Log data, timestamps, and error reports</li>
      </ul>

      <h2 style={{ color: BRAND.orange, marginTop: 30 }}>3. How We Use Your Information</h2>
      <ul>
        <li><strong>Communications</strong> — connecting calls, delivering text messages, and routing customer inquiries to the correct team member</li>
        <li><strong>Customer Service</strong> — sending appointment confirmations, invoice and payment links, and responding to customer requests via SMS</li>
        <li><strong>Account Management</strong> — creating and managing your account</li>
        <li><strong>Time Tracking</strong> — recording work hours for payroll purposes</li>
        <li><strong>Project Management</strong> — assigning employees to jobs and tracking progress</li>
        <li><strong>Reporting</strong> — generating timesheets and project reports</li>
        <li><strong>App Improvement</strong> — analyzing usage to improve features and performance</li>
        <li><strong>Support</strong> — responding to user inquiries and technical issues</li>
      </ul>

      <h2 style={{ color: BRAND.orange, marginTop: 30 }}>4. SMS / Text Messaging</h2>
      <p>
        If you provide your phone number to {company.name} (for example, when scheduling
        service, requesting a quote, or communicating with our team), you may receive SMS
        text messages related to appointment confirmations, invoices, and service updates.
      </p>
      <ul>
        <li>Message frequency varies based on your interactions with us.</li>
        <li>Message and data rates may apply.</li>
        <li>Reply <strong>STOP</strong> at any time to opt out of text messages.</li>
        <li>Reply <strong>HELP</strong> for assistance.</li>
        <li>We do not share your mobile number or SMS opt-in with third parties or affiliates for marketing purposes.</li>
      </ul>

      <h2 style={{ color: BRAND.orange, marginTop: 30 }}>5. Data Sharing and Disclosure</h2>
      <h3 style={{ color: BRAND.textDark }}>5.1 We Do Not Sell Your Data</h3>
      <p>We do not sell, rent, or trade your personal information to third parties.</p>

      <h3 style={{ color: BRAND.textDark }}>5.2 Sharing Within Your Organization</h3>
      <p>Your data is accessible to:</p>
      <ul>
        <li><strong>Company administrators</strong> — can view call/text logs, time clock entries, and employee information</li>
        <li><strong>Project managers</strong> — can view time entries and communications tied to their projects</li>
      </ul>

      <h3 style={{ color: BRAND.textDark }}>5.3 Service Providers</h3>
      <p>
        We use trusted third-party providers to operate our platform, including
        Supabase (database and authentication) and Twilio (phone calls and SMS
        delivery). These providers process data solely to provide their service
        to us and are contractually bound to protect your information.
      </p>

      <h2 style={{ color: BRAND.orange, marginTop: 30 }}>6. Data Retention</h2>
      <p>
        We retain call logs, text messages, and account data for as long as
        necessary to provide our services and comply with legal obligations.
        You may request deletion of your data at any time by contacting us
        below.
      </p>

      <h2 style={{ color: BRAND.orange, marginTop: 30 }}>7. Your Rights</h2>
      <p>
        You may request access to, correction of, or deletion of your personal
        information by contacting us at {company.email}. California residents
        have additional rights under the CCPA, including the right to know
        what personal information is collected and the right to request
        deletion.
      </p>

      <h2 style={{ color: BRAND.orange, marginTop: 30 }}>8. Data Security</h2>
      <p>
        We use industry-standard security measures, including encryption in
        transit and at rest, to protect your information. However, no method
        of transmission over the internet is 100% secure.
      </p>

      <h2 style={{ color: BRAND.orange, marginTop: 30 }}>9. Children's Privacy</h2>
      <p>
        Our services are not directed to individuals under 18. We do not
        knowingly collect personal information from children.
      </p>

      <h2 style={{ color: BRAND.orange, marginTop: 30 }}>10. International Users</h2>
      <p>
        Your information will be transferred to, stored, and processed in the
        United States, where our servers are located.
      </p>

      <h2 style={{ color: BRAND.orange, marginTop: 30 }}>11. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify
        you of material changes by updating the "Last Updated" date above.
      </p>

      <h2 style={{ color: BRAND.orange, marginTop: 30 }}>12. Contact Us</h2>
      <p>
        If you have questions about this Privacy Policy, contact us at:
        <br />
        <strong>{company.name}</strong>
        <br />
        Email: {company.email}
        <br />
        Phone: {company.phone}
      </p>

      <hr style={{ margin: "40px 0" }} />
      <p><em>This Privacy Policy applies to {company.appName}, a product of {company.name}. See also our <a href={`/terms?company=${key}`}>Terms of Service</a>.</em></p>
    </div>
  );
}
