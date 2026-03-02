import { useState, useRef } from "react";

const ASPEN_BLUE = "#1B75BB";
const ASPEN_DARK = "#1a2332";

function extractJSON(text) {
  const clean = text.replace(/```json|```/g, "").trim();
  try { return JSON.parse(clean); }
  catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Could not parse response");
  }
}

async function readFileAsBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = () => rej(new Error("Read failed"));
    r.readAsDataURL(file);
  });
}

const EXTRACTION_PROMPT = `Extract all information from this CV/resume and return ONLY a valid JSON object. No markdown, no explanation, no fences — just raw JSON.

Structure:
{
  "name": "Full Name",
  "title": "Professional Title",
  "professionalSummary": "Max 5 sentences",
  "technicalSkills": [
    { "category": "Category", "skills": "Skill1, Skill2" }
  ],
  "workExperience": [
    {
      "role": "Job Title",
      "company": "Company",
      "period": "Month Year – Month Year",
      "bullets": ["Achievement 1", "Achievement 2"]
    }
  ],
  "additionalCareerHighlights": "One sentence about older jobs, or null",
  "additionalPeriod": "Date range string, or null",
  "education": "Degree – Institution",
  "certifications": ["Cert 1", "Cert 2"]
}

Rules:
- workExperience: only 2-3 most recent jobs, max 2 bullets each (max 20 words per bullet)
- All older jobs collapsed into additionalCareerHighlights
- If 3 or fewer total jobs, set additionalCareerHighlights and additionalPeriod to null
- Return ONLY the JSON object`;

async function extractCVData(file) {
  const name = file.name.toLowerCase();
  const isPDF = name.endsWith(".pdf");
  const isDocx = name.endsWith(".docx") || name.endsWith(".doc");
  if (!isPDF && !isDocx) throw new Error("Unsupported format. Please upload a PDF or DOCX file.");

  const base64 = await readFileAsBase64(file);
  const mediaType = isPDF
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: EXTRACTION_PROMPT }
        ]
      }]
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const text = data.content.map((c) => c.text || "").join("");
  return extractJSON(text);
}

function buildPrintHTML(data) {
  const bullet = (text) =>
    `<div style="font-size:11px;color:#444;padding-left:14px;margin-bottom:3px;position:relative;line-height:1.45;"><span style="position:absolute;left:0;top:2px;color:#1B75BB;font-size:9px;">●</span>${text}</div>`;

  const sectionTitle = (t) =>
    `<div style="font-size:10px;font-weight:bold;color:#1B75BB;letter-spacing:1px;text-transform:uppercase;border-bottom:1.5px solid #1B75BB;padding-bottom:3px;margin-bottom:9px;margin-top:15px;">${t}</div>`;

  const skillsHTML = (data.technicalSkills || []).map(s =>
    `<div style="margin-bottom:4px;font-size:11px;"><span style="font-weight:bold;color:#1a2332;">${s.category}: </span><span style="color:#444;">${s.skills}</span></div>`
  ).join("");

  const jobsHTML = (data.workExperience || []).map(j =>
    `<div style="margin-bottom:12px;">
      <div style="font-weight:bold;font-size:11px;color:#1a2332;">${j.role}, ${j.company}</div>
      <div style="font-size:10px;color:#888;font-style:italic;margin-bottom:3px;">${j.period}</div>
      ${(j.bullets || []).map(bullet).join("")}
    </div>`
  ).join("");

  const highlightHTML = data.additionalCareerHighlights
    ? `<div style="margin-bottom:12px;">
        <div style="font-weight:bold;font-size:11px;color:#1a2332;">Additional Career Highlights${data.additionalPeriod ? ` <span style="font-weight:normal;font-style:italic;color:#888;font-size:10px;">(${data.additionalPeriod})</span>` : ""}</div>
        ${bullet(data.additionalCareerHighlights)}
      </div>` : "";

  const certsHTML = (data.certifications || []).length > 0
    ? `<div style="font-size:11px;font-weight:bold;color:#1a2332;margin-bottom:4px;">Certifications:</div>${data.certifications.map(bullet).join("")}` : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${data.name || "CV"} – AspenView</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: A4; margin: 10mm; }
  .no-print { display: block; }
  @media print { .no-print { display: none !important; } }
</style>
</head>
<body>
<div class="no-print" style="background:#1a2332;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
  <span style="color:#7a9ab8;font-family:Arial,sans-serif;font-size:13px;">To save as PDF: <strong style="color:white;">Ctrl+P</strong> (Win) / <strong style="color:white;">Cmd+P</strong> (Mac) → Destination: <strong style="color:#1B75BB;">Save as PDF</strong></span>
  <button onclick="window.print()" style="background:#1B75BB;color:white;border:none;padding:8px 20px;border-radius:5px;font-size:13px;font-weight:bold;cursor:pointer;">🖨️ Print / Save as PDF</button>
</div>
<div style="max-width:780px;margin:0 auto;background:white;">
  <div style="padding:22px 36px 16px;border-bottom:3px solid #1B75BB;">
    <div style="font-size:11px;color:#1B75BB;font-weight:bold;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">ASPENVIEW | TECHNOLOGY PARTNERS</div>
    <div style="font-size:20px;font-weight:bold;color:#1a2332;">${data.name || ""}</div>
    <div style="font-size:13px;color:#1B75BB;font-weight:600;margin-top:2px;">${data.title || ""}</div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;">
    <div style="padding:18px 24px;border-right:1px solid #e8edf2;">
      <div style="font-size:10px;font-weight:bold;color:#1B75BB;letter-spacing:1px;text-transform:uppercase;border-bottom:1.5px solid #1B75BB;padding-bottom:3px;margin-bottom:9px;">TECHNICAL SKILLS</div>
      ${skillsHTML}
      ${sectionTitle("WORK EXPERIENCE")}
      ${jobsHTML}
      ${highlightHTML}
    </div>
    <div style="padding:18px 24px;">
      <div style="font-size:10px;font-weight:bold;color:#1B75BB;letter-spacing:1px;text-transform:uppercase;border-bottom:1.5px solid #1B75BB;padding-bottom:3px;margin-bottom:9px;">PROFESSIONAL SUMMARY</div>
      <p style="font-size:11px;color:#444;line-height:1.55;margin-bottom:14px;">${data.professionalSummary || ""}</p>
      ${sectionTitle("EDUCATION & CERTIFICATIONS")}
      <div style="font-size:11px;font-weight:bold;color:#1a2332;margin-bottom:5px;">${data.education || ""}</div>
      ${certsHTML}
    </div>
  </div>
  <div style="padding:8px 36px;background:#f8f9fb;border-top:1px solid #e8edf2;text-align:center;">
    <div style="font-size:9px;color:#999;font-style:italic;">ASPENVIEW TECHNOLOGY PARTNERS, INC. – CONFIDENTIAL – DO NOT DISCLOSE, COPY, OR DISTRIBUTE</div>
    <div style="font-size:11px;font-weight:bold;color:#1B75BB;margin-top:1px;">www.aspenview.com</div>
  </div>
</div>
</body>
</html>`;
}

function Sec({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: "bold", color: ASPEN_BLUE, letterSpacing: 1, textTransform: "uppercase", borderBottom: `1.5px solid ${ASPEN_BLUE}`, paddingBottom: 3, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function Bullet({ text }) {
  return (
    <div style={{ fontSize: 11, color: "#444", paddingLeft: 13, marginBottom: 2, position: "relative", lineHeight: 1.4 }}>
      <span style={{ position: "absolute", left: 0, color: ASPEN_BLUE, fontSize: 8, top: 3 }}>●</span>
      {text}
    </div>
  );
}

function CVCard({ data }) {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", background: "white", width: 780 }}>
      <div style={{ padding: "22px 36px 16px", borderBottom: `3px solid ${ASPEN_BLUE}` }}>
        <div style={{ fontSize: 11, color: ASPEN_BLUE, fontWeight: "bold", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>ASPENVIEW | TECHNOLOGY PARTNERS</div>
        <div style={{ fontSize: 20, fontWeight: "bold", color: ASPEN_DARK }}>{data.name}</div>
        <div style={{ fontSize: 13, color: ASPEN_BLUE, fontWeight: 600, marginTop: 2 }}>{data.title}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        <div style={{ padding: "18px 24px", borderRight: "1px solid #e8edf2" }}>
          <Sec title="TECHNICAL SKILLS">
            {(data.technicalSkills || []).map((s, i) => (
              <div key={i} style={{ marginBottom: 4, fontSize: 11 }}>
                <span style={{ fontWeight: "bold", color: ASPEN_DARK }}>{s.category}: </span>
                <span style={{ color: "#444" }}>{s.skills}</span>
              </div>
            ))}
          </Sec>
          <Sec title="WORK EXPERIENCE">
            {(data.workExperience || []).map((j, i) => (
              <div key={i} style={{ marginBottom: 11 }}>
                <div style={{ fontWeight: "bold", fontSize: 11, color: ASPEN_DARK }}>{j.role}, {j.company}</div>
                <div style={{ fontSize: 10, color: "#888", fontStyle: "italic", marginBottom: 3 }}>{j.period}</div>
                {(j.bullets || []).map((b, k) => <Bullet key={k} text={b} />)}
              </div>
            ))}
            {data.additionalCareerHighlights && (
              <div style={{ marginBottom: 11 }}>
                <div style={{ fontWeight: "bold", fontSize: 11, color: ASPEN_DARK }}>
                  Additional Career Highlights
                  {data.additionalPeriod && <span style={{ fontWeight: "normal", fontStyle: "italic", color: "#888", fontSize: 10 }}> ({data.additionalPeriod})</span>}
                </div>
                <Bullet text={data.additionalCareerHighlights} />
              </div>
            )}
          </Sec>
        </div>
        <div style={{ padding: "18px 24px" }}>
          <Sec title="PROFESSIONAL SUMMARY">
            <p style={{ fontSize: 11, color: "#444", lineHeight: 1.55, margin: 0 }}>{data.professionalSummary}</p>
          </Sec>
          <Sec title="EDUCATION & CERTIFICATIONS">
            <div style={{ fontSize: 11, fontWeight: "bold", color: ASPEN_DARK, marginBottom: 5 }}>{data.education}</div>
            {(data.certifications || []).length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: "bold", color: ASPEN_DARK, marginBottom: 4 }}>Certifications:</div>
                {data.certifications.map((c, i) => <Bullet key={i} text={c} />)}
              </>
            )}
          </Sec>
        </div>
      </div>
      <div style={{ padding: "8px 36px", background: "#f8f9fb", borderTop: "1px solid #e8edf2", textAlign: "center" }}>
        <div style={{ fontSize: 9, color: "#999", fontStyle: "italic" }}>ASPENVIEW TECHNOLOGY PARTNERS, INC. – CONFIDENTIAL – DO NOT DISCLOSE, COPY, OR DISTRIBUTE</div>
        <div style={{ fontSize: 11, fontWeight: "bold", color: ASPEN_BLUE, marginTop: 1 }}>www.aspenview.com</div>
      </div>
    </div>
  );
}

export default function App() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle");
  const [cvData, setCvData] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  const handleFile = (f) => {
    if (!f) return;
    const n = f.name.toLowerCase();
    if (!n.endsWith(".pdf") && !n.endsWith(".docx") && !n.endsWith(".doc")) {
      setError("Please upload a PDF or Word (.docx) file");
      return;
    }
    setFile(f);
    setStatus("idle");
    setCvData(null);
    setError(null);
  };

  const handleConvert = async () => {
    if (!file) return;
    setStatus("loading");
    setError(null);
    try {
      const data = await extractCVData(file);
      setCvData(data);
      setStatus("done");
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  };

  const handleOpenPrint = () => {
    if (!cvData) return;
    const html = buildPrintHTML(cvData);
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(145deg, #0d1b2a 0%, #1a3a5c 60%, #0d1b2a 100%)", fontFamily: "'Segoe UI', system-ui, sans-serif", padding: "36px 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ fontSize: 11, color: ASPEN_BLUE, letterSpacing: 3, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>ASPENVIEW TECHNOLOGY PARTNERS</div>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: "white", margin: "0 0 6px" }}>CV Formatter</h1>
        <p style={{ color: "#7a9ab8", fontSize: 13, margin: 0 }}>Transform any CV into the professional AspenView format</p>
      </div>

      <div style={{ maxWidth: 580, margin: "0 auto 28px" }}>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
          style={{ border: `2px dashed ${dragOver ? ASPEN_BLUE : file ? "#27ae60" : "#2d4a6b"}`, borderRadius: 10, padding: "36px 24px", textAlign: "center", cursor: "pointer", background: dragOver ? "rgba(27,117,187,0.08)" : "rgba(255,255,255,0.03)", transition: "all 0.2s" }}
        >
          <div style={{ fontSize: 36, marginBottom: 10 }}>{file ? "✅" : "📄"}</div>
          {file ? (
            <div>
              <div style={{ color: "#27ae60", fontWeight: 600, fontSize: 14 }}>{file.name}</div>
              <div style={{ color: "#7a9ab8", fontSize: 11, marginTop: 3 }}>{(file.size / 1024).toFixed(0)} KB · Click to change</div>
            </div>
          ) : (
            <div>
              <div style={{ color: "white", fontWeight: 600, fontSize: 14 }}>Drag a CV here or click to upload</div>
              <div style={{ color: "#7a9ab8", fontSize: 12, marginTop: 3 }}>PDF or Word (.docx) supported</div>
            </div>
          )}
        </div>
        <input ref={inputRef} type="file" accept=".pdf,.docx,.doc" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />

        {error && (
          <div style={{ background: "rgba(220,53,69,0.12)", border: "1px solid rgba(220,53,69,0.25)", borderRadius: 7, padding: "11px 14px", marginTop: 10, color: "#ff6b7a", fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handleConvert}
          disabled={!file || status === "loading"}
          style={{ width: "100%", marginTop: 14, padding: "13px 24px", background: (!file || status === "loading") ? "#243d56" : ASPEN_BLUE, color: (!file || status === "loading") ? "#4a6a84" : "white", border: "none", borderRadius: 7, fontSize: 14, fontWeight: 700, cursor: (!file || status === "loading") ? "not-allowed" : "pointer", transition: "all 0.2s" }}
        >
          {status === "loading" ? "⏳ Processing CV with AI..." : "🔄 Convert to AspenView Format"}
        </button>
      </div>

      {status === "done" && cvData && (
        <div style={{ maxWidth: 840, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <div style={{ color: "#27ae60", fontWeight: 600, fontSize: 13 }}>✅ CV successfully converted</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleOpenPrint}
                style={{ padding: "8px 18px", background: "#27ae60", color: "white", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                🖨️ Save as PDF
              </button>
              <button
                onClick={() => { setFile(null); setStatus("idle"); setCvData(null); setError(null); }}
                style={{ padding: "8px 14px", background: "transparent", color: "#7a9ab8", border: "1px solid #2d4a6b", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
              >
                New CV
              </button>
            </div>
          </div>
          <div style={{ overflowX: "auto", boxShadow: "0 4px 40px rgba(0,0,0,0.2)", borderRadius: 4 }}>
            <CVCard data={cvData} />
          </div>
          <div style={{ textAlign: "center", color: "#4a6a84", fontSize: 11, marginTop: 10 }}>
            💡 "Save as PDF" opens a print-ready page → Ctrl+P / Cmd+P → Destination: Save as PDF
          </div>
        </div>
      )}
    </div>
  );
}
