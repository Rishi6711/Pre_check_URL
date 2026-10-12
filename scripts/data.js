// Cybersecurity Specialist Portfolio - Central Data Configuration
// Easily edit this file to personalize your portfolio information!

const PORTFOLIO_DATA = {
    profile: {
        name: "Alex Vance",
        title: "Cybersecurity Analyst & Systems Defense Engineer",
        handle: "operator@alexvance.sec",
        clearance: "LEVEL 4 // SEC-OPS AUTHORIZED",
        status: "OPERATIONAL // AVAILABLE FOR ENGAGEMENTS",
        statusLevel: "optimal", // optimal, alert, standby
        pgpKeyId: "4A9F 82C1 09E4 B33D 7F12 90D4 821E FB04",
        pgpKeyArmored: `-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: OpenPGP v2.1.4
Comment: https://alexvance.sec/pgp

mQGNBF+9w5kBDAC6zWcT2n7xQJpXq0tS01uX7yK9L3mV4e8W1j2H6k8M7N...
[KEY DATA TRUNCATED FOR DISPLAY - REPLACE WITH YOUR ARMOR FILE]
=4J9K
-----END PGP PUBLIC KEY BLOCK-----`,
        bio: "Specializing in threat intelligence, cloud security posture management, and proactive vulnerability mitigation. Proven track record in securing enterprise infrastructure, conducting defensive audits, and building automated threat detection pipelines.",
        location: "San Francisco, CA / Remote",
        email: "alex.vance.sec@proton.me",
        socials: {
            github: "https://github.com",
            linkedin: "https://linkedin.com",
            tryhackme: "https://tryhackme.com",
            hackthebox: "https://hackthebox.com"
        },
        stats: [
            { label: "Systems Audited", value: "140+" },
            { label: "Vulnerabilities Mitigated", value: "320+" },
            { label: "Security Advisories", value: "18" },
            { label: "Defensive Uptime", value: "99.99%" }
        ]
    },

    specializations: [
        {
            category: "Defensive Security & SOC",
            icon: "shield-alert",
            skills: [
                { name: "SIEM & Telemetry (Splunk, Elastic)", level: 95 },
                { name: "Incident Response & Forensics", level: 90 },
                { name: "Threat Hunting & Sigma Rules", level: 88 },
                { name: "Endpoint Detection & Response (EDR)", level: 92 }
            ],
            tools: ["Splunk", "Elasticsearch", "Wireshark", "Velociraptor", "YARA", "Suricata", "Zeek"]
        },
        {
            category: "Cloud & Infrastructure Hardening",
            icon: "cloud-lock",
            skills: [
                { name: "AWS & Azure Security Architecture", level: 92 },
                { name: "Kubernetes & Container Hardening", level: 86 },
                { name: "Infrastructure as Code (Terraform)", level: 85 },
                { name: "IAM Governance & Zero Trust", level: 94 }
            ],
            tools: ["AWS GuardDuty", "Azure Sentinel", "Trivy", "Falco", "Docker Bench", "Terraform", "Vault"]
        },
        {
            category: "Application Security & Auditing",
            icon: "code-scan",
            skills: [
                { name: "Web Application Security Auditing", level: 89 },
                { name: "Secure Code Review (Python, Go, JS)", level: 85 },
                { name: "API Security & OAuth/OIDC Hardening", level: 90 },
                { name: "CI/CD DevSecOps Automation", level: 87 }
            ],
            tools: ["Burp Suite Pro", "OWASP ZAP", "SonarQube", "Snyk", "Semgrep", "Postman", "GitLab CI"]
        }
    ],

    certifications: [
        {
            id: "cert-1",
            name: "CISSP",
            fullName: "Certified Information Systems Security Professional",
            issuer: "ISC2",
            issueDate: "2024",
            badgeColor: "#00f0ff",
            verifyUrl: "https://www.isc2.org/verification",
            credentialId: "ISC2-ID-892410",
            description: "Advanced competency in security architecture, risk management, asset security, and operational resilience."
        },
        {
            id: "cert-2",
            name: "OSCP",
            fullName: "Offensive Security Certified Professional",
            issuer: "OffSec",
            issueDate: "2023",
            badgeColor: "#ff0055",
            verifyUrl: "https://www.offsec.com/verify",
            credentialId: "OS-102984-PENTEST",
            description: "Hands-on mastery in system vulnerability assessment, network mapping, privilege escalation, and reporting."
        },
        {
            id: "cert-3",
            name: "AWS Security Specialty",
            fullName: "AWS Certified Security - Specialty",
            issuer: "Amazon Web Services",
            issueDate: "2024",
            badgeColor: "#ffb703",
            verifyUrl: "https://aws.amazon.com/verification",
            credentialId: "AWS-SEC-99412",
            description: "Expertise in securing multi-account AWS architectures, encryption controls, KMS management, and automated logging."
        },
        {
            id: "cert-4",
            name: "CompTIA Security+",
            fullName: "CompTIA Security+ SY0-701",
            issuer: "CompTIA",
            issueDate: "2022",
            badgeColor: "#00ff9d",
            verifyUrl: "https://comptia.org",
            credentialId: "COMP-SEC-77189",
            description: "Core foundation covering network architecture, cryptography, incident response procedures, and threat vectors."
        }
    ],

    projects: [
        {
            id: "proj-1",
            title: "SentinelWatch: Automated Threat Intelligence Engine",
            tagline: "High-throughput IOC aggregator and alerting pipeline built in Python and Docker.",
            description: "A resilient telemetry processing engine that ingests feeds from MISP, AlienVault OTX, and VirusTotal, parses indicators of compromise (IOCs), deduplicates signatures, and dynamically updates firewall blocklists via automated webhooks.",
            tags: ["Python", "FastAPI", "Docker", "MISP", "Redis", "Threat Intel"],
            metrics: "Processed 1.2M+ daily indicators with <40ms ingestion latency.",
            githubUrl: "https://github.com",
            demoUrl: "#"
        },
        {
            id: "proj-2",
            title: "KubeArmorAudit: Cloud-Native Pod Hardening Tool",
            tagline: "Automated scanner verifying CIS Kubernetes benchmarks and RBAC configurations.",
            description: "An open-source CLI utility assessing container runtime permissions, excessive service account privileges, and unencrypted secret volumes across production Kubernetes clusters, rendering colorized risk heatmaps.",
            tags: ["Go", "Kubernetes", "Docker", "DevSecOps", "CIS Benchmark"],
            metrics: "Audited 50+ enterprise production clusters with zero downtime.",
            githubUrl: "https://github.com",
            demoUrl: "#"
        },
        {
            id: "proj-3",
            title: "CipherLog: Zero-Knowledge Secure Comms Pipeline",
            tagline: "End-to-end encrypted incident communications dashboard for response teams.",
            description: "A lightweight, browser-based secure transmission channel utilizing WebCrypto API (AES-GCM-256 and ECDH key exchange) to enable out-of-band incident response coordination during active security incidents.",
            tags: ["JavaScript", "WebCrypto API", "WebSockets", "Zero-Knowledge", "Cryptography"],
            metrics: "Client-side verified key exchange with forward secrecy.",
            githubUrl: "https://github.com",
            demoUrl: "#"
        },
        {
            id: "proj-4",
            title: "HoneyNode: Distributed Deception Telemetry Grid",
            tagline: "Low-interaction honeypots collecting reconnaissance patterns across edge routers.",
            description: "Custom honeypot fleet mimicking exposed SSH and HTTP admin interfaces to capture automated scanning patterns, brute-force dictionaries, and adversary IP telemetry for proactive SOC alerting.",
            tags: ["Python", "Elasticsearch", "Kibana", "Threat Hunting", "Suricata"],
            metrics: "Indexed 85,000+ scanning attempts with automatic geo-tagging.",
            githubUrl: "https://github.com",
            demoUrl: "#"
        }
    ],

    advisories: [
        {
            id: "ADV-2024-04",
            title: "Improper Authorization in Cloud API Gateway",
            cvss: 8.8,
            severity: "High",
            vendor: "Enterprise SaaS Platform",
            status: "Resolved & Disclosed",
            date: "2024-06-18",
            impact: "Missing parameter validation allowed cross-tenant metadata inspection via manipulated JWT claims."
        },
        {
            id: "ADV-2023-11",
            title: "Race Condition in Session Token Invalidation",
            cvss: 7.4,
            severity: "High",
            vendor: "FinTech Banking Portal",
            status: "Patched & Bounty Awarded",
            date: "2023-11-04",
            impact: "Concurrent logout calls failed to synchronize Redis revocation cache, permitting transient token reuse."
        },
        {
            id: "ADV-2023-08",
            title: "Reflected Cross-Site Scripting (XSS) in Reporting Filter",
            cvss: 6.1,
            severity: "Medium",
            vendor: "Healthcare Analytics Service",
            status: "Remediated",
            date: "2023-08-22",
            impact: "Unsanitized query parameters reflected in compliance export dialog."
        }
    ],

    mitreCoverage: [
        {
            tactic: "Reconnaissance",
            id: "TA0043",
            techniques: ["Active Scanning (T1595)", "Gather Victim Org Info (T1591)", "Search Open Technical Databases (T1596)"],
            readiness: "92% Preparedness",
            color: "#00f0ff"
        },
        {
            tactic: "Initial Access",
            id: "TA0001",
            techniques: ["Valid Accounts (T1078)", "Phishing Triage (T1566)", "External Remote Services (T1133)"],
            readiness: "96% Defense Coverage",
            color: "#00ff9d"
        },
        {
            tactic: "Persistence & PrivEsc",
            id: "TA0003/TA0004",
            techniques: ["Account Manipulation (T1098)", "Scheduled Task/Job (T1053)", "Abuse Elevation Control (T1548)"],
            readiness: "89% Audited Rules",
            color: "#ffb703"
        },
        {
            tactic: "Defense Evasion",
            id: "TA0005",
            techniques: ["Impair Defenses (T1562)", "Obfuscated Files (T1027)", "Indicator Removal (T1070)"],
            readiness: "94% Behavioral Detection",
            color: "#ff0055"
        }
    ],

    ctfChallenge: {
        title: "Mission 01: Decrypt The Recruiter Dispatch",
        cipherType: "Base64 Encoded & Rot13 Shifted",
        encodedString: "U0VDe1ByMHQwYzBsXzFuc3Aza3RfNGwxeF92NG5jM18yMDI2fQ==",
        plainFlag: "SEC{Pr0t0c0l_1nsp3kt_4l1x_v4nc3_2026}",
        secretMessage: "ACCESS GRANTED. Verification Hash confirmed! You have unlocked direct recruitment priority for Alex Vance. Email with subject '[CTF-SOLVED] Interview Invitation' for immediate 24h response time."
    }
};
