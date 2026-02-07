// Simple test script to verify invite function works
// Run with: node test-invite.js

const https = require('https');

const SUPABASE_URL = 'https://hyhjxdgdetdqoyoscflu.supabase.co';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/invite-employee`;

// YOU NEED TO GET YOUR AUTH TOKEN:
// 1. Open TimeClock app
// 2. Open developer tools / inspect
// 3. Go to Application/Storage → Local Storage
// 4. Find your Supabase session token
// 5. Paste it here:
const AUTH_TOKEN = 'YOUR_AUTH_TOKEN_HERE'; // Replace with your actual token

const testEmail = 'test@example.com'; // Change this to test email

console.log('Testing invite function...\n');
console.log('Function URL:', FUNCTION_URL);
console.log('Test email:', testEmail);
console.log('---');

const payload = JSON.stringify({
  email: testEmail,
  role: 'employee'
});

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': payload.length,
    'Authorization': `Bearer ${AUTH_TOKEN}`
  }
};

const req = https.request(FUNCTION_URL, options, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));
  console.log('---');

  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response Body:');
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
      
      if (json.inviteLink) {
        console.log('\n✅ SUCCESS! Invite link:');
        console.log(json.inviteLink);
      } else if (json.error) {
        console.log('\n❌ ERROR:', json.error);
      }
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error);
});

req.write(payload);
req.end();
