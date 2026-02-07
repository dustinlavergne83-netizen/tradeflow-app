// This script deletes owner draw expenses from the database
const { createClient } = require("@supabase/supabase-js");
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteOwnerDrawExpenses() {
  try {
    // Find all owner draw expenses
    // (owner draw vendors typically: "Owner Draw", "Owner Withdrawal", "Owner Distribution")
    const { data: ownerDraws, error: fetchError } = await supabase
      .from("expenses")
      .select("id, vendor, description")
      .or("vendor.ilike.%owner%,description.ilike.%owner%")
      .limit(100);

    if (fetchError) throw fetchError;

    console.log(`Found ${ownerDraws?.length || 0} owner draw expenses to delete`);

    // Delete each one
    if (ownerDraws && ownerDraws.length > 0) {
      for (const expense of ownerDraws) {
        const { error: deleteError } = await supabase
          .from("expenses")
          .delete()
          .eq("id", expense.id);

        if (deleteError) {
          console.error(`Failed to delete expense ${expense.id}:`, deleteError);
        } else {
          console.log(`✅ Deleted owner draw expense: ${expense.vendor}`);
        }
      }
    }

    console.log("✅ Cleanup complete!");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

deleteOwnerDrawExpenses();
