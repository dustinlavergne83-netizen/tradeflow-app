# 🔧 Diagnostic Test Instructions for Photo Upload Issue

## Step 1: Add Test Button to Your Mobile App

Find any screen in your mobile app (like `timeclock-mobile/app/admin/project-photos.tsx`) and add this test button **temporarily**:

```tsx
// Add this import at the top
import { supabaseTest } from "../../lib/supabaseTest";

// Add this button somewhere in your JSX (temporary for testing)
<TouchableOpacity
  style={{
    backgroundColor: '#ff6b6b',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center'
  }}
  onPress={async () => {
    console.log("🧪 Starting diagnostic tests...");
    await supabaseTest.testConnection();
  }}
>
  <Text style={{ color: 'white', fontWeight: 'bold' }}>
    🧪 RUN DIAGNOSTIC TESTS
  </Text>
</TouchableOpacity>
```

## Step 2: Run the Tests

1. **Tap the diagnostic test button** in your mobile app
2. **Watch the console logs** carefully
3. **Note any error messages** that appear
4. **Tell me exactly what happens** at each step

## Step 3: Report Back

Please tell me:

1. **Does the test button appear?** (Yes/No)
2. **What console logs do you see?** (Copy the exact messages)
3. **What error alerts appear?** (Copy the exact text)
4. **At which step does it fail?**
   - ✅ Supabase client initialization
   - ✅ User authentication  
   - ✅ Database connection
   - ✅ Storage bucket access
   - ❌ **Upload test** (most likely failure point)

## Alternative Quick Test

If you can't add the button, try this **simple console test**:

In your mobile app's JavaScript console or React Native debugger, run:

```javascript
// Test 1: Check if Supabase is defined
console.log("Supabase client:", supabase);

// Test 2: Check environment variables
console.log("Supabase URL:", process.env.EXPO_PUBLIC_SUPABASE_URL);
console.log("Supabase Key:", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? "✅ Defined" : "❌ Missing");

// Test 3: Test basic storage access
supabase.storage.listBuckets().then(result => {
  console.log("Storage buckets result:", result);
}).catch(error => {
  console.error("Storage access failed:", error);
});
```

## Expected Results

If everything is working correctly, you should see:

```
🧪 Starting diagnostic tests...
Testing Supabase connection...
User authenticated: [some-user-id]
Database connection successful  
Available buckets: ["project-photos", ...]
project-photos bucket found: {...}
Upload test successful: {...}
✅ All Supabase tests passed!
```

## If Tests Fail

**Most likely failure points:**

1. **"Authentication Error"** → User not logged in
2. **"Database Error"** → Network/connection issue
3. **"Storage Error: project-photos bucket not found"** → Bucket doesn't exist
4. **"Upload Test Failed"** → Permission/policy issue

Please run this and **tell me exactly what you see** - this will help me identify the real problem!