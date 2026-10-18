# 🛡️ Pre check URL — Website Redirection & Screenshot Inspector

A high-performance URL forensics and sandbox inspection platform built with Node.js, Express, Puppeteer-Core (Chromium), and Chrome DevTools Protocol (CDP).

When any URL is pasted into the URL box, the system traces the full redirection journey, captures high-resolution screenshots of all redirected pages, detects any file download attempts with file extensions while denying download permissions, and provides an immediate interactive pop-up modal for any in-between human verification (CAPTCHA / Cloudflare) challenges so the user can interact directly on that page.

---

## 🎨 Visual Architecture & Styling
- **Page Name**: **Pre check URL**
- **URL Entering Section**: **Light Blue background** (`#dbeafe` to `#e0f2fe` gradient) with glassmorphic elevated search card, custom focus ring, and quick scenario test chips.
- **Outcome Section**: **Clean White background** (`#ffffff`) with high-contrast typography, crisp card borders, and executive telemetry badges.

---

## 📋 Outcomes Display (4 Required Sections)

### 1. 📸 Screen Shot Section (Redirected Pages)
- Full visual screenshots of every rendered page along the redirection trail (Initial hop, intermediate challenges, and destination page).
- Step numbers, HTTP status code badges (`200 OK`, `301`, `302`), page titles, and timestamps.
- Built-in full-resolution lightbox viewer with zoom and one-click image download.

### 2. 🔀 Redirected URL's Section
- Chronological timeline mentioning each redirected URL in sequence.
- Status code pills (`301 Moved Permanently`, `302 Found`, `307 Temporary`, `200 OK`).
- Redirection mechanism categorization: HTTP Location Header, Client-Side JavaScript, HTML Meta Refresh, or Post-Verification unlock.
- Hostname, Destination IP, Protocol, and one-click Copy URL / Copy Chain buttons.

### 3. 💾 File Download Detection Section
- Intercepts both Chromium DevTools Protocol download events and HTTP `Content-Disposition: attachment; filename="..."` headers.
- **No permission given for download**: All downloads are strictly blocked and denied from reaching user disk for sandbox safety.
- Displays:
  - **File Name**
  - **File Extension** highlighted badge (e.g. `.EXE`, `.PDF`, `.ZIP`, `.MSI`)
  - **Risk Rating** (High Risk Executable, Compressed Archive, Normal Asset)
  - **Permission Status**: `🔒 Permission Denied — Download Blocked For Your Safety`
  - MIME type and file size.
- Reassuring safe banner when no files are triggered for download.

### 4. 📊 Display the Summary
- Executive safety verdict card (`Safe Navigation`, `Caution`, `Dangerous / Binary Blocked`).
- Total Redirection Hops & Redirect Count summary.
- Initial vs Final Landed URL comparison.
- SSL Transport Security (`HTTPS Encrypted` vs `HTTP Unencrypted`).
- Human Verification Status (`None Required` vs `Encountered & Solved`).
- File Download Safety Status (`0 Files Allowed (Permission Denied)`).
- Destination Server Hostname, Resolved IP, City, Country, and ISP / Cloud Provider.

---

## 🛡️ Interactive Human Verification Pop-up Modal
- If any human verification (Cloudflare Turnstile, "Checking your browser", reCAPTCHA, bot puzzle) is detected **in between or on any page**:
  - The verification modal pops up immediately for direct user interaction.
  - Powered by live Chrome DevTools Protocol Screencast streaming to an interactive `<canvas>`.
  - Mouse clicks and keystrokes are forwarded to the headless browser so you can solve the challenge right on the page itself.
  - Auto-detects when verification passes, takes a post-verification screenshot, and smoothly continues the redirection scan.

---

## 🚀 How to Run

### Quick Start (Double-Click)
- Double-click **`start-inspector.bat`** in the repository root.
- The browser opens automatically at: **`http://localhost:4000`**

### Manual Start via Command Line
```powershell
cd Precheckwebsite
npm start
```

### Run Automated Test Suite
```powershell
cd Precheckwebsite
npm test
```
All tests verify multi-hop redirects, `.exe` download blocking, `.pdf` download detection, and interactive CAPTCHA modal resolution.

---

## 🌐 Cloud Hosting & Deployment Guide (Vercel + Free Render Backend)

### Why does Vercel show "Server Disconnected"?
**Vercel is a serverless platform (AWS Lambda).** Serverless functions:
1. Terminate after each HTTP request and **cannot maintain persistent WebSockets** (`ws://` / `wss://`).
2. Do not allow background long-running Chromium processes to stream live 30fps screencasts and interactive CAPTCHA clicks.

To host on Vercel, the architecture is:
- **Frontend** runs on **Vercel's Global Edge CDN** (blazing fast loading, custom domains).
- **Backend Engine** runs on a free persistent Node.js host like **Render.com** or **Railway.app** (runs Chromium + WebSockets).

---

### Step-by-Step Setup:

#### Step 1: Deploy Free Backend Engine on Render (Takes 2 minutes)
1. Push this repository to your GitHub account.
2. Go to **[Render.com Dashboard](https://dashboard.render.com)** (100% Free).
3. Click **New +** &rarr; **Web Service**.
4. Connect your GitHub repository.
5. Render will automatically detect the included **`Dockerfile`** / **`render.yaml`** and pre-install Chromium.
6. Click **Create Web Service**.
7. Once deployed, copy your Render URL: e.g. `https://precheck-engine.onrender.com`.

*(You can verify it by visiting `https://your-engine.onrender.com/api/health` — it will return `{"status":"online", "browserReady": true}`).*

---

#### Step 2: Deploy Frontend on Vercel
1. In your **[Vercel Dashboard](https://vercel.com/dashboard)**, click **Add New...** &rarr; **Project**.
2. Import the same GitHub repository.
3. The included **`vercel.json`** will automatically configure the static output from `public/`.
4. Click **Deploy**.

---

#### Step 3: Connect Frontend to Backend Engine
1. Open your Vercel deployment URL: `https://your-project.vercel.app`.
2. Click the **Backend** button (or the status pill) in the top navigation bar.
3. Paste your Render backend URL (e.g. `https://precheck-engine.onrender.com`).
4. Click **Test & Save**.
5. The status indicator will turn **🟢 Engine Ready**, and you can perform full URL forensics, live interactive verification, and file download interception from your Vercel site!

> **Tip:** You can also share direct links with the backend pre-configured by appending `?backend=https://your-engine.onrender.com` to your Vercel URL!

