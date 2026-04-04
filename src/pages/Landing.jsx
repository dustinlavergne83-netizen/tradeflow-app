import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useEffect, useState } from "react";
import logo from "../assets/LOGOD.jpg";
import { supabase } from "../lib/supabase";

const BRAND = {
  blue: "#0b3ea8",
  orange: "#fc6b04",
  darkBlue: "#092d7e",
  lightBlue: "#1a4fc7",
  white: "#ffffff",
  gray: "#f8fafc",
  textDark: "#111827",
  textMid: "#374151",
  textLight: "#6b7280",
};

const PHONE = "(337) 288-0395";
const PHONE_HREF = "tel:3372880395";
const EMAIL = "dustin@dmlelectrical.com";
const SERVICE_AREA = "Jennings, LA and Surrounding Areas";

const services = [
  {
    icon: "🏠",
    title: "Residential Wiring",
    desc: "Whether you're building new, remodeling, or upgrading outdated systems, DML Electrical delivers clean, code-compliant residential wiring that keeps your home safe and powered for the future. We handle everything from rough-in to final trim with speed and precision.",
  },
  {
    icon: "🏢",
    title: "Commercial Wiring",
    desc: "DML Electrical delivers high-performance commercial wiring built for safety, scalability, and speed. Whether you're powering a retail space, office, warehouse, or industrial site, we design and install clean, code-compliant systems that support your operations and future growth.",
  },
  {
    icon: "🔋",
    title: "Standby Generator Installation & Service",
    desc: "Power outages don't wait—and neither do we. DML Electrical installs and services all major brands of standby generators, including Generac, Briggs & Stratton, Kohler, and more. We make sure it's installed right and ready when you need it most.",
  },
  {
    icon: "🏟️",
    title: "Sports & Outdoor Lighting",
    desc: "In partnership with Elite Sports Lighting, DML Electrical delivers high-performance outdoor lighting for athletic fields, walking paths, courts, arenas, and rodeo grounds. We bring industry-leading fixtures and layout expertise to every project—maximum visibility, minimal glare, long-lasting performance.",
    bullets: ["LED lighting for fields, courts, arenas & rodeo grounds", "Pole installation, trenching & conduit work", "Photometric planning & layout assistance", "Upgrades, retrofits & repairs"],
    badge: "⚡ Proud Partner of Elite Sports Lighting",
  },
  {
    icon: "⚡",
    title: "EV Charger Installation",
    desc: "DML Electrical installs Level 2 EV chargers for homes and businesses—delivering fast, safe, and code-compliant power for your vehicle. Tesla Wall Connector, ChargePoint, JuiceBox, or any universal charger—we handle the wiring, permitting, and installation from start to finish.",
    bullets: ["Level 2 charger installation (240V)", "Tesla, ChargePoint, JuiceBox & all major brands", "Panel upgrades & dedicated circuits", "Permitting, code compliance & inspection support"],
  },
  {
    icon: "🌾",
    title: "Agricultural Electrical Services",
    desc: "DML Electrical powers Louisiana's ag operations with clean, code-compliant electrical systems built for the field. From grain bins to irrigation pumps, we wire it right—fast, safe, and built to last through harvest season and beyond.",
    bullets: ["Grain & rice bin motor wiring", "Augers, conveyors & control panels", "Irrigation pump hookups & motor starters", "Lighting for barns, shops & outdoor work areas", "Troubleshooting, upgrades & code corrections"],
  },
];

const whyUs = [
  { icon: "✅", title: "Licensed & Insured", desc: "Fully licensed electrical contractors with comprehensive liability coverage." },
  { icon: "🏆", title: "Quality Workmanship", desc: "We stand behind every job with a satisfaction guarantee on all work performed." },
  { icon: "💬", title: "Free Estimates", desc: "Get a detailed written estimate at no charge before any work begins." },
  { icon: "⏱️", title: "On-Time Service", desc: "We respect your time. Our crews arrive on schedule, every time." },
];

const testimonials = [
  { name: "Michael T.", location: "Jennings, LA", stars: 5, text: "DML did a full panel upgrade on my home and the work was outstanding. Professional from start to finish, on time, and the price was fair. Won't call anyone else!" },
  { name: "Sandra B.", location: "Lake Charles, LA", stars: 5, text: "Had an electrical emergency on a Sunday evening and Dustin answered right away. Fixed the problem fast. That kind of service is hard to find. Highly recommend." },
  { name: "Ray Construction", location: "Sulphur, LA", stars: 5, text: "We use DML for all our commercial builds. Reliable, professional, and they know their stuff. Always shows up when they say they will. Great company." },
  { name: "Jennifer M.", location: "Jennings, LA", stars: 5, text: "Got a new EV charger installed in my garage. Dustin walked me through the whole process, got the permit handled, and the install was clean and fast. Very happy!" },
];

const serviceAreas = [
  "Jennings", "Lake Charles", "Lafayette", "Sulphur", "Crowley",
  "Rayne", "Iowa", "Welsh", "Oakdale", "DeRidder",
  "Abbeville", "New Iberia", "Morgan City", "Franklin",
];

export default function Landing() {
  const navigate = useNavigate();
  const { user, employee, customer, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [announcement, setAnnouncement] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    if (!loading && user) {
      if (customer) navigate("/customer/portal");
      // Employees can view the landing page (public website preview) - don't redirect them
      // The orange banner at the top lets them return to the dashboard
    }
  }, [user, customer, loading, navigate]);

  useEffect(() => {
    loadDynamicContent();
  }, []);

  async function loadDynamicContent() {
    // Load gallery
    const { data: photos } = await supabase
      .from("website_gallery")
      .select("*")
      .eq("visible", true)
      .order("display_order", { ascending: true });
    if (photos) setGalleryPhotos(photos);

    // Load announcement
    const { data: contentRows } = await supabase
      .from("website_content")
      .select("*")
      .eq("content_key", "announcement")
      .eq("active", true)
      .maybeSingle();
    if (contentRows?.content_value) setAnnouncement(contentRows.content_value);
  }

  const galleryCategories = ["all", ...new Set(galleryPhotos.map((p) => p.category).filter(Boolean))];
  const filteredPhotos = activeFilter === "all" ? galleryPhotos : galleryPhotos.filter((p) => p.category === activeFilter);

  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", color: BRAND.textDark }}>

      {/* ===== EMPLOYEE BACK BANNER ===== */}
      {employee && (
        <div style={{ backgroundColor: BRAND.orange, padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>
            👷 You're viewing the public website as {employee.first_name || "Employee"}
          </span>
          <button
            onClick={() => navigate("/dashboard")}
            style={{ padding: "6px 16px", backgroundColor: "#fff", color: BRAND.orange, border: "none", borderRadius: 6, fontSize: 13, fontWeight: 800, cursor: "pointer" }}
          >
            ← Back to Dashboard
          </button>
        </div>
      )}

      {/* ===== ANNOUNCEMENT BANNER ===== */}
      {announcement && (
        <div style={{ backgroundColor: BRAND.blue, padding: "12px 24px", textAlign: "center", fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.5 }}>
          📢 {announcement}
        </div>
      )}

      {/* ===== HEADER ===== */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.headerBrand}>
            <img src={logo} alt="DML Electrical" style={styles.headerLogo} />
            <div>
              <div style={styles.companyName}>DML Electrical Service</div>
              <div style={styles.companyTagline}>Licensed • Insured • Professional</div>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav style={styles.headerNav}>
            <a href="#services" style={styles.navLink}>Services</a>
            <a href="#about" style={styles.navLink}>About</a>
            <a href="#areas" style={styles.navLink}>Service Areas</a>
            <a href="#contact" style={styles.navLink}>Contact</a>
            <button style={styles.navBtnOutline} onClick={() => navigate("/customer/login")}>Customer Portal</button>
            <button style={styles.navBtnFill} onClick={() => navigate("/signin")}>Employee Login</button>
          </nav>

          {/* Mobile Hamburger */}
          <button style={styles.hamburger} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div style={styles.mobileMenu}>
            <a href="#services" style={styles.mobileMenuLink} onClick={() => setMenuOpen(false)}>Services</a>
            <a href="#about" style={styles.mobileMenuLink} onClick={() => setMenuOpen(false)}>About</a>
            <a href="#areas" style={styles.mobileMenuLink} onClick={() => setMenuOpen(false)}>Service Areas</a>
            <a href="#contact" style={styles.mobileMenuLink} onClick={() => setMenuOpen(false)}>Contact</a>
            <a href={PHONE_HREF} style={{ ...styles.mobileMenuLink, color: BRAND.orange }}>📞 {PHONE}</a>
            <button style={styles.mobileMenuBtn} onClick={() => { navigate("/customer/login"); setMenuOpen(false); }}>Customer Portal</button>
            <button style={{ ...styles.mobileMenuBtn, backgroundColor: BRAND.orange }} onClick={() => { navigate("/signin"); setMenuOpen(false); }}>Employee Login</button>
          </div>
        )}
      </header>

      {/* ===== TOP BAR ===== */}
      <div style={styles.topBar}>
        <span>📞 <a href={PHONE_HREF} style={{ color: "#fff", textDecoration: "none", fontWeight: 700 }}>{PHONE}</a></span>
        <span style={{ margin: "0 12px", opacity: 0.4 }}>|</span>
        <span>📧 <a href={`mailto:${EMAIL}`} style={{ color: "#fff", textDecoration: "none" }}>{EMAIL}</a></span>
        <span style={{ margin: "0 12px", opacity: 0.4 }}>|</span>
        <span>📍 {SERVICE_AREA}</span>
      </div>

      {/* ===== HERO ===== */}
      <section style={styles.hero}>
        <div style={styles.heroOverlay} />
        <div style={styles.heroContent}>
          <div style={styles.heroBadge}>⚡ Professional Electrical Contractor</div>
          <h1 style={styles.heroTitle}>
            DML Electrical<br />
            <span style={{ color: BRAND.orange }}>Service LLC</span>
          </h1>
          <p style={{ ...styles.heroSubtitle, fontSize: 22, fontWeight: 800, fontStyle: "italic", color: BRAND.orange, marginBottom: 16 }}>
            Done Right. First Time. Every Time.
          </p>
          <p style={styles.heroSubtitle}>
            At DML Electrical, we power more than buildings—we energize trust, speed, and precision. Whether you're upgrading your home, lighting a sports complex, or preparing for storm season, our licensed and insured team delivers clean, code-compliant electrical solutions built to last.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32, textAlign: "left", maxWidth: 480, margin: "0 auto 32px" }}>
            {["Residential & commercial wiring", "Standby generator installation & service", "Sports lighting for fields, courts & arenas", "Transparent estimates & fast turnaround"].map((item, i) => (
              <div key={i} style={{ color: "rgba(255,255,255,0.9)", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: "#22c55e", fontSize: 18 }}>✅</span> {item}
              </div>
            ))}
          </div>
          <div style={styles.heroCtas}>
            <a href={PHONE_HREF} style={styles.heroCtaPrimary}>📞 Call {PHONE}</a>
            <button style={styles.heroCtaSecondary} onClick={() => document.getElementById("contact").scrollIntoView({ behavior: "smooth" })}>
              Free Estimate →
            </button>
          </div>
          <div style={styles.heroStats}>
            <div style={styles.heroStat}><strong>⚡</strong> Licensed & Insured</div>
            <div style={styles.heroStatDivider} />
            <div style={styles.heroStat}><strong>🚨</strong> 24/7 Emergency</div>
            <div style={styles.heroStatDivider} />
            <div style={styles.heroStat}><strong>✅</strong> Free Estimates</div>
          </div>
        </div>
      </section>

      {/* ===== SERVICES ===== */}
      <section id="services" style={styles.section}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionLabel}>What We Do</div>
          <h2 style={styles.sectionTitle}>Our Electrical Services</h2>
          <p style={styles.sectionSubtitle}>
            From simple repairs to large commercial projects, DML Electrical handles it all with expertise and professionalism.
          </p>
          <div style={styles.servicesGrid}>
            {services.map((s, i) => (
              <div key={i} style={styles.serviceCard}>
                <div style={styles.serviceIcon}>{s.icon}</div>
                <h3 style={styles.serviceTitle}>{s.title}</h3>
                <p style={styles.serviceDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== WHY US ===== */}
      <section id="why-us" style={{ ...styles.section, backgroundColor: BRAND.gray }}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionLabel}>Why Choose Us</div>
          <h2 style={styles.sectionTitle}>The DML Difference</h2>
          <div style={styles.whyGrid}>
            {whyUs.map((w, i) => (
              <div key={i} style={styles.whyCard}>
                <div style={styles.whyIcon}>{w.icon}</div>
                <h3 style={styles.whyTitle}>{w.title}</h3>
                <p style={styles.whyDesc}>{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ABOUT US ===== */}
      <section id="about" style={styles.section}>
        <div style={styles.sectionInner}>
          <div style={styles.aboutGrid}>
            <div style={styles.aboutText}>
              <div style={styles.sectionLabel}>About The Owner</div>
              <h2 style={styles.sectionTitle}>Dustin Lavergne</h2>
              <div style={{ display: "inline-block", backgroundColor: BRAND.orange, color: "#fff", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 800, marginBottom: 16 }}>
                Owner & Lead Electrician
              </div>
              <p style={{ color: BRAND.textMid, lineHeight: 1.8, fontSize: 16, marginBottom: 20 }}>
                Dustin Lavergne, Owner & Lead Electrician, is the driving force behind DML Electrical—a licensed, insured electrical service built on speed, precision, and trust. With over a decade of hands-on experience and a sharp eye for detail, Dustin leads every project with a commitment to clean work, clear communication, and crew-friendly systems that keep jobs running smoothly.
              </p>
              <p style={{ color: BRAND.textMid, lineHeight: 1.8, fontSize: 16, marginBottom: 20 }}>
                Whether installing standby generators, lighting sports fields, or wiring agricultural operations, Dustin brings the same energy: <em style={{ fontWeight: 700, color: BRAND.blue }}>Done Right. First Time. Every Time.</em>
              </p>
              <p style={{ color: BRAND.textMid, lineHeight: 1.8, fontSize: 16, marginBottom: 28 }}>
                DML Electrical is also a proud partner of <strong>Elite Sports Lighting</strong>, delivering professional-grade lighting systems for athletic fields, arenas, and outdoor spaces across the Southeastern U.S.
              </p>
              <div style={styles.aboutStats}>
                <div style={styles.aboutStat}>
                  <div style={styles.aboutStatNum}>100%</div>
                  <div style={styles.aboutStatLabel}>Satisfaction Guarantee</div>
                </div>
                <div style={styles.aboutStat}>
                  <div style={styles.aboutStatNum}>24/7</div>
                  <div style={styles.aboutStatLabel}>Emergency Service</div>
                </div>
                <div style={styles.aboutStat}>
                  <div style={styles.aboutStatNum}>$0</div>
                  <div style={styles.aboutStatLabel}>Estimate Cost</div>
                </div>
              </div>
            </div>
            <div style={styles.aboutLicenses}>
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20, color: BRAND.textDark }}>Credentials & Coverage</h3>
              {[
                { icon: "🏛️", label: "Louisiana State Licensed Electrical Contractor" },
                { icon: "🛡️", label: "Fully Insured — General Liability & Workers' Comp" },
                { icon: "📋", label: "Permitted Work — We Pull All Required Permits" },
                { icon: "🔍", label: "NEC Code Compliant on All Installations" },
                { icon: "⭐", label: "Locally Owned & Operated in Jennings, LA" },
              ].map((item, i) => (
                <div key={i} style={styles.licenseItem}>
                  <span style={{ fontSize: 22 }}>{item.icon}</span>
                  <span style={{ fontSize: 14, color: BRAND.textMid, fontWeight: 600 }}>{item.label}</span>
                </div>
              ))}
              <a href={PHONE_HREF} style={styles.aboutCallBtn}>📞 Call Us Today: {PHONE}</a>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section style={{ ...styles.section, backgroundColor: BRAND.gray }}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionLabel}>Reviews</div>
          <h2 style={styles.sectionTitle}>What Our Customers Say</h2>
          <div style={styles.reviewsGrid}>
            {testimonials.map((t, i) => (
              <div key={i} style={styles.reviewCard}>
                <div style={styles.reviewStars}>{"⭐".repeat(t.stars)}</div>
                <p style={styles.reviewText}>"{t.text}"</p>
                <div style={styles.reviewAuthor}>
                  <div style={styles.reviewAvatar}>{t.name[0]}</div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: BRAND.textDark }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: BRAND.textLight }}>{t.location}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== OUR WORK GALLERY (dynamic) ===== */}
      {galleryPhotos.length > 0 && (
        <section id="our-work" style={styles.section}>
          <div style={styles.sectionInner}>
            <div style={styles.sectionLabel}>Our Work</div>
            <h2 style={styles.sectionTitle}>Recent Projects</h2>
            <p style={styles.sectionSubtitle}>A look at some of the work we've done for customers across South Louisiana.</p>

            {/* Category Filter */}
            {galleryCategories.length > 2 && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 32 }}>
                {galleryCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveFilter(cat)}
                    style={{
                      padding: "8px 20px",
                      backgroundColor: activeFilter === cat ? BRAND.blue : "#f3f4f6",
                      color: activeFilter === cat ? "#fff" : "#374151",
                      border: activeFilter === cat ? `2px solid ${BRAND.blue}` : "2px solid #e5e7eb",
                      borderRadius: 24,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    {cat === "all" ? "All Projects" : cat}
                  </button>
                ))}
              </div>
            )}

            {/* Photo Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
              {filteredPhotos.map((photo) => (
                <div
                  key={photo.id}
                  style={{
                    borderRadius: 16,
                    overflow: "hidden",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <div style={{ position: "relative", height: 220, overflow: "hidden" }}>
                    <img
                      src={photo.image_url}
                      alt={photo.title || "DML Electrical project"}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    {photo.category && (
                      <div style={{
                        position: "absolute", bottom: 10, left: 10,
                        backgroundColor: "rgba(11,62,168,0.85)", color: "#fff",
                        padding: "3px 12px", borderRadius: 20, fontSize: 11,
                        fontWeight: 700, textTransform: "capitalize",
                      }}>
                        {photo.category}
                      </div>
                    )}
                  </div>
                  {(photo.title || photo.description) && (
                    <div style={{ padding: "14px 16px" }}>
                      {photo.title && <div style={{ fontSize: 14, fontWeight: 800, color: "#111", marginBottom: 4 }}>{photo.title}</div>}
                      {photo.description && <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{photo.description}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== SERVICE AREAS ===== */}
      <section id="areas" style={{ ...styles.section, backgroundColor: BRAND.blue }}>
        <div style={styles.sectionInner}>
          <div style={{ ...styles.sectionLabel, color: "rgba(255,255,255,0.7)", backgroundColor: "rgba(255,255,255,0.15)" }}>
            Where We Work
          </div>
          <h2 style={{ ...styles.sectionTitle, color: "#fff" }}>Service Areas</h2>
          <p style={{ ...styles.sectionSubtitle, color: "rgba(255,255,255,0.8)" }}>
            Based in Jennings, LA — we serve all of Southwest Louisiana including:
          </p>
          <div style={styles.areasGrid}>
            {serviceAreas.map((area, i) => (
              <div key={i} style={styles.areaChip}>
                <span style={{ color: BRAND.orange, marginRight: 6 }}>📍</span>{area}
              </div>
            ))}
          </div>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginTop: 24, textAlign: "center" }}>
            Not seeing your area? Give us a call — we may still be able to help!
          </p>
        </div>
      </section>

      {/* ===== PORTALS ===== */}
      <section style={styles.section}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionLabel}>Online Portals</div>
          <h2 style={styles.sectionTitle}>Access Your Portal</h2>
          <p style={styles.sectionSubtitle}>
            Customers and employees can log in to manage estimates, invoices, timeclock, and more.
          </p>
          <div style={styles.portalsGrid}>
            <div style={styles.portalCard}>
              <div style={styles.portalIcon}>👤</div>
              <h3 style={styles.portalTitle}>Customer Portal</h3>
              <p style={styles.portalDesc}>View estimates, pay invoices online, track project status, and view your payment history.</p>
              <ul style={styles.portalFeatureList}>
                <li>✓ View & accept estimates</li>
                <li>✓ Pay invoices online</li>
                <li>✓ Track project status</li>
                <li>✓ View receipts & history</li>
              </ul>
              <button style={styles.portalBtn} onClick={() => navigate("/customer/login")}>Customer Login →</button>
            </div>
            <div style={{ ...styles.portalCard, borderTop: `4px solid ${BRAND.orange}` }}>
              <div style={styles.portalIcon}>👷</div>
              <h3 style={styles.portalTitle}>Employee Portal</h3>
              <p style={styles.portalDesc}>Clock in and out, view your weekly hours, and stay connected with the team.</p>
              <ul style={styles.portalFeatureList}>
                <li>✓ Time clock in/out</li>
                <li>✓ View weekly hours</li>
                <li>✓ Check pay stubs</li>
                <li>✓ View schedule</li>
              </ul>
              <button style={{ ...styles.portalBtn, backgroundColor: BRAND.orange }} onClick={() => navigate("/signin")}>Employee Login →</button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CONTACT ===== */}
      <section id="contact" style={{ ...styles.section, backgroundColor: BRAND.gray }}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionLabel}>Get In Touch</div>
          <h2 style={styles.sectionTitle}>Contact DML Electrical</h2>
          <div style={styles.contactGrid}>
            <div style={styles.contactInfo}>
              <h3 style={styles.contactInfoTitle}>We're Here to Help</h3>
              <p style={{ color: BRAND.textMid, marginBottom: 24, lineHeight: 1.7 }}>
                Ready to start your project or have an electrical emergency? Contact us today for fast, reliable service. Free estimates on all new work.
              </p>
              <div style={styles.contactItems}>
                <div style={styles.contactItem}>
                  <span style={styles.contactItemIcon}>📞</span>
                  <div>
                    <div style={styles.contactItemLabel}>Phone / Emergency</div>
                    <a href={PHONE_HREF} style={{ ...styles.contactItemValue, textDecoration: "none", color: BRAND.blue }}>{PHONE}</a>
                  </div>
                </div>
                <div style={styles.contactItem}>
                  <span style={styles.contactItemIcon}>📧</span>
                  <div>
                    <div style={styles.contactItemLabel}>Email</div>
                    <a href={`mailto:${EMAIL}`} style={{ ...styles.contactItemValue, textDecoration: "none", color: BRAND.blue }}>{EMAIL}</a>
                  </div>
                </div>
                <div style={styles.contactItem}>
                  <span style={styles.contactItemIcon}>📍</span>
                  <div>
                    <div style={styles.contactItemLabel}>Based In</div>
                    <div style={styles.contactItemValue}>Jennings, LA 70546</div>
                  </div>
                </div>
                <div style={styles.contactItem}>
                  <span style={styles.contactItemIcon}>📍</span>
                  <div>
                    <div style={styles.contactItemLabel}>Service Area</div>
                    <div style={styles.contactItemValue}>All of Southwest Louisiana</div>
                  </div>
                </div>
                <div style={styles.contactItem}>
                  <span style={styles.contactItemIcon}>🕐</span>
                  <div>
                    <div style={styles.contactItemLabel}>Hours</div>
                    <div style={styles.contactItemValue}>Mon–Fri 7am–6pm | 24/7 Emergency</div>
                  </div>
                </div>
              </div>
            </div>
            <div style={styles.contactForm}>
              <h3 style={styles.contactInfoTitle}>Request a Free Estimate</h3>
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer style={styles.footer}>
        <div style={styles.footerInner}>
          <div style={styles.footerBrand}>
            <img src={logo} alt="DML Electrical" style={{ height: 40, objectFit: "contain" }} />
            <div style={styles.footerBrandName}>DML Electrical Service</div>
            <div style={styles.footerBrandTagline}>Licensed • Insured • Professional</div>
          </div>
          <div style={styles.footerLinks}>
            <a href="#services" style={styles.footerLink}>Services</a>
            <a href="#about" style={styles.footerLink}>About</a>
            <a href="#areas" style={styles.footerLink}>Service Areas</a>
            <a href="#contact" style={styles.footerLink}>Contact</a>
            <a href={PHONE_HREF} style={{ ...styles.footerLink, color: BRAND.orange }}>{PHONE}</a>
            <button style={styles.footerLinkBtn} onClick={() => navigate("/customer/login")}>Customer Portal</button>
            <button style={styles.footerLinkBtn} onClick={() => navigate("/signin")}>Employee Login</button>
          </div>
          <div style={styles.footerCopy}>
            © {new Date().getFullYear()} DML Electrical Service, LLC. All rights reserved. | Jennings, LA
            <br />
            <span style={{ fontSize: 11, opacity: 0.5 }}>Powered by TradeFlow</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ===== CONTACT FORM WITH RESEND =====
function ContactForm() {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", service: "", message: "" });
  const [status, setStatus] = useState("idle"); // idle | sending | success | error

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName || !form.email) return;
    setStatus("sending");
    try {
      const { error } = await supabase.functions.invoke("contact-form", { body: form });
      if (error) throw error;
      setStatus("success");
      setForm({ firstName: "", lastName: "", email: "", phone: "", service: "", message: "" });
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h3 style={{ color: "#065f46", fontWeight: 800, fontSize: 20, margin: "0 0 8px 0" }}>Request Sent!</h3>
        <p style={{ color: "#374151", fontSize: 15, lineHeight: 1.7, margin: "0 0 20px 0" }}>
          Thanks! We'll get back to you within 1 business day.<br />
          For emergencies, call us directly at <a href={PHONE_HREF} style={{ color: BRAND.blue, fontWeight: 700 }}>{PHONE}</a>
        </p>
        <button onClick={() => setStatus("idle")} style={{ padding: "10px 24px", backgroundColor: BRAND.blue, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          Send Another Request
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <input name="firstName" value={form.firstName} onChange={handleChange} type="text" placeholder="First Name *" required style={fStyles.input} />
        <input name="lastName" value={form.lastName} onChange={handleChange} type="text" placeholder="Last Name" style={fStyles.input} />
      </div>
      <input name="email" value={form.email} onChange={handleChange} type="email" placeholder="Email Address *" required style={fStyles.input} />
      <input name="phone" value={form.phone} onChange={handleChange} type="tel" placeholder="Phone Number" style={fStyles.input} />
      <select name="service" value={form.service} onChange={handleChange} style={fStyles.input}>
        <option value="">Type of Service Needed</option>
        <option>Residential</option>
        <option>Commercial</option>
        <option>Industrial</option>
        <option>Service & Repair</option>
        <option>EV Charging</option>
        <option>Emergency</option>
        <option>Other</option>
      </select>
      <textarea name="message" value={form.message} onChange={handleChange} placeholder="Describe your project or issue..." rows={4} style={{ ...fStyles.input, resize: "vertical" }} />
      {status === "error" && (
        <p style={{ color: "#dc2626", fontSize: 13, margin: 0, textAlign: "center" }}>
          Something went wrong. Please call us at <a href={PHONE_HREF} style={{ color: "#dc2626" }}>{PHONE}</a>
        </p>
      )}
      <button type="submit" disabled={status === "sending"} style={{ ...fStyles.submitBtn, opacity: status === "sending" ? 0.7 : 1 }}>
        {status === "sending" ? "⏳ Sending..." : "📨 Send Request"}
      </button>
      <p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", margin: 0 }}>
        We'll respond within 1 business day. For emergencies, call directly.
      </p>
    </form>
  );
}

const fStyles = {
  input: {
    padding: "12px 16px", fontSize: 14, border: "2px solid #e5e7eb",
    borderRadius: 8, outline: "none", backgroundColor: "#fff",
    color: "#111", width: "100%", boxSizing: "border-box",
  },
  submitBtn: {
    padding: "14px", backgroundColor: BRAND.orange, color: "#fff",
    border: "none", borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: "pointer",
  },
};

const styles = {
  /* HEADER */
  header: { backgroundColor: BRAND.blue, padding: "12px 24px", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 12px rgba(0,0,0,0.25)" },
  headerInner: { maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 },
  headerBrand: { display: "flex", alignItems: "center", gap: 12 },
  headerLogo: { height: 48, objectFit: "contain" },
  companyName: { color: BRAND.orange, fontSize: 20, fontWeight: 900, fontStyle: "italic", lineHeight: 1.1 },
  companyTagline: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: 600, letterSpacing: 0.5 },
  headerNav: { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" },
  navLink: { color: "rgba(255,255,255,0.85)", textDecoration: "none", fontSize: 14, fontWeight: 600, padding: "4px 8px", borderRadius: 4 },
  navBtnOutline: { padding: "8px 16px", backgroundColor: "transparent", border: "2px solid rgba(255,255,255,0.6)", color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" },
  navBtnFill: { padding: "8px 16px", backgroundColor: BRAND.orange, border: "none", color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" },
  hamburger: { display: "none", backgroundColor: "transparent", border: "none", color: "#fff", fontSize: 26, cursor: "pointer", padding: "4px 8px",
    "@media (max-width: 768px)": { display: "block" }
  },
  mobileMenu: { backgroundColor: BRAND.darkBlue, padding: "12px 24px", display: "flex", flexDirection: "column", gap: 8 },
  mobileMenuLink: { color: "rgba(255,255,255,0.9)", textDecoration: "none", fontSize: 16, fontWeight: 600, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.1)" },
  mobileMenuBtn: { padding: "12px", backgroundColor: BRAND.blue, border: "2px solid rgba(255,255,255,0.3)", color: "#fff", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 4 },

  /* TOP BAR */
  topBar: { backgroundColor: BRAND.darkBlue, padding: "8px 24px", textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.8)", display: "flex", justifyContent: "center", alignItems: "center", flexWrap: "wrap", gap: 4 },

  /* HERO */
  hero: { minHeight: "88vh", background: `linear-gradient(135deg, ${BRAND.darkBlue} 0%, ${BRAND.blue} 50%, #1a5fc7 100%)`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", padding: "60px 24px" },
  heroOverlay: { position: "absolute", inset: 0, background: "radial-gradient(ellipse at 70% 50%, rgba(252,107,4,0.15) 0%, transparent 70%)", pointerEvents: "none" },
  heroContent: { textAlign: "center", maxWidth: 720, position: "relative", zIndex: 2 },
  heroBadge: { display: "inline-block", backgroundColor: "rgba(252,107,4,0.2)", border: "1px solid rgba(252,107,4,0.5)", color: BRAND.orange, padding: "6px 20px", borderRadius: 24, fontSize: 13, fontWeight: 700, letterSpacing: 0.5, marginBottom: 20 },
  heroTitle: { fontSize: 72, fontWeight: 900, color: "#fff", margin: "0 0 16px 0", lineHeight: 1.05, fontStyle: "italic" },
  heroSubtitle: { fontSize: 18, color: "rgba(255,255,255,0.8)", marginBottom: 36, lineHeight: 1.7 },
  heroCtas: { display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 40 },
  heroCtaPrimary: { padding: "16px 36px", backgroundColor: BRAND.orange, color: "#fff", border: "none", borderRadius: 12, fontSize: 17, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px rgba(252,107,4,0.4)", textDecoration: "none", display: "inline-block" },
  heroCtaSecondary: { padding: "16px 36px", backgroundColor: "rgba(255,255,255,0.15)", color: "#fff", border: "2px solid rgba(255,255,255,0.4)", borderRadius: 12, fontSize: 17, fontWeight: 700, cursor: "pointer" },
  heroStats: { display: "flex", gap: 20, justifyContent: "center", alignItems: "center", color: "rgba(255,255,255,0.75)", fontSize: 14, fontWeight: 600, flexWrap: "wrap" },
  heroStat: { display: "flex", alignItems: "center", gap: 8 },
  heroStatDivider: { width: 1, height: 20, backgroundColor: "rgba(255,255,255,0.3)" },

  /* SECTIONS */
  section: { padding: "80px 24px", backgroundColor: "#fff" },
  sectionInner: { maxWidth: 1100, margin: "0 auto" },
  sectionLabel: { display: "inline-block", backgroundColor: "rgba(11,62,168,0.1)", color: BRAND.blue, padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 },
  sectionTitle: { fontSize: 40, fontWeight: 900, margin: "0 0 12px 0", color: BRAND.textDark },
  sectionSubtitle: { fontSize: 16, color: BRAND.textLight, maxWidth: 580, lineHeight: 1.7, marginBottom: 48 },

  /* SERVICES */
  servicesGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24 },
  serviceCard: { backgroundColor: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 2px 16px rgba(0,0,0,0.06)", border: "1px solid #e5e7eb" },
  serviceIcon: { fontSize: 40, marginBottom: 16 },
  serviceTitle: { fontSize: 18, fontWeight: 800, color: BRAND.textDark, margin: "0 0 10px 0" },
  serviceDesc: { fontSize: 14, color: BRAND.textLight, lineHeight: 1.7, margin: 0 },

  /* WHY US */
  whyGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 24 },
  whyCard: { backgroundColor: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 2px 10px rgba(0,0,0,0.06)", borderTop: `4px solid ${BRAND.blue}` },
  whyIcon: { fontSize: 36, marginBottom: 14 },
  whyTitle: { fontSize: 17, fontWeight: 800, color: BRAND.textDark, margin: "0 0 8px 0" },
  whyDesc: { fontSize: 14, color: BRAND.textLight, lineHeight: 1.6, margin: 0 },

  /* ABOUT */
  aboutGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 56, alignItems: "start" },
  aboutText: {},
  aboutStats: { display: "flex", gap: 24, flexWrap: "wrap" },
  aboutStat: { textAlign: "center" },
  aboutStatNum: { fontSize: 36, fontWeight: 900, color: BRAND.blue },
  aboutStatLabel: { fontSize: 12, color: BRAND.textLight, fontWeight: 700, textTransform: "uppercase" },
  aboutLicenses: { backgroundColor: BRAND.gray, borderRadius: 16, padding: 32, border: "1px solid #e5e7eb" },
  licenseItem: { display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #e5e7eb" },
  aboutCallBtn: { display: "block", marginTop: 24, padding: "14px 20px", backgroundColor: BRAND.orange, color: "#fff", textDecoration: "none", borderRadius: 10, fontSize: 15, fontWeight: 800, textAlign: "center" },

  /* TESTIMONIALS */
  reviewsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 24 },
  reviewCard: { backgroundColor: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid #e5e7eb", display: "flex", flexDirection: "column", gap: 14 },
  reviewStars: { fontSize: 18 },
  reviewText: { fontSize: 14, color: BRAND.textMid, lineHeight: 1.75, margin: 0, flex: 1, fontStyle: "italic" },
  reviewAuthor: { display: "flex", alignItems: "center", gap: 12 },
  reviewAvatar: { width: 40, height: 40, borderRadius: "50%", backgroundColor: BRAND.blue, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, flexShrink: 0 },

  /* SERVICE AREAS */
  areasGrid: { display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" },
  areaChip: { backgroundColor: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "8px 18px", borderRadius: 24, fontSize: 14, fontWeight: 600 },

  /* PORTALS */
  portalsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32, maxWidth: 800, margin: "0 auto" },
  portalCard: { backgroundColor: "#fff", borderRadius: 20, padding: 36, textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb", borderTop: `4px solid ${BRAND.blue}` },
  portalIcon: { fontSize: 56, marginBottom: 16 },
  portalTitle: { fontSize: 24, fontWeight: 900, color: BRAND.textDark, margin: "0 0 12px 0" },
  portalDesc: { fontSize: 15, color: BRAND.textLight, lineHeight: 1.7, margin: "0 0 20px 0" },
  portalFeatureList: { listStyle: "none", padding: 0, margin: "0 0 24px 0", textAlign: "left", display: "flex", flexDirection: "column", gap: 8, color: BRAND.textMid, fontSize: 14, fontWeight: 600 },
  portalBtn: { display: "block", width: "100%", padding: "14px", backgroundColor: BRAND.blue, color: "#fff", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 800, cursor: "pointer" },

  /* CONTACT */
  contactGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 48, alignItems: "start" },
  contactInfo: {},
  contactInfoTitle: { fontSize: 22, fontWeight: 800, margin: "0 0 16px 0", color: BRAND.textDark },
  contactItems: { display: "flex", flexDirection: "column", gap: 20 },
  contactItem: { display: "flex", alignItems: "flex-start", gap: 14 },
  contactItemIcon: { fontSize: 24, flexShrink: 0 },
  contactItemLabel: { fontSize: 12, color: BRAND.textLight, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  contactItemValue: { fontSize: 16, fontWeight: 700, color: BRAND.textDark },
  contactForm: { backgroundColor: "#fff", borderRadius: 16, padding: 32, boxShadow: "0 2px 16px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb" },

  /* FOOTER */
  footer: { backgroundColor: "#0a0f1e", padding: "48px 24px" },
  footerInner: { maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 28, textAlign: "center" },
  footerBrand: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  footerBrandName: { color: BRAND.orange, fontSize: 18, fontWeight: 900, fontStyle: "italic" },
  footerBrandTagline: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 600 },
  footerLinks: { display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" },
  footerLink: { color: "rgba(255,255,255,0.6)", textDecoration: "none", fontSize: 14, fontWeight: 600 },
  footerLinkBtn: { backgroundColor: "transparent", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: 600, cursor: "pointer", padding: 0 },
  footerCopy: { color: "rgba(255,255,255,0.35)", fontSize: 13, lineHeight: 1.7 },
};
