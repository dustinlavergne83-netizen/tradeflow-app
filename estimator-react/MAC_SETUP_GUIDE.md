# 🍎 Mac Development Setup Guide
## Estimator React Project

This guide walks you through setting up your development environment on your new Mac so you can continue working on this project.

---

## 📋 What You're Working With

| Technology | Purpose |
|---|---|
| **React + Vite** | Web app frontend |
| **Supabase** | Backend / Database |
| **React Native + Expo** | Mobile app (iOS/Android) |
| **Node.js / npm** | Package management |

---

## 🚀 Step 1: Install Homebrew (Mac's Package Manager)

Open **Terminal** — here are several ways to find it:

### ✅ Method 1: Finder (Most Reliable)
1. Click the **Finder** icon in your Dock (the blue/white smiley face at the bottom of your screen)
2. In the menu bar at the top, click **Go**
3. Click **Utilities**
4. Double-click **Terminal**

### ✅ Method 2: Spotlight Search (if Cmd+Space works for you)
1. Press `Cmd + Space` — a search bar should pop up in the center of your screen
2. Type **Terminal** and press `Enter`
> ⚠️ If Cmd+Space opens something else (like a PDF), your Spotlight shortcut may have been changed. Use Method 1 instead.

### ✅ Method 3: Dock
- If you see a black screen icon labeled **Terminal** at the bottom of your screen, just click it

Once Terminal is open, run:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

> **Note:** After installation, Homebrew may ask you to run 2 extra commands to add it to your PATH. Copy and run those commands — they'll look something like:
> ```bash
> echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
> eval "$(/opt/homebrew/bin/brew shellenv)"
> ```

---

## 🚀 Step 2: Install Node.js

```bash
brew install node
```

Verify it worked:
```bash
node --version   # Should show v18 or higher
npm --version    # Should show a version number
```

---

## 🚀 Step 3: Install Git

Git usually comes with Xcode Command Line Tools. Check if you have it:
```bash
git --version
```

If not installed, run:
```bash
brew install git
```

---

## 🚀 Step 4: Install Visual Studio Code

Download VS Code from: **https://code.visualstudio.com/**

Or install via Homebrew:
```bash
brew install --cask visual-studio-code
```

After installing, open VS Code and press `Cmd + Shift + P`, type **"Shell Command: Install 'code' command in PATH"** and select it. This lets you open projects from Terminal with the `code .` command.

---

## 🚀 Step 5: Get the Project onto Your Mac

### Option A: From GitHub (Recommended)
If you've been pushing your code to GitHub:
```bash
cd ~/Documents
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd estimator-react
```

### Option B: Transfer from Windows PC
1. On your Windows PC, copy the project folder to a USB drive or cloud storage (Google Drive, Dropbox, iCloud)
2. **Do NOT copy** `node_modules` — it's huge and gets rebuilt automatically
3. Copy everything else including your `.env` file
4. On your Mac, place it somewhere like `~/Documents/estimator-react`

---

## 🚀 Step 6: Set Up the Project

Navigate to your project folder and install dependencies:
```bash
cd ~/Documents/estimator-react
npm install
```

---

## 🚀 Step 7: Create Your .env File

Your `.env` file contains your Supabase credentials. **This file is NOT in git** (it's in .gitignore for security).

Create it manually:
```bash
cd ~/Documents/estimator-react
touch .env
open -e .env
```

Paste in your credentials (these are your actual values):
```
VITE_SUPABASE_URL=https://hyhjxdgdetdqoyoscflu.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5aGp4ZGdkZXRkcW95b3NjZmx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MjQ0NDUsImV4cCI6MjA4MTQwMDQ0NX0.kuEyoo4q-7utRafZHqjPD2lndBm-vRyUPeVqjkfDUF4
```

Save and close the file.

---

## 🚀 Step 8: Run the Web App

```bash
npm run dev
```

Open your browser and go to: **http://localhost:5173**

You should see your app running! 🎉

---

## 🚀 Step 9: (Optional) Set Up for iOS Development

Since you now have a Mac, you can build and run iOS apps natively! This is a big advantage over Windows.

### Install Xcode
1. Open the **App Store** on your Mac
2. Search for **"Xcode"** and install it (it's free, ~15GB)
3. After install, open Xcode once to accept the license agreement

### Install Xcode Command Line Tools
```bash
xcode-select --install
```

### Install CocoaPods (needed for React Native iOS)
```bash
sudo gem install cocoapods
```

### Install Expo CLI
```bash
npm install -g @expo/cli
```

### Run on iOS Simulator
```bash
npm run ios
```

This will open your app in the iPhone Simulator! 📱

---

## 🚀 Step 10: Set Up Git (So You Don't Lose Work)

Configure your identity:
```bash
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

### Push to GitHub (Highly Recommended)
If you're not already using GitHub:
1. Create a free account at **https://github.com**
2. Create a new repository
3. In your project folder:
```bash
git init
git add .
git commit -m "Initial commit from Windows"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

> ⚠️ **IMPORTANT:** Before pushing, make sure `.env` is in your `.gitignore` (it already is). This keeps your Supabase keys private.

---

## 📁 Recommended VS Code Extensions

Open VS Code, press `Cmd + Shift + X` and install:

- **ES7+ React/Redux/React-Native snippets** — faster coding
- **Prettier - Code formatter** — auto-formats your code
- **GitLens** — better git integration
- **Tailwind CSS IntelliSense** — if you use Tailwind
- **Supabase** — Supabase helper tools

---

## 🔄 Daily Workflow on Mac

```bash
# Open project
cd ~/Documents/estimator-react
code .                    # Opens in VS Code

# Start the dev server
npm run dev               # Web app at http://localhost:5173

# iOS simulator (bonus - couldn't do this on Windows!)
npm run ios

# Android (still works on Mac too)
npm run android
```

---

## ❓ Troubleshooting

### "command not found: npm"
Run the Homebrew PATH commands again, then restart Terminal.

### "permission denied" errors
Add `sudo` in front of the command (you'll be asked for your Mac password).

### App won't start / missing modules
```bash
rm -rf node_modules
npm install
npm run dev
```

### iOS build fails
```bash
cd ios
pod install
cd ..
npm run ios
```

---

## 💡 Mac Tips for Windows Users

| Windows | Mac Equivalent |
|---|---|
| `Ctrl + C` (copy) | `Cmd + C` |
| `Ctrl + V` (paste) | `Cmd + V` |
| `Ctrl + Z` (undo) | `Cmd + Z` |
| `Alt + F4` (close) | `Cmd + Q` |
| File Explorer | Finder |
| Task Manager | Activity Monitor |
| Command Prompt | Terminal |
| `C:\Users\...` paths | `/Users/yourname/...` paths |
| Right-click | Two-finger tap on trackpad |

---

*Generated for the estimator-react project — React + Vite + Supabase + Expo*
