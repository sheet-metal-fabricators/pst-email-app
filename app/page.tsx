"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload, Search, Mail, Paperclip, ChevronDown, ChevronRight,
  Sparkles, Folder, X, ArrowLeft, FileText, Lightbulb,
  Loader2, AlertCircle, Table, Settings, Eye, EyeOff,
  Check, Shield,
} from "lucide-react";
import type { EmailData, SearchResult, ParsedPST } from "@/lib/types";

// ── Types ───────────────────────────────────────────────────────────

type Provider = "claude" | "chatgpt" | "gemini";

interface ProviderConfig {
  id: Provider;
  name: string;
  color: string;
  activeColor: string;
  borderColor: string;
  placeholder: string;
  helpUrl: string;
  helpLabel: string;
  prefix: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: "claude",
    name: "Claude",
    color: "text-amber-400",
    activeColor: "bg-amber-400/15 border-amber-400/40 text-amber-400",
    borderColor: "border-amber-400/40",
    placeholder: "sk-ant-api03-...",
    helpUrl: "https://console.anthropic.com/settings/keys",
    helpLabel: "How to get a Claude API key (2 min setup)",
    prefix: "sk-ant-",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    color: "text-emerald-400",
    activeColor: "bg-emerald-400/15 border-emerald-400/40 text-emerald-400",
    borderColor: "border-emerald-400/40",
    placeholder: "sk-proj-...",
    helpUrl: "https://platform.openai.com/api-keys",
    helpLabel: "How to get an OpenAI API key (2 min setup)",
    prefix: "sk-",
  },
  {
    id: "gemini",
    name: "Gemini",
    color: "text-blue-400",
    activeColor: "bg-blue-400/15 border-blue-400/40 text-blue-400",
    borderColor: "border-blue-400/40",
    placeholder: "AIzaSy...",
    helpUrl: "https://aistudio.google.com/app/apikey",
    helpLabel: "How to get a Gemini API key (2 min setup)",
    prefix: "AIza",
  },
];

// ── Local Storage helpers ───────────────────────────────────────────

function loadKeys(): Record<Provider, string> {
  if (typeof window === "undefined") return { claude: "", chatgpt: "", gemini: "" };
  try {
    const raw = localStorage.getItem("pst-intel-keys");
    return raw ? JSON.parse(raw) : { claude: "", chatgpt: "", gemini: "" };
  } catch {
    return { claude: "", chatgpt: "", gemini: "" };
  }
}

function saveKeys(keys: Record<Provider, string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem("pst-intel-keys", JSON.stringify(keys));
}

function loadProvider(): Provider {
  if (typeof window === "undefined") return "claude";
  return (localStorage.getItem("pst-intel-provider") as Provider) || "claude";
}

function saveProvider(p: Provider) {
  if (typeof window === "undefined") return;
  localStorage.setItem("pst-intel-provider", p);
}

// ── Sample data ─────────────────────────────────────────────────────

const SAMPLE_EMAILS: EmailData[] = [
  {
    subject: "Q3 Budget Approval — Final Numbers",
    sender: "Maria Chen",
    sender_email: "maria.chen@acme.com",
    recipients: ["team-leads@acme.com", "cfo@acme.com"],
    date: "2025-03-15T09:30:00",
    body: "Hi Team,\n\nAttached is the final Q3 budget breakdown. Key highlights:\n\n- Total approved budget: $2.4M (up 12% from Q2)\n- Engineering allocation: $1.1M including new cloud infrastructure costs\n- Marketing: $450K with $200K earmarked for the product launch campaign\n- Operations: $350K, includes new office lease in Austin\n- R&D reserve: $500K for the AI initiative\n\nPlease review the line items for your departments by Friday. Any variances over 5% from the preliminary numbers need justification memos.\n\nThe board presentation is scheduled for March 22nd. I'll need department summaries by March 19th.\n\nBest,\nMaria",
    folder: "Inbox/Finance",
    attachments: [{ name: "Q3_Budget_Final.xlsx", size: 245000 }],
    has_attachments: true,
  },
  {
    subject: "RE: Customer Escalation — Pinnacle Systems",
    sender: "James Rodriguez",
    sender_email: "j.rodriguez@acme.com",
    recipients: ["support-leads@acme.com"],
    date: "2025-03-14T16:45:00",
    body: "Update on the Pinnacle Systems situation:\n\nI spoke with their CTO, David Park, this morning. The core issue is that their API integration has been dropping connections intermittently since our v3.2 update last Tuesday. They're seeing roughly 15% failure rate on batch operations.\n\nTheir contract is up for renewal in April ($380K ARR) and David made it clear this needs resolution before they'll sign.\n\nI've looped in Sarah from Engineering. She identified a race condition in the connection pooling module. Fix is being tested now — ETA for patch: Thursday EOD.\n\nI've offered them:\n1. Dedicated support engineer through the resolution\n2. 2-month credit on their next invoice\n3. Priority access to our beta reliability dashboard\n\nDavid seemed receptive but wants written confirmation of the credit. Can someone from Finance draft that letter?\n\n— James",
    folder: "Inbox/Support",
    attachments: [],
    has_attachments: false,
  },
  {
    subject: "New Hire Onboarding — Week of March 17",
    sender: "Priya Sharma",
    sender_email: "priya.sharma@acme.com",
    recipients: ["hr@acme.com", "it@acme.com"],
    date: "2025-03-13T11:00:00",
    body: "Hello everyone,\n\nWe have 4 new team members starting next week:\n\n1. Alex Kim — Senior Backend Engineer (Sarah's team)\n   - Start date: Monday March 17\n   - Needs: Dev laptop (MacBook Pro M3), GitHub access, AWS IAM credentials\n\n2. Rachel Torres — Product Designer\n   - Start date: Monday March 17\n   - Needs: Design laptop, Figma Enterprise license\n\n3. Tom Weber — Sales Development Rep\n   - Start date: Tuesday March 18\n   - Needs: Standard laptop, Salesforce access\n\n4. Aisha Okonkwo — Data Scientist\n   - Start date: Wednesday March 19\n   - Needs: GPU workstation, Jupyter Hub access\n\nIT: Please have equipment ready by 8 AM on respective start dates.\n\nThanks,\nPriya",
    folder: "Inbox/HR",
    attachments: [{ name: "Orientation_Schedule_Mar17.pdf", size: 156000 }],
    has_attachments: true,
  },
  {
    subject: "Competitive Intel — Nexus Corp Product Launch",
    sender: "Daniel Okafor",
    sender_email: "d.okafor@acme.com",
    recipients: ["product@acme.com", "exec-team@acme.com"],
    date: "2025-03-12T14:20:00",
    body: "Team,\n\nNexus Corp announced their new platform 'Nexus Flow' yesterday. Analysis:\n\nWhat they launched:\n- Real-time collaboration engine (similar to our Q4 roadmap item)\n- AI-powered workflow automation\n- $99/user/month vs our $79\n\nStrengths: polished UI, partnered with 3 consulting firms\nWeaknesses: No API, English only, 50-seat minimum\n\nImplications: accelerate our collab features, lean on multilingual advantage\n\nDaniel",
    folder: "Inbox/Strategy",
    attachments: [{ name: "Nexus_Flow_Teardown.pdf", size: 2100000 }],
    has_attachments: true,
  },
  {
    subject: "RE: RE: Office Lease Negotiation — Austin",
    sender: "Lisa Tanaka",
    sender_email: "l.tanaka@acme.com",
    recipients: ["maria.chen@acme.com", "legal@acme.com"],
    date: "2025-03-11T10:15:00",
    body: "Maria,\n\nAustin lease update — landlord counter-offer:\n- 5-year term (we asked 3)\n- $42/sqft (down from $48, we offered $38)\n- 6 months free rent\n- TI allowance: $35/sqft (we asked $50)\n\nMarket is soft — 18% vacancy. I recommend pushing for 3+2 structure at $40/sqft.\n\nSpace: 8,500 sqft, 12th floor, great light, fits 60 people.\n\nLisa",
    folder: "Sent Items/Operations",
    attachments: [{ name: "Austin_Lease_Terms_v3.docx", size: 89000 }],
    has_attachments: true,
  },
  {
    subject: "Weekly Engineering Standup Notes — March 10",
    sender: "Sarah Kim",
    sender_email: "sarah.kim@acme.com",
    recipients: ["engineering-all@acme.com"],
    date: "2025-03-10T17:00:00",
    body: "Sprint 14 — Day 8 of 10:\n- Auth migration: 85% done\n- Mobile v4.1: on TestFlight, 2 P2 bugs (iPad layout, push delay)\n- API v3.2 hotfix: race condition fix in QA\n- Data pipeline: Spark jobs 3x faster than legacy\n\nBlockers: need staging env for auth, waiting on legal for analytics SDK, GPU cluster at capacity\n\nUpcoming: Sprint demo Friday 2 PM, planning Monday 10 AM, tech debt week March 24\n\nSarah",
    folder: "Inbox/Engineering",
    attachments: [],
    has_attachments: false,
  },
];

// ── Helpers ─────────────────────────────────────────────────────────

function formatDate(d: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
    });
  } catch { return d; }
}

function formatSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

// ── API Key Settings Panel ──────────────────────────────────────────

function ApiKeySettings({
  isOpen,
  onClose,
  provider,
  setProvider,
  keys,
  setKeys,
}: {
  isOpen: boolean;
  onClose: () => void;
  provider: Provider;
  setProvider: (p: Provider) => void;
  keys: Record<Provider, string>;
  setKeys: (k: Record<Provider, string>) => void;
}) {
  const [showKey, setShowKey] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [justSaved, setJustSaved] = useState<Provider | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const cfg = PROVIDERS.find((p) => p.id === provider)!;

  // Sync input when provider changes
  useEffect(() => {
    setInputVal(keys[provider] || "");
    setShowKey(false);
    setHelpOpen(false);
  }, [provider, keys]);

  const handleSave = () => {
    const updated = { ...keys, [provider]: inputVal.trim() };
    setKeys(updated);
    saveKeys(updated);
    setJustSaved(provider);
    setTimeout(() => setJustSaved(null), 2000);
  };

  const handleClear = () => {
    const updated = { ...keys, [provider]: "" };
    setKeys(updated);
    saveKeys(updated);
    setInputVal("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl border border-ink-700/50 bg-ink-950 shadow-2xl animate-fade-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-800/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
              <Settings size={16} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-ink-100 font-semibold text-sm">AI Model & API Key</h2>
              <p className="text-ink-500 text-xs mt-0.5">
                Choose your preferred AI model. Each uses its own API key — your keys are saved securely in this browser only.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-600 hover:text-ink-300 transition-colors p-1">
            <X size={16} />
          </button>
        </div>

        {/* Provider tabs */}
        <div className="px-6 pt-5 pb-0">
          <div className="flex gap-2">
            {PROVIDERS.map((p) => {
              const isActive = provider === p.id;
              const hasKey = !!keys[p.id];
              return (
                <button
                  key={p.id}
                  onClick={() => { setProvider(p.id); saveProvider(p.id); }}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all
                    ${isActive
                      ? p.activeColor
                      : "border-ink-800/50 bg-ink-900/30 text-ink-400 hover:border-ink-700 hover:text-ink-300"
                    }
                  `}
                >
                  <span className={`w-2 h-2 rounded-full ${isActive ? "bg-current" : "bg-ink-700"}`} />
                  {p.name}
                  {hasKey && <Check size={12} className="opacity-70" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Key input */}
        <div className="px-6 py-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className={`flex-1 flex items-center rounded-lg border ${keys[provider] && justSaved === provider ? cfg.borderColor : "border-ink-700/50"} bg-ink-900/60 transition-all`}>
              <input
                type={showKey ? "text" : "password"}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder={cfg.placeholder}
                className="flex-1 bg-transparent border-none text-ink-200 text-sm font-mono px-4 py-3 placeholder:text-ink-700 focus:outline-none"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
              <button onClick={() => setShowKey(!showKey)} className="px-3 text-ink-600 hover:text-ink-400 transition-colors">
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Save / status */}
            <div className="w-20 text-right">
              {inputVal.trim() && inputVal.trim() !== keys[provider] ? (
                <button
                  onClick={handleSave}
                  className="px-3 py-2 rounded-lg bg-amber-400 text-ink-950 text-xs font-semibold hover:bg-amber-500 transition-all"
                >
                  Save
                </button>
              ) : keys[provider] ? (
                <span className={`text-xs font-medium flex items-center gap-1 justify-end ${cfg.color}`}>
                  <Check size={12} /> Saved
                </span>
              ) : (
                <span className="text-ink-700 text-xs">Not set</span>
              )}
            </div>
          </div>

          {/* Clear key */}
          {keys[provider] && (
            <button onClick={handleClear} className="text-ink-600 text-xs hover:text-red-400 transition-colors">
              Remove saved key
            </button>
          )}

          {/* Help accordion */}
          <button
            onClick={() => setHelpOpen(!helpOpen)}
            className="flex items-center gap-2 text-sm text-amber-400/70 hover:text-amber-400 transition-colors w-full"
          >
            <ChevronRight size={14} className={`transition-transform ${helpOpen ? "rotate-90" : ""}`} />
            {cfg.helpLabel}
          </button>

          {helpOpen && (
            <div className="rounded-lg border border-ink-800/40 bg-ink-900/40 p-4 text-xs text-ink-400 space-y-2 animate-fade-up">
              <p>1. Go to <a href={cfg.helpUrl} target="_blank" rel="noopener noreferrer" className="text-amber-400 underline underline-offset-2">{cfg.helpUrl}</a></p>
              <p>2. Sign in or create a free account</p>
              <p>3. Click "Create new API key"</p>
              <p>4. Copy the key and paste it above</p>
            </div>
          )}
        </div>

        {/* Security note */}
        <div className="px-6 pb-5">
          <div className="flex items-start gap-2 rounded-lg bg-ink-900/40 border border-ink-800/30 px-4 py-3">
            <Shield size={14} className="text-ink-600 mt-0.5 flex-shrink-0" />
            <p className="text-ink-600 text-xs leading-relaxed">
              Your API key is stored in your browser's local storage only. It is sent to our server-side API route for processing but is never logged or stored on the server.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Upload View ─────────────────────────────────────────────────────

function UploadView({ onLoad }: { onLoad: (emails: EmailData[], name: string) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    setError("");

    if (!file.name.toLowerCase().endsWith(".json")) {
      setError("Please upload a .json file extracted from your PST");
      return;
    }

    setLoading(true);
    try {
      const text = await file.text();
      const data: ParsedPST | EmailData[] = JSON.parse(text);
      const emailList = Array.isArray(data) ? data : data.emails;
      if (!Array.isArray(emailList) || emailList.length === 0) throw new Error("No emails found in JSON file");
      onLoad(emailList, file.name);
    } catch (e: any) {
      setError(e.message || "Failed to parse file");
    } finally {
      setLoading(false);
    }
  }, [onLoad]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-6">
      <div className="text-center mb-12 animate-fade-up">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-ink-700/50 bg-ink-900/50 text-ink-400 text-xs font-medium tracking-wide mb-6">
          <Sparkles size={12} className="text-amber-400" />
          AI-POWERED EMAIL INTELLIGENCE
        </div>
        <h1 className="font-display text-5xl md:text-6xl text-ink-100 mb-4 leading-tight">
          Search your <em className="text-amber-400">Outlook</em> archive
        </h1>
        <p className="text-ink-400 text-lg max-w-lg mx-auto leading-relaxed">
          Upload extracted email data. Ask questions in natural language.
          Get instant answers powered by AI.
        </p>
      </div>

      <div
        className={`w-full max-w-xl rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer
          ${dragOver ? "border-amber-400/60 bg-amber-400/5 scale-[1.01]" : "border-ink-700/40 hover:border-ink-600/60 bg-ink-900/30"}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => !loading && fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept=".json" className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        <div className="flex flex-col items-center gap-4 py-16 px-8">
          {loading ? (
            <>
              <Loader2 size={40} className="text-amber-400 animate-spin" />
              <p className="text-ink-300 text-sm">Loading email data...</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-ink-800/60 border border-ink-700/40 flex items-center justify-center">
                <Upload size={24} className="text-ink-400" />
              </div>
              <div className="text-center">
                <p className="text-ink-200 font-medium">Drop your JSON file here</p>
                <p className="text-ink-500 text-sm mt-1">
                  Accepts <span className="text-amber-400/80 font-mono text-xs">.json</span> exported from pst_extractor.py
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 text-red-400/90 text-sm animate-fade-up">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div className="mt-6 animate-fade-up stagger-1">
        <button onClick={() => onLoad(SAMPLE_EMAILS, "sample-data.json")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-amber-400/20 bg-amber-400/5
                     text-amber-400 text-sm font-medium hover:bg-amber-400/10 transition-all">
          <Sparkles size={14} />
          Try with sample data (6 demo emails)
        </button>
      </div>

      <div className="mt-10 w-full max-w-xl animate-fade-up stagger-3">
        <div className="rounded-xl border border-ink-800/60 bg-ink-900/40 p-6">
          <h3 className="text-ink-300 text-sm font-semibold mb-3 flex items-center gap-2">
            <FileText size={14} className="text-amber-400/70" />
            How to extract your PST emails
          </h3>
          <div className="space-y-3 text-ink-500 text-sm leading-relaxed">
            <p><span className="text-ink-300 font-medium">1.</span> Download <code className="px-1.5 py-0.5 rounded bg-ink-800 text-amber-400/80 font-mono text-xs">pst_extractor.py</code> from the GitHub repo</p>
            <p><span className="text-ink-300 font-medium">2.</span> Install: <code className="px-1.5 py-0.5 rounded bg-ink-800 text-amber-400/80 font-mono text-xs">pip install pypff</code></p>
            <p><span className="text-ink-300 font-medium">3.</span> Run: <code className="px-1.5 py-0.5 rounded bg-ink-800 text-amber-400/80 font-mono text-xs">python3 pst_extractor.py your_mailbox.pst</code></p>
            <p><span className="text-ink-300 font-medium">4.</span> Upload the generated .json file above</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Search View ─────────────────────────────────────────────────────

function SearchView({
  emails, filename, onReset, provider, apiKey,
}: {
  emails: EmailData[];
  filename: string;
  onReset: () => void;
  provider: Provider;
  apiKey: string;
}) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState("");
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [showBrowser, setShowBrowser] = useState(false);

  const providerLabel = PROVIDERS.find((p) => p.id === provider)?.name || provider;

  const doSearch = async () => {
    if (!query.trim()) return;

    if (!apiKey) {
      setError("No API key set. Click the ⚙ icon in the top bar to add your key.");
      return;
    }

    setSearching(true);
    setError("");
    setResult(null);
    setExpandedIdx(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ query, emails, provider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const suggestions = [
    "Summarize all key decisions",
    "Find financial figures and amounts",
    "List all action items and deadlines",
    "Who are the main people involved?",
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 pb-24">
      {/* Session header */}
      <div className="flex items-center justify-between py-6 border-b border-ink-800/50 mb-8 animate-fade-up">
        <div className="flex items-center gap-3">
          <button onClick={onReset} className="text-ink-500 hover:text-ink-300 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-ink-200 font-medium text-sm">{filename}</h2>
            <p className="text-ink-500 text-xs mt-0.5">{emails.length} emails · Using {providerLabel}</p>
          </div>
        </div>
        <button onClick={() => setShowBrowser(!showBrowser)}
          className="flex items-center gap-1.5 text-xs text-ink-500 hover:text-amber-400 transition-colors">
          <Mail size={12} /> {showBrowser ? "Hide" : "Browse"} emails
        </button>
      </div>

      {/* Search bar */}
      <div className="animate-fade-up stagger-1">
        <div className="flex items-center gap-3 rounded-xl border border-ink-700/50 bg-ink-900/60 px-4 py-1 transition-all focus-within:border-amber-400/30">
          <Search size={18} className="text-ink-500 flex-shrink-0" />
          <input className="flex-1 bg-transparent border-none text-ink-100 text-[15px] font-body py-3 placeholder:text-ink-600"
            placeholder="Ask anything about your emails..."
            value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()} disabled={searching} />
          <button onClick={doSearch} disabled={searching || !query.trim()}
            className={`px-5 py-2 rounded-lg font-medium text-sm transition-all
              ${searching || !query.trim() ? "bg-ink-800 text-ink-600 cursor-not-allowed" : "bg-amber-400 text-ink-950 hover:bg-amber-500 active:scale-[0.97]"}`}>
            {searching ? <Loader2 size={16} className="animate-spin" /> : "Search"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {suggestions.map((s) => (
            <button key={s} onClick={() => setQuery(s)}
              className="px-3 py-1.5 rounded-lg border border-ink-800/50 bg-ink-900/30 text-ink-500 text-xs hover:border-ink-700 hover:text-ink-300 transition-all">
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-6 flex items-center gap-2 px-4 py-3 rounded-lg border border-red-900/30 bg-red-950/20 text-red-400 text-sm animate-fade-up">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {searching && (
        <div className="flex flex-col items-center gap-4 py-20 animate-fade-up">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-ink-800 border-t-amber-400 animate-spin" />
            <Sparkles size={16} className="absolute inset-0 m-auto text-amber-400" />
          </div>
          <p className="text-ink-500 text-sm">Analyzing {emails.length} emails with {providerLabel}...</p>
        </div>
      )}

      {/* Results */}
      {result && !searching && (
        <div className="mt-8 space-y-6">
          <div className="rounded-xl border border-amber-400/15 bg-gradient-to-br from-amber-400/[0.04] to-transparent p-6 animate-fade-up">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb size={16} className="text-amber-400" />
              <span className="text-amber-400 text-xs font-semibold tracking-wider">AI ANSWER</span>
            </div>
            <p className="text-ink-200 leading-relaxed whitespace-pre-line">{result.answer}</p>
            {result.summary_table.length > 0 && (
              <div className="mt-5 rounded-lg overflow-hidden border border-ink-800/40">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-ink-900/60 border-b border-ink-800/40">
                  <Table size={12} className="text-ink-500" />
                  <span className="text-ink-400 text-xs font-medium">Extracted Data</span>
                </div>
                {result.summary_table.map((row, i) => (
                  <div key={i} className="flex justify-between px-4 py-2.5 border-b border-ink-800/20 last:border-0 text-sm">
                    <span className="text-ink-400">{row.label}</span>
                    <span className="text-ink-200 font-medium text-right">{row.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {result.relevant_emails.length > 0 && (
            <div className="animate-fade-up stagger-2">
              <h3 className="text-ink-500 text-xs font-semibold tracking-wider mb-3 flex items-center gap-2">
                <Mail size={12} /> SOURCE EMAILS ({result.relevant_emails.length})
              </h3>
              <div className="space-y-2">
                {result.relevant_emails.map((re, i) => {
                  const email = emails[re.index];
                  const isOpen = expandedIdx === re.index;
                  return (
                    <div key={i}
                      className={`rounded-lg border transition-all cursor-pointer
                        ${isOpen ? "border-amber-400/20 bg-ink-900/60" : "border-ink-800/40 bg-ink-900/30 hover:border-ink-700/50"}`}
                      onClick={() => setExpandedIdx(isOpen ? null : re.index)}>
                      <div className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          {isOpen ? <ChevronDown size={14} className="text-amber-400 mt-0.5 flex-shrink-0" /> : <ChevronRight size={14} className="text-ink-600 mt-0.5 flex-shrink-0" />}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-3">
                              <p className="text-ink-200 text-sm font-medium truncate">{re.subject}</p>
                              {email && <span className="text-ink-600 text-[10px] whitespace-nowrap">{formatDate(email.date)}</span>}
                            </div>
                            <p className="text-ink-500 text-xs mt-1">{re.relevance}</p>
                          </div>
                        </div>
                        {re.extracted_info && (
                          <div className="mt-2.5 ml-6 px-3 py-2 rounded-md bg-emerald-950/20 border border-emerald-800/20">
                            <span className="text-emerald-400/80 text-xs font-medium">Extracted: </span>
                            <span className="text-emerald-300/70 text-xs">{re.extracted_info}</span>
                          </div>
                        )}
                      </div>
                      {isOpen && email && (
                        <div className="border-t border-ink-800/30 px-4 py-4" onClick={(e) => e.stopPropagation()}>
                          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                            <span className="text-ink-500">From</span><span className="text-ink-300">{email.sender} ({email.sender_email})</span>
                            <span className="text-ink-500">To</span><span className="text-ink-300">{email.recipients?.join(", ") || "—"}</span>
                            <span className="text-ink-500">Date</span><span className="text-ink-300">{formatDate(email.date)}</span>
                            {email.folder && (<><span className="text-ink-500">Folder</span><span className="text-ink-300">{email.folder}</span></>)}
                            {email.has_attachments && (<><span className="text-ink-500">Attachments</span><span className="text-ink-300 flex items-center gap-1"><Paperclip size={10} />{email.attachments?.map((a) => `${a.name} (${formatSize(a.size)})`).join(", ")}</span></>)}
                          </div>
                          <pre className="mt-3 p-4 rounded-lg bg-ink-950/60 border border-ink-800/30 text-ink-300 text-xs font-mono leading-relaxed whitespace-pre-wrap max-h-80 overflow-auto">{email.body}</pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Browse emails */}
      {showBrowser && (
        <div className="mt-8 animate-fade-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-ink-500 text-xs font-semibold tracking-wider flex items-center gap-2"><Folder size={12} /> ALL EMAILS ({emails.length})</h3>
            <button onClick={() => setShowBrowser(false)} className="text-ink-600 hover:text-ink-400"><X size={14} /></button>
          </div>
          <div className="space-y-1.5 max-h-[60vh] overflow-auto pr-1">
            {emails.map((e, i) => {
              const isOpen = expandedIdx === i;
              return (
                <div key={i}
                  className={`rounded-lg border transition-all cursor-pointer
                    ${isOpen ? "border-amber-400/20 bg-ink-900/60" : "border-ink-800/30 bg-ink-900/20 hover:border-ink-700/40"}`}
                  onClick={() => setExpandedIdx(isOpen ? null : i)}>
                  <div className="flex items-start gap-3 px-4 py-3">
                    <Mail size={14} className="text-ink-600 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-ink-300 text-sm font-medium truncate">{e.subject}</span>
                        <span className="text-ink-600 text-[10px] whitespace-nowrap">{formatDate(e.date)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-ink-500 text-xs">{e.sender}</span>
                        {e.has_attachments && <Paperclip size={9} className="text-ink-600" />}
                      </div>
                      <p className="text-ink-600 text-xs mt-1 truncate">{(e.body || "").substring(0, 120)}...</p>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="border-t border-ink-800/30 px-4 py-4" onClick={(ev) => ev.stopPropagation()}>
                      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                        <span className="text-ink-500">From</span><span className="text-ink-300">{e.sender} ({e.sender_email})</span>
                        <span className="text-ink-500">To</span><span className="text-ink-300">{e.recipients?.join(", ") || "—"}</span>
                        <span className="text-ink-500">Date</span><span className="text-ink-300">{formatDate(e.date)}</span>
                        {e.folder && (<><span className="text-ink-500">Folder</span><span className="text-ink-300">{e.folder}</span></>)}
                        {e.has_attachments && (<><span className="text-ink-500">Attachments</span><span className="text-ink-300 flex items-center gap-1"><Paperclip size={10} />{e.attachments?.map((a) => `${a.name} (${formatSize(a.size)})`).join(", ")}</span></>)}
                      </div>
                      <pre className="mt-3 p-4 rounded-lg bg-ink-950/60 border border-ink-800/30 text-ink-300 text-xs font-mono leading-relaxed whitespace-pre-wrap max-h-80 overflow-auto">{e.body}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !searching && !showBrowser && (
        <div className="flex flex-col items-center py-20 text-center animate-fade-up stagger-3">
          <div className="w-20 h-20 rounded-full bg-ink-900/50 border border-ink-800/40 flex items-center justify-center mb-4">
            <Search size={28} className="text-ink-700" />
          </div>
          <p className="text-ink-500 text-sm">Ask a question about your {emails.length} emails</p>
          <p className="text-ink-700 text-xs mt-1">Try the suggestion chips above to get started</p>
        </div>
      )}
    </div>
  );
}

// ── App Root ────────────────────────────────────────────────────────

export default function Home() {
  const [emails, setEmails] = useState<EmailData[] | null>(null);
  const [filename, setFilename] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [provider, setProvider] = useState<Provider>("claude");
  const [keys, setKeys] = useState<Record<Provider, string>>({ claude: "", chatgpt: "", gemini: "" });

  // Load persisted settings on mount
  useEffect(() => {
    setProvider(loadProvider());
    setKeys(loadKeys());
  }, []);

  const activeKey = keys[provider] || "";
  const providerCfg = PROVIDERS.find((p) => p.id === provider)!;

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-ink-800/30 bg-ink-950/70 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
              <Mail size={14} className="text-amber-400" />
            </div>
            <span className="font-display text-lg text-ink-200">PST Intelligence</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Active provider indicator */}
            <span className={`text-xs font-medium flex items-center gap-1.5 ${providerCfg.color}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {providerCfg.name}
              {activeKey ? <Check size={10} /> : null}
            </span>
            {/* Settings button */}
            <button
              onClick={() => setSettingsOpen(true)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all
                ${activeKey
                  ? "bg-ink-800/40 text-ink-400 hover:text-ink-200"
                  : "bg-amber-400/10 text-amber-400 border border-amber-400/30 animate-pulse"
                }`}
              title="AI Settings & API Key"
            >
              <Settings size={14} />
            </button>
          </div>
        </div>
      </nav>

      {/* Settings Modal */}
      <ApiKeySettings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        provider={provider}
        setProvider={setProvider}
        keys={keys}
        setKeys={setKeys}
      />

      {/* Content */}
      {emails ? (
        <SearchView
          emails={emails}
          filename={filename}
          onReset={() => { setEmails(null); setFilename(""); }}
          provider={provider}
          apiKey={activeKey}
        />
      ) : (
        <UploadView onLoad={(data, name) => { setEmails(data); setFilename(name); }} />
      )}
    </div>
  );
}
