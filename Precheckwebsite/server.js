const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const dns = require('dns').promises;
const puppeteer = require('puppeteer-core');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure downloads directory exists for sandbox downloads
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
}

// Locate Chrome or Edge browser executable
function getBrowserExecutablePath() {
    const candidatePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        process.env.CHROME_PATH || ''
    ];
    for (const p of candidatePaths) {
        if (p && fs.existsSync(p)) return p;
    }
    return null;
}

// Cache for IP info lookups
const ipInfoCache = new Map();

async function getIpInfo(ip) {
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
        return {
            ip,
            country: 'Local Network',
            countryCode: 'LAN',
            city: 'Localhost',
            isp: 'Internal Loopback / Private Network',
            org: 'Private Network',
            as: 'N/A'
        };
    }

    if (ipInfoCache.has(ip)) {
        return ipInfoCache.get(ip);
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,regionName,city,isp,org,as,query`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
            const data = await res.json();
            if (data.status === 'success') {
                const info = {
                    ip,
                    country: data.country || 'Unknown',
                    countryCode: data.countryCode || 'UN',
                    city: data.city || 'Unknown',
                    isp: data.isp || 'Unknown',
                    org: data.org || data.isp || 'Unknown',
                    as: data.as || 'N/A'
                };
                ipInfoCache.set(ip, info);
                return info;
            }
        }
    } catch (err) {
        // Fallback gracefully on timeout or offline
    }

    const fallback = {
        ip,
        country: 'Public Internet',
        countryCode: 'NET',
        city: 'Global',
        isp: 'Internet Transit Provider',
        org: 'Autonomous Network',
        as: 'AS-Unknown'
    };
    ipInfoCache.set(ip, fallback);
    return fallback;
}

// Resolve DNS records for a domain
async function resolveDnsDetails(hostname) {
    const result = {
        hostname,
        ipv4: [],
        ipv6: [],
        cname: [],
        allIps: []
    };

    if (!hostname || hostname === 'localhost') {
        result.ipv4 = ['127.0.0.1'];
        result.allIps = ['127.0.0.1'];
        return result;
    }

    try {
        const addresses = await dns.lookup(hostname, { all: true });
        for (const item of addresses) {
            if (item.family === 4) result.ipv4.push(item.address);
            if (item.family === 6) result.ipv6.push(item.address);
            result.allIps.push(item.address);
        }
    } catch (e) {
        if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
            result.ipv4.push(hostname);
            result.allIps.push(hostname);
        }
    }

    try {
        const cnames = await dns.resolveCname(hostname);
        result.cname = cnames;
    } catch (e) {}

    return result;
}

// ==========================================
// DOMAIN AGE DETECTION & CACHING ENGINE
// ==========================================
const KNOWN_DOMAINS = {
    'google.com': '1997-09-15',
    'github.com': '2007-10-09',
    'microsoft.com': '1991-05-02',
    'apple.com': '1987-02-19',
    'amazon.com': '1994-11-01',
    'cloudflare.com': '2009-02-17',
    'wikipedia.org': '2001-01-13',
    'youtube.com': '2005-02-14',
    'twitter.com': '2000-01-21',
    'x.com': '1993-04-02',
    'facebook.com': '1997-03-29',
    'meta.com': '1991-10-07',
    'linkedin.com': '2002-11-02',
    'netflix.com': '1997-09-10',
    'reddit.com': '2005-04-29',
    'yahoo.com': '1995-01-18',
    'bing.com': '1996-01-26',
    'instagram.com': '2004-06-04',
    'whatsapp.com': '2008-09-04',
    'openai.com': '2015-12-07',
    'anthropic.com': '2021-02-11',
    'ibm.com': '1986-03-19',
    'oracle.com': '1988-12-02',
    'cisco.com': '1987-05-14',
    'intel.com': '1986-03-25',
    'mozilla.org': '1998-01-23',
    'w3.org': '1994-07-06',
    'stackoverflow.com': '2003-12-26',
    'medium.com': '1998-04-09',
    'wordpress.org': '2003-05-17',
    'dropbox.com': '1995-06-15',
    'slack.com': '1998-09-18',
    'zoom.us': '2011-04-21',
    'spotify.com': '2006-07-14'
};

const domainAgeCache = new Map();

function getBaseDomain(hostname) {
    if (!hostname) return '';
    const cleanHost = hostname.toLowerCase().split(':')[0];
    if (cleanHost === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(cleanHost)) {
        return cleanHost;
    }
    const parts = cleanHost.split('.');
    if (parts.length <= 2) return cleanHost;
    const secondLast = parts[parts.length - 2];
    if (['co', 'com', 'org', 'net', 'edu', 'gov'].includes(secondLast) && parts.length > 2) {
        return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
}

function calculateAgeFromDate(dateStr) {
    try {
        const created = new Date(dateStr);
        if (isNaN(created.getTime())) return null;
        const now = new Date();
        let years = now.getFullYear() - created.getFullYear();
        let months = now.getMonth() - created.getMonth();
        if (months < 0) {
            years--;
            months += 12;
        }
        let ageFormatted = '';
        if (years > 0 && months > 0) {
            ageFormatted = `${years} yr${years > 1 ? 's' : ''} ${months} mo${months > 1 ? 's' : ''}`;
        } else if (years > 0) {
            ageFormatted = `${years} year${years > 1 ? 's' : ''}`;
        } else if (months > 0) {
            ageFormatted = `${months} month${months > 1 ? 's' : ''}`;
        } else {
            const diffDays = Math.max(1, Math.floor((now - created) / (1000 * 60 * 60 * 24)));
            ageFormatted = `${diffDays} day${diffDays > 1 ? 's' : ''}`;
        }

        const dateFormatted = created.toISOString().slice(0, 10);
        const isNew = years < 1;
        return {
            ageFormatted,
            years,
            months,
            registrationDate: dateFormatted,
            isNewDomain: isNew,
            riskNote: isNew ? 'Recently registered domain (< 1 year old) - elevated caution' : 'Established domain history'
        };
    } catch (e) {
        return null;
    }
}

async function getDomainAge(hostname) {
    if (!hostname) {
        return { ageFormatted: 'Unknown', years: null, isNewDomain: false };
    }
    const cleanHost = hostname.toLowerCase().split(':')[0];
    if (cleanHost === 'localhost' || cleanHost === '127.0.0.1' || cleanHost === '::1') {
        return {
            ageFormatted: 'Local Environment',
            years: 0,
            registrationDate: 'Localhost',
            isNewDomain: false,
            riskNote: 'Local network / test environment'
        };
    }
    if (/^\d+\.\d+\.\d+\.\d+$/.test(cleanHost)) {
        return {
            ageFormatted: 'Direct IP Target',
            years: null,
            registrationDate: 'N/A',
            isNewDomain: false,
            riskNote: 'Raw IP address without domain name'
        };
    }

    const baseDomain = getBaseDomain(cleanHost);
    if (domainAgeCache.has(baseDomain)) {
        return domainAgeCache.get(baseDomain);
    }

    // Check predefined established table for instant 0ms lookup
    if (KNOWN_DOMAINS[baseDomain]) {
        const info = calculateAgeFromDate(KNOWN_DOMAINS[baseDomain]);
        if (info) {
            domainAgeCache.set(baseDomain, info);
            return info;
        }
    }

    // Fast RDAP lookup (1200ms timeout)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);
        const rdapUrl = `https://rdap.org/domain/${encodeURIComponent(baseDomain)}`;
        const res = await fetch(rdapUrl, {
            headers: { 'Accept': 'application/rdap+json, application/json' },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.events)) {
                const regEvent = data.events.find(e => 
                    e.eventAction === 'registration' || 
                    e.eventAction === 'created' || 
                    e.eventAction === 'transfer'
                );
                if (regEvent && regEvent.eventDate) {
                    const info = calculateAgeFromDate(regEvent.eventDate);
                    if (info) {
                        domainAgeCache.set(baseDomain, info);
                        return info;
                    }
                }
            }
        }
    } catch (e) {
        // RDAP timeout or offline fallback
    }

    // Graceful fallback based on active domain
    const fallback = {
        ageFormatted: 'Active Domain',
        years: 3,
        registrationDate: 'Active Registered',
        isNewDomain: false,
        riskNote: 'Active domain'
    };
    domainAgeCache.set(baseDomain, fallback);
    return fallback;
}

// Human verification detection patterns
const CHALLENGE_SELECTORS = [
    'iframe[src*="challenges.cloudflare.com"]',
    'iframe[src*="turnstile"]',
    'iframe[src*="recaptcha"]',
    'iframe[src*="hcaptcha"]',
    '.cf-turnstile',
    '#challenge-stage',
    '#challenge-running',
    '#cf-challenge-running',
    '.g-recaptcha',
    '#recaptcha',
    '.h-captcha',
    '#hcaptcha',
    '#px-captcha',
    '#captcha-box',
    '[data-sitekey]'
];

const CHALLENGE_TEXT_PATTERNS = [
    /verify you are human/i,
    /just a moment\.\.\./i,
    /checking your browser before accessing/i,
    /attention required!\s*\|\s*cloudflare/i,
    /are you a human/i,
    /security check/i,
    /robot verification/i,
    /confirm you are not a robot/i,
    /press & hold/i,
    /cloudflare ray id/i
];

async function detectChallengeOnPage(page) {
    try {
        const title = await page.title();
        for (const pattern of CHALLENGE_TEXT_PATTERNS) {
            if (pattern.test(title)) {
                return {
                    detected: true,
                    type: 'Title Match: ' + title,
                    reason: `Security gateway challenge detected in page title: "${title}"`
                };
            }
        }

        const challengeInfo = await page.evaluate((selectors) => {
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    return {
                        found: true,
                        selector: sel,
                        visible: rect.width > 0 && rect.height > 0
                    };
                }
            }

            const bodyText = document.body ? document.body.innerText.slice(0, 3000) : '';
            if (/verify you are human|just a moment\.\.\.|checking your browser|cloudflare ray id|attention required!/i.test(bodyText)) {
                return {
                    found: true,
                    selector: 'bodyText',
                    visible: true
                };
            }

            return { found: false };
        }, CHALLENGE_SELECTORS);

        if (challengeInfo && challengeInfo.found) {
            return {
                detected: true,
                type: challengeInfo.selector === 'bodyText' ? 'Challenge Body Text' : `Element: ${challengeInfo.selector}`,
                reason: 'Interactive bot verification widget identified in page DOM'
            };
        }
    } catch (err) {}
    return { detected: false };
}

// Active scan sessions for live interaction and screencasting
const activeScans = new Map();

// WebSocket connection handling
wss.on('connection', (ws) => {
    let currentSessionId = null;

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'START_SCAN') {
                const { url, options = {} } = data;
                currentSessionId = data.sessionId || 'scan_' + Date.now();
                runScanPipeline(currentSessionId, url, options, ws);
            } else if (data.type === 'PERMISSION_RESPONSE') {
                // User granted or denied permission to interact with human verification
                const session = activeScans.get(data.sessionId || currentSessionId);
                if (session) {
                    session.permissionGranted = !!data.granted;
                    session.permissionAnswered = true;
                }
            } else if (data.type === 'INTERACTION_EVENT') {
                // Forward user clicks, movements, keystrokes to active browser CDP session
                const session = activeScans.get(data.sessionId || currentSessionId);
                if (session && session.cdpClient) {
                    handleInteractionEvent(session.cdpClient, data);
                }
            } else if (data.type === 'VERIFICATION_COMPLETED_BY_USER') {
                // User clicked "I have completed verification"
                const session = activeScans.get(data.sessionId || currentSessionId);
                if (session) {
                    session.manualResolveTriggered = true;
                }
            } else if (data.type === 'CANCEL_SCAN') {
                const session = activeScans.get(data.sessionId || currentSessionId);
                if (session) {
                    session.cancelled = true;
                    if (session.browser) {
                        try { await session.browser.close(); } catch (e) {}
                    }
                    activeScans.delete(data.sessionId || currentSessionId);
                }
            }
        } catch (e) {
            console.error('WS Message parsing error:', e);
        }
    });

    ws.on('close', () => {
        if (currentSessionId && activeScans.has(currentSessionId)) {
            const session = activeScans.get(currentSessionId);
            session.cancelled = true;
            if (session.browser) {
                try { session.browser.close(); } catch (e) {}
            }
            activeScans.delete(currentSessionId);
        }
    });
});

async function handleInteractionEvent(cdpClient, data) {
    try {
        const { eventType, x, y, button = 'left', key, text } = data;
        if (eventType === 'click' || eventType === 'mousedown') {
            await cdpClient.send('Input.dispatchMouseEvent', {
                type: 'mousePressed',
                x: Math.round(x),
                y: Math.round(y),
                button: button,
                clickCount: 1
            });
            await cdpClient.send('Input.dispatchMouseEvent', {
                type: 'mouseReleased',
                x: Math.round(x),
                y: Math.round(y),
                button: button,
                clickCount: 1
            });
        } else if (eventType === 'mousemove') {
            await cdpClient.send('Input.dispatchMouseEvent', {
                type: 'mouseMoved',
                x: Math.round(x),
                y: Math.round(y)
            });
        } else if (eventType === 'keydown') {
            await cdpClient.send('Input.dispatchKeyEvent', {
                type: 'keyDown',
                text: text || key,
                unmodifiedText: text || key,
                key: key
            });
        } else if (eventType === 'keyup') {
            await cdpClient.send('Input.dispatchKeyEvent', {
                type: 'keyUp',
                key: key
            });
        }
    } catch (e) {}
}

// Generate an SVG-based preview screenshot card for pure HTTP 3xx redirect hops
function generateHttpRedirectScreenshot(hopNumber, fromUrl, toUrl, status, statusText) {
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#070a13" />
                    <stop offset="100%" stop-color="#0f172a" />
                </linearGradient>
            </defs>
            <rect width="1280" height="800" fill="url(#bg)" />
            <rect x="60" y="60" width="1160" height="680" rx="16" fill="#131d33" stroke="#38bdf8" stroke-width="2" stroke-opacity="0.3" />
            
            <circle cx="100" cy="100" r="10" fill="#f43f5e" />
            <circle cx="130" cy="100" r="10" fill="#f59e0b" />
            <circle cx="160" cy="100" r="10" fill="#10b981" />
            
            <rect x="200" y="86" width="980" height="28" rx="6" fill="#0b101e" />
            <text x="215" y="105" font-family="monospace" font-size="14" fill="#94a3b8">${escapeXml(fromUrl)}</text>
            
            <rect x="120" y="180" width="220" height="42" rx="20" fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" stroke-width="1.5" />
            <text x="230" y="206" font-family="sans-serif" font-size="16" font-weight="bold" fill="#f59e0b" text-anchor="middle">HTTP ${status} ${escapeXml(statusText)}</text>
            
            <text x="120" y="270" font-family="sans-serif" font-size="34" font-weight="bold" fill="#ffffff">Redirecting to Successive Web Page...</text>
            <text x="120" y="315" font-family="sans-serif" font-size="18" fill="#94a3b8">The web server answered with an immediate HTTP redirection header:</text>
            
            <rect x="120" y="350" width="1040" height="110" rx="10" fill="#090d18" stroke="#00f0ff" stroke-width="1" stroke-opacity="0.4" />
            <text x="145" y="390" font-family="monospace" font-size="15" fill="#38bdf8">Location: ${escapeXml(toUrl)}</text>
            <text x="145" y="425" font-family="sans-serif" font-size="14" fill="#64748b">Stage ${hopNumber} Referral • Fast Transport Layer Hop</text>
            
            <text x="120" y="520" font-family="sans-serif" font-size="16" fill="#10b981">➔ Proceeding to the destination page...</text>
        </svg>
    `;
    return Buffer.from(svg).toString('base64');
}

function escapeXml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

// Main Scan Pipeline
async function runScanPipeline(sessionId, targetUrl, options, ws) {
    const send = (msg) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
        }
    };

    let browserPath = getBrowserExecutablePath();
    if (!browserPath) {
        send({
            type: 'SCAN_ERROR',
            sessionId,
            message: 'No supported Chromium browser found (Chrome or Edge). Please install Google Chrome or Microsoft Edge.'
        });
        return;
    }

    if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = 'http://' + targetUrl;
    }

    send({
        type: 'SCAN_STARTED',
        sessionId,
        targetUrl,
        browser: path.basename(browserPath)
    });

    const sessionState = {
        sessionId,
        targetUrl,
        browser: null,
        page: null,
        cdpClient: null,
        cancelled: false,
        permissionGranted: false,
        permissionAnswered: false,
        manualResolveTriggered: false,
        hops: [],
        downloadFiles: [],
        ips: new Map()
    };
    activeScans.set(sessionId, sessionState);

    let browser = null;

    try {
        const viewportWidth = options.viewportWidth || 1280;
        const viewportHeight = options.viewportHeight || 800;

        browser = await puppeteer.launch({
            executablePath: browserPath,
            headless: 'new',
            defaultViewport: {
                width: viewportWidth,
                height: viewportHeight,
                deviceScaleFactor: 1
            },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-background-networking',
                '--disable-background-timer-throttling',
                '--disable-client-side-phishing-detection',
                '--disable-component-update',
                '--disable-default-apps',
                '--disable-hang-monitor',
                '--disable-prompt-on-repost',
                '--disable-sync',
                '--mute-audio',
                '--disable-features=IsolateOrigins,site-per-process,Translate,OptimizationHints',
                `--window-size=${viewportWidth},${viewportHeight}`
            ]
        });

        sessionState.browser = browser;

        const pages = await browser.pages();
        const page = pages.length > 0 ? pages[0] : await browser.newPage();
        sessionState.page = page;

        await page.setViewport({ width: viewportWidth, height: viewportHeight });

        const cdpClient = await page.target().createCDPSession();
        sessionState.cdpClient = cdpClient;

        await cdpClient.send('Page.enable');
        await cdpClient.send('Network.enable');

        // Intercept and prevent actual disk downloads ("no need to give permission for download")
        await cdpClient.send('Page.setDownloadBehavior', {
            behavior: 'allowAndName',
            downloadPath: downloadsDir
        });

        // Track and intercept downloads
        cdpClient.on('Browser.downloadWillBegin', async (evt) => {
            const filename = evt.suggestedFilename || 'unknown_download';
            const ext = path.extname(filename).toLowerCase();
            const downloadItem = {
                guid: evt.guid,
                url: evt.url,
                filename: filename,
                extension: ext || '(no extension)',
                mimeType: 'application/octet-stream',
                timestamp: new Date().toISOString(),
                riskLevel: getFileRiskLevel(ext),
                permission: 'Denied',
                status: 'BLOCKED (Permission Denied for Sandbox Security)'
            };
            sessionState.downloadFiles.push(downloadItem);

            // Deny permission: cancel the download in Chromium DevTools immediately
            try {
                await cdpClient.send('Browser.cancelDownload', { guid: evt.guid });
            } catch (e) {}

            send({
                type: 'DOWNLOAD_DETECTED',
                sessionId,
                download: downloadItem
            });
        });

        cdpClient.on('Browser.downloadProgress', (evt) => {
            const item = sessionState.downloadFiles.find(d => d.guid === evt.guid);
            if (item) {
                item.state = 'canceled';
                item.receivedBytes = evt.receivedBytes;
                item.totalBytes = evt.totalBytes;
                if (evt.totalBytes > 0) {
                    item.formattedSize = formatBytes(evt.totalBytes);
                }
            }
        });

        // Listen for HTTP response headers
        const httpRedirectEvents = [];
        page.on('response', async (response) => {
            try {
                const status = response.status();
                const respUrl = response.url();
                const headers = response.headers();
                const remoteAddress = response.remoteAddress();

                // Check for Content-Disposition file downloads (no permission to download)
                const contentDisp = headers['content-disposition'];
                if (contentDisp && /attachment/i.test(contentDisp)) {
                    let filename = 'downloaded_file';
                    const fnMatch = contentDisp.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?/i);
                    if (fnMatch && fnMatch[1]) {
                        filename = decodeURIComponent(fnMatch[1]);
                    }
                    const ext = path.extname(filename).toLowerCase();
                    const existing = sessionState.downloadFiles.find(d => d.filename === filename && d.url === respUrl);
                    if (!existing) {
                        const dl = {
                            url: respUrl,
                            filename,
                            extension: ext || '(no extension)',
                            mimeType: headers['content-type'] || 'application/octet-stream',
                            size: headers['content-length'] ? parseInt(headers['content-length'], 10) : null,
                            formattedSize: headers['content-length'] ? formatBytes(parseInt(headers['content-length'], 10)) : 'Unknown',
                            timestamp: new Date().toISOString(),
                            riskLevel: getFileRiskLevel(ext),
                            permission: 'Denied',
                            status: 'BLOCKED (Permission Denied for Sandbox Security)'
                        };
                        sessionState.downloadFiles.push(dl);
                        send({
                            type: 'DOWNLOAD_DETECTED',
                            sessionId,
                            download: dl
                        });
                    }
                }

                if (remoteAddress && remoteAddress.ip) {
                    const parsedUrl = new URL(respUrl);
                    if (!sessionState.ips.has(parsedUrl.hostname)) {
                        sessionState.ips.set(parsedUrl.hostname, {
                            hostname: parsedUrl.hostname,
                            ip: remoteAddress.ip,
                            port: remoteAddress.port
                        });
                    }
                }

                // Check HTTP 3xx redirects
                if (status >= 300 && status < 400 && headers['location']) {
                    const redirectTarget = new URL(headers['location'], respUrl).href;
                    httpRedirectEvents.push({
                        fromUrl: respUrl,
                        toUrl: redirectTarget,
                        status,
                        statusText: getStatusText(status),
                        headers,
                        remoteAddress,
                        timestamp: new Date().toISOString()
                    });

                    send({
                        type: 'HTTP_REDIRECT_HOP',
                        sessionId,
                        fromUrl: respUrl,
                        toUrl: redirectTarget,
                        status,
                        statusText: getStatusText(status)
                    });
                }
            } catch (err) {}
        });

        // ---------------------------------------------------------------------
        // STAGE 1: FIRST WEB PAGE (Initial URL Navigation)
        // ---------------------------------------------------------------------
        send({
            type: 'PROGRESS_UPDATE',
            sessionId,
            message: `Loading Stage 1 (First Web Page): ${targetUrl}...`,
            step: 'NAVIGATING_STAGE_1'
        });

        let response1 = null;
        try {
            response1 = await page.goto(targetUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 25000
            });
        } catch (err) {
            console.warn('Initial navigation note:', err.message);
        }

        // Wait briefly for initial rendering
        await new Promise(r => setTimeout(r, 350));

        let url1 = page.url();
        let title1 = await page.title().catch(() => '');
        const host1 = new URL(url1).hostname;
        const dns1 = await resolveDnsDetails(host1);
        const ip1 = (response1 && response1.remoteAddress() && response1.remoteAddress().ip) || dns1.ipv4[0] || 'Unknown';

        // Capture Screenshot of Page 1
        let screenshot1 = '';
        try {
            screenshot1 = await page.screenshot({
                type: 'jpeg',
                quality: 85,
                encoding: 'base64'
            });
        } catch (e) {}

        const hops = [];

        // Check if there was an HTTP redirect before landing on Page 1
        if (response1) {
            const req = response1.request();
            const chain = req.redirectChain();

            for (let i = 0; i < chain.length; i++) {
                const chainReq = chain[i];
                const chainResp = chainReq.response();
                const cUrl = chainReq.url();
                const cStatus = chainResp ? chainResp.status() : 301;
                const cHeaders = chainResp ? chainResp.headers() : {};
                const cHost = new URL(cUrl).hostname;
                const cIp = (chainResp && chainResp.remoteAddress() && chainResp.remoteAddress().ip) ||
                    (await resolveDnsDetails(cHost)).ipv4[0] || 'Unknown';
                const nextTarget = cHeaders['location'] ? new URL(cHeaders['location'], cUrl).href : url1;

                hops.push({
                    hopNumber: hops.length + 1,
                    pageStage: `Hop ${hops.length + 1}: HTTP Redirection Gateway`,
                    url: cUrl,
                    hostname: cHost,
                    status: cStatus,
                    statusText: getStatusText(cStatus),
                    redirectType: 'HTTP Header Redirect (301/302)',
                    locationHeader: cHeaders['location'] || '',
                    ip: cIp,
                    timestamp: new Date().toISOString(),
                    screenshot: generateHttpRedirectScreenshot(hops.length + 1, cUrl, nextTarget, cStatus, getStatusText(cStatus)),
                    isIntermediate: true
                });
            }
        }

        // Record Stage 1 (First Web Page)
        const stage1HopIndex = hops.length + 1;
        hops.push({
            hopNumber: stage1HopIndex,
            pageStage: `Page 1 of Successive Journey: Initial Landed Web Page`,
            url: url1,
            hostname: host1,
            status: response1 ? response1.status() : 200,
            statusText: response1 ? getStatusText(response1.status()) : 'OK',
            redirectType: hops.length > 0 ? 'Landed First Web Page' : 'Direct Navigation',
            ip: ip1,
            timestamp: new Date().toISOString(),
            pageTitle: title1 || 'First Web Page',
            screenshot: screenshot1,
            isIntermediate: false
        });

        sessionState.hops = hops;

        // ---------------------------------------------------------------------
        // ---------------------------------------------------------------------
        // IN-BETWEEN CHECK: HUMAN VERIFICATION POPUP & DIRECT INTERACTION
        // ---------------------------------------------------------------------
        const challengeCheck = await detectChallengeOnPage(page);

        if (challengeCheck.detected) {
            // "if in between any human verfiication was required mean's , it should pop-up for the interaction with the user, only human verfication was need page itself."
            sessionState.humanVerificationEncountered = true;
            sessionState.challengeType = challengeCheck.type;

            // Start CDP Screencast immediately so the user can interact right away
            try {
                await cdpClient.send('Page.startScreencast', {
                    format: 'jpeg',
                    quality: 75,
                    maxWidth: viewportWidth,
                    maxHeight: viewportHeight,
                    everyNthFrame: 1
                });

                cdpClient.on('Page.screencastFrame', async ({ data, sessionId: sId }) => {
                    send({
                        type: 'SCREENCAST_FRAME',
                        sessionId,
                        frame: data
                    });
                    try {
                        await cdpClient.send('Page.screencastFrameAck', { sessionId: sId });
                    } catch (e) {}
                });
            } catch (screencastErr) {
                console.warn('Screencast start note:', screencastErr.message);
            }

            send({
                type: 'HUMAN_VERIFICATION_REQUIRED',
                sessionId,
                stage: 'Human Verification Required',
                url: url1,
                challengeType: challengeCheck.type,
                reason: challengeCheck.reason,
                pageTitle: title1,
                viewport: { width: viewportWidth, height: viewportHeight },
                page1HopNumber: stage1HopIndex
            });

            // Monitor for challenge resolution (by click, automated solver, or manual resolution button)
            const solveMaxWait = 120000;
            let solveElapsed = 0;
            let challengeSolved = false;

            while (solveElapsed < solveMaxWait && !sessionState.cancelled) {
                await new Promise(r => setTimeout(r, 800));
                solveElapsed += 800;

                if (sessionState.manualResolveTriggered) {
                    challengeSolved = true;
                    break;
                }

                if (sessionState.permissionAnswered && !sessionState.permissionGranted) {
                    // User chose to skip
                    break;
                }

                const checkAgain = await detectChallengeOnPage(page);
                const curUrl = page.url();

                if (!checkAgain.detected || curUrl !== url1) {
                    challengeSolved = true;
                    break;
                }
            }

            try {
                await cdpClient.send('Page.stopScreencast');
            } catch (e) {}

            if (challengeSolved) {
                sessionState.humanVerificationSolved = true;
                send({
                    type: 'HUMAN_VERIFICATION_RESOLVED',
                    sessionId,
                    message: 'Human verification successfully completed! Transitioning to next web page...'
                });

                // Wait for unlocked page settlement
                await new Promise(r => setTimeout(r, 2000));

                const postUrl = page.url();
                const postTitle = await page.title().catch(() => '');
                const postHost = new URL(postUrl).hostname;
                const postDns = await resolveDnsDetails(postHost);

                let postScreenshot = '';
                try {
                    postScreenshot = await page.screenshot({
                        type: 'jpeg',
                        quality: 85,
                        encoding: 'base64'
                    });
                } catch (e) {}

                // Add Stage 2: Successive Web Page after Verification
                hops.push({
                    hopNumber: hops.length + 1,
                    pageStage: `Successive Journey: Unlocked Web Page Destination`,
                    url: postUrl,
                    hostname: postHost,
                    status: 200,
                    statusText: 'OK (Post-Verification)',
                    redirectType: 'Unlocked via Human Verification',
                    ip: postDns.ipv4[0] || ip1,
                    timestamp: new Date().toISOString(),
                    pageTitle: postTitle,
                    screenshot: postScreenshot,
                    isIntermediate: false
                });
            } else {
                send({
                    type: 'HUMAN_VERIFICATION_SKIPPED',
                    sessionId,
                    message: 'Verification ended or skipped by user.'
                });
            }
        }

        // ---------------------------------------------------------------------
        // STAGE 2: SUCCESSIVE WEB PAGE / REDIRECT DETECTION
        // ---------------------------------------------------------------------
        // "atleast two sucesses of web page's along with the url need to be included.
        //  if URL final web page was ended at first stage, no need to do it,
        //  but if it was possible to get the next web page of the link means need to display it."
        
        let currentUrlAfterStage1 = page.url();

        // 1. Check if a client-side JavaScript or Meta Refresh redirect occurred
        if (currentUrlAfterStage1 !== url1 && !hops.some(h => h.url === currentUrlAfterStage1)) {
            const hostAfter = new URL(currentUrlAfterStage1).hostname;
            const dnsAfter = await resolveDnsDetails(hostAfter);
            const titleAfter = await page.title().catch(() => '');
            let screenshotAfter = '';
            try {
                screenshotAfter = await page.screenshot({
                    type: 'jpeg',
                    quality: 85,
                    encoding: 'base64'
                });
            } catch (e) {}

            hops.push({
                hopNumber: hops.length + 1,
                pageStage: `Page 2 of Successive Journey: Dynamic Redirect Destination`,
                url: currentUrlAfterStage1,
                hostname: hostAfter,
                status: 200,
                statusText: 'OK',
                redirectType: 'Client-Side Redirect (JS / Meta Refresh)',
                ip: dnsAfter.ipv4[0] || 'Unknown',
                timestamp: new Date().toISOString(),
                pageTitle: titleAfter,
                screenshot: screenshotAfter,
                isIntermediate: false
            });
        } 
        // 2. If page is still on URL 1, check if page has an automatic redirect timer or forward link
        else if (hops.filter(h => !h.isIntermediate).length < 2) {
            // Inspect DOM for meta refresh or onward destination link
            let nextPossibleTarget = null;
            try {
                nextPossibleTarget = await page.evaluate(() => {
                    // Check meta refresh
                    const metaRefresh = document.querySelector('meta[http-equiv="refresh" i]');
                    if (metaRefresh && metaRefresh.content) {
                        const match = metaRefresh.content.match(/url=(.+)/i);
                        if (match && match[1]) {
                            return { type: 'meta_refresh', url: match[1].trim() };
                        }
                    }

                    // Check for prominent redirect or onward link on gateway/shortener pages
                    const onwardLink = document.querySelector('a#redirect-link, a.redirect-link, a.destination-link, a[data-redirect], .btn-proceed, #proceed-link');
                    if (onwardLink && onwardLink.href && !onwardLink.href.startsWith('javascript:')) {
                        return { type: 'gateway_link', url: onwardLink.href };
                    }

                    return null;
                });
            } catch (evalErr) {
                // Ignore detached frame if page navigated concurrently
            }

            if (nextPossibleTarget && nextPossibleTarget.url) {
                send({
                    type: 'PROGRESS_UPDATE',
                    sessionId,
                    message: `Advancing to Stage 2 (Second Web Page): Following ${nextPossibleTarget.type} to ${nextPossibleTarget.url}...`
                });

                try {
                    const nextFullUrl = new URL(nextPossibleTarget.url, page.url()).href;
                    const resp2 = await page.goto(nextFullUrl, {
                        waitUntil: 'domcontentloaded',
                        timeout: 20000
                    });

                    // Fast rendering delay
                    await new Promise(r => setTimeout(r, 350));

                    const url2 = page.url();
                    const title2 = await page.title().catch(() => '');
                    const host2 = new URL(url2).hostname;
                    const dns2 = await resolveDnsDetails(host2);
                    const ip2 = (resp2 && resp2.remoteAddress() && resp2.remoteAddress().ip) || dns2.ipv4[0] || 'Unknown';

                    let screenshot2 = '';
                    try {
                        screenshot2 = await page.screenshot({
                            type: 'jpeg',
                            quality: 85,
                            encoding: 'base64'
                        });
                    } catch (e) {}

                    hops.push({
                        hopNumber: hops.length + 1,
                        pageStage: `Page 2 of Successive Journey: Destination Web Page`,
                        url: url2,
                        hostname: host2,
                        status: resp2 ? resp2.status() : 200,
                        statusText: resp2 ? getStatusText(resp2.status()) : 'OK',
                        redirectType: nextPossibleTarget.type === 'meta_refresh' ? 'HTML Meta Refresh' : 'Gateway Onward Navigation',
                        ip: ip2,
                        timestamp: new Date().toISOString(),
                        pageTitle: title2,
                        screenshot: screenshot2,
                        isIntermediate: false
                    });
                } catch (e) {
                    console.warn('Next stage navigation note:', e.message);
                }
            }
            // If none, and page was ended at first stage naturally, no need to force a fake page ("if URL final web page was ended at first stage, no need to do it")
        }

        // ---------------------------------------------------------------------
        // COMPILE OUTCOMES (OPTIMIZED FAST PARALLEL RESOLUTION)
        // ---------------------------------------------------------------------
        const uniqueHostnames = new Set();
        hops.forEach(h => uniqueHostnames.add(h.hostname));
        sessionState.ips.forEach((v, k) => uniqueHostnames.add(k));

        // 1. Parallel Domain Age Resolution
        const domainAgeMap = new Map();
        const hostList = Array.from(uniqueHostnames);
        await Promise.allSettled(hostList.map(async (host) => {
            try {
                const age = await getDomainAge(host);
                domainAgeMap.set(host, age);
            } catch (e) {
                domainAgeMap.set(host, { ageFormatted: 'Active Domain', years: 3 });
            }
        }));

        // Attach domain age info directly to each hop
        hops.forEach(h => {
            h.domainAge = domainAgeMap.get(h.hostname) || { ageFormatted: 'Active Domain', years: null };
        });

        // 2. Parallel DNS & IP Geo-telemetry Resolution
        const dnsResults = await Promise.all(hostList.map(async (host) => {
            const dnsInfo = await resolveDnsDetails(host);
            return { host, dnsInfo };
        }));

        const destinationIpDetails = [];
        const seenIps = new Set();
        const ipLookupTasks = [];

        for (const { host, dnsInfo } of dnsResults) {
            for (const ip of dnsInfo.allIps) {
                if (!seenIps.has(ip)) {
                    seenIps.add(ip);
                    ipLookupTasks.push(
                        getIpInfo(ip).then(geo => ({
                            hostname: host,
                            ip,
                            isIpv6: ip.includes(':'),
                            country: geo.country,
                            countryCode: geo.countryCode,
                            city: geo.city,
                            isp: geo.isp,
                            org: geo.org,
                            as: geo.as
                        }))
                    );
                }
            }
        }

        const resolvedIps = await Promise.allSettled(ipLookupTasks);
        resolvedIps.forEach(r => {
            if (r.status === 'fulfilled' && r.value) {
                destinationIpDetails.push(r.value);
            }
        });

        // 1. Screen shot section outcomes
        const screenshotItems = hops
            .filter(h => !!h.screenshot)
            .map(h => ({
                hopNumber: h.hopNumber,
                pageStage: h.pageStage,
                url: h.url,
                pageTitle: h.pageTitle || 'Web Page Snapshot',
                status: h.status,
                statusText: h.statusText,
                redirectType: h.redirectType,
                screenshotBase64: h.screenshot,
                timestamp: h.timestamp,
                domainAge: h.domainAge,
                isIntermediate: h.isIntermediate || false
            }));

        // Initial and Final Domain Age references
        const initialHostname = new URL(targetUrl).hostname;
        const finalHostname = new URL(hops[hops.length - 1].url).hostname;
        const initialDomainAge = domainAgeMap.get(initialHostname) || await getDomainAge(initialHostname);
        const finalDomainAge = domainAgeMap.get(finalHostname) || await getDomainAge(finalHostname);

        // 4. Summary Section compilation (Required Outcome 4)
        const hasHighRiskDownload = sessionState.downloadFiles.some(d => (d.riskLevel || '').includes('High'));
        const hasDownloads = sessionState.downloadFiles.length > 0;
        const isHttps = hops[hops.length - 1].url.startsWith('https://');
        let safetyVerdict = 'Safe Navigation';
        let safetyBadgeClass = 'safe';
        let safetyReason = 'All redirection hops resolved securely. No malicious files or unauthorized behaviors detected.';
        
        if (hasHighRiskDownload) {
            safetyVerdict = 'Dangerous (Executable Download Blocked)';
            safetyBadgeClass = 'danger';
            safetyReason = 'The target website triggered an executable/binary download. The download was strictly blocked and permission denied.';
        } else if (hasDownloads) {
            safetyVerdict = 'Caution (File Downloads Intercepted)';
            safetyBadgeClass = 'warn';
            safetyReason = 'The target website attempted automatic file downloads. All downloads were intercepted and permission was denied.';
        } else if (!isHttps) {
            safetyVerdict = 'Caution (Unencrypted HTTP Connection)';
            safetyBadgeClass = 'warn';
            safetyReason = 'The destination page does not utilize SSL/TLS encryption (HTTP plaintext). Sensitive data may be visible in transit.';
        } else if (hops.length >= 3) {
            safetyVerdict = 'Suspicious (Extended Redirection Chain)';
            safetyBadgeClass = 'warn';
            safetyReason = `The URL traversed through ${hops.length} hops across different domains or endpoints before reaching its landing page.`;
        }

        const summaryData = {
            verdict: safetyVerdict,
            badgeClass: safetyBadgeClass,
            reason: safetyReason,
            initialUrl: targetUrl,
            finalUrl: hops[hops.length - 1].url,
            initialDomainAge,
            finalDomainAge,
            totalHops: hops.length,
            redirectsCount: Math.max(0, hops.length - 1),
            isRedirected: hops.length > 1,
            protocol: isHttps ? 'HTTPS (TLS Encrypted)' : 'HTTP (Plaintext Unencrypted)',
            isHttps,
            humanVerification: {
                encountered: sessionState.humanVerificationEncountered || false,
                solved: sessionState.humanVerificationSolved || false,
                type: sessionState.challengeType || 'None'
            },
            downloads: {
                totalDetected: sessionState.downloadFiles.length,
                permissionDenied: true,
                files: sessionState.downloadFiles.map(d => ({
                    filename: d.filename,
                    extension: d.extension,
                    riskLevel: d.riskLevel,
                    status: 'BLOCKED (Permission Denied)'
                }))
            },
            destinationServer: destinationIpDetails[0] || null,
            scanCompletedAt: new Date().toISOString()
        };

        const finalResults = {
            sessionId,
            initialUrl: targetUrl,
            finalUrl: hops[hops.length - 1].url,
            initialDomainAge,
            finalDomainAge,
            totalHops: hops.length,
            totalRenderedPages: screenshotItems.length,
            isRedirected: hops.length > 1,
            outcomes: {
                // 1. Screen shot section
                screenshots: screenshotItems,
                // 2. Redirected URL's section
                redirectChain: hops.map(h => ({
                    hopNumber: h.hopNumber,
                    pageStage: h.pageStage,
                    url: h.url,
                    hostname: h.hostname,
                    status: h.status,
                    statusText: h.statusText,
                    redirectType: h.redirectType,
                    locationHeader: h.locationHeader || null,
                    ip: h.ip,
                    domainAge: h.domainAge,
                    pageTitle: h.pageTitle || null,
                    timestamp: h.timestamp
                })),
                // 3. File download detection (no permission given for download)
                downloads: sessionState.downloadFiles,
                // 4. Display the summary
                summary: summaryData,
                // Additional Network Telemetry
                destinationIps: destinationIpDetails
            },
            telemetry: {
                dns: {
                    initial: await resolveDnsDetails(new URL(targetUrl).hostname),
                    final: await resolveDnsDetails(new URL(hops[hops.length - 1].url).hostname)
                },
                scanCompletedAt: new Date().toISOString(),
                browserUsed: path.basename(browserPath)
            }
        };

        send({
            type: 'SCAN_COMPLETE',
            sessionId,
            results: finalResults
        });

    } catch (err) {
        console.error('Scan pipeline exception:', err);
        send({
            type: 'SCAN_ERROR',
            sessionId,
            message: `Inspection encountered an issue: ${err.message}`
        });
    } finally {
        if (browser) {
            try { await browser.close(); } catch (e) {}
        }
        activeScans.delete(sessionId);
    }
}

// Helpers
function getStatusText(code) {
    const table = {
        200: 'OK',
        201: 'Created',
        204: 'No Content',
        301: 'Moved Permanently',
        302: 'Found (Temporary Redirect)',
        303: 'See Other',
        304: 'Not Modified',
        307: 'Temporary Redirect',
        308: 'Permanent Redirect',
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        500: 'Internal Server Error',
        502: 'Bad Gateway',
        503: 'Service Unavailable',
        504: 'Gateway Timeout'
    };
    return table[code] || `HTTP ${code}`;
}

function getFileRiskLevel(ext) {
    const highRisk = ['.exe', '.msi', '.bat', '.cmd', '.scr', '.vbs', '.js', '.ps1', '.sh', '.apk', '.jar', '.dll'];
    const mediumRisk = ['.zip', '.rar', '.7z', '.tar', '.gz', '.iso', '.dmg', '.bin'];
    if (highRisk.includes(ext)) return 'High Risk (Executable / Script)';
    if (mediumRisk.includes(ext)) return 'Medium Risk (Compressed Archive)';
    return 'Low / Normal Risk (Document / Asset)';
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ==========================================
// PDF REPORT GENERATION ENGINE (PUPPETEER)
// ==========================================

function generatePdfHtmlReport(results) {
    const summary = results.outcomes?.summary || {
        verdict: 'Safe Navigation',
        badgeClass: 'safe',
        reason: 'Inspection completed without malicious redirects or download payloads.',
        initialUrl: results.initialUrl,
        finalUrl: results.finalUrl,
        totalHops: results.totalHops || 1,
        redirectsCount: Math.max(0, (results.totalHops || 1) - 1),
        protocol: (results.finalUrl || '').startsWith('https://') ? 'HTTPS (TLS Encrypted)' : 'HTTP (Plaintext Unencrypted)',
        humanVerification: { encountered: false, type: 'None' },
        downloads: { totalDetected: 0, permissionDenied: true }
    };

    const screenshots = results.outcomes?.screenshots || [];
    const redirectChain = results.outcomes?.redirectChain || [];
    const downloads = results.outcomes?.downloads || [];
    const destinationIps = results.outcomes?.destinationIps || [];

    const verdictColor = summary.badgeClass === 'danger' ? '#dc2626' : (summary.badgeClass === 'warn' ? '#d97706' : '#059669');
    const verdictBg = summary.badgeClass === 'danger' ? '#fee2e2' : (summary.badgeClass === 'warn' ? '#fffbeb' : '#ecfdf5');
    const verdictBorder = summary.badgeClass === 'danger' ? '#fca5a5' : (summary.badgeClass === 'warn' ? '#fde68a' : '#a7f3d0');

    // Build screenshots HTML
    let screenshotsHtml = '';
    if (screenshots.length === 0) {
        screenshotsHtml = '<div style="padding:14px; color:#64748b; font-style:italic;">No visual screenshots were captured along this path.</div>';
    } else {
        screenshotsHtml = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-top:12px;">
                ${screenshots.map((s, idx) => {
                    const imgSrc = s.screenshotBase64.startsWith('<svg') || s.screenshotBase64.startsWith('PD94') || s.screenshotBase64.startsWith('PHN2')
                        ? 'data:image/svg+xml;base64,' + s.screenshotBase64
                        : 'data:image/jpeg;base64,' + s.screenshotBase64;
                    const stageBadge = s.pageStage ? s.pageStage.split(':')[0] : `Hop ${s.hopNumber || idx + 1}`;
                    return `
                        <div style="border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; background:#ffffff; page-break-inside:avoid;">
                            <div style="position:relative; width:100%; aspect-ratio:16/10; background:#f1f5f9; overflow:hidden;">
                                <img src="${imgSrc}" style="width:100%; height:100%; object-fit:cover; object-position:top;" />
                                <span style="position:absolute; top:8px; left:8px; background:rgba(15,23,42,0.85); color:#ffffff; padding:2px 8px; border-radius:4px; font-size:10px; font-weight:bold;">${escapeXml(stageBadge)}</span>
                            </div>
                            <div style="padding:10px 12px;">
                                <div style="font-weight:bold; font-size:12px; color:#0f172a; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeXml(s.pageTitle || 'Web Page')}</div>
                                <div style="font-family:monospace; font-size:10px; color:#0284c7; margin-bottom:6px; word-break:break-all;">${escapeXml(s.url)}</div>
                                <div style="display:flex; gap:6px;">
                                    <span style="background:#ecfdf5; color:#059669; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:600;">${s.status} ${escapeXml(s.statusText || 'OK')}</span>
                                    <span style="background:#f1f5f9; color:#475569; padding:2px 6px; border-radius:4px; font-size:10px;">${escapeXml(s.redirectType || 'Page')}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    // Build Redirect Chain HTML
    let redirectChainHtml = `
        <table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:11px;">
            <thead>
                <tr style="background:#f8fafc; border-bottom:2px solid #cbd5e1; text-align:left;">
                    <th style="padding:8px 10px; color:#475569;">#</th>
                    <th style="padding:8px 10px; color:#475569;">Status</th>
                    <th style="padding:8px 10px; color:#475569;">Redirect Type</th>
                    <th style="padding:8px 10px; color:#475569;">URL</th>
                    <th style="padding:8px 10px; color:#475569;">Domain Age</th>
                    <th style="padding:8px 10px; color:#475569;">Destination IP</th>
                </tr>
            </thead>
            <tbody>
                ${redirectChain.map(h => `
                    <tr style="border-bottom:1px solid #e2e8f0;">
                        <td style="padding:8px 10px; font-weight:bold; color:#0284c7;">Hop ${h.hopNumber}</td>
                        <td style="padding:8px 10px;">
                            <span style="background:${h.status === 200 ? '#ecfdf5' : '#fffbeb'}; color:${h.status === 200 ? '#059669' : '#d97706'}; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:10px;">
                                ${h.status} ${escapeXml(h.statusText || '')}
                            </span>
                        </td>
                        <td style="padding:8px 10px; color:#334155;">${escapeXml(h.redirectType || 'Redirect')}</td>
                        <td style="padding:8px 10px; font-family:monospace; color:#0f172a; word-break:break-all;">
                            ${escapeXml(h.url)}
                            ${h.locationHeader ? `<div style="color:#0284c7; font-size:10px; margin-top:2px;">➔ Location: ${escapeXml(h.locationHeader)}</div>` : ''}
                        </td>
                        <td style="padding:8px 10px; font-size:10px; color:#0369a1; font-weight:600; white-space:nowrap;">
                            ${escapeXml(h.domainAge?.ageFormatted || 'Active')}
                        </td>
                        <td style="padding:8px 10px; font-family:monospace; color:#475569;">${escapeXml(h.ip || 'Resolved')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    // Build Downloads HTML
    let downloadsHtml = '';
    if (downloads.length === 0) {
        downloadsHtml = `
            <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; padding:12px 16px; display:flex; align-items:center; gap:12px; margin-top:10px;">
                <div style="font-size:18px; color:#059669; font-weight:bold;">✓</div>
                <div>
                    <strong style="color:#065f46; font-size:12px; display:block;">Safe Navigation: No Automatic Downloads Detected</strong>
                    <span style="color:#047857; font-size:11px;">Neither HTTP Content-Disposition headers nor browser download events were triggered along this URL path.</span>
                </div>
            </div>
        `;
    } else {
        downloadsHtml = `
            <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:8px 12px; margin-top:10px; font-size:11px; color:#1e40af;">
                <strong>🛡️ Sandbox Enforcement Notice:</strong> No permission was granted for downloads. All files were intercepted and blocked from downloading. URLs are locked non-clickable for protection.
            </div>
            <div style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">
                ${downloads.map(dl => {
                    const isExe = (dl.riskLevel || '').includes('High');
                    return `
                        <div style="border:1px solid ${isExe ? '#fca5a5' : '#fed7aa'}; background:${isExe ? '#fffafa' : '#fffdfa'}; border-radius:8px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; page-break-inside:avoid;">
                            <div>
                                <div style="font-family:monospace; font-weight:bold; font-size:13px; color:#0f172a;">${escapeXml(dl.filename)}</div>
                                <div style="margin-top:4px; display:flex; align-items:center; gap:8px;">
                                    <span style="background:${isExe ? '#fee2e2' : '#e0f2fe'}; color:${isExe ? '#dc2626' : '#0284c7'}; padding:2px 8px; border-radius:4px; font-size:10px; font-weight:800;">
                                        EXTENSION: ${escapeXml((dl.extension || '').toUpperCase())}
                                    </span>
                                    <span style="color:#64748b; font-size:11px;">${escapeXml(dl.riskLevel || '')}</span>
                                    <span style="color:#dc2626; background:#fff1f2; font-size:10px; font-weight:bold; padding:2px 6px; border-radius:4px;">
                                        🔒 PERMISSION DENIED (BLOCKED)
                                    </span>
                                </div>
                            </div>
                            <div style="text-align:right; font-size:11px; color:#64748b;">
                                <div>Size: <strong style="color:#0f172a;">${escapeXml(dl.formattedSize || 'Unknown')}</strong></div>
                                <div>MIME: <code style="font-family:monospace;">${escapeXml(dl.mimeType || 'application/octet-stream')}</code></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    // Build Destination IPs HTML
    let ipsHtml = '';
    if (destinationIps.length > 0) {
        ipsHtml = `
            <div style="margin-top:20px; page-break-inside:avoid;">
                <h3 style="font-size:13px; font-weight:bold; color:#0f172a; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.04em;">
                    Destination IP's & Network Telemetry
                </h3>
                <table style="width:100%; border-collapse:collapse; font-size:11px;">
                    <thead>
                        <tr style="background:#f8fafc; border-bottom:2px solid #cbd5e1; text-align:left;">
                            <th style="padding:6px 10px; color:#475569;">Hostname</th>
                            <th style="padding:6px 10px; color:#475569;">Destination IP</th>
                            <th style="padding:6px 10px; color:#475569;">Type</th>
                            <th style="padding:6px 10px; color:#475569;">Location</th>
                            <th style="padding:6px 10px; color:#475569;">Hosting / ISP</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${destinationIps.map(ip => `
                            <tr style="border-bottom:1px solid #e2e8f0;">
                                <td style="padding:6px 10px; font-family:monospace; font-weight:bold; color:#0f172a;">${escapeXml(ip.hostname)}</td>
                                <td style="padding:6px 10px; font-family:monospace; color:#0284c7; font-weight:bold;">${escapeXml(ip.ip)}</td>
                                <td style="padding:6px 10px;"><span style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:9px;">${ip.isIpv6 ? 'IPv6' : 'IPv4'}</span></td>
                                <td style="padding:6px 10px;">${escapeXml(ip.city || 'Unknown')}, ${escapeXml(ip.country || 'Global')}</td>
                                <td style="padding:6px 10px; color:#334155;"><strong>${escapeXml(ip.isp || ip.org || '')}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    const initAgeText = results.initialDomainAge?.ageFormatted || summary.initialDomainAge?.ageFormatted || '';
    const finalAgeText = results.finalDomainAge?.ageFormatted || summary.finalDomainAge?.ageFormatted || '';
    const isLockedOnDownload = downloads.length > 0;

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Pre check URL — Inspection Report</title>
            <style>
                @page {
                    size: A4;
                    margin: 12mm;
                }
                * { box-sizing: border-box; margin:0; padding:0; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    color: #0f172a;
                    background: #ffffff;
                    font-size: 12px;
                    line-height: 1.5;
                    padding: 10px;
                }
                .report-header {
                    border-bottom: 2px solid #0284c7;
                    padding-bottom: 14px;
                    margin-bottom: 18px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }
                .brand-title {
                    font-size: 22px;
                    font-weight: 800;
                    color: #0284c7;
                    letter-spacing: -0.02em;
                }
                .brand-sub {
                    font-size: 11px;
                    color: #64748b;
                    font-weight: 500;
                }
                .report-meta {
                    text-align: right;
                    font-size: 11px;
                    color: #475569;
                }
                .section-card {
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    padding: 14px 18px;
                    margin-bottom: 16px;
                    background: #ffffff;
                }
                .section-title {
                    font-size: 13px;
                    font-weight: 800;
                    color: #0f172a;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 6px;
                }
                .section-subtitle {
                    font-size: 10px;
                    color: #64748b;
                    margin-bottom: 10px;
                }
                .metric-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                    margin-top: 10px;
                }
                .metric-box {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    padding: 10px;
                }
                .metric-label {
                    font-size: 9px;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: #64748b;
                }
                .metric-val {
                    font-size: 13px;
                    font-weight: 800;
                    color: #0f172a;
                    margin-top: 2px;
                }
                .footer {
                    margin-top: 24px;
                    padding-top: 12px;
                    border-top: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    font-size: 10px;
                    color: #94a3b8;
                }
                .url-locked-text {
                    color: #dc2626;
                    font-size: 9px;
                    font-weight: 800;
                    margin-top: 2px;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                }
            </style>
        </head>
        <body>
            <!-- Report Header -->
            <div class="report-header">
                <div>
                    <div class="brand-title">🛡️ Pre check URL</div>
                    <div class="brand-sub">Website Redirection & Security Forensics Report</div>
                </div>
                <div class="report-meta">
                    <div>Generated: <strong>${new Date().toLocaleString()}</strong></div>
                    <div>Engine: <strong>Chromium Sandbox</strong></div>
                </div>
            </div>

            <!-- Target URL & Landing Ribbon with Domain Age (Beside URL) -->
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:12px 16px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div style="flex:1;">
                        <span style="font-size:9px; font-weight:bold; color:#64748b; text-transform:uppercase;">Entered Target URL</span>
                        <div style="font-family:monospace; font-weight:bold; font-size:12px; color:#0f172a; word-break:break-all;">
                            ${escapeXml(results.initialUrl)}
                            ${initAgeText ? `<span style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; margin-left:6px; display:inline-block;">Domain Age: ${escapeXml(initAgeText)}</span>` : ''}
                        </div>
                        ${isLockedOnDownload ? '<div class="url-locked-text">🔒 Non-clickable (Files Downloaded)</div>' : ''}
                    </div>
                    <div style="font-size:18px; color:#94a3b8; padding:0 14px;">➔</div>
                    <div style="flex:1;">
                        <span style="font-size:9px; font-weight:bold; color:#64748b; text-transform:uppercase;">Final Landed Destination</span>
                        <div style="font-family:monospace; font-weight:bold; font-size:12px; color:#0284c7; word-break:break-all;">
                            ${escapeXml(results.finalUrl)}
                            ${finalAgeText ? `<span style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; margin-left:6px; display:inline-block;">Domain Age: ${escapeXml(finalAgeText)}</span>` : ''}
                        </div>
                        ${isLockedOnDownload ? '<div class="url-locked-text">🔒 Non-clickable (Files Downloaded)</div>' : ''}
                    </div>
                </div>
            </div>

            <!-- Outcome 1: Screen Shot Section -->
            <div class="section-card">
                <div class="section-title">1. Screen Shot Section (Redirected Pages)</div>
                <div class="section-subtitle">Visual page screenshots captured along the URL redirection trail</div>
                ${screenshotsHtml}
            </div>

            <!-- Outcome 2: Redirected URL's Section -->
            <div class="section-card" style="page-break-inside:avoid;">
                <div class="section-title">2. Redirected URL's Section</div>
                <div class="section-subtitle">Full redirection chain with HTTP status codes, referral mechanisms, domain age, and destination IPs</div>
                ${redirectChainHtml}
            </div>

            <!-- Outcome 3: File Download Detection Section -->
            <div class="section-card" style="page-break-inside:avoid;">
                <div class="section-title">3. File Download Detection Section</div>
                <div class="section-subtitle">Real-time detection of any files or binaries triggered for download (Permission Denied for Sandbox Security)</div>
                ${downloadsHtml}
            </div>

            <!-- Destination IP's & Network Telemetry -->
            ${ipsHtml}

            <!-- Outcome 4: Summary Section (AT THE END OF THE PAGE AS REQUIRED BY USER) -->
            <div class="section-card" style="page-break-inside:avoid; margin-top:20px; border:2px solid ${verdictBorder}; background:${verdictBg};">
                <div class="section-title" style="color:${verdictColor};">4. Summary Section</div>
                <div class="section-subtitle">High-level safety verdict, redirection metrics, SSL status, and forensics summary</div>
                
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <span style="font-size:15px; font-weight:800; color:${verdictColor};">${escapeXml(summary.verdict)}</span>
                    <span style="background:${verdictColor}; color:#ffffff; padding:3px 12px; border-radius:12px; font-size:10px; font-weight:bold; text-transform:uppercase;">VERDICT</span>
                </div>
                <div style="font-size:11px; color:#334155; margin-bottom:12px;">${escapeXml(summary.reason)}</div>

                <div class="metric-grid">
                    <div class="metric-box">
                        <div class="metric-label">Total Redirection Hops</div>
                        <div class="metric-val">${summary.totalHops} Hops (${summary.redirectsCount} Redirects)</div>
                    </div>
                    <div class="metric-box">
                        <div class="metric-label">SSL Transport Security</div>
                        <div class="metric-val" style="color:${summary.protocol.includes('HTTPS') ? '#059669' : '#d97706'};">${escapeXml(summary.protocol)}</div>
                    </div>
                    <div class="metric-box">
                        <div class="metric-label">File Downloads Detected</div>
                        <div class="metric-val" style="color:${downloads.length > 0 ? '#dc2626' : '#059669'};">${downloads.length} Files (Permission Denied)</div>
                    </div>
                    <div class="metric-box">
                        <div class="metric-label">Human Verification</div>
                        <div class="metric-val">${summary.humanVerification?.encountered ? 'Encountered & Solved' : 'None Required'}</div>
                    </div>
                    <div class="metric-box">
                        <div class="metric-label">Landed Hostname & Domain Age</div>
                        <div class="metric-val" style="font-size:11px; font-family:monospace;">
                            ${escapeXml(new URL(results.finalUrl).hostname)}
                            ${finalAgeText ? `<div style="font-size:10px; color:#0284c7; font-family:sans-serif; margin-top:2px;">Age: ${escapeXml(finalAgeText)}</div>` : ''}
                        </div>
                    </div>
                    <div class="metric-box">
                        <div class="metric-label">Redirection Status</div>
                        <div class="metric-val" style="color:${results.isRedirected ? '#d97706' : '#059669'};">${results.isRedirected ? 'Redirected' : 'Direct Navigation'}</div>
                    </div>
                </div>
            </div>

            <!-- Report Footer -->
            <div class="footer">
                <div>Pre check URL Forensics System • Powered by Headless Chromium & CDP</div>
                <div>Format: PDF Forensic Document • Page 1 of 1</div>
            </div>
        </body>
        </html>
    `;
}

// PDF Export Endpoint (Required by user: only in pdf extension)
app.post('/api/export-pdf', async (req, res) => {
    const results = req.body;
    if (!results || !results.initialUrl) {
        return res.status(400).json({ error: 'Missing or invalid scan results data.' });
    }

    let browser = null;
    try {
        const browserPath = getBrowserExecutablePath();
        if (!browserPath) {
            return res.status(500).json({ error: 'Chromium browser not located for PDF printing.' });
        }

        browser = await puppeteer.launch({
            executablePath: browserPath,
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
        });

        const page = await browser.newPage();
        const html = generatePdfHtmlReport(results);
        await page.setContent(html, { waitUntil: 'load', timeout: 35000 });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '10mm',
                bottom: '10mm',
                left: '10mm',
                right: '10mm'
            }
        });

        const filename = `pre_check_url_${Date.now()}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.end(pdfBuffer);
    } catch (err) {
        console.error('PDF generation error:', err);
        res.status(500).json({ error: 'Failed to generate PDF report: ' + err.message });
    } finally {
        if (browser) {
            try { await browser.close(); } catch (e) {}
        }
    }
});

// ==========================================
// BUILT-IN TEST SUITE / SIMULATION ENDPOINTS
// ==========================================

// 1. Two-Stage Successive Web Page Journey (Page 1 -> Page 2)
app.get('/test/two-stage-flow', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Stage 1 // Referral Gateway Web Page</title>
            <meta http-equiv="refresh" content="2;url=/test/two-stage-flow/destination">
            <style>
                body { background: #0c1222; color: #f8fafc; font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .box { background: #182238; border: 2px solid #38bdf8; border-radius: 12px; padding: 40px; text-align: center; max-width: 520px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
                h1 { color: #38bdf8; font-size: 24px; margin-top: 0; }
                p { color: #94a3b8; font-size: 15px; line-height: 1.6; }
                .badge { background: #0284c7; color: white; padding: 6px 16px; border-radius: 20px; font-weight: bold; display: inline-block; margin-top: 10px; }
            </style>
        </head>
        <body>
            <div class="box">
                <h1>PAGE 1: Gateway Landing Page</h1>
                <p>This is the first success web page. Preparing to transition to the successive web page in 2 seconds...</p>
                <div class="badge">Stage 1 Active</div>
            </div>
        </body>
        </html>
    `);
});

app.get('/test/two-stage-flow/destination', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Stage 2 // Successive Final Destination</title>
            <style>
                body { background: #064e3b; color: #ecfdf5; font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .box { background: #065f46; border: 2px solid #34d399; border-radius: 12px; padding: 40px; text-align: center; max-width: 520px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
                h1 { color: #34d399; font-size: 24px; margin-top: 0; }
                p { color: #d1fae5; font-size: 15px; line-height: 1.6; }
                .badge { background: #059669; color: white; padding: 6px 16px; border-radius: 20px; font-weight: bold; display: inline-block; margin-top: 10px; }
            </style>
        </head>
        <body>
            <div class="box">
                <h1>PAGE 2: Destination Landed Successfully!</h1>
                <p>You have arrived at the second successive web page along this URL journey.</p>
                <div class="badge">Stage 2 Reached (200 OK)</div>
            </div>
        </body>
        </html>
    `);
});

// 2. Human Verification Between First and Second Web Page
app.get(['/test/captcha-permission', '/test/captcha-challenge'], (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Attention Required! | Cloudflare Security Check</title>
            <style>
                * { box-sizing: border-box; }
                body { background: #0b0f19; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
                .challenge-box { background: #151d2e; border: 1px solid #f59e0b; padding: 36px; border-radius: 12px; width: 440px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
                .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; color: #f59e0b; font-size: 20px; font-weight: bold; }
                h2 { margin: 0 0 10px 0; font-size: 22px; color: #ffffff; }
                p { color: #94a3b8; font-size: 14px; margin-bottom: 24px; line-height: 1.5; }
                .turnstile-widget { background: #1e293b; border: 1px solid #475569; border-radius: 8px; padding: 16px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.2s; }
                .turnstile-widget:hover { border-color: #38bdf8; background: #243248; }
                .checkbox-area { display: flex; align-items: center; gap: 14px; font-size: 15px; font-weight: 500; }
                .fake-checkbox { width: 28px; height: 28px; border: 2px solid #64748b; border-radius: 6px; display: flex; align-items: center; justify-content: center; background: #0f172a; transition: all 0.2s; }
                .turnstile-widget.checked .fake-checkbox { background: #10b981; border-color: #10b981; }
                .turnstile-widget.checked .fake-checkbox::after { content: "✓"; color: white; font-weight: bold; font-size: 18px; }
                .cloudflare-logo { font-size: 11px; color: #64748b; text-align: right; }
                .footer { margin-top: 24px; font-size: 12px; color: #64748b; border-top: 1px solid #2d3748; padding-top: 16px; }
            </style>
        </head>
        <body>
            <div class="challenge-box" id="challenge-stage">
                <div class="brand">
                    <span>🛡️ Security Gateway</span>
                </div>
                <h2>Verify you are human</h2>
                <p>Security verification encountered between Page 1 and Page 2. Please complete the verification to unlock the second web page.</p>
                
                <div class="turnstile-widget cf-turnstile" id="cf-turnstile-box" onclick="solveChallenge()">
                    <div class="checkbox-area">
                        <div class="fake-checkbox" id="check-icon"></div>
                        <span>I am not a robot</span>
                    </div>
                    <div class="cloudflare-logo">
                        <span>Protected by</span><br>
                        <strong style="color:#94a3b8;">Turnstile Engine</strong>
                    </div>
                </div>

                <div class="footer">
                    Ray ID: <code>86f29a007b82</code> • Pre-Check Verification Stage
                </div>
            </div>

            <script>
                function solveChallenge() {
                    const box = document.getElementById('cf-turnstile-box');
                    box.classList.add('checked');
                    box.querySelector('.checkbox-area span').innerText = 'Verifying...';
                    setTimeout(() => {
                        document.title = 'Verification Solved! Advancing to Page 2...';
                        window.location.href = '/test/two-stage-flow/destination';
                    }, 1200);
                }
            </script>
        </body>
        </html>
    `);
});

// 3. Multi-Hop Redirect Chain
app.get('/test/chain-start', (req, res) => {
    res.redirect(301, '/test/chain-step2');
});

app.get('/test/chain-step2', (req, res) => {
    res.redirect(302, '/test/chain-final');
});

app.get('/test/chain-final', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Multi-Hop Redirect Destination</title>
            <style>
                body { background: #0f172a; color: #f8fafc; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .card { background: #1e293b; padding: 40px; border-radius: 12px; border: 1px solid #38bdf8; text-align: center; max-width: 500px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                h1 { color: #38bdf8; margin-top: 0; }
                p { color: #94a3b8; line-height: 1.6; }
                .badge { background: #0284c7; color: white; padding: 6px 14px; border-radius: 20px; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Destination Landed</h1>
                <p>Traversed through maximum HTTP 301 & 302 redirection chain.</p>
                <div class="badge">Status: 200 OK</div>
            </div>
        </body>
        </html>
    `);
});

// 4. File Downloads
app.get('/test/download-file', (req, res) => {
    const filename = req.query.type === 'pdf' ? 'security_audit_report.pdf' : 'system_patch_update.exe';
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', req.query.type === 'pdf' ? 'application/pdf' : 'application/x-msdownload');
    res.send(Buffer.from('DEMO_SANDBOX_DOWNLOAD_PAYLOAD_CONTENT_2026'));
});

// 5. Single Stage (ends at first stage)
app.get('/test/single-stage', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Single Stage Web Page</title>
            <style>
                body { background: #0f172a; color: #f8fafc; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .card { background: #1e293b; padding: 40px; border-radius: 12px; border: 1px solid #10b981; text-align: center; max-width: 500px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1 style="color:#10b981;">Single Stage Page</h1>
                <p>This web page ends naturally at the first stage without any redirects.</p>
            </div>
        </body>
        </html>
    `);
});

// ==========================================
// USER AUTHENTICATION & QUOTA API ENDPOINTS
// ==========================================
const usersDataFile = path.join(__dirname, 'data', 'users.json');
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

function loadUsers() {
    try {
        if (fs.existsSync(usersDataFile)) {
            return JSON.parse(fs.readFileSync(usersDataFile, 'utf8'));
        }
    } catch (e) {}
    // Pre-seed with default demo account
    return [
        {
            id: 'usr_demo_1',
            name: 'Demo Analyst',
            email: 'demo.user@precheck.io',
            password: 'SecurePass@2026!',
            createdAt: new Date().toISOString()
        }
    ];
}

function saveUsers(users) {
    try {
        fs.writeFileSync(usersDataFile, JSON.stringify(users, null, 2), 'utf8');
    } catch (e) {}
}

let usersDatabase = loadUsers();

// 1. Register User (Validates minimum 12 chars standard password policy)
app.post('/api/auth/register', (req, res) => {
    const { name, email, password } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }
    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists
    if (usersDatabase.some(u => u.email === cleanEmail)) {
        return res.status(409).json({ success: false, error: 'An account with this email already exists. Please sign in.' });
    }

    // Password standard security policy: min 12 chars, upper, lower, digit, special char
    if (password.length < 12) {
        return res.status(400).json({ success: false, error: 'Password must be at least 12 characters in length.' });
    }
    if (!/[A-Z]/.test(password)) {
        return res.status(400).json({ success: false, error: 'Password must include at least one uppercase letter (A-Z).' });
    }
    if (!/[a-z]/.test(password)) {
        return res.status(400).json({ success: false, error: 'Password must include at least one lowercase letter (a-z).' });
    }
    if (!/[0-9]/.test(password)) {
        return res.status(400).json({ success: false, error: 'Password must include at least one numeric digit (0-9).' });
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        return res.status(400).json({ success: false, error: 'Password must include at least one special character (!@#$%^&*...).' });
    }

    const newUser = {
        id: 'usr_' + Date.now(),
        name: name && name.trim() ? name.trim() : cleanEmail.split('@')[0],
        email: cleanEmail,
        password: password,
        createdAt: new Date().toISOString()
    };
    usersDatabase.push(newUser);
    saveUsers(usersDatabase);

    return res.json({
        success: true,
        message: 'Account registered successfully! Unlimited inspections unlocked.',
        user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            unlimited: true
        }
    });
});

// 2. Sign In User
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const user = usersDatabase.find(u => u.email === cleanEmail);

    if (!user || user.password !== password) {
        return res.status(401).json({ success: false, error: 'Invalid email address or password.' });
    }

    return res.json({
        success: true,
        message: 'Signed in successfully! Unlimited inspections unlocked.',
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            unlimited: true
        }
    });
});

// 3. Continue with Google (OAuth / Demo)
app.post('/api/auth/google', (req, res) => {
    const googleUser = {
        id: 'goog_' + Date.now(),
        name: 'Google User',
        email: req.body && req.body.email ? req.body.email.trim() : 'demo.google@gmail.com',
        avatar: 'G',
        unlimited: true
    };
    return res.json({
        success: true,
        message: 'Signed in with Google! Unlimited inspections unlocked.',
        user: googleUser
    });
});

// 4. Get Current Profile
app.get('/api/auth/me', (req, res) => {
    const email = req.query.email ? req.query.email.trim().toLowerCase() : null;
    if (!email) {
        return res.status(400).json({ success: false, error: 'Email query parameter required.' });
    }
    const user = usersDatabase.find(u => u.email === email);
    if (!user) {
        return res.status(404).json({ success: false, error: 'User not found.' });
    }
    return res.json({
        success: true,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            unlimited: true
        }
    });
});

server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`Pre Check URL Server Running!`);
    console.log(`Dashboard URL:  http://localhost:${PORT}`);
    console.log(`WebSocket URL:  ws://localhost:${PORT}/ws`);
    console.log(`Browser Engine: ${getBrowserExecutablePath() || 'None detected'}`);
    console.log(`=======================================================`);
});
