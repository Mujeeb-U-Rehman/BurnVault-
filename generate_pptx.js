const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");

// ── Icon helpers ──────────────────────────────────────────────────────────────
const {
  FaShieldAlt, FaKey, FaFire, FaLock, FaExchangeAlt,
  FaUserShield, FaBug, FaCheckCircle, FaServer, FaCode,
  FaEnvelope, FaFile, FaSearch, FaExclamationTriangle,
  FaChartLine, FaDatabase, FaWifi, FaCloudUploadAlt
} = require("react-icons/fa");

function renderIconSvg(IconComponent, color = "#000000", size = 256) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
}
async function iconPng(IconComponent, color, size = 256) {
  const svg = renderIconSvg(IconComponent, color, size);
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  navy:    "1B3A5C",   // headings, accents
  steel:   "2E6DA4",   // secondary accent
  dark:    "1E1E1E",   // body text
  mid:     "4A4A4A",   // sub-text
  light:   "F0F4F8",   // card backgrounds
  border:  "C8D8E8",   // table borders
  white:   "FFFFFF",
  green:   "1E6B3C",
  red:     "A61C00",
  amber:   "7B4F00",
  tag:     "E8F0F8",   // tag/badge fill
};

// ── Typography ────────────────────────────────────────────────────────────────
const TITLE_FONT = "Georgia";
const BODY_FONT  = "Calibri";

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeShadow = () => ({ type: "outer", blur: 5, offset: 2, angle: 135, color: "000000", opacity: 0.10 });

// Slide title bar (left navy rectangle + title text)
function addSlideHeader(slide, title, pres) {
  // left accent bar
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.45, y: 0.28, w: 0.07, h: 0.55,
    fill: { color: C.navy }, line: { color: C.navy, width: 0 }
  });
  slide.addText(title, {
    x: 0.60, y: 0.22, w: 9.0, h: 0.68,
    fontFace: TITLE_FONT, fontSize: 28, bold: true,
    color: C.navy, valign: "middle", align: "left", margin: 0
  });
  // thin full-width rule under header
  slide.addShape(pres.shapes.LINE, {
    x: 0.45, y: 0.88, w: 9.1, h: 0,
    line: { color: C.border, width: 0.8 }
  });
}

// Speaker notes
function addNotes(slide, notes) {
  slide.addNotes(notes);
}

// Bullet list helper
function makeBullets(items) {
  return items.map((item, i) => {
    const isLast = i === items.length - 1;
    if (typeof item === "string") {
      return { text: item, options: { bullet: true, breakLine: !isLast, paraSpaceAfter: 6, color: C.dark, fontSize: 15, fontFace: BODY_FONT } };
    }
    // [{bold, rest}]
    return {
      text: [
        { text: item.bold + ": ", options: { bold: true, color: C.navy } },
        { text: item.rest, options: { color: C.dark } }
      ],
      options: { bullet: true, breakLine: !isLast, paraSpaceAfter: 6, fontSize: 15, fontFace: BODY_FONT }
    };
  });
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function build() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.title  = "BurnVault — Zero-Knowledge Ephemeral Communication Platform";
  pres.author = "CY321 Project Team";

  // ── Pre-render icons ──────────────────────────────────────────────────────
  const [
    iShield, iKey, iFire, iLock, iExchange,
    iUserShield, iBug, iCheck, iServer, iCode,
    iEnvelope, iFile, iSearch, iWarn,
    iChart, iDatabase, iWifi
  ] = await Promise.all([
    iconPng(FaShieldAlt,         C.navy,  256),
    iconPng(FaKey,               C.navy,  256),
    iconPng(FaFire,              C.navy,  256),
    iconPng(FaLock,              C.navy,  256),
    iconPng(FaExchangeAlt,       C.navy,  256),
    iconPng(FaUserShield,        C.navy,  256),
    iconPng(FaBug,               C.red,   256),
    iconPng(FaCheckCircle,       C.green, 256),
    iconPng(FaServer,            C.navy,  256),
    iconPng(FaCode,              C.navy,  256),
    iconPng(FaEnvelope,          C.navy,  256),
    iconPng(FaFile,              C.navy,  256),
    iconPng(FaSearch,            C.navy,  256),
    iconPng(FaExclamationTriangle, "CC6600", 256),
    iconPng(FaChartLine,         C.navy,  256),
    iconPng(FaDatabase,          C.navy,  256),
    iconPng(FaWifi,              C.navy,  256),
  ]);

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 1 — Title
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.white };

    // top navy bar
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 10, h: 1.2,
      fill: { color: C.navy }, line: { color: C.navy, width: 0 }
    });
    // flame icon in navy bar
    s.addImage({ data: await iconPng(FaFire, C.white, 256), x: 0.4, y: 0.2, w: 0.78, h: 0.78 });
    s.addText("BurnVault", {
      x: 1.3, y: 0.12, w: 7.5, h: 1.0,
      fontFace: TITLE_FONT, fontSize: 44, bold: true,
      color: C.white, valign: "middle", align: "left", margin: 0
    });

    // tagline
    s.addText("Zero-Knowledge Ephemeral Communication Platform", {
      x: 0.5, y: 1.4, w: 9, h: 0.55,
      fontFace: BODY_FONT, fontSize: 18, italic: true,
      color: C.steel, align: "center"
    });

    // divider
    s.addShape(pres.shapes.LINE, {
      x: 1.5, y: 2.1, w: 7, h: 0,
      line: { color: C.border, width: 1 }
    });

    // info block
    const infoItems = [
      ["Student Name / ID", "[ Your Name · Student ID ]"],
      ["Course",            "Secure Software Development — CY321"],
      ["Institution",       "GIK Institute of Engineering Sciences and Technology"],
      ["Date",              "May 2026"],
    ];
    infoItems.forEach(([label, val], i) => {
      const y = 2.3 + i * 0.6;
      s.addText(label + ":", { x: 1.5, y, w: 2.8, h: 0.48, fontFace: BODY_FONT, fontSize: 13, bold: true, color: C.navy, valign: "middle", align: "right", margin: 0 });
      s.addText(val,           { x: 4.5, y, w: 5.0, h: 0.48, fontFace: BODY_FONT, fontSize: 13, color: C.dark,  valign: "middle", align: "left",  margin: 0 });
    });

    // bottom strip
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 5.27, w: 10, h: 0.35,
      fill: { color: C.light }, line: { color: C.border, width: 0 }
    });
    s.addText("Secure Software Development · CY321", {
      x: 0.3, y: 5.28, w: 9.4, h: 0.32,
      fontFace: BODY_FONT, fontSize: 10, color: C.mid, align: "center"
    });

    addNotes(s, "Introduce yourself and the project. BurnVault is a web-based platform designed for high-stakes communications where even the existence of a message must be deniable. Today's presentation covers the full design, implementation, and security analysis.");
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 2 — Agenda
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.white };
    addSlideHeader(s, "Agenda", pres);

    const items = [
      ["01", "Problem Statement",       "Why existing tools fall short"],
      ["02", "Solution Overview",       "BurnVault's core guarantees"],
      ["03", "Architecture & Stack",    "System components and design principles"],
      ["04", "Cryptographic Workflows", "Key management, messaging, file transfer"],
      ["05", "Threat Model (STRIDE)",   "Threats and mitigations"],
      ["06", "Security Testing",        "Tools, methodology, and results"],
      ["07", "Remediation Summary",     "Issues found and fixes applied"],
      ["08", "Conclusion",              "Security posture and future work"],
    ];

    const cols = 2;
    items.forEach(([num, title, sub], i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 0.45 + col * 4.8;
      const y = 1.05 + row * 1.08;

      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 4.55, h: 0.90,
        fill: { color: C.light }, line: { color: C.border, width: 0.5 },
        shadow: makeShadow()
      });
      // number badge
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 0.50, h: 0.90,
        fill: { color: C.navy }, line: { color: C.navy, width: 0 }
      });
      s.addText(num, { x: x + 0.01, y, w: 0.48, h: 0.90, fontFace: BODY_FONT, fontSize: 14, bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
      s.addText(title, { x: x + 0.60, y: y + 0.04, w: 3.85, h: 0.38, fontFace: BODY_FONT, fontSize: 14, bold: true, color: C.navy, valign: "middle", align: "left", margin: 0 });
      s.addText(sub,   { x: x + 0.60, y: y + 0.47, w: 3.85, h: 0.36, fontFace: BODY_FONT, fontSize: 11, color: C.mid,  valign: "top",    align: "left", margin: 0 });
    });

    addNotes(s, "Walk through the agenda briefly. The presentation is structured to take the panel from the problem space through the design, implementation, and security analysis findings.");
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 3 — Problem Statement
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.white };
    addSlideHeader(s, "Problem Statement", pres);

    // left column: the problem
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.45, y: 1.0, w: 4.45, h: 3.9,
      fill: { color: C.light }, line: { color: C.border, width: 0.5 }
    });
    s.addText("Existing Tools Fall Short", {
      x: 0.55, y: 1.05, w: 4.25, h: 0.48,
      fontFace: BODY_FONT, fontSize: 14, bold: true, color: C.navy, margin: 0
    });
    const problems = [
      "Retain server logs after message delivery",
      "Store plaintext or weakly encrypted data",
      "Preserve metadata (sender, timestamp, size)",
      "Require unconditional trust in a central operator",
      "Lack guaranteed post-read data destruction",
    ];
    s.addText(problems.map((p, i) => ({
      text: p, options: { bullet: true, breakLine: i < problems.length - 1, paraSpaceAfter: 8, fontSize: 13, fontFace: BODY_FONT, color: C.dark }
    })), { x: 0.55, y: 1.58, w: 4.25, h: 3.1 });

    // right column: the gap
    s.addShape(pres.shapes.RECTANGLE, {
      x: 5.1, y: 1.0, w: 4.45, h: 3.9,
      fill: { color: C.navy }, line: { color: C.navy, width: 0 }
    });
    s.addText("The Gap BurnVault Fills", {
      x: 5.2, y: 1.05, w: 4.25, h: 0.48,
      fontFace: BODY_FONT, fontSize: 14, bold: true, color: C.white, margin: 0
    });
    const gaps = [
      "Client-side encryption — server never sees plaintext",
      "Ephemeral volatile storage with strict TTL",
      "Guaranteed post-read data destruction (burn-on-read)",
      "Plausible deniability for high-stakes communications",
      "Zero third-party cryptographic library dependencies",
    ];
    s.addText(gaps.map((g, i) => ({
      text: g, options: { bullet: true, breakLine: i < gaps.length - 1, paraSpaceAfter: 8, fontSize: 13, fontFace: BODY_FONT, color: "CADCFC" }
    })), { x: 5.2, y: 1.58, w: 4.25, h: 3.1 });

    addNotes(s, "Explain that most commercial messaging tools — even those marketed as 'secure' — retain server-side metadata, trust a central operator, or lack guaranteed deletion. BurnVault was built specifically to eliminate every one of these gaps for whistleblowers, legal professionals, and high-security teams.");
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 4 — Solution Overview
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.white };
    addSlideHeader(s, "Solution Overview", pres);

    const cards = [
      { icon: iLock,       title: "End-to-End Encryption",   desc: "All encryption/decryption happens in the browser. The server only relays opaque ciphertexts." },
      { icon: iShield,     title: "Zero-Knowledge Server",   desc: "The server has no access to plaintext data, private keys, or decryption capabilities." },
      { icon: iFire,       title: "Burn-on-Read",            desc: "Messages and files are permanently deleted immediately upon retrieval — no residual data." },
      { icon: iDatabase,   title: "Ephemeral Storage",       desc: "Redis caches encrypted payloads with strict TTL. No persistent plaintext is ever written." },
    ];

    cards.forEach(({ icon, title, desc }, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.45 + col * 4.8;
      const y = 1.05 + row * 2.1;

      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 4.55, h: 1.9,
        fill: { color: C.white }, line: { color: C.border, width: 0.8 },
        shadow: makeShadow()
      });
      // left accent
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 0.07, h: 1.9,
        fill: { color: C.navy }, line: { color: C.navy, width: 0 }
      });
      s.addImage({ data: icon, x: x + 0.18, y: y + 0.55, w: 0.58, h: 0.58 });
      s.addText(title, { x: x + 0.85, y: y + 0.12, w: 3.55, h: 0.42, fontFace: BODY_FONT, fontSize: 14, bold: true, color: C.navy, margin: 0 });
      s.addText(desc,  { x: x + 0.85, y: y + 0.55, w: 3.55, h: 1.2,  fontFace: BODY_FONT, fontSize: 12, color: C.dark, margin: 0, wrap: true });
    });

    // target users tag
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.45, y: 5.12, w: 9.1, h: 0.38,
      fill: { color: C.tag }, line: { color: C.border, width: 0.5 }
    });
    s.addText("Target Audience:  Whistleblowers · Legal Professionals · High-Security Teams · Journalists", {
      x: 0.55, y: 5.13, w: 8.9, h: 0.36,
      fontFace: BODY_FONT, fontSize: 12, color: C.navy, valign: "middle", align: "center", margin: 0
    });

    addNotes(s, "Summarise the four core promises of BurnVault. Emphasise that the zero-knowledge property is not just a marketing claim — it is architecturally enforced by performing all cryptographic operations client-side. The server is structurally incapable of reading message content.");
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 5 — Architecture & Tech Stack
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.white };
    addSlideHeader(s, "System Architecture & Technology Stack", pres);

    // left column: tech stack
    const layers = [
      { label: "Frontend",      val: "Vanilla JS (ES6+), HTML5, Pure CSS", icon: iCode },
      { label: "Cryptography",  val: "Web Crypto API — AES-256-GCM · RSA-2048-OAEP · PBKDF2", icon: iKey },
      { label: "Backend",       val: "Python · Django · Django REST Framework", icon: iServer },
      { label: "Real-Time",     val: "Django Channels · WebSockets (WSS) · Redis", icon: iWifi },
      { label: "Database",      val: "PostgreSQL / SQLite — stores encrypted blobs only", icon: iDatabase },
    ];
    layers.forEach(({ label, val, icon }, i) => {
      const y = 1.05 + i * 0.87;
      s.addShape(pres.shapes.RECTANGLE, {
        x: 0.45, y, w: 5.2, h: 0.75,
        fill: { color: C.light }, line: { color: C.border, width: 0.5 }
      });
      s.addImage({ data: icon, x: 0.58, y: y + 0.14, w: 0.45, h: 0.45 });
      s.addText(label + ":", { x: 1.12, y: y + 0.04, w: 1.5, h: 0.36, fontFace: BODY_FONT, fontSize: 12, bold: true, color: C.navy, margin: 0 });
      s.addText(val,          { x: 1.12, y: y + 0.37, w: 4.4, h: 0.32, fontFace: BODY_FONT, fontSize: 11, color: C.dark, margin: 0 });
    });

    // right column: architecture diagram placeholder
    s.addShape(pres.shapes.RECTANGLE, {
      x: 5.85, y: 1.0, w: 3.7, h: 4.4,
      fill: { color: C.light }, line: { color: C.border, width: 0.8 }
    });
    s.addText("Architecture Diagram", {
      x: 5.95, y: 1.1, w: 3.5, h: 0.4,
      fontFace: BODY_FONT, fontSize: 12, bold: true, color: C.navy, align: "center", margin: 0
    });

    // simple text diagram inside placeholder
    const diagramSteps = [
      "[ Browser: Client A ]",
      "       ↓ AES-GCM ciphertext",
      "       ↓ RSA-wrapped key",
      "[ Django API + Channels ]",
      "    ↙           ↘",
      "[ Redis ]   [ PostgreSQL ]",
      "       ↓ Encrypted payload",
      "[ Browser: Client B ]",
    ];
    s.addText(diagramSteps.map((line, i) => ({
      text: line, options: { breakLine: i < diagramSteps.length - 1, fontSize: 10, fontFace: "Courier New", color: C.navy, paraSpaceAfter: 2 }
    })), { x: 5.95, y: 1.6, w: 3.5, h: 3.5, align: "center", valign: "top" });

    s.addText("[ Replace with architecture diagram image ]", {
      x: 5.95, y: 4.95, w: 3.5, h: 0.35,
      fontFace: BODY_FONT, fontSize: 9, color: "999999", align: "center", italic: true, margin: 0
    });

    addNotes(s, "Walk through the five technology layers from top to bottom. Key architectural principle: no third-party cryptographic libraries are used — the browser's native Web Crypto API handles all operations. Replace the placeholder on the right with your actual architecture diagram image before the presentation.");
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 6 — Key Management & Authentication
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.white };
    addSlideHeader(s, "Key Management & Authentication", pres);

    // Registration flow
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.45, y: 1.0, w: 4.45, h: 3.95,
      fill: { color: C.light }, line: { color: C.border, width: 0.5 }
    });
    s.addText("Registration & Key Generation", {
      x: 0.55, y: 1.05, w: 4.25, h: 0.38,
      fontFace: BODY_FONT, fontSize: 13, bold: true, color: C.navy, margin: 0
    });
    const regSteps = [
      "User submits username + password",
      "Browser generates RSA-2048-OAEP key pair",
      "Password → AES-GCM key via PBKDF2",
      "Private RSA key encrypted with AES key",
      "Server receives: public key + encrypted private key",
      "Server NEVER sees the plaintext private key",
    ];
    s.addText(regSteps.map((t, i) => ({
      text: t, options: {
        bullet: { type: "number" }, breakLine: i < regSteps.length - 1,
        paraSpaceAfter: 7, fontSize: 12, fontFace: BODY_FONT, color: C.dark
      }
    })), { x: 0.55, y: 1.5, w: 4.25, h: 3.2 });

    // Login flow
    s.addShape(pres.shapes.RECTANGLE, {
      x: 5.1, y: 1.0, w: 4.45, h: 3.95,
      fill: { color: C.light }, line: { color: C.border, width: 0.5 }
    });
    s.addText("Login & Key Recovery", {
      x: 5.2, y: 1.05, w: 4.25, h: 0.38,
      fontFace: BODY_FONT, fontSize: 13, bold: true, color: C.navy, margin: 0
    });
    const loginSteps = [
      "Server verifies credentials → returns JWT",
      "Server also returns user's encrypted private key",
      "Browser re-derives AES key from password (PBKDF2)",
      "Private key decrypted into browser memory only",
      "WebSocket connection opened, protected by JWT",
      "Key never persisted to disk or localStorage",
    ];
    s.addText(loginSteps.map((t, i) => ({
      text: t, options: {
        bullet: { type: "number" }, breakLine: i < loginSteps.length - 1,
        paraSpaceAfter: 7, fontSize: 12, fontFace: BODY_FONT, color: C.dark
      }
    })), { x: 5.2, y: 1.5, w: 4.25, h: 3.2 });

    addNotes(s, "This slide covers the two key workflows: registration (where keys are generated and the private key is wrapped before server storage) and login (where the key is unwrapped client-side and held only in browser memory). Emphasise that the server acts as a secure key escrow but is architecturally prevented from using the keys.");
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 7 — Messaging Workflow
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.white };
    addSlideHeader(s, "Encrypted Messaging Workflow", pres);

    // flow steps as numbered cards
    const steps = [
      { n: "1", title: "Fetch Recipient's Public Key", body: "Sender requests recipient's public RSA key from the server." },
      { n: "2", title: "Generate Ephemeral AES Key",   body: "Browser generates a random, single-use AES-256-GCM key and a unique random IV." },
      { n: "3", title: "Encrypt Message",              body: "Plaintext message is encrypted locally with the ephemeral AES key." },
      { n: "4", title: "Wrap Key with RSA",            body: "The ephemeral AES key is encrypted (wrapped) with the recipient's public RSA key." },
      { n: "5", title: "Send Ciphertext to Server",    body: "Ciphertext + wrapped AES key + IV are transmitted. Server sees only encrypted blobs." },
      { n: "6", title: "Recipient Decrypts",           body: "Recipient's private RSA key unwraps the AES key; AES key decrypts the message locally." },
    ];

    steps.forEach(({ n, title, body }, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.45 + col * 4.8;
      const y = 1.02 + row * 1.45;

      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 4.55, h: 1.3,
        fill: { color: C.white }, line: { color: C.border, width: 0.7 },
        shadow: makeShadow()
      });
      // number circle
      s.addShape(pres.shapes.OVAL, {
        x: x + 0.12, y: y + 0.3, w: 0.52, h: 0.52,
        fill: { color: C.navy }, line: { color: C.navy, width: 0 }
      });
      s.addText(n, { x: x + 0.12, y: y + 0.3, w: 0.52, h: 0.52, fontFace: BODY_FONT, fontSize: 14, bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
      s.addText(title, { x: x + 0.76, y: y + 0.06, w: 3.65, h: 0.38, fontFace: BODY_FONT, fontSize: 13, bold: true, color: C.navy, margin: 0 });
      s.addText(body,  { x: x + 0.76, y: y + 0.48, w: 3.65, h: 0.72, fontFace: BODY_FONT, fontSize: 11, color: C.dark, margin: 0, wrap: true });
    });

    // burn-on-read callout
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.45, y: 5.12, w: 9.1, h: 0.38,
      fill: { color: "FFF3CD" }, line: { color: "CC8800", width: 0.7 }
    });
    s.addText("🔥  Burn-on-Read: Immediately upon successful decryption, the server permanently deletes the database record.", {
      x: 0.55, y: 5.13, w: 8.9, h: 0.35,
      fontFace: BODY_FONT, fontSize: 11.5, color: "7B4F00", align: "center", valign: "middle", margin: 0
    });

    addNotes(s, "Walk through the six steps of the encrypted messaging workflow. The critical point is step 2: each message uses a fresh, random AES key — so even if one message's AES key were somehow compromised, it reveals nothing about any other message. The burn-on-read at step 6 ensures no ciphertext lingers on the server.");
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 8 — File Transfer Workflow
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.white };
    addSlideHeader(s, "Secure File Transfer Workflow", pres);

    const uploadSteps = [
      ["1", "Read File as ArrayBuffer",    "Browser reads the attached file into memory as raw binary."],
      ["2", "Generate AES-GCM Key",         "A unique AES-256-GCM key is generated for this file."],
      ["3", "Encrypt File Locally",         "The entire file is encrypted in the browser before upload."],
      ["4", "Wrap Key + Metadata",          "Filename, MIME type, and the AES key are encrypted with recipient's RSA public key."],
      ["5", "Upload Ciphertext",            "Encrypted file + encrypted metadata uploaded to server — no plaintext touches the wire."],
    ];
    const downloadSteps = [
      ["6", "Recipient Downloads Payload",  "Recipient fetches the encrypted file and encrypted metadata bundle."],
      ["7", "Decrypt Metadata & Key",       "Private RSA key unwraps the AES key; AES key decrypts filename and MIME type."],
      ["8", "Decrypt File & Trigger Save",  "File blob is decrypted locally and a browser download is triggered."],
      ["9", "Server Deletes Record & File", "Immediately after download: DB record deleted + physical file removed from disk."],
    ];

    // Upload column
    s.addText("Upload", { x: 0.45, y: 1.0, w: 4.55, h: 0.35, fontFace: BODY_FONT, fontSize: 13, bold: true, color: C.navy, margin: 0 });
    uploadSteps.forEach(([n, title, body], i) => {
      const y = 1.38 + i * 0.82;
      s.addShape(pres.shapes.RECTANGLE, { x: 0.45, y, w: 4.55, h: 0.72, fill: { color: C.light }, line: { color: C.border, width: 0.5 } });
      s.addText(n,     { x: 0.52, y, w: 0.4, h: 0.72, fontFace: BODY_FONT, fontSize: 13, bold: true, color: C.navy, align: "center", valign: "middle", margin: 0 });
      s.addText(title, { x: 0.98, y: y + 0.04, w: 3.9, h: 0.3, fontFace: BODY_FONT, fontSize: 12, bold: true, color: C.dark, margin: 0 });
      s.addText(body,  { x: 0.98, y: y + 0.36, w: 3.9, h: 0.3, fontFace: BODY_FONT, fontSize: 10, color: C.mid,  margin: 0 });
    });

    // Download column
    s.addText("Download", { x: 5.1, y: 1.0, w: 4.45, h: 0.35, fontFace: BODY_FONT, fontSize: 13, bold: true, color: C.navy, margin: 0 });
    downloadSteps.forEach(([n, title, body], i) => {
      const y = 1.38 + i * 0.82;
      const bg = n === "9" ? "FFF3CD" : C.light;
      const border = n === "9" ? "CC8800" : C.border;
      s.addShape(pres.shapes.RECTANGLE, { x: 5.1, y, w: 4.45, h: 0.72, fill: { color: bg }, line: { color: border, width: 0.5 } });
      s.addText(n,     { x: 5.18, y, w: 0.4, h: 0.72, fontFace: BODY_FONT, fontSize: 13, bold: true, color: C.navy, align: "center", valign: "middle", margin: 0 });
      s.addText(title, { x: 5.62, y: y + 0.04, w: 3.8, h: 0.3, fontFace: BODY_FONT, fontSize: 12, bold: true, color: n === "9" ? "7B4F00" : C.dark, margin: 0 });
      s.addText(body,  { x: 5.62, y: y + 0.36, w: 3.8, h: 0.3, fontFace: BODY_FONT, fontSize: 10, color: n === "9" ? "7B4F00" : C.mid, margin: 0 });
    });

    addNotes(s, "The file transfer follows the same zero-knowledge pattern as messaging: the server only ever stores an encrypted blob it cannot interpret. Step 9 is the destroy-after-download guarantee — both the database record and the physical file on disk are deleted immediately, leaving zero residual data.");
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 9 — Threat Model (STRIDE)
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.white };
    addSlideHeader(s, "Threat Model — STRIDE Analysis", pres);

    // STRIDE table
    const headers = ["STRIDE Threat", "Attack Vector", "Mitigation"];
    const rows = [
      ["Spoofing",              "Impersonation of a legitimate user",          "JWT authentication + TOTP 2FA"],
      ["Tampering",             "Modification of data in transit or at rest",  "AES-256-GCM authenticated encryption (integrity built-in)"],
      ["Repudiation",           "Denial of actions performed",                 "JWT tokens bind every API action to an authenticated identity"],
      ["Information Disclosure","Unauthorised access to message content",       "Zero-knowledge server; encrypted storage; ephemeral keys"],
      ["Denial of Service",     "Flooding API endpoints or WebSocket pool",    "API rate limiting; Redis connection throttling"],
      ["Elevation of Privilege","Accessing another user's messages",           "Django object-level permissions; strict ownership checks"],
    ];

    const strideColors = ["1B3A5C","1C5E8A","2E6DA4","1B3A5C","1C5E8A","2E6DA4"];

    // header row
    const colW = [1.9, 3.2, 3.6];
    const startX = [0.45, 2.35, 5.55];
    const headerHeight = 0.45;
    const rowHeight = 0.68;
    const startY = 1.0;

    headers.forEach((h, col) => {
      s.addShape(pres.shapes.RECTANGLE, {
        x: startX[col], y: startY, w: colW[col], h: headerHeight,
        fill: { color: C.navy }, line: { color: C.navy, width: 0 }
      });
      s.addText(h, { x: startX[col] + 0.05, y: startY, w: colW[col] - 0.1, h: headerHeight, fontFace: BODY_FONT, fontSize: 12, bold: true, color: C.white, valign: "middle", align: "left", margin: 0 });
    });

    rows.forEach((row, r) => {
      const y = startY + headerHeight + r * rowHeight;
      const bg = r % 2 === 0 ? C.light : C.white;
      row.forEach((cell, col) => {
        s.addShape(pres.shapes.RECTANGLE, {
          x: startX[col], y, w: colW[col], h: rowHeight,
          fill: { color: col === 0 ? "E8F0F8" : bg }, line: { color: C.border, width: 0.4 }
        });
        s.addText(cell, {
          x: startX[col] + 0.08, y: y + 0.05, w: colW[col] - 0.15, h: rowHeight - 0.1,
          fontFace: BODY_FONT, fontSize: col === 0 ? 12 : 11,
          bold: col === 0, color: col === 0 ? C.navy : C.dark,
          valign: "middle", margin: 0, wrap: true
        });
      });
    });

    addNotes(s, "Explain how the STRIDE framework was applied to BurnVault during threat modelling in Deliverable 1, and how each threat was addressed in the implementation. The zero-knowledge architecture and AES-256-GCM together handle the majority of STRIDE categories.");
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 10 — Security Testing Approach
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.white };
    addSlideHeader(s, "Security Testing Approach", pres);

    const tools = [
      { icon: iCode,   name: "Bandit",      type: "Static",  desc: "Python security linter — detects hardcoded secrets, insecure APIs, injection patterns." },
      { icon: iCode,   name: "Pylint",      type: "Static",  desc: "Code quality analysis — enforces secure coding standards and code maintainability." },
      { icon: iSearch, name: "Radon",       type: "Static",  desc: "Cyclomatic complexity grader — identifies overly complex functions prone to bugs." },
      { icon: iShield, name: "Safety",      type: "Static",  desc: "Dependency vulnerability scanner — checks requirements.txt against known CVE database." },
      { icon: iChart,  name: "Coverage.py", type: "Dynamic", desc: "Test coverage measurement — tracks which code paths are exercised by the test suite." },
      { icon: iBug,    name: "OWASP ZAP",   type: "Dynamic", desc: "Web application scanner — tests live endpoints against the OWASP Top 10." },
    ];

    const typeColors = { "Static": "1B3A5C", "Dynamic": "1C5E8A" };

    tools.forEach(({ icon, name, type, desc }, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.45 + col * 4.8;
      const y = 1.02 + row * 1.45;

      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 4.55, h: 1.3, fill: { color: C.white }, line: { color: C.border, width: 0.7 }, shadow: makeShadow()
      });
      s.addImage({ data: icon, x: x + 0.15, y: y + 0.37, w: 0.5, h: 0.5 });
      // type badge
      s.addShape(pres.shapes.RECTANGLE, {
        x: x + 3.3, y: y + 0.1, w: 1.1, h: 0.3,
        fill: { color: typeColors[type] }, line: { color: typeColors[type], width: 0 }
      });
      s.addText(type, { x: x + 3.3, y: y + 0.1, w: 1.1, h: 0.3, fontFace: BODY_FONT, fontSize: 10, bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
      s.addText(name, { x: x + 0.75, y: y + 0.1, w: 2.5, h: 0.4, fontFace: BODY_FONT, fontSize: 14, bold: true, color: C.navy, margin: 0 });
      s.addText(desc, { x: x + 0.75, y: y + 0.52, w: 3.65, h: 0.72, fontFace: BODY_FONT, fontSize: 11, color: C.dark, margin: 0, wrap: true });
    });

    addNotes(s, "We used a dual-phase testing approach: four static analysis tools on the source code, and two dynamic tools on the running application. This combination gives both pre-deployment and post-deployment coverage. Additionally, manual code review focused on the cryptographic implementation and ephemeral delete logic.");
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 11 — Static Analysis Results
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.white };
    addSlideHeader(s, "Static Analysis Results", pres);

    // Four result cards
    const results = [
      { tool: "Bandit",  color: C.green, icon: iCheck,
        finding: "1 LOW severity (B110 — bare except: pass)",
        detail: "0 HIGH, 0 MEDIUM issues. Confirms strong security patterns throughout the codebase." },
      { tool: "Pylint",  color: C.steel, icon: iChart,
        finding: "Score improved: 5.76 → 8.42 (+2.66)",
        detail: "Fixed unused imports, bare except clauses, and naming convention violations." },
      { tool: "Radon",   color: C.navy,  icon: iCode,
        finding: "All functions: Cyclomatic Grade A or B",
        detail: "All functions are simple and testable — no excessively complex logic paths." },
      { tool: "Safety",  color: C.green, icon: iShield,
        finding: "0 CVEs found in requirements.txt",
        detail: "All dependencies scanned. No known vulnerabilities in any third-party package." },
    ];

    results.forEach(({ tool, color, icon, finding, detail }, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.45 + col * 4.8;
      const y = 1.05 + row * 2.15;

      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 4.55, h: 2.0, fill: { color: C.white }, line: { color: C.border, width: 0.8 }, shadow: makeShadow()
      });
      // top colour bar
      s.addShape(pres.shapes.RECTANGLE, { x, y, w: 4.55, h: 0.45, fill: { color: color }, line: { color, width: 0 } });
      s.addText(tool, { x: x + 0.08, y, w: 3.5, h: 0.45, fontFace: BODY_FONT, fontSize: 14, bold: true, color: C.white, valign: "middle", margin: 0 });
      s.addImage({ data: icon, x: x + 4.0, y: y + 0.0, w: 0.45, h: 0.45 });
      s.addText(finding, { x: x + 0.1, y: y + 0.52, w: 4.3, h: 0.55, fontFace: BODY_FONT, fontSize: 13, bold: true, color: color, margin: 0, wrap: true });
      s.addText(detail,  { x: x + 0.1, y: y + 1.1,  w: 4.3, h: 0.82, fontFace: BODY_FONT, fontSize: 11, color: C.dark,  margin: 0, wrap: true });
    });

    s.addText("[ Add Bandit / Pylint screenshot images here ]", {
      x: 0.45, y: 5.1, w: 9.1, h: 0.35,
      fontFace: BODY_FONT, fontSize: 10, color: "999999", align: "center", italic: true, margin: 0
    });

    addNotes(s, "Highlight that Bandit found zero HIGH or MEDIUM issues — the single LOW-severity finding was a bare except clause that was subsequently fixed. The Pylint improvement of +2.66 points demonstrates that fixing security issues also improved overall code quality. All dependencies passed the Safety CVE scan.");
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 12 — Dynamic Analysis Results
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.white };
    addSlideHeader(s, "Dynamic Analysis Results", pres);

    // Coverage chart
    s.addText("Coverage.py — Test Coverage", {
      x: 0.45, y: 1.0, w: 4.5, h: 0.38, fontFace: BODY_FONT, fontSize: 13, bold: true, color: C.navy, margin: 0
    });
    s.addChart(pres.charts.BAR, [
      { name: "Coverage %", labels: ["Initial", "Final"], values: [54, 87] }
    ], {
      x: 0.45, y: 1.38, w: 4.55, h: 2.8,
      barDir: "col",
      chartColors: [C.border.replace("C8","A8"), C.navy],
      chartArea: { fill: { color: C.white }, roundedCorners: false },
      catAxisLabelColor: C.mid,
      valAxisLabelColor: C.mid,
      valGridLine: { color: "E2E8F0", size: 0.5 },
      catGridLine: { style: "none" },
      showValue: true,
      dataLabelColor: C.white,
      dataLabelFontSize: 14,
      dataLabelFontBold: true,
      showLegend: false,
      valAxisMaxVal: 100,
    });
    s.addText("+33 percentage points\nafter adding crypto utility & WebSocket handler tests", {
      x: 0.45, y: 4.25, w: 4.55, h: 0.6,
      fontFace: BODY_FONT, fontSize: 11, color: C.mid, align: "center", margin: 0
    });

    // ZAP results
    s.addText("OWASP ZAP — Web Application Scan", {
      x: 5.1, y: 1.0, w: 4.45, h: 0.38, fontFace: BODY_FONT, fontSize: 13, bold: true, color: C.navy, margin: 0
    });
    const zapFindings = [
      { level: "HIGH",   n: "0", color: "CC0000", bg: "FFF0F0", note: "No high-risk vulnerabilities detected" },
      { level: "MEDIUM", n: "2", color: "CC6600", bg: "FFF5E6", note: "Missing CSP header; missing X-Frame-Options → FIXED" },
      { level: "LOW",    n: "3", color: "888800", bg: "FFFFF0", note: "Information disclosure in error messages → FIXED" },
    ];
    zapFindings.forEach(({ level, n, color, bg, note }, i) => {
      const y = 1.45 + i * 1.1;
      s.addShape(pres.shapes.RECTANGLE, { x: 5.1, y, w: 4.45, h: 0.98, fill: { color: bg }, line: { color, width: 0.7 } });
      s.addText(n,     { x: 5.18, y, w: 0.7, h: 0.98, fontFace: BODY_FONT, fontSize: 36, bold: true, color, align: "center", valign: "middle", margin: 0 });
      s.addText(level, { x: 5.96, y: y + 0.08, w: 2.5, h: 0.38, fontFace: BODY_FONT, fontSize: 13, bold: true, color, margin: 0 });
      s.addText(note,  { x: 5.96, y: y + 0.50, w: 3.45, h: 0.4, fontFace: BODY_FONT, fontSize: 11, color: C.dark, margin: 0, wrap: true });
    });
    s.addText("[ Add ZAP alert summary screenshot here ]", {
      x: 5.1, y: 4.85, w: 4.45, h: 0.35,
      fontFace: BODY_FONT, fontSize: 10, color: "999999", align: "center", italic: true, margin: 0
    });

    addNotes(s, "Test coverage rose from 54% to 87% after adding targeted tests for the encryption utilities and WebSocket handlers — the two highest-risk areas. ZAP found zero high-risk issues. The two medium-risk findings (missing security headers) and three low-risk findings (verbose error messages) were all fixed before the final release.");
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 13 — Remediation Summary
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.white };
    addSlideHeader(s, "Remediation Summary", pres);

    const headers = ["Vulnerability", "Tool", "Risk", "Fix Applied", "Status"];
    const data = [
      ["Bare except: pass (silent error swallowing)", "Bandit", "LOW",    "Added logging; replaced with specific exception handlers", "✓ Fixed"],
      ["Missing Content-Security-Policy header",      "ZAP",    "MEDIUM", "Added strict CSP header in Django middleware settings",    "✓ Fixed"],
      ["Missing X-Frame-Options header",              "ZAP",    "MEDIUM", "Added X-Frame-Options: DENY to response headers",          "✓ Fixed"],
      ["Verbose error messages (info disclosure)",    "ZAP",    "LOW",    "Replaced specific error messages with generic handlers",   "✓ Fixed"],
      ["Pylint: unused imports & naming issues",      "Pylint", "LOW",    "Removed unused imports; fixed naming conventions",         "✓ Fixed"],
    ];

    const riskColor = { "HIGH":"CC0000","MEDIUM":"CC6600","LOW":"888800" };
    const colWidths = [2.5, 0.9, 0.85, 3.4, 0.9];
    const startX = [0.45, 2.95, 3.85, 4.70, 8.10];
    const hY = 1.0;

    headers.forEach((h, col) => {
      s.addShape(pres.shapes.RECTANGLE, {
        x: startX[col], y: hY, w: colWidths[col], h: 0.42,
        fill: { color: C.navy }, line: { color: C.navy, width: 0 }
      });
      s.addText(h, {
        x: startX[col] + 0.04, y: hY, w: colWidths[col] - 0.08, h: 0.42,
        fontFace: BODY_FONT, fontSize: 11, bold: true, color: C.white, valign: "middle", margin: 0
      });
    });

    data.forEach((row, r) => {
      const rowY = hY + 0.42 + r * 0.82;
      const bg = r % 2 === 0 ? C.light : C.white;
      row.forEach((cell, col) => {
        let cellColor = C.dark;
        let cellBold = false;
        if (col === 2) { cellColor = riskColor[cell] || C.dark; cellBold = true; }
        if (col === 4) { cellColor = C.green; cellBold = true; }

        s.addShape(pres.shapes.RECTANGLE, {
          x: startX[col], y: rowY, w: colWidths[col], h: 0.76,
          fill: { color: bg }, line: { color: C.border, width: 0.4 }
        });
        s.addText(cell, {
          x: startX[col] + 0.04, y: rowY + 0.04, w: colWidths[col] - 0.08, h: 0.70,
          fontFace: BODY_FONT, fontSize: col === 0 ? 11 : 11,
          bold: cellBold, color: cellColor, valign: "middle", margin: 0, wrap: true
        });
      });
    });

    s.addText("All identified vulnerabilities were remediated before the final release. No outstanding issues remain.", {
      x: 0.45, y: 5.12, w: 9.1, h: 0.35,
      fontFace: BODY_FONT, fontSize: 11.5, bold: true, color: C.green, align: "center", margin: 0
    });

    addNotes(s, "Walk through the remediation table row by row. Emphasise that every finding — regardless of severity — was addressed. The most important fixes were the missing security headers (CSP and X-Frame-Options), which were medium-risk and are trivial to exploit if left unpatched.");
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 14 — Conclusion & Security Posture
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.white };
    addSlideHeader(s, "Conclusion & Security Posture", pres);

    // Three column summary
    const cols3 = [
      { icon: iCheck,  title: "Zero-Knowledge Guarantee\nFully Realised",
        points: ["Server never processes plaintext", "All crypto in the browser (Web Crypto API)", "Private keys never leave client unencrypted", "PBKDF2 wrapping verified in code review"] },
      { icon: iShield, title: "Clean Security Test\nResults",
        points: ["0 HIGH severity issues (Bandit + ZAP)", "0 CVEs in any dependency (Safety)", "87% test coverage achieved", "All medium/low findings fixed"] },
      { icon: iKey,    title: "Future Work",
        points: ["Automated periodic dependency scans", "Third-party security audit", "TOTP 2FA UI refinements", "Formal threat model re-assessment"] },
    ];

    cols3.forEach(({ icon, title, points }, i) => {
      const x = 0.45 + i * 3.15;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: 1.0, w: 3.0, h: 4.5, fill: { color: C.light }, line: { color: C.border, width: 0.7 }, shadow: makeShadow()
      });
      // top navy cap
      s.addShape(pres.shapes.RECTANGLE, { x, y: 1.0, w: 3.0, h: 0.5, fill: { color: C.navy }, line: { color: C.navy, width: 0 } });
      s.addImage({ data: icon, x: x + 1.2, y: 1.04, w: 0.42, h: 0.42 });
      s.addText(title, { x: x + 0.08, y: 1.55, w: 2.85, h: 0.75, fontFace: BODY_FONT, fontSize: 13, bold: true, color: C.navy, align: "center", margin: 0, wrap: true });
      s.addText(points.map((p, pi) => ({
        text: p, options: { bullet: true, breakLine: pi < points.length - 1, paraSpaceAfter: 8, fontSize: 12, fontFace: BODY_FONT, color: C.dark }
      })), { x: x + 0.1, y: 2.35, w: 2.8, h: 2.9 });
    });

    s.addText("BurnVault successfully demonstrates that strong, zero-knowledge security is achievable using standard web APIs, without third-party cryptographic dependencies.", {
      x: 0.45, y: 5.13, w: 9.1, h: 0.38,
      fontFace: BODY_FONT, fontSize: 12, bold: true, color: C.navy, align: "center", margin: 0
    });

    addNotes(s, "Summarise BurnVault's final security posture across three dimensions: zero-knowledge guarantee, clean test results, and future work. The key takeaway for the panel is that zero critical vulnerabilities remain, the architecture enforces security by design rather than by configuration, and the project is production-ready for a university context.");
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SLIDE 15 — Q&A
  // ════════════════════════════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };

    s.addImage({ data: await iconPng(FaFire, C.white, 256), x: 4.3, y: 0.9, w: 1.4, h: 1.4 });

    s.addText("Thank You", {
      x: 0.5, y: 2.4, w: 9, h: 0.9,
      fontFace: TITLE_FONT, fontSize: 42, bold: true, color: C.white, align: "center"
    });
    s.addText("Questions?", {
      x: 0.5, y: 3.3, w: 9, h: 0.65,
      fontFace: BODY_FONT, fontSize: 26, italic: true, color: "CADCFC", align: "center"
    });

    s.addShape(pres.shapes.LINE, {
      x: 2.5, y: 4.05, w: 5, h: 0, line: { color: "CADCFC", width: 0.8 }
    });

    s.addText("BurnVault  ·  Secure Software Development — CY321  ·  May 2026", {
      x: 0.5, y: 4.2, w: 9, h: 0.4,
      fontFace: BODY_FONT, fontSize: 12, color: "8BAFD4", align: "center"
    });

    addNotes(s, "Open the floor to questions. Be ready to discuss the cryptographic key wrapping scheme, the burn-on-read implementation in Django views, and the OWASP ZAP remediation steps in detail.");
  }

  // ── Write file ──────────────────────────────────────────────────────────────
  await pres.writeFile({ fileName: "BurnVault_Presentation.pptx" });
  console.log("✅  Presentation written to BurnVault_Presentation.pptx");
}

build().catch(err => { console.error(err); process.exit(1); });
