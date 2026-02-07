console.log("Checking auth state...");
import { supabase } from "./src/lib/supabase.ts";

supabase.auth.getSession().then(({ data }) => {
  console.log("Current session:", data.session ? "SIGNED IN" : "NOT SIGNED IN");
  if (data.session) {
    console.log("User:", data.session.user.email);
    console.log("Clearing session...");
    supabase.auth.signOut().then(() => {
      console.log("Session cleared. Refresh your browser.");
    });
  } else {
    console.log("No session found. You should see the sign-in page.");
  }
});
