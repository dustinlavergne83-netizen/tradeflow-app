import { useState } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../lib/supabase";

export default function SignUp() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.toLowerCase().trim(),
        password: formData.password,
      });

      if (authError) throw authError;

      // Create employee record
      const { error: empError } = await supabase
        .from("employees")
        .insert({
          email: formData.email.toLowerCase().trim(),
          first_name: formData.email.split('@')[0],
          last_name: '',
          role: "employee",
          is_active: false, // Admin needs to activate
        });

      if (empError && empError.code !== '23505') {
        throw empError;
      }

      alert("Account created! Please wait for an admin to activate your account, then sign in.");
      navigate("/signin");
    } catch (err) {
      console.error("Error signing up:", err);
      setError(err.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      padding: "20px",
    }}>
      <div style={{
        background: "white",
        padding: "40px",
        borderRadius: "16px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        width: "100%",
        maxWidth: "400px",
      }}>
        <h1 style={{
          fontSize: "28px",
          fontWeight: "bold",
          marginBottom: "8px",
          color: "#1a202c",
          textAlign: "center",
        }}>
          Create Account
        </h1>
        <p style={{
          color: "#718096",
          marginBottom: "32px",
          textAlign: "center",
        }}>
          DML Electrical Employee
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "20px" }}>
            <label style={{
              display: "block",
              marginBottom: "8px",
              color: "#2d3748",
              fontWeight: "500",
            }}>
              Email
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              style={{
                width: "100%",
                padding: "12px",
                border: "2px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "16px",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => e.target.style.borderColor = "#667eea"}
              onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{
              display: "block",
              marginBottom: "8px",
              color: "#2d3748",
              fontWeight: "500",
            }}>
              Password
            </label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              style={{
                width: "100%",
                padding: "12px",
                border: "2px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "16px",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => e.target.style.borderColor = "#667eea"}
              onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{
              display: "block",
              marginBottom: "8px",
              color: "#2d3748",
              fontWeight: "500",
            }}>
              Confirm Password
            </label>
            <input
              type="password"
              required
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              style={{
                width: "100%",
                padding: "12px",
                border: "2px solid #e2e8f0",
                borderRadius: "8px",
                fontSize: "16px",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => e.target.style.borderColor = "#667eea"}
              onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
            />
          </div>

          {error && (
            <div style={{
              padding: "12px",
              background: "#fed7d7",
              color: "#c53030",
              borderRadius: "8px",
              marginBottom: "20px",
              fontSize: "14px",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              background: loading ? "#cbd5e0" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: "600",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "transform 0.2s",
            }}
            onMouseEnter={(e) => !loading && (e.target.style.transform = "scale(1.02)")}
            onMouseLeave={(e) => e.target.style.transform = "scale(1)"}
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>

        <div style={{
          marginTop: "24px",
          textAlign: "center",
          color: "#718096",
          fontSize: "14px",
        }}>
          Already have an account?{" "}
          <button
            onClick={() => navigate("/signin")}
            style={{
              color: "#667eea",
              fontWeight: "600",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
