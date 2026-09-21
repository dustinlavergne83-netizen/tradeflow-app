import { useSearchParams } from "react-router-dom";

// Public, no-auth legal page — required for Google Play, App Store, and
// Twilio A2P 10DLC campaign registration. See PrivacyPolicy.jsx for the
// same ?company= pattern.
//
// URLs:
//   https://tradeflow-app.vercel.app/terms?company=dml
//   https://tradeflow-app.vercel.app/terms?company=dt-specialties

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

export default function TermsOfService() {
  const [params] = useSearchParams();
  const key = (params.get("company") || "dml").toLowerCase();
  const company = COMPANIES[key] || COMPANIES.dml;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px", fontFamily: "Arial, sans-serif", lineHeight: 1.6, color: BRAND.textMid }}>
      <h1 style={{ color: BRAND.blue }}>{company.appName} Terms of Service</h1>
      <p><strong>Effective Date:</strong> January 1, 2026</p>
      <p><strong>Last Updated:</strong> {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

      <h2 style={{ color: BRAND.orange, marginTop: 30 }}>1. Acceptance of Terms</h2>
      <p>
        These Terms of Service ("Terms") govern your use of {company.appName},
        operated by {company.name} ("we," "us," or "our"). By accessing or
        using our mobile application and communications platform, you agree
        to be bound by these Terms. If you do not agree, do not use the app.
      </p>

      <h2 style={{ color: BRAND.orange, marginTop: 30 }}>2. Description of Service</h2>
      <p>
        {company.appName} provides employees and administrators of {company.name}
        with tools to manage phone calls, SMS text messaging, customer
        communications, time tracking, and project management related to our
        business operations.
      </p>

      <h2 style={{ color: BRAND.orange, marginTop: 30 }}>3. Eligibility</h2>
      <p>
        This app is intended for use by employees, contractors, and
        authorized administrators of {company.name}. Access is granted on an
        invitation basis and may be revoked at any time.
      </p>

      <h2 style={{ color: BRAND.orange, marginTop: 30 }}>4. SMS / Text Messaging Terms</h2>
      <p>
        Customers who provide their phone number to {company.name} may
        receive SMS messages related to appointments, invoices, and service
        updates. By providing your number, you consent to receive these
        messages.
      </p>
      <ul>
        <li>Message frequency varies based on your interactions with us.</li>
        <li>Message and data rates may apply.</li>
        <li>Reply <strong>STOP</strong> at any time to cancel/opt out.</li>
        <li>Reply <strong>HELP</strong> for help, or contact {company.email} / {company.phone}.</li>
        <li>Carriers are not liable for delayed or undelivered messages.</li>
      </ul>

      <h2 style={{ color: BRAND.orange, marginTop: 30 }}>5. Call Recording</h2>
      <p>
        Some calls made or received through this platform may be recorded
        for quality assurance, training, and dispute resolution purposes.
        Where required by law, callers will be notified that the call may be
        recorded.
      </p>

      <h2 style={{ color: BRAND.orange, marginTop: 30 }}>6. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the app for any unlawful purpose</li>
        <li>Send unsolicited or abusive messages through the platform</li>
        <li>Attempt to access accounts or data that do not belong to you</li>
        <li>Interfere with or disrupt the platform's operation</li>
      </ul>

      <h2 style={{ color: BRAND.orange, marginTop: 30 }}>7. Account Responsibility</h2>
      <p>
        You are responsible for maintaining the confidentiality of your
        account credentials and for all activity under your account.
      </p>

      <h2 style={{ color: BRAND.orange, marginTop: 30 }}>8. Service Availability</h2>
      <p>
        We strive to keep the platform available at all times but do not
        guarantee uninterrupted service. Calls and messages depend on
        third-party carriers and infrastructure (including Twilio) that are
        outside our direct control.
      </p>

      <h2 style={{ color: BRAND.orange, marginTop: 30 }}>9. Limitation of Liability</h2>
      <p>
        To the fullest extent permitted by law, {company.name} is not liable
        for indirect, incidental, or consequential damages arising from your
        use of the app, including missed calls, delayed messages, or data
        loss.
      </p>

      <h2 style={{ color: BRAND.orange, marginTop: 30 }}>10. Termination</h2>
      <p>
        We may suspend or terminate your access to the app at any time,
        including upon termination of your employment or contractor
        relationship with {company.name}.
      </p>

      <h2 style={{ color: BRAND.orange, marginTop: 30 }}>11. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. Continued use of the
        app after changes take effect constitutes acceptance of the revised
        Terms.
      </p>

      <h2 style={{ color: BRAND.orange, marginTop: 30 }}>12. Governing Law</h2>
      <p>
        These Terms are governed by the laws of the State of Louisiana,
        without regard to its conflict of law provisions.
      </p>

      <h2 style={{ color: BRAND.orange, marginTop: 30 }}>13. Contact Us</h2>
      <p>
        If you have questions about these Terms, contact us at:
        <br />
        <strong>{company.name}</strong>
        <br />
        Email: {company.email}
        <br />
        Phone: {company.phone}
      </p>

      <hr style={{ margin: "40px 0" }} />
      <p><em>These Terms of Service apply to {company.appName}, a product of {company.name}. See also our <a href={`/privacy?company=${key}`}>Privacy Policy</a>.</em></p>
    </div>
  );
}
