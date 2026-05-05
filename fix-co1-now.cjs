const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://hyhjxdgdetdqoyoscflu.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5aGp4ZGdkZXRkcW95b3NjZmx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MjQ0NDUsImV4cCI6MjA4MTQwMDQ0NX0.kuEyoo4q-7utRafZHqjPD2lndBm-vRyUPeVqjkfDUF4"
);

async function run() {
  // Dump ALL change_orders to see what's there and what column names exist
  const { data, error } = await supabase
    .from("change_orders")
    .select("id, change_order_number, project_name, title, description")
    .limit(20);

  if (error) {
    console.error("Error:", JSON.stringify(error));
  } else {
    console.log("All change_orders (first 20):", JSON.stringify(data, null, 2));
    console.log("Total found:", data?.length);
  }
}

run();
