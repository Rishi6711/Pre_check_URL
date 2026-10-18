/**
 * app.js
 * Main frontend controller for Pre check URL
 * Handles WebSocket communication, live human verification interaction,
 * and rendering of all 4 primary outcome sections.
 */

(function () {
    // Application State
    let ws = null;
    let currentSessionId = null;
    let isScanning = false;
    let scanStartTime = 0;
    let timerInterval = null;
    let screencastController = null;
    let lastScanResults = null;

    // Authentication & Quota State
    const MAX_FREE_SCANS = 5;
    let authMode = 'login'; // 'login' or 'register'
    let currentUser = null;

    // DOM Elements Mapping
    const elements = {
        scanForm: document.getElementById('scan-form'),
        urlInput: document.getElementById('target-url-input'),
        btnClearInput: document.getElementById('btn-clear-input'),
        btnInspect: document.getElementById('btn-inspect'),
        btnCancelScan: document.getElementById('btn-cancel-scan'),
        btnToggleOptions: document.getElementById('btn-toggle-options'),
        advancedOptionsPanel: document.getElementById('advanced-options-panel'),
        optViewport: document.getElementById('opt-viewport'),
        optTimeout: document.getElementById('opt-timeout'),
        
        // Progress & Errors
        progressSection: document.getElementById('scan-progress-section'),
        progressBarFill: document.getElementById('progress-bar-fill'),
        progressStatusTitle: document.getElementById('progress-status-title'),
        progressStatusDetail: document.getElementById('progress-status-detail'),
        progressTimer: document.getElementById('progress-timer'),
        errorBanner: document.getElementById('error-banner'),
        errorTitle: document.getElementById('error-title'),
        errorMessage: document.getElementById('error-message'),

        // Outcomes Dashboard & Ribbon
        outcomesDashboard: document.getElementById('outcomes-dashboard'),
        ribbonInitialUrl: document.getElementById('ribbon-initial-url'),
        ribbonFinalUrl: document.getElementById('ribbon-final-url'),
        badgeTotalHops: document.getElementById('badge-total-hops'),
        badgeRedirectStatus: document.getElementById('badge-redirect-status'),
        badgeDownloadsFound: document.getElementById('badge-downloads-found'),

        // Outcome 1: Screen Shot Section
        screenshotGallery: document.getElementById('screenshot-gallery'),
        screenshotCountBadge: document.getElementById('screenshot-count-badge'),

        // Outcome 2: Redirected URLs Section
        redirectTimeline: document.getElementById('redirect-timeline'),
        btnCopyChain: document.getElementById('btn-copy-chain'),

        // Outcome 3: File Download Detection Section
        downloadsContainer: document.getElementById('downloads-container'),
        downloadsCountBadge: document.getElementById('downloads-count-badge'),

        // Outcome 4: Display the Summary
        summaryContainer: document.getElementById('summary-container'),
        summaryVerdictPill: document.getElementById('summary-verdict-pill'),

        // Extra Telemetry: Destination IPs
        destinationIpsTbody: document.getElementById('destination-ips-tbody'),
        ipsCountBadge: document.getElementById('ips-count-badge'),

        // Human Verification Pop-up Modal
        modalVerification: document.getElementById('modal-verification'),
        modalTitleText: document.getElementById('modal-title-text'),
        modalChallengeReason: document.getElementById('modal-challenge-reason'),
        challengeCurrentUrl: document.getElementById('challenge-current-url'),
        challengeStatusIndicator: document.getElementById('challenge-status-indicator'),
        btnManualResolve: document.getElementById('btn-manual-resolve'),
        btnDenyPermission: document.getElementById('btn-deny-permission'),

        // Lightbox Modal
        modalLightbox: document.getElementById('modal-screenshot-lightbox'),
        lightboxTitle: document.getElementById('lightbox-title'),
        lightboxUrl: document.getElementById('lightbox-url'),
        lightboxImg: document.getElementById('lightbox-img'),
        lightboxDownloadLink: document.getElementById('lightbox-download-link'),
        btnCloseLightbox: document.getElementById('btn-close-lightbox'),

        // History Drawer
        btnOpenHistory: document.getElementById('btn-open-history'),
        btnCloseHistory: document.getElementById('btn-close-history'),
        historyDrawer: document.getElementById('history-drawer'),
        historyList: document.getElementById('history-list'),
        historyCount: document.getElementById('history-count'),
        btnClearHistory: document.getElementById('btn-clear-history'),

        // Export PDF (Required: Only in PDF format)
        btnExportPdf: document.getElementById('btn-export-pdf'),
        btnRibbonDownloadPdf: document.getElementById('btn-ribbon-download-pdf'),

        // Authentication & Scan Quota
        modalLogin: document.getElementById('modal-login'),
        btnLoginOpen: document.getElementById('btn-open-login'),
        btnLoginClose: document.getElementById('btn-close-login'),
        loginTitleText: document.getElementById('login-title-text'),
        loginSubtitleText: document.getElementById('login-subtitle-text'),
        loginLimitAlert: document.getElementById('login-limit-alert'),
        btnGoogleAuth: document.getElementById('btn-google-auth'),
        authForm: document.getElementById('auth-form'),
        formGroupName: document.getElementById('form-group-name'),
        authInputName: document.getElementById('auth-input-name'),
        authInputEmail: document.getElementById('auth-input-email'),
        authInputPassword: document.getElementById('auth-input-password'),
        btnTogglePwd: document.getElementById('btn-toggle-pwd'),
        pwdEyeIcon: document.getElementById('pwd-eye-icon'),
        strengthMeterBar: document.getElementById('strength-meter-bar'),
        strengthStatusText: document.getElementById('strength-status-text'),
        ruleLength: document.getElementById('rule-length'),
        ruleUpper: document.getElementById('rule-upper'),
        ruleLower: document.getElementById('rule-lower'),
        ruleNumber: document.getElementById('rule-number'),
        ruleSpecial: document.getElementById('rule-special'),
        authErrorBox: document.getElementById('auth-error-box'),
        btnAuthSubmit: document.getElementById('btn-auth-submit'),
        btnAuthSubmitLabel: document.getElementById('btn-auth-submit-label'),
        authSwitchPrompt: document.getElementById('auth-switch-prompt'),
        btnSwitchAuthMode: document.getElementById('btn-switch-auth-mode'),
        btnDemoFill: document.getElementById('btn-demo-fill'),
        attemptsIndicatorPill: document.getElementById('attempts-indicator-pill'),
        attemptsCountText: document.getElementById('attempts-count-text'),
        userProfileBadge: document.getElementById('user-profile-badge'),
        navUserAvatar: document.getElementById('nav-user-avatar'),
        navUserEmail: document.getElementById('nav-user-email'),
        btnNavLogout: document.getElementById('btn-nav-logout'),
        serverStatusPill: document.getElementById('server-status-pill'),
        btnOpenBackendModal: document.getElementById('btn-open-backend-modal'),
        modalBackendSettings: document.getElementById('modal-backend-settings'),
        btnCloseBackend: document.getElementById('btn-close-backend'),
        inputBackendUrl: document.getElementById('input-backend-url'),
        btnTestBackend: document.getElementById('btn-test-backend'),
        btnSaveBackend: document.getElementById('btn-save-backend'),
        backendStatusTag: document.getElementById('backend-status-tag'),
        backendTestResult: document.getElementById('backend-test-result'),
        btnPresetLocal: document.getElementById('btn-preset-local'),
        btnPresetReset: document.getElementById('btn-preset-reset')
    };

    // Initialize Application
    function init() {
        initWebSocket();
        initScreencast();
        initAuthAndQuota();
        bindUIEvents();
        loadHistoryCount();
    }

    let reconnectTimeout = null;
    let manualBackendUrl = localStorage.getItem('precheck_backend_url') || '';

    // Check query param ?backend=https://... to automatically configure backend
    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('backend')) {
            const paramVal = urlParams.get('backend').trim();
            if (paramVal) {
                manualBackendUrl = paramVal.replace(/\/+$/, '');
                localStorage.setItem('precheck_backend_url', manualBackendUrl);
            }
        }
    } catch (_) {}

    function isLocalhost() {
        return window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1' || 
               window.location.protocol === 'file:';
    }

    function isVercelDomain() {
        return window.location.hostname.endsWith('.vercel.app');
    }

    function getBackendOrigin() {
        if (manualBackendUrl) {
            return manualBackendUrl.replace(/\/+$/, '');
        }
        if (isLocalhost()) {
            return 'http://localhost:4000';
        }
        // If hosted on unified cloud platform (Render/Railway/Fly)
        if (!isVercelDomain()) {
            return window.location.origin;
        }
        return '';
    }

    function getApiBase() {
        const origin = getBackendOrigin();
        if (origin) return origin;
        if (isLocalhost()) return 'http://localhost:4000';
        return '';
    }

    function getWebSocketUrl() {
        const origin = getBackendOrigin();
        if (origin) {
            const wsProto = origin.startsWith('https:') ? 'wss:' : 'ws:';
            const wsHost = origin.replace(/^https?:\/\//, '');
            return `${wsProto}//${wsHost}/ws`;
        }

        if (isLocalhost()) {
            return 'ws://localhost:4000/ws';
        }

        if (isVercelDomain()) {
            // Vercel serverless functions cannot handle WebSockets
            return null;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}/ws`;
    }

    // Initialize WebSocket Connection
    function initWebSocket() {
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }

        const wsUrl = getWebSocketUrl();
        const statusPill = document.getElementById('server-status-pill');

        if (!wsUrl) {
            // Running on Vercel without a configured backend engine
            if (statusPill) {
                statusPill.innerHTML = '<span class="status-dot warning"></span><span class="status-text">Setup Backend</span>';
                statusPill.title = 'Running on Vercel: Click to connect your free Render/Railway backend engine';
            }
            updateBackendStatusTag('offline', 'Setup Required');
            return;
        }

        try {
            if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
                return;
            }

            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                if (statusPill) {
                    statusPill.innerHTML = '<span class="status-dot online"></span><span class="status-text">Engine Ready</span>';
                    statusPill.title = `Connected to backend engine at ${wsUrl} • Click to configure`;
                }
                updateBackendStatusTag('online', 'Connected');
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    handleServerMessage(data);
                } catch (err) {
                    console.error('Failed to parse WebSocket message:', err);
                }
            };

            ws.onerror = (err) => {
                console.warn('WebSocket connection error:', err);
            };

            ws.onclose = () => {
                if (statusPill) {
                    statusPill.innerHTML = '<span class="status-dot" style="background:#f43f5e; box-shadow:0 0 8px #f43f5e;"></span><span class="status-text">Disconnected (Click to Config)</span>';
                    statusPill.title = `Unable to connect to ${wsUrl} • Click to change backend settings`;
                }
                updateBackendStatusTag('offline', 'Disconnected');
                reconnectTimeout = setTimeout(initWebSocket, 2500);
            };
        } catch (err) {
            console.error('Failed to initialize WebSocket:', err);
            if (statusPill) {
                statusPill.innerHTML = '<span class="status-dot" style="background:#f43f5e; box-shadow:0 0 8px #f43f5e;"></span><span class="status-text">Disconnected (Click to Config)</span>';
            }
            updateBackendStatusTag('offline', 'Error');
            reconnectTimeout = setTimeout(initWebSocket, 3000);
        }
    }

    // Backend Settings Modal Handlers
    function openBackendModal() {
        if (!elements.modalBackendSettings) return;
        elements.modalBackendSettings.style.display = 'flex';
        if (elements.inputBackendUrl) {
            elements.inputBackendUrl.value = manualBackendUrl || (isLocalhost() ? 'http://localhost:4000' : '');
        }
        if (elements.backendTestResult) {
            elements.backendTestResult.style.display = 'none';
        }
        checkBackendStatusSilent();
    }

    function closeBackendModal() {
        if (!elements.modalBackendSettings) return;
        elements.modalBackendSettings.style.display = 'none';
    }

    function updateBackendStatusTag(statusClass, label) {
        if (!elements.backendStatusTag) return;
        elements.backendStatusTag.className = `backend-status-tag ${statusClass}`;
        elements.backendStatusTag.textContent = label;
    }

    async function checkBackendStatusSilent() {
        const base = getApiBase();
        if (!base) {
            updateBackendStatusTag('offline', 'Not Configured');
            return;
        }
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            const res = await fetch(`${base}/api/health`, { method: 'GET', signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
                updateBackendStatusTag('online', 'Online');
            } else {
                updateBackendStatusTag('offline', 'Offline');
            }
        } catch (_) {
            updateBackendStatusTag('offline', 'Unreachable');
        }
    }

    async function testBackendConnection() {
        let testUrl = elements.inputBackendUrl ? elements.inputBackendUrl.value.trim() : '';
        if (!testUrl) {
            testUrl = isLocalhost() ? 'http://localhost:4000' : '';
        }
        testUrl = testUrl.replace(/\/+$/, '');

        if (!testUrl) {
            showBackendTestResult('error', 'Please enter a Backend URL (e.g. https://your-backend.onrender.com or http://localhost:4000)');
            return;
        }

        if (elements.btnTestBackend) {
            elements.btnTestBackend.disabled = true;
            elements.btnTestBackend.textContent = 'Testing...';
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 7000);
            const res = await fetch(`${testUrl}/api/health`, {
                signal: controller.signal,
                method: 'GET'
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json().catch(() => ({}));
                const engine = data.browserEngine || 'Chrome';
                showBackendTestResult('success', `✅ Connection verified! Backend is online. Browser engine: ${engine}`);
                updateBackendStatusTag('online', 'Verified');
            } else {
                showBackendTestResult('error', `⚠️ Server reachable, but returned HTTP ${res.status}. Expected 200 OK from /api/health.`);
                updateBackendStatusTag('offline', 'Error');
            }
        } catch (err) {
            showBackendTestResult('error', `❌ Cannot reach ${testUrl}/api/health. Ensure your backend service is deployed and running.`);
            updateBackendStatusTag('offline', 'Failed');
        } finally {
            if (elements.btnTestBackend) {
                elements.btnTestBackend.disabled = false;
                elements.btnTestBackend.textContent = 'Test';
            }
        }
    }

    function showBackendTestResult(type, msg) {
        if (!elements.backendTestResult) return;
        elements.backendTestResult.className = `backend-test-result ${type}`;
        elements.backendTestResult.textContent = msg;
        elements.backendTestResult.style.display = 'block';
    }

    function saveBackendUrl() {
        let newUrl = elements.inputBackendUrl ? elements.inputBackendUrl.value.trim() : '';
        newUrl = newUrl.replace(/\/+$/, '');

        manualBackendUrl = newUrl;
        if (newUrl) {
            localStorage.setItem('precheck_backend_url', newUrl);
            showToast(`Backend updated: ${newUrl}`, 'success');
        } else {
            localStorage.removeItem('precheck_backend_url');
            showToast('Backend set to auto-detect.', 'info');
        }

        if (ws) {
            try { ws.close(); } catch (_) {}
            ws = null;
        }

        closeBackendModal();
        initWebSocket();
    }

    // Initialize Screencast Controller for Live Canvas Interaction
    function initScreencast() {
        screencastController = new ScreencastController('screencast-canvas', 'canvas-loader', (interaction) => {
            if (ws && ws.readyState === WebSocket.OPEN && currentSessionId) {
                ws.send(JSON.stringify({
                    type: 'INTERACTION_EVENT',
                    sessionId: currentSessionId,
                    ...interaction
                }));
            }
        });
    }

    // UI Event Listeners
    function bindUIEvents() {
        // Form Submit
        elements.scanForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const url = elements.urlInput.value.trim();
            if (url) startScan(url);
        });

        // Clear input button
        elements.urlInput.addEventListener('input', () => {
            elements.btnClearInput.style.display = elements.urlInput.value ? 'block' : 'none';
        });

        elements.btnClearInput.addEventListener('click', () => {
            elements.urlInput.value = '';
            elements.btnClearInput.style.display = 'none';
            elements.urlInput.focus();
        });

        // Quick Sample Chips
        document.querySelectorAll('.sample-chips .chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const sampleUrl = chip.getAttribute('data-url');
                const fullUrl = sampleUrl.startsWith('/') ? `${window.location.origin}${sampleUrl}` : sampleUrl;
                elements.urlInput.value = fullUrl;
                elements.btnClearInput.style.display = 'block';
                startScan(fullUrl);
            });
        });

        // Cancel Button
        elements.btnCancelScan.addEventListener('click', cancelScan);

        // Toggle Advanced Options
        elements.btnToggleOptions.addEventListener('click', () => {
            const isHidden = elements.advancedOptionsPanel.style.display === 'none';
            elements.advancedOptionsPanel.style.display = isHidden ? 'block' : 'none';
        });

        // Copy redirect chain
        elements.btnCopyChain.addEventListener('click', () => {
            if (!lastScanResults) return;
            const chainText = lastScanResults.outcomes.redirectChain
                .map(h => `[Hop ${h.hopNumber}] (${h.status} ${h.statusText}) -> ${h.url}`)
                .join('\n');
            navigator.clipboard.writeText(chainText).then(() => {
                const orig = elements.btnCopyChain.innerHTML;
                elements.btnCopyChain.innerHTML = '<span>✓ Copied Chain!</span>';
                setTimeout(() => elements.btnCopyChain.innerHTML = orig, 1800);
            });
        });

        // Human Verification Manual Completion Button
        elements.btnManualResolve.addEventListener('click', () => {
            if (ws && ws.readyState === WebSocket.OPEN && currentSessionId) {
                ws.send(JSON.stringify({
                    type: 'VERIFICATION_COMPLETED_BY_USER',
                    sessionId: currentSessionId
                }));
                elements.challengeStatusIndicator.innerHTML = '<span style="color:#0284c7; font-weight:bold;">Verifying completion...</span>';
            }
        });

        // Human Verification Skip / Close
        elements.btnDenyPermission.addEventListener('click', () => {
            if (ws && ws.readyState === WebSocket.OPEN && currentSessionId) {
                ws.send(JSON.stringify({
                    type: 'PERMISSION_RESPONSE',
                    sessionId: currentSessionId,
                    granted: false
                }));
            }
            closeVerificationModal();
        });

        // Lightbox Close
        elements.btnCloseLightbox.addEventListener('click', () => {
            elements.modalLightbox.style.display = 'none';
        });
        elements.modalLightbox.addEventListener('click', (e) => {
            if (e.target === elements.modalLightbox) {
                elements.modalLightbox.style.display = 'none';
            }
        });

        // History Drawer
        elements.btnOpenHistory.addEventListener('click', openHistoryDrawer);
        elements.btnCloseHistory.addEventListener('click', () => elements.historyDrawer.style.display = 'none');
        elements.historyDrawer.addEventListener('click', (e) => {
            if (e.target === elements.historyDrawer) elements.historyDrawer.style.display = 'none';
        });
        elements.btnClearHistory.addEventListener('click', clearHistory);

        // Export PDF Report (Strictly .pdf format)
        if (elements.btnExportPdf) {
            elements.btnExportPdf.addEventListener('click', downloadPdfReport);
        }
        if (elements.btnRibbonDownloadPdf) {
            elements.btnRibbonDownloadPdf.addEventListener('click', downloadPdfReport);
        }

        // ==========================================
        // AUTHENTICATION & QUOTA MODAL CONTROLLERS
        // ==========================================
        if (elements.btnLoginOpen) {
            elements.btnLoginOpen.addEventListener('click', () => openLoginModal(false));
        }

        if (elements.attemptsIndicatorPill) {
            elements.attemptsIndicatorPill.addEventListener('click', () => {
                if (!currentUser) {
                    const isExhausted = getScanCount() >= MAX_FREE_SCANS;
                    openLoginModal(isExhausted);
                } else {
                    showToast(`Signed in as ${currentUser.email} • Unlimited scans enabled!`, 'info');
                }
            });
        }

        if (elements.btnLoginClose) {
            elements.btnLoginClose.addEventListener('click', closeLoginModal);
        }

        if (elements.modalLogin) {
            elements.modalLogin.addEventListener('click', (e) => {
                if (e.target === elements.modalLogin) {
                    closeLoginModal();
                }
            });
        }

        if (elements.btnSwitchAuthMode) {
            elements.btnSwitchAuthMode.addEventListener('click', () => {
                setAuthMode(authMode === 'login' ? 'register' : 'login');
            });
        }

        if (elements.btnTogglePwd) {
            elements.btnTogglePwd.addEventListener('click', togglePasswordVisibility);
        }

        if (elements.authInputPassword) {
            elements.authInputPassword.addEventListener('input', (e) => {
                validatePasswordPolicy(e.target.value);
            });
        }

        if (elements.btnDemoFill) {
            elements.btnDemoFill.addEventListener('click', handleDemoFill);
        }

        if (elements.authForm) {
            elements.authForm.addEventListener('submit', handleAuthSubmit);
        }

        if (elements.btnGoogleAuth) {
            elements.btnGoogleAuth.addEventListener('click', handleGoogleAuth);
        }

        if (elements.btnNavLogout) {
            elements.btnNavLogout.addEventListener('click', handleLogout);
        }

        // ==========================================
        // BACKEND ENGINE SETTINGS MODAL CONTROLLERS
        // ==========================================
        if (elements.serverStatusPill) {
            elements.serverStatusPill.addEventListener('click', openBackendModal);
        }
        if (elements.btnOpenBackendModal) {
            elements.btnOpenBackendModal.addEventListener('click', openBackendModal);
        }
        if (elements.btnCloseBackend) {
            elements.btnCloseBackend.addEventListener('click', closeBackendModal);
        }
        if (elements.modalBackendSettings) {
            elements.modalBackendSettings.addEventListener('click', (e) => {
                if (e.target === elements.modalBackendSettings) closeBackendModal();
            });
        }
        if (elements.btnTestBackend) {
            elements.btnTestBackend.addEventListener('click', testBackendConnection);
        }
        if (elements.btnSaveBackend) {
            elements.btnSaveBackend.addEventListener('click', saveBackendUrl);
        }
        if (elements.btnPresetLocal) {
            elements.btnPresetLocal.addEventListener('click', () => {
                if (elements.inputBackendUrl) elements.inputBackendUrl.value = 'http://localhost:4000';
            });
        }
        if (elements.btnPresetReset) {
            elements.btnPresetReset.addEventListener('click', () => {
                if (elements.inputBackendUrl) elements.inputBackendUrl.value = '';
            });
        }
    }

    // ==========================================
    // USER AUTHENTICATION & QUOTA LOGIC
    // ==========================================
    function initAuthAndQuota() {
        try {
            const rawUser = localStorage.getItem('precheck_auth_user');
            if (rawUser) {
                currentUser = JSON.parse(rawUser);
            }
        } catch (e) {
            currentUser = null;
        }
        updateAuthAndQuotaUI();
    }

    function getScanCount() {
        try {
            const count = parseInt(localStorage.getItem('precheck_scan_count') || '0', 10);
            return isNaN(count) ? 0 : count;
        } catch (e) {
            return 0;
        }
    }

    function setScanCount(count) {
        try {
            localStorage.setItem('precheck_scan_count', String(count));
        } catch (e) {}
    }

    function updateAuthAndQuotaUI() {
        if (currentUser) {
            // Signed In User: Unlimited Inspections
            if (elements.attemptsCountText) {
                elements.attemptsCountText.textContent = '⚡ Unlimited (Signed In)';
            }
            if (elements.attemptsIndicatorPill) {
                elements.attemptsIndicatorPill.classList.remove('low', 'exhausted');
                elements.attemptsIndicatorPill.title = `Signed in as ${currentUser.email} • Unlimited inspections`;
            }
            if (elements.btnLoginOpen) {
                elements.btnLoginOpen.style.display = 'none';
            }
            if (elements.userProfileBadge) {
                elements.userProfileBadge.style.display = 'inline-flex';
            }
            if (elements.navUserEmail) {
                elements.navUserEmail.textContent = currentUser.email || 'User';
                elements.navUserEmail.title = currentUser.email || 'User';
            }
            if (elements.navUserAvatar) {
                const initial = (currentUser.name || currentUser.email || 'U').charAt(0).toUpperCase();
                elements.navUserAvatar.textContent = initial;
            }
        } else {
            // Guest User: 5 Free Scans
            const used = getScanCount();
            const remaining = Math.max(0, MAX_FREE_SCANS - used);
            if (elements.attemptsCountText) {
                elements.attemptsCountText.textContent = `${remaining} / ${MAX_FREE_SCANS} Free Scans`;
            }
            if (elements.attemptsIndicatorPill) {
                elements.attemptsIndicatorPill.classList.remove('low', 'exhausted');
                if (remaining === 0) {
                    elements.attemptsIndicatorPill.classList.add('exhausted');
                    elements.attemptsIndicatorPill.title = 'Free scans limit reached (0 / 5 left) - Click to sign in or create an account';
                } else if (remaining <= 2) {
                    elements.attemptsIndicatorPill.classList.add('low');
                    elements.attemptsIndicatorPill.title = `${remaining} free scans remaining before login is required`;
                } else {
                    elements.attemptsIndicatorPill.title = `${remaining} free scans remaining before login is required`;
                }
            }
            if (elements.btnLoginOpen) {
                elements.btnLoginOpen.style.display = 'inline-flex';
            }
            if (elements.userProfileBadge) {
                elements.userProfileBadge.style.display = 'none';
            }
        }
    }

    function openLoginModal(isQuotaTriggered = false) {
        if (elements.modalLogin) {
            elements.modalLogin.style.display = 'flex';
            if (elements.loginLimitAlert) {
                elements.loginLimitAlert.style.display = isQuotaTriggered ? 'flex' : 'none';
            }
            hideAuthError();
            setTimeout(() => {
                if (elements.authInputEmail) elements.authInputEmail.focus();
            }, 100);
        }
    }

    function closeLoginModal() {
        if (elements.modalLogin) {
            elements.modalLogin.style.display = 'none';
            hideAuthError();
        }
    }

    function setAuthMode(mode) {
        authMode = mode;
        hideAuthError();
        if (authMode === 'register') {
            if (elements.loginTitleText) elements.loginTitleText.textContent = 'Create Account on Pre check URL';
            if (elements.loginSubtitleText) elements.loginSubtitleText.textContent = 'Sign up with password (minimum 12 characters & standard policies)';
            if (elements.formGroupName) elements.formGroupName.style.display = 'block';
            if (elements.btnAuthSubmitLabel) elements.btnAuthSubmitLabel.textContent = 'Create Account & Unlock Unlimited Scans';
            if (elements.authSwitchPrompt) elements.authSwitchPrompt.textContent = 'Already have an account?';
            if (elements.btnSwitchAuthMode) elements.btnSwitchAuthMode.textContent = 'Sign in to account';
        } else {
            authMode = 'login';
            if (elements.loginTitleText) elements.loginTitleText.textContent = 'Sign In to Pre check URL';
            if (elements.loginSubtitleText) elements.loginSubtitleText.textContent = 'Unlock unlimited URL inspections, sandbox forensics, and PDF reports';
            if (elements.formGroupName) elements.formGroupName.style.display = 'none';
            if (elements.btnAuthSubmitLabel) elements.btnAuthSubmitLabel.textContent = 'Sign In & Unlock Unlimited Scans';
            if (elements.authSwitchPrompt) elements.authSwitchPrompt.textContent = "Don't have an account yet?";
            if (elements.btnSwitchAuthMode) elements.btnSwitchAuthMode.textContent = 'Create an account';
        }
    }

    function togglePasswordVisibility() {
        if (!elements.authInputPassword) return;
        const currentType = elements.authInputPassword.getAttribute('type');
        const nextType = currentType === 'password' ? 'text' : 'password';
        elements.authInputPassword.setAttribute('type', nextType);
        if (elements.btnTogglePwd) {
            elements.btnTogglePwd.title = nextType === 'text' ? 'Hide password' : 'Show password';
        }
    }

    function validatePasswordPolicy(password) {
        const rules = {
            length: password.length >= 12,
            upper: /[A-Z]/.test(password),
            lower: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)
        };

        const updateRule = (el, valid) => {
            if (!el) return;
            const icon = el.querySelector('.rule-icon');
            if (valid) {
                el.classList.add('valid');
                if (icon) icon.textContent = '✓';
            } else {
                el.classList.remove('valid');
                if (icon) icon.textContent = '✕';
            }
        };

        updateRule(elements.ruleLength, rules.length);
        updateRule(elements.ruleUpper, rules.upper);
        updateRule(elements.ruleLower, rules.lower);
        updateRule(elements.ruleNumber, rules.number);
        updateRule(elements.ruleSpecial, rules.special);

        let score = 0;
        if (rules.length) score++;
        if (rules.upper) score++;
        if (rules.lower) score++;
        if (rules.number) score++;
        if (rules.special) score++;

        if (elements.strengthMeterBar && elements.strengthStatusText) {
            if (!password) {
                elements.strengthMeterBar.style.width = '0%';
                elements.strengthMeterBar.style.backgroundColor = 'transparent';
                elements.strengthStatusText.textContent = 'Password Strength: Empty';
            } else {
                const percent = Math.round((score / 5) * 100);
                elements.strengthMeterBar.style.width = `${percent}%`;
                if (score <= 1) {
                    elements.strengthMeterBar.style.backgroundColor = '#ef4444';
                    elements.strengthStatusText.textContent = 'Weak (1/5 requirements met)';
                } else if (score === 2) {
                    elements.strengthMeterBar.style.backgroundColor = '#f97316';
                    elements.strengthStatusText.textContent = 'Fair (2/5 requirements met)';
                } else if (score === 3) {
                    elements.strengthMeterBar.style.backgroundColor = '#eab308';
                    elements.strengthStatusText.textContent = 'Moderate (3/5 requirements met)';
                } else if (score === 4) {
                    elements.strengthMeterBar.style.backgroundColor = '#3b82f6';
                    elements.strengthStatusText.textContent = 'Strong (4/5 requirements met)';
                } else {
                    elements.strengthMeterBar.style.backgroundColor = '#10b981';
                    elements.strengthStatusText.textContent = 'Excellent (All 5 requirements met)';
                }
            }
        }

        return score === 5;
    }

    function showAuthError(msg) {
        if (elements.authErrorBox) {
            elements.authErrorBox.textContent = msg;
            elements.authErrorBox.style.display = 'block';
        }
    }

    function hideAuthError() {
        if (elements.authErrorBox) {
            elements.authErrorBox.style.display = 'none';
            elements.authErrorBox.textContent = '';
        }
    }

    function handleDemoFill() {
        if (elements.authInputEmail) elements.authInputEmail.value = 'demo.user@precheck.io';
        if (elements.authInputPassword) {
            elements.authInputPassword.value = 'SecurePass@2026!';
            validatePasswordPolicy('SecurePass@2026!');
        }
        hideAuthError();
    }

    async function handleAuthSubmit(e) {
        e.preventDefault();
        hideAuthError();

        const email = elements.authInputEmail ? elements.authInputEmail.value.trim() : '';
        const password = elements.authInputPassword ? elements.authInputPassword.value : '';
        const name = elements.authInputName ? elements.authInputName.value.trim() : '';

        if (!email) {
            showAuthError('Please enter a valid email address.');
            if (elements.authInputEmail) elements.authInputEmail.focus();
            return;
        }

        if (!password) {
            showAuthError('Please enter your password.');
            if (elements.authInputPassword) elements.authInputPassword.focus();
            return;
        }

        if (authMode === 'register') {
            const allPassed = validatePasswordPolicy(password);
            if (!allPassed) {
                showAuthError('Password must satisfy all standard requirements: minimum 12 characters, uppercase, lowercase, number, special character.');
                return;
            }
        }

        const endpoint = authMode === 'register' ? `${getApiBase()}/api/auth/register` : `${getApiBase()}/api/auth/login`;
        const payload = authMode === 'register' ? { name, email, password } : { email, password };

        if (elements.btnAuthSubmit) elements.btnAuthSubmit.disabled = true;

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                showAuthError(data.error || 'Authentication failed. Please check your credentials.');
                return;
            }

            // Successfully authenticated!
            currentUser = data.user;
            localStorage.setItem('precheck_auth_user', JSON.stringify(currentUser));
            updateAuthAndQuotaUI();
            closeLoginModal();

            if (elements.authInputPassword) elements.authInputPassword.value = '';
            validatePasswordPolicy('');

            showToast(data.message || 'Signed in successfully! Unlimited scans unlocked.', 'success');
        } catch (err) {
            showAuthError('Network error connecting to authentication server.');
        } finally {
            if (elements.btnAuthSubmit) elements.btnAuthSubmit.disabled = false;
        }
    }

    async function handleGoogleAuth() {
        hideAuthError();
        if (elements.btnGoogleAuth) elements.btnGoogleAuth.disabled = true;

        try {
            const res = await fetch(`${getApiBase()}/api/auth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'demo.google@gmail.com' })
            });
            const data = await res.json();
            if (data.success && data.user) {
                currentUser = data.user;
                localStorage.setItem('precheck_auth_user', JSON.stringify(currentUser));
                updateAuthAndQuotaUI();
                closeLoginModal();
                showToast('Signed in with Google! Unlimited scans unlocked.', 'success');
            } else {
                showAuthError('Google sign in failed. Please try again.');
            }
        } catch (err) {
            showAuthError('Failed to connect to Google authentication.');
        } finally {
            if (elements.btnGoogleAuth) elements.btnGoogleAuth.disabled = false;
        }
    }

    function handleLogout() {
        currentUser = null;
        try {
            localStorage.removeItem('precheck_auth_user');
        } catch (e) {}
        updateAuthAndQuotaUI();
        showToast('Signed out. Free guest scans quota restored.', 'info');
    }

    function showToast(message, type = 'info') {
        let toast = document.getElementById('app-dynamic-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'app-dynamic-toast';
            toast.style.position = 'fixed';
            toast.style.bottom = '24px';
            toast.style.right = '24px';
            toast.style.zIndex = '9999';
            toast.style.padding = '12px 18px';
            toast.style.borderRadius = '10px';
            toast.style.fontSize = '0.85rem';
            toast.style.fontWeight = '600';
            toast.style.color = '#ffffff';
            toast.style.background = '#0f172a';
            toast.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.3)';
            toast.style.display = 'flex';
            toast.style.alignItems = 'center';
            toast.style.gap = '8px';
            toast.style.transition = 'all 0.3s ease';
            toast.style.transform = 'translateY(20px)';
            toast.style.opacity = '0';
            document.body.appendChild(toast);
        }

        if (type === 'success') {
            toast.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
            toast.innerHTML = `<span>✓</span> <span>${escapeHtml(message)}</span>`;
        } else if (type === 'warn') {
            toast.style.background = 'linear-gradient(135deg, #d97706 0%, #b45309 100%)';
            toast.innerHTML = `<span>⚠️</span> <span>${escapeHtml(message)}</span>`;
        } else {
            toast.style.background = 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)';
            toast.innerHTML = `<span>ℹ️</span> <span>${escapeHtml(message)}</span>`;
        }

        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';

        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => {
            toast.style.transform = 'translateY(20px)';
            toast.style.opacity = '0';
        }, 3000);
    }

    // Start URL Inspection
    function startScan(targetUrl) {
        if (isScanning) return;

        // Quota Enforcement: Check guest scan limit (5 free scans)
        if (!currentUser) {
            const usedCount = getScanCount();
            if (usedCount >= MAX_FREE_SCANS) {
                // Free scans exhausted!
                openLoginModal(true);
                showError(
                    'Free Scans Exhausted (5 / 5 Used)',
                    'You have reached the 5 free scans limit for guest users. Please sign in or create an account to unlock unlimited scans.'
                );
                return;
            }

            // Consume one scan attempt
            const newCount = usedCount + 1;
            setScanCount(newCount);
            updateAuthAndQuotaUI();
        }

        // Reset UI
        hideError();
        elements.outcomesDashboard.style.display = 'none';
        elements.progressSection.style.display = 'block';
        elements.progressBarFill.style.width = '20%';
        elements.progressStatusTitle.innerText = `Connecting to ${targetUrl}...`;
        elements.progressStatusDetail.innerText = 'Initializing isolated Chromium browser sandbox...';
        
        // Button spinner
        elements.btnInspect.disabled = true;
        elements.btnInspect.querySelector('.btn-content').style.display = 'none';
        elements.btnInspect.querySelector('.spinner').style.display = 'inline-block';

        // Start Timer
        isScanning = true;
        scanStartTime = Date.now();
        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);

        currentSessionId = 'scan_' + Date.now();

        const [vw, vh] = elements.optViewport.value.split('x').map(Number);

        // Send start command to server
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'START_SCAN',
                sessionId: currentSessionId,
                url: targetUrl,
                options: {
                    viewportWidth: vw || 1280,
                    viewportHeight: vh || 800,
                    timeout: parseInt(elements.optTimeout.value, 10) || 25000
                }
            }));
        } else {
            const isVercel = isVercelDomain();
            if (isVercel && !manualBackendUrl) {
                openBackendModal();
                showError('Backend Engine Required', 'Vercel is a serverless platform that requires a persistent backend engine (e.g. Render / Railway). Please connect your backend in the dialog.');
            } else {
                showError('Server Disconnected', 'Cannot connect to backend server. Retrying connection... Click the Backend button or status pill to check settings.');
            }
            endScan();
        }
    }

    // Cancel Active Inspection
    function cancelScan() {
        if (!isScanning) return;
        if (ws && ws.readyState === WebSocket.OPEN && currentSessionId) {
            ws.send(JSON.stringify({
                type: 'CANCEL_SCAN',
                sessionId: currentSessionId
            }));
        }
        endScan();
        showError('Inspection Cancelled', 'The URL inspection was aborted by user.');
    }

    function endScan() {
        isScanning = false;
        clearInterval(timerInterval);
        elements.progressSection.style.display = 'none';
        elements.btnInspect.disabled = false;
        elements.btnInspect.querySelector('.btn-content').style.display = 'inline-flex';
        elements.btnInspect.querySelector('.spinner').style.display = 'none';
        closeVerificationModal();
    }

    function updateTimer() {
        const elapsed = Math.floor((Date.now() - scanStartTime) / 1000);
        const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const secs = String(elapsed % 60).padStart(2, '0');
        elements.progressTimer.innerText = `${mins}:${secs}`;
    }

    // Process WebSocket messages from backend
    function handleServerMessage(data) {
        switch (data.type) {
            case 'PROGRESS_UPDATE':
                elements.progressBarFill.style.width = '45%';
                elements.progressStatusTitle.innerText = data.message;
                elements.progressStatusDetail.innerText = `Following redirects and tracing pages...`;
                break;

            case 'HTTP_REDIRECT_HOP':
                elements.progressBarFill.style.width = '65%';
                elements.progressStatusTitle.innerText = `Redirect detected: ${data.status} ${data.statusText}`;
                elements.progressStatusDetail.innerText = `Hop to ${data.toUrl}...`;
                break;

            case 'DOWNLOAD_DETECTED':
                // Real-time alert when a download is intercepted and blocked
                elements.progressStatusDetail.innerText = `⚠️ File download intercepted & blocked: ${data.download.filename}`;
                break;

            case 'HUMAN_VERIFICATION_REQUIRED':
            case 'HUMAN_VERIFICATION_PERMISSION_REQUIRED':
                handleHumanVerificationRequired(data);
                break;

            case 'HUMAN_VERIFICATION_SESSION_ACTIVE':
                if (screencastController) {
                    screencastController.start();
                }
                break;

            case 'HUMAN_VERIFICATION_SKIPPED':
                closeVerificationModal();
                break;

            case 'SCREENCAST_FRAME':
                if (screencastController) {
                    screencastController.renderFrame(data.frame);
                }
                break;

            case 'HUMAN_VERIFICATION_RESOLVED':
                handleHumanVerificationResolved(data);
                break;

            case 'HUMAN_VERIFICATION_TIMEOUT':
                closeVerificationModal();
                break;

            case 'SCAN_COMPLETE':
                endScan();
                renderScanResults(data.results);
                saveToHistory(data.results);
                break;

            case 'SCAN_ERROR':
                endScan();
                showError('Inspection Failed', data.message);
                break;
        }
    }

    // ==============================================================
    // HUMAN VERIFICATION POP-UP MODAL (REQUIRED BY USER)
    // ==============================================================
    function handleHumanVerificationRequired(data) {
        elements.progressBarFill.style.width = '75%';
        elements.progressStatusTitle.innerText = `⚠️ Human Verification Detected on Page`;
        elements.progressStatusDetail.innerText = `Waiting for verification challenge to be solved...`;

        elements.modalTitleText.innerText = 'Human Verification Required on Page';
        elements.modalChallengeReason.innerText = data.reason || 'Security verification detected on this page. Click below to solve:';
        elements.challengeCurrentUrl.innerText = data.url;
        elements.challengeStatusIndicator.innerText = 'Interactive session active. Click inside the window to solve:';

        if (data.viewport && screencastController) {
            screencastController.setViewport(data.viewport.width, data.viewport.height);
        }

        elements.modalVerification.style.display = 'flex';
        if (screencastController) {
            screencastController.start();
        }
    }

    function handleHumanVerificationResolved(data) {
        elements.challengeStatusIndicator.innerHTML = '<span style="color:#10b981; font-weight:bold;">✓ Verification Solved! Proceeding to destination...</span>';
        setTimeout(() => {
            closeVerificationModal();
        }, 900);
    }

    function closeVerificationModal() {
        if (screencastController) {
            screencastController.stop();
        }
        elements.modalVerification.style.display = 'none';
    }

    // ==============================================================
    // RENDER ALL 4 OUTCOME SECTIONS (IN WHITE OUTCOME SECTION)
    // ==============================================================
    function renderScanResults(results) {
        lastScanResults = results;
        elements.outcomesDashboard.style.display = 'block';
        if (elements.btnExportPdf) {
            elements.btnExportPdf.style.display = 'inline-flex';
        }

        // Overview Ribbon
        elements.ribbonInitialUrl.innerText = results.initialUrl;
        elements.ribbonFinalUrl.innerText = results.finalUrl;
        elements.badgeTotalHops.innerText = `${results.totalHops} ${results.totalHops === 1 ? 'Hop' : 'Hops'}`;
        elements.badgeRedirectStatus.innerText = results.isRedirected ? 'Redirected' : 'Direct (No Redirects)';
        elements.badgeRedirectStatus.className = `badge ${results.isRedirected ? 'warn' : 'success'}`;
        
        const dlCount = results.outcomes.downloads ? results.outcomes.downloads.length : 0;
        elements.badgeDownloadsFound.innerText = `${dlCount} ${dlCount === 1 ? 'Download Blocked' : 'Downloads Blocked'}`;
        elements.badgeDownloadsFound.className = `badge ${dlCount > 0 ? 'danger' : 'success'}`;

        // 1. Screen shot section
        renderScreenshotsSection(results.outcomes.screenshots);

        // 2. Redirected URL's section
        renderUrlsSection(results.outcomes.redirectChain);

        // 3. File download detection section
        renderDownloadsSection(results.outcomes.downloads);

        // 4. Display the summary
        renderSummarySection(results.outcomes.summary, results);

        // Additional: Destination IP's & Network Telemetry
        renderDestinationIpsSection(results.outcomes.destinationIps);

        // Scroll to white outcome section smoothly
        elements.outcomesDashboard.scrollIntoView({ behavior: 'smooth' });
    }

    // --------------------------------------------------------------
    // 1. SCREEN SHOT SECTION RENDERER
    // --------------------------------------------------------------
    function renderScreenshotsSection(screenshots) {
        elements.screenshotGallery.innerHTML = '';
        elements.screenshotCountBadge.innerText = `${screenshots.length} ${screenshots.length === 1 ? 'Screenshot' : 'Screenshots'}`;

        if (!screenshots || screenshots.length === 0) {
            elements.screenshotGallery.innerHTML = `
                <div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--text-muted);">
                    <p>No rendered page screenshots captured.</p>
                </div>
            `;
            return;
        }

        screenshots.forEach((shot, idx) => {
            const card = document.createElement('div');
            card.className = 'screenshot-card';

            const imgSrc = shot.screenshotBase64.startsWith('<svg') || shot.screenshotBase64.startsWith('PD94') || shot.screenshotBase64.startsWith('PHN2')
                ? 'data:image/svg+xml;base64,' + shot.screenshotBase64
                : 'data:image/jpeg;base64,' + shot.screenshotBase64;

            const isLast = idx === screenshots.length - 1;
            const stageBadge = shot.pageStage ? shot.pageStage.split(':')[0] : (isLast && screenshots.length > 1 ? 'Final Destination' : `Hop ${shot.hopNumber}`);

            card.innerHTML = `
                <div class="screenshot-thumbnail-wrapper">
                    <img src="${imgSrc}" alt="${escapeHtml(shot.pageTitle || 'Page Screenshot')}" loading="lazy" />
                    <span class="screenshot-step-tag">${escapeHtml(stageBadge)}</span>
                    <div class="screenshot-overlay-hover">
                        <span class="btn-zoom">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
                            </svg>
                            View Fullscreen
                        </span>
                    </div>
                </div>
                <div class="screenshot-info">
                    <div class="screenshot-title" title="${escapeHtml(shot.pageStage || shot.pageTitle || 'Web Page')}">${escapeHtml(shot.pageStage || shot.pageTitle || 'Web Page')}</div>
                    <div class="screenshot-url mono" title="${escapeHtml(shot.url)}">${escapeHtml(shot.url)}</div>
                    <div class="screenshot-meta-tags">
                        <span class="mini-tag status-${shot.status}">${shot.status} ${escapeHtml(shot.statusText || '')}</span>
                        <span class="mini-tag">${escapeHtml(shot.redirectType || 'Page')}</span>
                    </div>
                </div>
            `;

            // Open Full Resolution Lightbox on click
            card.querySelector('.screenshot-thumbnail-wrapper').addEventListener('click', () => {
                openLightbox(imgSrc, shot.pageStage || shot.pageTitle, shot.url, shot.hopNumber);
            });

            elements.screenshotGallery.appendChild(card);
        });
    }

    // --------------------------------------------------------------
    // 2. REDIRECTED URL'S SECTION RENDERER
    // --------------------------------------------------------------
    function renderUrlsSection(redirectChain) {
        elements.redirectTimeline.innerHTML = '';

        redirectChain.forEach((hop, idx) => {
            const isLast = idx === redirectChain.length - 1;
            const item = document.createElement('div');
            item.className = 'timeline-step';

            const statusClass = hop.status === 200 ? 'pill-200' : 'pill-301';

            let parsedUrl = { protocol: 'http:', pathname: '/', search: '', hostname: '' };
            try {
                parsedUrl = new URL(hop.url);
            } catch (e) {}

            item.innerHTML = `
                <div class="timeline-step-indicator ${isLast ? 'final-indicator' : ''}">
                    ${isLast && redirectChain.length > 1 ? '★' : hop.hopNumber}
                </div>
                <div class="timeline-content-card">
                    <div class="step-header">
                        <div>
                            <span class="step-type-pill">${escapeHtml(hop.redirectType || 'Redirect')}</span>
                            ${hop.pageStage ? `<span style="font-size:0.76rem; color:var(--text-muted); margin-left:8px; font-weight:600;">${escapeHtml(hop.pageStage)}</span>` : ''}
                        </div>
                        <span class="step-status-pill ${statusClass}">${hop.status} ${escapeHtml(hop.statusText || '')}</span>
                    </div>
                    <div class="step-url-row">
                        <span class="step-url-text">${escapeHtml(hop.url)}</span>
                        <button class="btn btn-secondary btn-xs btn-copy-url" data-url="${escapeHtml(hop.url)}" title="Copy URL">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                        </button>
                    </div>
                    <div class="step-details-grid">
                        <div class="detail-col">
                            <span class="col-label">Hostname / Domain</span>
                            <span class="col-value">${escapeHtml(hop.hostname || parsedUrl.hostname)}</span>
                        </div>
                        <div class="detail-col">
                            <span class="col-label">Destination IP</span>
                            <span class="col-value">${escapeHtml(hop.ip || 'Resolved via DNS')}</span>
                        </div>
                        <div class="detail-col">
                            <span class="col-label">Protocol</span>
                            <span class="col-value">${parsedUrl.protocol ? parsedUrl.protocol.replace(':', '').toUpperCase() : 'HTTP'}</span>
                        </div>
                        ${hop.locationHeader ? `
                        <div class="detail-col" style="grid-column: 1 / -1;">
                            <span class="col-label">HTTP Location Header Target</span>
                            <span class="col-value mono" style="color:#0284c7;">${escapeHtml(hop.locationHeader)}</span>
                        </div>` : ''}
                    </div>
                </div>
            `;

            // Copy button listener
            item.querySelector('.btn-copy-url').addEventListener('click', (e) => {
                const u = e.currentTarget.getAttribute('data-url');
                navigator.clipboard.writeText(u);
                e.currentTarget.innerHTML = '✓';
                setTimeout(() => {
                    e.currentTarget.innerHTML = `
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>`;
                }, 1500);
            });

            elements.redirectTimeline.appendChild(item);
        });
    }

    // --------------------------------------------------------------
    // 3. FILE DOWNLOAD DETECTION SECTION RENDERER
    // --------------------------------------------------------------
    function renderDownloadsSection(downloads) {
        elements.downloadsContainer.innerHTML = '';
        const dlCount = downloads ? downloads.length : 0;
        elements.downloadsCountBadge.innerText = `${dlCount} ${dlCount === 1 ? 'Download' : 'Downloads'}`;

        if (!downloads || downloads.length === 0) {
            elements.downloadsContainer.innerHTML = `
                <div class="download-safe-state">
                    <div class="safe-icon">✓</div>
                    <div class="safe-info">
                        <h4>Safe Navigation: No Files Were Downloading</h4>
                        <p>Neither HTTP Content-Disposition attachment headers nor browser download events were triggered while traversing this website.</p>
                    </div>
                </div>
            `;
            return;
        }

        const list = document.createElement('div');
        list.className = 'download-alerts-list';

        downloads.forEach(dl => {
            const isExecutable = (dl.riskLevel || '').includes('High');
            const card = document.createElement('div');
            card.className = `download-alert-card ${isExecutable ? 'high-risk' : ''}`;

            card.innerHTML = `
                <div class="dl-file-group">
                    <div class="dl-icon ${isExecutable ? 'danger' : ''}">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                    </div>
                    <div class="dl-names">
                        <div class="dl-filename">${escapeHtml(dl.filename)}</div>
                        <div>
                            <span class="dl-extension-badge ${isExecutable ? 'ext-danger' : 'ext-info'}">
                                EXTENSION: ${escapeHtml((dl.extension || '').toUpperCase())}
                            </span>
                            <span style="font-size:0.75rem; color:var(--text-muted); margin-left:8px;">
                                ${escapeHtml(dl.riskLevel || '')}
                            </span>
                        </div>
                        <div>
                            <span class="dl-permission-status">
                                🔒 Permission Denied — Download Blocked For Your Safety
                            </span>
                        </div>
                    </div>
                </div>
                <div class="dl-meta">
                    <div>Size: <strong>${escapeHtml(dl.formattedSize || 'Streaming / Unknown')}</strong></div>
                    <div>MIME: <code class="mono">${escapeHtml(dl.mimeType || 'application/octet-stream')}</code></div>
                </div>
            `;

            list.appendChild(card);
        });

        elements.downloadsContainer.appendChild(list);
    }

    // --------------------------------------------------------------
    // 4. DISPLAY THE SUMMARY SECTION RENDERER
    // --------------------------------------------------------------
    function renderSummarySection(summary, results) {
        elements.summaryContainer.innerHTML = '';

        if (!summary) {
            // Build fallback summary if server didn't generate one
            const hasDownloads = results.outcomes.downloads && results.outcomes.downloads.length > 0;
            summary = {
                verdict: hasDownloads ? 'Caution (Downloads Blocked)' : 'Safe Navigation',
                badgeClass: hasDownloads ? 'warn' : 'safe',
                reason: hasDownloads 
                    ? 'Automatic file downloads were triggered by the website. All downloads were intercepted and permission was denied.' 
                    : 'The URL was analyzed safely through Chromium sandbox without malicious download activity.',
                initialUrl: results.initialUrl,
                finalUrl: results.finalUrl,
                totalHops: results.totalHops,
                redirectsCount: Math.max(0, results.totalHops - 1),
                isRedirected: results.isRedirected,
                protocol: results.finalUrl.startsWith('https://') ? 'HTTPS (TLS Encrypted)' : 'HTTP (Plaintext Unencrypted)',
                humanVerification: {
                    encountered: false,
                    type: 'None'
                },
                downloads: {
                    totalDetected: results.outcomes.downloads ? results.outcomes.downloads.length : 0,
                    permissionDenied: true
                }
            };
        }

        // Update verdict badge
        elements.summaryVerdictPill.innerText = summary.verdict.split('(')[0].trim();
        elements.summaryVerdictPill.className = `verdict-pill ${summary.badgeClass || 'safe'}`;

        const summaryCard = document.createElement('div');
        summaryCard.className = `summary-headline-card ${summary.badgeClass || 'safe'}`;

        summaryCard.innerHTML = `
            <div class="headline-top">
                <div class="headline-title">${escapeHtml(summary.verdict)}</div>
            </div>
            <div class="headline-reason">${escapeHtml(summary.reason)}</div>
        `;

        const statsGrid = document.createElement('div');
        statsGrid.className = 'summary-stats-grid';

        const dlCount = summary.downloads ? summary.downloads.totalDetected : 0;
        const dlStatusText = dlCount > 0 
            ? `${dlCount} File(s) Detected (Permission Denied)` 
            : '0 Files (Safe)';

        statsGrid.innerHTML = `
            <div class="stat-box">
                <span class="stat-label">Total Redirection Hops</span>
                <div class="stat-value">${summary.totalHops} ${summary.totalHops === 1 ? 'Hop' : 'Hops'}</div>
                <div class="stat-desc">${summary.redirectsCount} Redirect(s) Traversed</div>
            </div>
            <div class="stat-box">
                <span class="stat-label">Redirection Status</span>
                <div class="stat-value" style="color: ${summary.isRedirected ? '#d97706' : '#059669'};">
                    ${summary.isRedirected ? 'Redirected Path' : 'Direct Navigation'}
                </div>
                <div class="stat-desc">${summary.isRedirected ? 'Landed on alternate URL' : 'Remained on original URL'}</div>
            </div>
            <div class="stat-box">
                <span class="stat-label">File Downloads</span>
                <div class="stat-value" style="color: ${dlCount > 0 ? '#dc2626' : '#059669'};">
                    ${dlStatusText}
                </div>
                <div class="stat-desc">Permission Denied in Sandbox</div>
            </div>
            <div class="stat-box">
                <span class="stat-label">SSL Transport Security</span>
                <div class="stat-value" style="color: ${summary.protocol.includes('HTTPS') ? '#059669' : '#d97706'};">
                    ${summary.protocol}
                </div>
                <div class="stat-desc">${summary.protocol.includes('HTTPS') ? 'Secure End-to-End' : 'Unencrypted plaintext'}</div>
            </div>
            <div class="stat-box">
                <span class="stat-label">Human Verification</span>
                <div class="stat-value" style="color: ${summary.humanVerification && summary.humanVerification.encountered ? '#0284c7' : '#64748b'};">
                    ${summary.humanVerification && summary.humanVerification.encountered ? 'Encountered & Solved' : 'None Required'}
                </div>
                <div class="stat-desc">${summary.humanVerification && summary.humanVerification.type ? escapeHtml(summary.humanVerification.type) : 'Standard Web Flow'}</div>
            </div>
            <div class="stat-box">
                <span class="stat-label">Destination Domain</span>
                <div class="stat-value mono" style="font-size:0.95rem; word-break:break-all;">
                    ${escapeHtml(new URL(summary.finalUrl).hostname)}
                </div>
                <div class="stat-desc">Final Landed Host</div>
            </div>
        `;

        elements.summaryContainer.appendChild(summaryCard);
        elements.summaryContainer.appendChild(statsGrid);
    }

    // --------------------------------------------------------------
    // EXTRA: DESTINATION IP'S & NETWORK TELEMETRY
    // --------------------------------------------------------------
    function renderDestinationIpsSection(destinationIps) {
        elements.destinationIpsTbody.innerHTML = '';
        const count = destinationIps ? destinationIps.length : 0;
        elements.ipsCountBadge.innerText = `${count} ${count === 1 ? 'IP' : "IP's"}`;

        if (!destinationIps || destinationIps.length === 0) {
            elements.destinationIpsTbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; padding: 24px; color: var(--text-muted);">
                        No server destination IP addresses recorded.
                    </td>
                </tr>
            `;
            return;
        }

        destinationIps.forEach(item => {
            const tr = document.createElement('tr');
            const flag = getFlagEmoji(item.countryCode);

            tr.innerHTML = `
                <td class="mono" style="font-weight:700; color:#0f172a;">${escapeHtml(item.hostname)}</td>
                <td>
                    <span class="ip-badge">${escapeHtml(item.ip)}</span>
                </td>
                <td>
                    <span class="badge ${item.isIpv6 ? 'info' : 'success'}">${item.isIpv6 ? 'IPv6' : 'IPv4'}</span>
                </td>
                <td>
                    <span style="font-size:1.1rem; margin-right:4px;">${flag}</span>
                    <span>${escapeHtml(item.city || 'Unknown')}, ${escapeHtml(item.country || 'Global')}</span>
                </td>
                <td>
                    <strong>${escapeHtml(item.isp || item.org || 'Autonomous System')}</strong>
                    <div style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);">${escapeHtml(item.as || '')}</div>
                </td>
            `;

            elements.destinationIpsTbody.appendChild(tr);
        });
    }

    // Lightbox Modal
    function openLightbox(imgSrc, title, url, hopNumber) {
        elements.lightboxTitle.innerText = `[Hop ${hopNumber}] ${title || 'Screenshot'}`;
        elements.lightboxUrl.innerText = url;
        elements.lightboxImg.src = imgSrc;
        elements.lightboxDownloadLink.href = imgSrc;
        elements.lightboxDownloadLink.download = `screenshot-hop-${hopNumber}.jpg`;
        elements.modalLightbox.style.display = 'flex';
    }

    // History Storage
    function saveToHistory(results) {
        try {
            const history = JSON.parse(localStorage.getItem('url_precheck_history') || '[]');
            const entry = {
                id: results.sessionId,
                url: results.initialUrl,
                finalUrl: results.finalUrl,
                totalHops: results.totalHops,
                timestamp: new Date().toLocaleTimeString(),
                date: new Date().toLocaleDateString(),
                downloadsCount: results.outcomes.downloads ? results.outcomes.downloads.length : 0
            };
            history.unshift(entry);
            const trimmed = history.slice(0, 20);
            localStorage.setItem('url_precheck_history', JSON.stringify(trimmed));
            loadHistoryCount();
        } catch (e) {}
    }

    function loadHistoryCount() {
        try {
            const history = JSON.parse(localStorage.getItem('url_precheck_history') || '[]');
            elements.historyCount.innerText = history.length;
        } catch (e) {}
    }

    function openHistoryDrawer() {
        try {
            const history = JSON.parse(localStorage.getItem('url_precheck_history') || '[]');
            elements.historyList.innerHTML = '';
            if (history.length === 0) {
                elements.historyList.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">No scan history yet.</p>';
            } else {
                history.forEach(item => {
                    const el = document.createElement('div');
                    el.className = 'history-item';
                    el.innerHTML = `
                        <div class="history-item-url">${escapeHtml(item.url)}</div>
                        <div class="history-item-meta">
                            <span>${item.totalHops} Hops • ${item.downloadsCount} DLs</span>
                            <span>${item.date} ${item.timestamp}</span>
                        </div>
                    `;
                    el.addEventListener('click', () => {
                        elements.urlInput.value = item.url;
                        elements.btnClearInput.style.display = 'block';
                        elements.historyDrawer.style.display = 'none';
                        startScan(item.url);
                    });
                    elements.historyList.appendChild(el);
                });
            }
            elements.historyDrawer.style.display = 'flex';
        } catch (e) {}
    }

    function clearHistory() {
        localStorage.removeItem('url_precheck_history');
        elements.historyList.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">History cleared.</p>';
        elements.historyCount.innerText = '0';
    }

    // Export PDF Report (Strictly .pdf extension only)
    async function downloadPdfReport() {
        if (!lastScanResults) return;

        const btnTop = elements.btnExportPdf;
        const btnRibbon = elements.btnRibbonDownloadPdf;

        const origHtmlTop = btnTop ? btnTop.innerHTML : '';
        const origHtmlRibbon = btnRibbon ? btnRibbon.innerHTML : '';

        const loadingHtml = `
            <span class="spinner" style="width:13px; height:13px; border-width:2px; display:inline-block;"></span>
            <span>Generating PDF...</span>
        `;

        if (btnTop) {
            btnTop.innerHTML = loadingHtml;
            btnTop.disabled = true;
        }
        if (btnRibbon) {
            btnRibbon.innerHTML = loadingHtml;
            btnRibbon.disabled = true;
        }

        try {
            const response = await fetch(`${getApiBase()}/api/export-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(lastScanResults)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `Server returned HTTP ${response.status}`);
            }

            const blob = await response.blob();
            const pdfBlob = new Blob([blob], { type: 'application/pdf' });
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            a.download = `pre_check_url_report_${timestamp}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            if (btnTop) btnTop.innerHTML = '<span>✓ PDF Downloaded!</span>';
            if (btnRibbon) btnRibbon.innerHTML = '<span>✓ PDF Downloaded!</span>';
            setTimeout(() => {
                if (btnTop) {
                    btnTop.innerHTML = origHtmlTop;
                    btnTop.disabled = false;
                }
                if (btnRibbon) {
                    btnRibbon.innerHTML = origHtmlRibbon;
                    btnRibbon.disabled = false;
                }
            }, 2200);

        } catch (err) {
            console.error('PDF download error:', err);
            showError('PDF Generation Error', `Failed to generate PDF report: ${err.message}. Please try again.`);
            if (btnTop) {
                btnTop.innerHTML = origHtmlTop;
                btnTop.disabled = false;
            }
            if (btnRibbon) {
                btnRibbon.innerHTML = origHtmlRibbon;
                btnRibbon.disabled = false;
            }
        }
    }

    // Utilities
    function showError(title, msg) {
        elements.errorTitle.innerText = title;
        elements.errorMessage.innerText = msg;
        elements.errorBanner.style.display = 'flex';
    }

    function hideError() {
        elements.errorBanner.style.display = 'none';
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getFlagEmoji(countryCode) {
        if (!countryCode || countryCode.length !== 2 || countryCode === 'UN' || countryCode === 'LAN') {
            return '🌐';
        }
        const codePoints = countryCode
            .toUpperCase()
            .split('')
            .map(char => 127397 + char.charCodeAt(0));
        return String.fromCodePoint(...codePoints);
    }

    // Initialize on DOM load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
