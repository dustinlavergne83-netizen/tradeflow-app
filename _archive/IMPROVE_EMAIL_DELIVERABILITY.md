# Improve Email Deliverability - Prevent Spam Folder

## ✅ Good News!
The employee invite emails ARE working! They're just going to spam folders. This is normal for newly configured email domains.

## Why Emails Go to Spam

Email providers (Gmail, Outlook, etc.) check for authentication records to verify emails are legitimate:
- **SPF** - Sender Policy Framework
- **DKIM** - DomainKeys Identified Mail  
- **DMARC** - Domain-based Message Authentication

Without these records, emails are more likely to be marked as spam.

## Quick Fix (Temporary)

**For Recipients:**
1. Check spam/junk folder
2. Mark email as "Not Spam"
3. Add `timeclock@dmlelectrical.com` to contacts
4. Future emails should arrive in inbox

## Permanent Solution - Set Up DNS Records

### Step 1: Verify Domain in Resend

1. Go to https://resend.com/domains
2. Click on your domain (dmlelectrical.com)
3. You'll see DNS records that need to be added

### Step 2: Add DNS Records

You need to add these records to your domain's DNS settings (GoDaddy, Namecheap, etc.):

#### SPF Record
```
Type: TXT
Name: @
Value: v=spf1 include:amazonses.com ~all
```

#### DKIM Records (Resend will provide these)
```
Type: TXT
Name: resend._domainkey
Value: [Resend will provide this value]
```

#### DMARC Record
```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@dmlelectrical.com
```

### Step 3: Where to Add DNS Records

**If using GoDaddy:**
1. Log into GoDaddy
2. Go to My Products → Domains
3. Click DNS next to your domain
4. Add the records from Resend

**If using Namecheap:**
1. Log into Namecheap
2. Domain List → Manage → Advanced DNS
3. Add new records

**If using Cloudflare:**
1. Log into Cloudflare
2. Select domain → DNS → Records
3. Add records

### Step 4: Verify in Resend

1. After adding DNS records, return to Resend
2. Click "Verify Domain"
3. Wait 24-48 hours for DNS propagation
4. Once verified, emails will have much better deliverability

## Alternative: Use a Subdomain

If you don't want to modify main domain DNS:

1. Create subdomain: `mail.dmlelectrical.com`
2. Verify subdomain in Resend
3. Change email from address in both functions:
   - `send-proposal/index.ts`
   - `invite-employee/index.ts`
4. From: `proposals@mail.dmlelectrical.com`
5. From: `timeclock@mail.dmlelectrical.com`

## Check Email Deliverability

**In Resend Dashboard:**
- Go to https://resend.com/emails
- Click on any sent email
- Check "Delivery Status"
- Look for authentication results (SPF, DKIM, DMARC)

**Use Testing Tools:**
- https://www.mail-tester.com/
- Send test email to address provided
- Get spam score and recommendations

## Best Practices

1. **Don't Use Generic Addresses:**
   - ❌ noreply@dmlelectrical.com
   - ✅ timeclock@dmlelectrical.com

2. **Add Reply-To Header:**
   - Let recipients reply if needed
   - Builds trust with email providers

3. **Monitor Bounces:**
   - Check Resend dashboard regularly
   - Remove bad email addresses

4. **Warm Up Your Domain:**
   - Start with small volumes
   - Gradually increase over weeks
   - Don't send 1000 emails on day 1

5. **Content Quality:**
   - Avoid spam trigger words
   - Use proper HTML structure
   - Include unsubscribe link (for marketing emails)

## Current Email Status

✅ **Proposals:** `proposals@dmlelectrical.com`  
✅ **Employee Invites:** `timeclock@dmlelectrical.com`  
⚠️ **Domain Verification:** Needs DNS setup for best deliverability

## Expected Improvement Timeline

- **Immediate:** Mark as "Not Spam" helps
- **24-48 hours:** After DNS records added and verified
- **2-4 weeks:** Full domain reputation builds
- **After Setup:** 95%+ inbox delivery rate

## Testing Checklist

- [ ] Send test employee invite
- [ ] Check spam folder
- [ ] Mark as "Not Spam"
- [ ] Verify DNS records in Resend
- [ ] Wait for DNS propagation
- [ ] Send another test
- [ ] Confirm inbox delivery

## Need Help?

- **Resend Support:** https://resend.com/docs
- **DNS Help:** Contact your domain registrar
- **Email Testing:** mail-tester.com

## Summary

The email functionality is **working perfectly**! The spam folder issue will be resolved once you:
1. Verify your domain in Resend
2. Add the required DNS records
3. Wait for DNS propagation (24-48 hours)

In the meantime, employees can check their spam folders and mark as "Not Spam."
