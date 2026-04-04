# AI Phone Assistant for After-Hours & Weekends
## DML Electrical Service LLC

---

## 🎯 What It Does

An AI voice assistant that:
- Answers calls when you're unavailable (nights, weekends)
- Speaks naturally — customers won't feel like they're on hold
- Collects caller name, phone, address, and service request
- Sends you a **text or email** summary after every call
- Handles emergency vs. non-emergency triage
- Books callbacks or schedules appointments
- Knows your services, prices, and service area

---

## 🏆 Best Options (Ranked for Small Contractors)

---

### Option 1: **Vapi.ai** ⭐ RECOMMENDED
**Cost:** ~$0.05–$0.15/minute | ~$20–60/month typical

**Why it's best for you:**
- No coding required — set up in 30 minutes
- Custom AI voice that sounds professional
- Can use your existing phone number via call forwarding
- Sends you a full transcript + summary after every call
- Can be trained on your exact services, service area, pricing

**Setup Steps:**
1. Go to **https://vapi.ai** → Create free account
2. Click "Create Assistant" → Choose "Phone"
3. Paste the system prompt below into the assistant
4. Get a Vapi phone number (or forward your existing number)
5. Set your forwarding schedule in your carrier:
   - Forward after 6pm weekdays
   - Forward all day Saturday/Sunday
   - Forward to Vapi number

**Vapi System Prompt for DML Electrical:**
```
You are a professional receptionist for DML Electrical Service LLC, 
a licensed electrical contractor based in Jennings, Louisiana, 
owned by Dustin Lavergne.

Your job is to:
1. Greet callers warmly and professionally
2. Find out if it's an emergency or non-emergency
3. Collect: full name, callback number, address, and description of the issue
4. For EMERGENCIES (no power, electrical fire smell, sparks, flooding near electrical): 
   - Express urgency, get all info, say you're alerting the on-call technician immediately
5. For NON-EMERGENCIES: 
   - Schedule a callback for the next business day (Mon-Fri 7am-6pm)
6. End every call professionally

Company Info:
- Name: DML Electrical Service LLC
- Owner: Dustin Lavergne
- Phone: (337) 288-0395
- Email: dustin@dmlelectrical.com
- Location: Jennings, LA
- Service Area: Jennings, Lake Charles, Lafayette, Sulphur, Crowley, and Southwest Louisiana
- Services: Residential & commercial wiring, standby generator installation & service, 
  sports & outdoor lighting, EV charger installation, agricultural electrical services
- Hours: Mon-Fri 7am-6pm | 24/7 Emergency available

Always be friendly, professional, and reassuring. Never make promises you can't keep.
Never quote specific prices — say "we'll give you a free written estimate."
```

---

### Option 2: **Bland.ai**
**Cost:** ~$0.09/minute | blandai.com

Very similar to Vapi. Good option if Vapi doesn't work for you.
Same setup process. Has good reliability.

---

### Option 3: **Retell AI**
**Cost:** ~$0.07–$0.12/minute | retellai.com

More enterprise-focused but still easy to use.
Best transcription accuracy of the three.

---

### Option 4: **Google Voice + AI Chat (FREE option)**
**Cost:** FREE for basic

If you just want something simple and free:
1. Set up **Google Voice** (voice.google.com)
2. Enable voicemail transcription — Google AI transcribes every voicemail to text
3. You get emailed the transcript immediately
4. Not truly "AI answering" but captures every message automatically

---

### Option 5: **Build Custom with Twilio + OpenAI**
**Cost:** ~$0.02/minute + OpenAI costs

If you want maximum control and integration with TradeFlow:
- Calls route through Twilio
- OpenAI handles the conversation
- Leads automatically saved to your Supabase database
- Can auto-create estimate requests

This requires coding — but I can build it for you!

---

## 📱 How to Forward Your Number After Hours

### If you use **AT&T**:
- Conditional forwarding (no answer): `*004*[vapi-number]#`
- Turn off: `##004#`

### If you use **Verizon**:
- Call Forwarding When Unanswered: `*71[vapi-number]`
- Turn off: `*73`

### If you use **T-Mobile**:
- Forward when no answer: `**004*[vapi-number]#`

### Better Option — Use a **Scheduling App**:
Many phone providers let you set "business hours" forwarding via their app.
The call goes to AI ONLY outside your set hours automatically.

---

## 🔔 Notifications You'll Get After Each Call

With Vapi, after every call you receive:
- 📱 **Text message** with: caller name, number, issue summary
- 📧 **Email** with: full transcript of the conversation
- 📊 **Dashboard** with: all call history, recordings, analytics

---

## 💡 Pro Tips

1. **Set a custom greeting:** "Thank you for calling DML Electrical. You've reached our after-hours service. I'm an AI assistant and I can help collect your information..."

2. **Emergency escalation:** Program the AI to send you an immediate text for emergencies so you can call back within minutes.

3. **Caller screening:** The AI filters out spam/robo-calls before alerting you.

4. **Appointment booking:** Connect Vapi to Calendly so the AI can book actual appointments in your calendar.

---

## 🚀 Quickest Path to Get Started Today

1. Go to **https://vapi.ai**
2. Create free account (no credit card to start)
3. Create assistant using the system prompt above
4. Test it by calling the test number they give you
5. When ready, forward your business number to it

**Estimated setup time: 30–45 minutes**
**Monthly cost for a small contractor: $20–$60**

---

## Want Me to Build the Custom Version?

I can build a **Twilio + OpenAI** integration that:
- Answers calls using your DML Electrical script
- Saves every lead directly into your TradeFlow database
- Sends you a push notification on your phone
- Auto-creates an estimate request in the system
- Shows you a "Missed Leads" dashboard in TradeFlow

Just say the word and I'll set it all up!
