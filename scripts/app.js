// Main Application Logic & Dynamic UI Orchestrator

document.addEventListener('DOMContentLoaded', () => {
    initHeroData();
    renderSpecializations();
    renderMitreMatrix();
    renderCertifications();
    renderProjects();
    renderAdvisories();
    initCtfChallenge();
    initContactForm();
    initGlobalControls();
});

// Populate Hero and Profile Details
function initHeroData() {
    const p = PORTFOLIO_DATA.profile;

    const opName = document.getElementById('op-name');
    if (opName) opName.textContent = p.name;

    const opTitle = document.getElementById('op-title');
    if (opTitle) opTitle.textContent = p.title;

    const opClearance = document.getElementById('op-clearance');
    if (opClearance) opClearance.textContent = p.clearance;

    const opBio = document.getElementById('op-bio');
    if (opBio) opBio.textContent = p.bio;

    const opPgp = document.getElementById('op-pgp-fingerprint');
    if (opPgp) opPgp.textContent = p.pgpKeyId;

    // Render Stats
    const statsContainer = document.getElementById('stats-strip');
    if (statsContainer && p.stats) {
        statsContainer.innerHTML = p.stats.map(s => `
            <div class="stat-box">
                <div class="stat-val">${s.value}</div>
                <div class="stat-lbl">${s.label}</div>
            </div>
        `).join('');
    }

    // PGP Copy Button
    const btnCopyPgp = document.getElementById('btn-copy-pgp');
    if (btnCopyPgp) {
        btnCopyPgp.addEventListener('click', () => {
            navigator.clipboard.writeText(p.pgpKeyArmored).then(() => {
                if (window.cyberSound) window.cyberSound.playClick();
                btnCopyPgp.textContent = 'COPIED!';
                setTimeout(() => {
                    btnCopyPgp.textContent = 'COPY KEY';
                }, 2000);
            });
        });
    }
}

// Render Skills & Specializations
function renderSpecializations() {
    const container = document.getElementById('skills-grid');
    if (!container) return;

    container.innerHTML = PORTFOLIO_DATA.specializations.map(spec => `
        <div class="skill-card">
            <div class="skill-header">
                <div class="skill-icon-wrapper">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                </div>
                <h3>${spec.category}</h3>
            </div>
            <div class="skill-bars">
                ${spec.skills.map(s => `
                    <div class="skill-item">
                        <div class="skill-meta">
                            <span class="skill-name">${s.name}</span>
                            <span class="skill-pct">${s.level}%</span>
                        </div>
                        <div class="progress-track">
                            <div class="progress-fill" style="width: ${s.level}%;"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="tool-tags">
                ${spec.tools.map(t => `<span class="tool-tag">${t}</span>`).join('')}
            </div>
        </div>
    `).join('');
}

// Render MITRE ATT&CK Matrix Grid
function renderMitreMatrix() {
    const container = document.getElementById('mitre-grid');
    if (!container) return;

    container.innerHTML = PORTFOLIO_DATA.mitreCoverage.map(m => `
        <div class="mitre-column" style="border-top-color: ${m.color};">
            <div class="mitre-tactic-id">${m.id}</div>
            <h4 class="mitre-tactic-title">${m.tactic}</h4>
            <div class="mitre-readiness">${m.readiness}</div>
            <ul class="mitre-techniques-list">
                ${m.techniques.map(t => `<li>${t}</li>`).join('')}
            </ul>
        </div>
    `).join('');
}

// Render Certifications Showcase
function renderCertifications() {
    const container = document.getElementById('certs-grid');
    if (!container) return;

    container.innerHTML = PORTFOLIO_DATA.certifications.map(c => `
        <div class="cert-card">
            <div class="cert-badge-circle" style="border-color: ${c.badgeColor}; box-shadow: 0 0 15px ${c.badgeColor}40;">
                <span style="color: ${c.badgeColor};">${c.name}</span>
            </div>
            <h4 class="cert-name">${c.name}</h4>
            <div class="cert-issuer">${c.issuer} // ${c.issueDate}</div>
            <div class="cert-id-badge">${c.credentialId}</div>
            <p class="cert-desc">${c.description}</p>
            <a href="${c.verifyUrl}" target="_blank" rel="noopener noreferrer" class="cert-verify-link">
                <span>VERIFY CREDENTIAL</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
            </a>
        </div>
    `).join('');
}

// Render Projects
function renderProjects() {
    const container = document.getElementById('projects-grid');
    if (!container) return;

    container.innerHTML = PORTFOLIO_DATA.projects.map(p => `
        <div class="project-card">
            <div class="project-meta-top">
                <span class="project-status-tag">ACTIVE REPO</span>
                <span class="t-mono t-muted" style="font-size: 0.72rem;">${p.id.toUpperCase()}</span>
            </div>
            <h3 class="project-title">${p.title}</h3>
            <div class="project-tagline">${p.tagline}</div>
            <p class="project-desc">${p.description}</p>
            <div class="project-metric-callout">
                <strong>Benchmark:</strong> ${p.metrics}
            </div>
            <div class="project-footer">
                <div class="project-tags">
                    ${p.tags.map(t => `<span class="project-tag-badge">${t}</span>`).join('')}
                </div>
                <div class="project-links">
                    <a href="${p.githubUrl}" target="_blank" rel="noopener noreferrer" class="project-link-btn" title="View Code">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
                        </svg>
                        <span>Code</span>
                    </a>
                </div>
            </div>
        </div>
    `).join('');
}

// Render Security Advisories
function renderAdvisories() {
    const tableBody = document.getElementById('advisories-tbody');
    if (!tableBody) return;

    tableBody.innerHTML = PORTFOLIO_DATA.advisories.map(a => {
        let cvssClass = 'cvss-medium';
        if (a.cvss >= 8.5) cvssClass = 'cvss-critical';
        else if (a.cvss >= 7.0) cvssClass = 'cvss-high';

        return `
            <tr>
                <td><strong class="t-cyan">${a.id}</strong></td>
                <td>
                    <span class="cvss-pill ${cvssClass}">CVSS ${a.cvss} (${a.severity})</span>
                </td>
                <td>
                    <div><strong>${a.title}</strong></div>
                    <div class="t-muted" style="font-size: 0.75rem; margin-top: 0.2rem;">${a.impact}</div>
                </td>
                <td>${a.vendor}</td>
                <td><span class="t-green">${a.status}</span></td>
                <td><span class="t-muted">${a.date}</span></td>
            </tr>
        `;
    }).join('');
}

// Interactive CTF Cryptographic Challenge
function initCtfChallenge() {
    const ctf = PORTFOLIO_DATA.ctfChallenge;
    const cipherStr = document.getElementById('ctf-cipher-string');
    const inputEl = document.getElementById('ctf-flag-input');
    const btnSubmit = document.getElementById('btn-submit-flag');
    const resultBox = document.getElementById('ctf-result-box');

    if (cipherStr) cipherStr.textContent = ctf.encodedString;

    if (btnSubmit && inputEl && resultBox) {
        btnSubmit.addEventListener('click', () => {
            const val = inputEl.value.trim();
            if (!val) return;

            if (val === ctf.plainFlag) {
                if (window.cyberSound) window.cyberSound.playChime();
                resultBox.className = 'ctf-result-box success';
                resultBox.innerHTML = `
                    <strong>✔ [CHALLENGE SOLVED] ACCESS GRANTED</strong><br/>
                    ${ctf.secretMessage}
                `;
            } else {
                if (window.cyberSound) window.cyberSound.playError();
                resultBox.className = 'ctf-result-box error';
                resultBox.innerHTML = `
                    <strong>✖ [VERIFICATION FAILED]</strong><br/>
                    Hash mismatch. Hint: Decode the Base64 token above to uncover the raw plain flag.
                `;
            }
        });
    }
}

// Encrypted Contact Transmission Form
function initContactForm() {
    const form = document.getElementById('secure-contact-form');
    const statusBox = document.getElementById('form-status-alert');

    if (form && statusBox) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (window.cyberSound) window.cyberSound.playClick();

            const name = document.getElementById('contact-name').value;
            const email = document.getElementById('contact-email').value;
            const msg = document.getElementById('contact-msg').value;

            statusBox.className = 'form-status-alert active';
            statusBox.innerHTML = `
                ✔ Transmission securely packaged and logged. Thank you, <strong>${name}</strong>. Operator will acknowledge via <strong>${email}</strong> within 24 hours.
            `;

            form.reset();
            setTimeout(() => {
                statusBox.className = 'form-status-alert';
            }, 8000);
        });
    }
}

// Global Controls (Audio Mute Toggle, Scanlines Toggle, Navigation Highlighting)
function initGlobalControls() {
    const audioBtn = document.getElementById('btn-toggle-audio');
    if (audioBtn) {
        audioBtn.addEventListener('click', () => {
            if (window.cyberSound) {
                const isMuted = window.cyberSound.toggleMute();
                audioBtn.innerHTML = isMuted ? `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="1" y1="1" x2="23" y2="23"/>
                        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
                        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
                        <line x1="12" y1="19" x2="12" y2="23"/>
                        <line x1="8" y1="23" x2="16" y2="23"/>
                    </svg>
                    <span>SFX: MUTED</span>
                ` : `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </svg>
                    <span>SFX: ON</span>
                `;
                audioBtn.classList.toggle('active', !isMuted);
            }
        });
    }

    const scanlinesBtn = document.getElementById('btn-toggle-scanlines');
    if (scanlinesBtn) {
        scanlinesBtn.addEventListener('click', () => {
            document.body.classList.toggle('no-scanlines');
            scanlinesBtn.classList.toggle('active');
            if (window.cyberSound) window.cyberSound.playClick();
        });
    }

    const clearTerminalBtn = document.getElementById('btn-clear-terminal');
    if (clearTerminalBtn) {
        clearTerminalBtn.addEventListener('click', () => {
            const out = document.getElementById('terminal-output');
            if (out) out.innerHTML = '';
            if (window.cyberSound) window.cyberSound.playClick();
        });
    }
}
