// Interactive SOC Console & Terminal Emulator
// Provides an authentic cybersecurity command-line interface

class TerminalEmulator {
    constructor() {
        this.history = [];
        this.historyIndex = -1;
        this.commands = [
            'help', 'whoami', 'skills', 'certs', 'projects', 
            'advisories', 'cve', 'pgp', 'mitre', 'contact', 
            'clear', 'uptime', 'decrypt', 'nmap', 'banner'
        ];

        this.outputEl = document.getElementById('terminal-output');
        this.inputEl = document.getElementById('terminal-input');
        this.formEl = document.getElementById('terminal-form');
        this.containerEl = document.getElementById('terminal-container');

        if (this.inputEl && this.outputEl) {
            this.init();
        }
    }

    init() {
        this.formEl.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCommand(this.inputEl.value.trim());
        });

        this.inputEl.addEventListener('keydown', (e) => {
            if (window.cyberSound) {
                window.cyberSound.playKey();
            }

            // Arrow Up: Previous command
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (this.history.length > 0 && this.historyIndex > 0) {
                    this.historyIndex--;
                    this.inputEl.value = this.history[this.historyIndex];
                } else if (this.historyIndex === 0) {
                    this.inputEl.value = this.history[0];
                }
            }

            // Arrow Down: Next command
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (this.historyIndex < this.history.length - 1) {
                    this.historyIndex++;
                    this.inputEl.value = this.history[this.historyIndex];
                } else {
                    this.historyIndex = this.history.length;
                    this.inputEl.value = '';
                }
            }

            // Tab: Autocomplete
            if (e.key === 'Tab') {
                e.preventDefault();
                const val = this.inputEl.value.trim();
                if (!val) return;
                const match = this.commands.find(c => c.startsWith(val.toLowerCase()));
                if (match) {
                    this.inputEl.value = match;
                }
            }
        });

        // Focus input when clicking anywhere in terminal
        this.containerEl.addEventListener('click', () => {
            this.inputEl.focus();
        });

        // Initial welcome banner
        this.printBanner();
    }

    printBanner() {
        const welcome = `
<span class="t-cyan">╔════════════════════════════════════════════════════════════════════════╗</span>
<span class="t-cyan">║</span>  <span class="t-green">SEC-OPS TELEMETRY TERMINAL v3.2.4</span> [OPERATOR: ${PORTFOLIO_DATA.profile.handle}]  <span class="t-cyan">║</span>
<span class="t-cyan">║</span>  Type <span class="t-yellow">'help'</span> for available commands or <span class="t-yellow">'whoami'</span> for operator specs.   <span class="t-cyan">║</span>
<span class="t-cyan">╚════════════════════════════════════════════════════════════════════════╝</span>
<span class="t-muted">System security posture: OPTIMAL. All perimeter honeypots armed.</span>
`;
        this.printOutput(welcome);
    }

    printOutput(html) {
        const line = document.createElement('div');
        line.className = 'terminal-line';
        line.innerHTML = html;
        this.outputEl.appendChild(line);
        this.containerEl.scrollTop = this.containerEl.scrollHeight;
    }

    handleCommand(cmd) {
        if (!cmd) return;

        // Log command prompt line
        const promptEcho = `
<div class="terminal-cmd-echo">
    <span class="t-green">operator@alexvance:~$</span> <span class="t-white">${this.escapeHtml(cmd)}</span>
</div>`;
        this.printOutput(promptEcho);

        // Add to history
        this.history.push(cmd);
        this.historyIndex = this.history.length;
        this.inputEl.value = '';

        const parts = cmd.split(' ');
        const mainCmd = parts[0].toLowerCase();
        const args = parts.slice(1);

        switch (mainCmd) {
            case 'help':
                this.cmdHelp();
                break;
            case 'whoami':
                this.cmdWhoami();
                break;
            case 'skills':
            case 'specializations':
                this.cmdSkills();
                break;
            case 'certs':
            case 'certifications':
                this.cmdCerts();
                break;
            case 'projects':
            case 'tools':
                this.cmdProjects();
                break;
            case 'cve':
            case 'advisories':
                this.cmdAdvisories();
                break;
            case 'pgp':
                this.cmdPgp();
                break;
            case 'mitre':
                this.cmdMitre();
                break;
            case 'contact':
                this.cmdContact();
                break;
            case 'uptime':
            case 'status':
                this.cmdUptime();
                break;
            case 'nmap':
                this.cmdNmap(args);
                break;
            case 'decrypt':
                this.cmdDecrypt(args);
                break;
            case 'banner':
                this.printBanner();
                break;
            case 'clear':
            case 'cls':
                this.outputEl.innerHTML = '';
                break;
            default:
                if (window.cyberSound) window.cyberSound.playError();
                this.printOutput(`<span class="t-red">Command not recognized: '${this.escapeHtml(mainCmd)}'. Type <span class="t-yellow">'help'</span> for instructions.</span>`);
        }
    }

    cmdHelp() {
        const text = `
<span class="t-yellow">AVAILABLE TELEMETRY COMMANDS:</span>
  <span class="t-cyan">whoami</span>        : Display operator dossier, clearance, and core profile
  <span class="t-cyan">skills</span>        : Inspect offensive & defensive domain competencies
  <span class="t-cyan">certs</span>         : Display verified industry credentials (CISSP, OSCP, AWS...)
  <span class="t-cyan">projects</span>      : List open-source security tools & detection repos
  <span class="t-cyan">advisories</span>    : Show coordinated vulnerability disclosures & CVSS scores
  <span class="t-cyan">mitre</span>         : View tactical MITRE ATT&CK coverage summary
  <span class="t-cyan">pgp</span>           : Output armored PGP public key for encrypted transmissions
  <span class="t-cyan">nmap</span> &lt;host&gt;    : Run defensive port and service audit simulation
  <span class="t-cyan">decrypt</span> &lt;flag&gt;: Submit CTF puzzle answer to verify cryptographic token
  <span class="t-cyan">contact</span>       : Output encrypted comms channels & direct email
  <span class="t-cyan">uptime</span>        : Check SOC telemetry and node availability
  <span class="t-cyan">clear</span>         : Flush the current terminal buffer
`;
        this.printOutput(text);
    }

    cmdWhoami() {
        const p = PORTFOLIO_DATA.profile;
        const text = `
<span class="t-green">OPERATOR IDENTITY:</span> ${p.name}
<span class="t-yellow">DESIGNATION:</span>       ${p.title}
<span class="t-cyan">STATUS:</span>            ${p.status}
<span class="t-magenta">CLEARANCE:</span>         ${p.clearance}
<span class="t-white">LOCATION:</span>          ${p.location}
<span class="t-muted">${p.bio}</span>
`;
        this.printOutput(text);
    }

    cmdSkills() {
        let text = `<span class="t-yellow">SECURITY DOMAIN COMPETENCIES:</span>\n`;
        PORTFOLIO_DATA.specializations.forEach(s => {
            text += `\n<span class="t-cyan">[+] ${s.category}</span>\n`;
            s.skills.forEach(sk => {
                const bar = '█'.repeat(Math.floor(sk.level / 10)) + '░'.repeat(10 - Math.floor(sk.level / 10));
                text += `  • ${sk.name.padEnd(38)} [${bar}] ${sk.level}%\n`;
            });
            text += `    <span class="t-muted">Arsenal: ${s.tools.join(', ')}</span>\n`;
        });
        this.printOutput(`<pre class="t-mono">${text}</pre>`);
    }

    cmdCerts() {
        let text = `<span class="t-yellow">VERIFIED ACCREDITATIONS & CREDENTIALS:</span>\n\n`;
        PORTFOLIO_DATA.certifications.forEach(c => {
            text += `<span class="t-green">[✔] ${c.name}</span> - ${c.fullName}\n`;
            text += `    Issuer: ${c.issuer} | Year: ${c.issueDate} | Credential: <span class="t-cyan">${c.credentialId}</span>\n`;
            text += `    <span class="t-muted">${c.description}</span>\n\n`;
        });
        this.printOutput(text);
    }

    cmdProjects() {
        let text = `<span class="t-yellow">SECURITY TOOLS & DETECTION ARCHITECTURE:</span>\n\n`;
        PORTFOLIO_DATA.projects.forEach(p => {
            text += `<span class="t-cyan">▶ ${p.title}</span>\n`;
            text += `  Tagline: ${p.tagline}\n`;
            text += `  Stack:   <span class="t-magenta">${p.tags.join(' | ')}</span>\n`;
            text += `  Metrics: <span class="t-green">${p.metrics}</span>\n\n`;
        });
        this.printOutput(text);
    }

    cmdAdvisories() {
        let text = `<span class="t-yellow">COORDINATED SECURITY ADVISORIES & DISCLOSURES:</span>\n\n`;
        PORTFOLIO_DATA.advisories.forEach(a => {
            const sevColor = a.cvss >= 8.0 ? 't-red' : (a.cvss >= 6.0 ? 't-yellow' : 't-green');
            text += `<span class="${sevColor}">[CVSS ${a.cvss} - ${a.severity.toUpperCase()}]</span> <span class="t-white">${a.id}: ${a.title}</span>\n`;
            text += `  Target: ${a.vendor} | Status: <span class="t-green">${a.status}</span> | Date: ${a.date}\n`;
            text += `  Impact: <span class="t-muted">${a.impact}</span>\n\n`;
        });
        this.printOutput(text);
    }

    cmdMitre() {
        let text = `<span class="t-yellow">MITRE ATT&CK DEFENSIVE MATRIX READINESS:</span>\n\n`;
        PORTFOLIO_DATA.mitreCoverage.forEach(m => {
            text += `<span class="t-cyan">[${m.id}] ${m.tactic}</span> -> <span class="t-green">${m.readiness}</span>\n`;
            text += `  Audited Techniques: ${m.techniques.join(', ')}\n\n`;
        });
        this.printOutput(text);
    }

    cmdPgp() {
        const text = `
<span class="t-yellow">PGP FINGERPRINT:</span>
<span class="t-cyan">${PORTFOLIO_DATA.profile.pgpKeyId}</span>

<pre class="t-mono t-muted">${this.escapeHtml(PORTFOLIO_DATA.profile.pgpKeyArmored)}</pre>
`;
        this.printOutput(text);
    }

    cmdContact() {
        const p = PORTFOLIO_DATA.profile;
        const text = `
<span class="t-yellow">SECURE COMM CHANNELS:</span>
  Direct Email:     <span class="t-cyan">${p.email}</span>
  PGP Key ID:       <span class="t-green">${p.pgpKeyId}</span>
  GitHub Repository: <span class="t-white">${p.socials.github}</span>
  LinkedIn:         <span class="t-white">${p.socials.linkedin}</span>
  HackTheBox:       <span class="t-white">${p.socials.hackthebox}</span>
`;
        this.printOutput(text);
    }

    cmdUptime() {
        const d = new Date().toUTCString();
        const text = `
<span class="t-green">TELEMETRY STATUS: HEALTHY</span>
Current UTC Timestamp : ${d}
SOC Node Location     : US-WEST-2 (Defense Cluster A)
Active Packet Sensors : 4 Ingestion Nodes Active
Threat Level (DEFCON) : 1 (DEFENSE READINESS OPTIMAL)
`;
        this.printOutput(text);
    }

    cmdNmap(args) {
        const target = args[0] || '127.0.0.1';
        this.printOutput(`<span class="t-cyan">Starting Nmap 7.94 defensive port audit against target ${this.escapeHtml(target)}...</span>`);
        
        setTimeout(() => {
            const report = `
Nmap scan report for <span class="t-white">${this.escapeHtml(target)}</span>
Host is up (0.00042s latency).
Not shown: 996 closed tcp ports (reset)
PORT     STATE SERVICE       VERSION
22/tcp   open  ssh           OpenSSH 9.4 (ED25519-only hardened)
80/tcp   open  http          Nginx 1.25.3 (HSTS enforced)
443/tcp  open  ssl/https     TLSv1.3 TLS_AES_256_GCM_SHA384
8443/tcp open  vault-api     HashiCorp Vault HSM v1.15.2

<span class="t-green">Audit completed: Zero unsecured listeners detected. All TLS policies hardened.</span>
`;
            this.printOutput(report);
        }, 600);
    }

    cmdDecrypt(args) {
        const flag = args.join(' ').trim();
        if (!flag) {
            this.printOutput(`<span class="t-yellow">Usage: decrypt &lt;flag_string&gt;</span>\nExample: decrypt ${PORTFOLIO_DATA.ctfChallenge.plainFlag}`);
            return;
        }

        if (flag === PORTFOLIO_DATA.ctfChallenge.plainFlag) {
            if (window.cyberSound) window.cyberSound.playChime();
            this.printOutput(`
<span class="t-green">✔ [CRITICAL SUCCESS] FLAG VALIDATED!</span>
<span class="t-cyan">${PORTFOLIO_DATA.ctfChallenge.secretMessage}</span>
`);
        } else {
            if (window.cyberSound) window.cyberSound.playError();
            this.printOutput(`<span class="t-red">✖ Verification Failed. Check token encoding and try again.</span>`);
        }
    }

    escapeHtml(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.socTerminal = new TerminalEmulator();
});
