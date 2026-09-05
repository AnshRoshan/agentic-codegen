"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, KeyRound, CheckCircle2, XCircle, Loader2, Sparkles } from "lucide-react";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

interface AiSettingsResponse {
  provider: "openai" | "azure" | "custom";
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  baseUrl: string | null;
  model: string | null;
  azureResourceName: string | null;
  azureApiVersion: string | null;
  isConfigured: boolean;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
}

const PROVIDER_INFO = {
  openai: {
    label: "OpenAI",
    desc: "Official OpenAI API — pass your OPENAI_API_KEY",
  },
  azure: {
    label: "Azure OpenAI",
    desc: "Azure-hosted OpenAI deployments with resource name + API version",
  },
  custom: {
    label: "OpenAI-Compatible",
    desc: "Any OpenAI-compatible endpoint: Groq, Together, OpenRouter, local LLMs (Ollama/LM Studio), etc.",
  },
};

export default function SettingsModal({ open, onClose, onSaved }: SettingsModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [provider, setProvider] = useState<"openai" | "azure" | "custom">("openai");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [azureResourceName, setAzureResourceName] = useState("");
  const [azureApiVersion, setAzureApiVersion] = useState("2025-01-01-preview");
  const [existing, setExisting] = useState<AiSettingsResponse | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/settings/ai")
      .then((r) => r.json())
      .then((data: AiSettingsResponse) => {
        setExisting(data);
        setProvider(data.provider ?? "openai");
        setBaseUrl(data.baseUrl ?? "");
        setModel(data.model ?? "gpt-4o-mini");
        setAzureResourceName(data.azureResourceName ?? "");
        setAzureApiVersion(data.azureApiVersion ?? "2025-01-01-preview");
        if (data.lastTestStatus) {
          setTestResult({
            success: data.lastTestStatus === "success",
            message: data.lastTestMessage ?? "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, [open]);

  // no early return — AnimatePresence handles enter/exit

  const currentConfig = () => ({
    provider,
    apiKey: apiKey || undefined,
    baseUrl: baseUrl || undefined,
    model,
    azureResourceName: azureResourceName || undefined,
    azureApiVersion: azureApiVersion || undefined,
  });

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentConfig()),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, message: "Network error while testing connection." });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentConfig()),
      });
      setApiKey("");
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    await fetch("/api/settings/ai", { method: "DELETE" });
    setApiKey("");
    setTestResult(null);
    onSaved?.();
  };

  return (
    <AnimatePresence>
      {open && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="glass-heavy border border-surface-700 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary-400" />
            <h2 className="text-xl font-bold text-surface-100">AI Provider Settings</h2>
          </div>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
          </div>
        ) : (
          <div className="p-6 space-y-5">
            <p className="text-sm text-surface-400">
              Connect Azure OpenAI or any OpenAI-compatible endpoint so agents generate{" "}
              <span className="text-surface-200">real, working code</span> instead of running in
              simulation mode. Keys are stored server-side only and never sent to the browser.
            </p>

            {existing?.isConfigured && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-900/20 border border-emerald-500/30 text-emerald-400 text-xs">
                <CheckCircle2 className="w-4 h-4" />
                A key is currently configured ({existing.apiKeyMasked}). Leave the field blank to
                keep it.
              </div>
            )}

            {/* Provider selector */}
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">Provider</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(PROVIDER_INFO) as Array<keyof typeof PROVIDER_INFO>).map((key) => (
                  <button
                    key={key}
                    onClick={() => setProvider(key)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      provider === key
                        ? "border-primary-500 bg-primary-500/10"
                        : "border-surface-700 bg-surface-800/50 hover:border-surface-600"
                    }`}
                  >
                    <p className="text-sm font-medium text-surface-100">
                      {PROVIDER_INFO[key].label}
                    </p>
                  </button>
                ))}
              </div>
              <p className="text-xs text-surface-500 mt-1.5">{PROVIDER_INFO[provider].desc}</p>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={existing?.hasApiKey ? "•••••••••••••••••••• (leave blank to keep)" : "sk-..."}
                className="w-full px-4 py-2.5 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 font-mono text-sm"
              />
            </div>

            {/* Model */}
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">
                {provider === "azure" ? "Deployment Name" : "Model"}
              </label>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={provider === "azure" ? "gpt-4o-mini-deployment" : "gpt-4o-mini"}
                className="w-full px-4 py-2.5 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 font-mono text-sm"
              />
            </div>

            {/* Provider-specific fields */}
            {provider === "azure" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">
                    Resource Name
                  </label>
                  <input
                    value={azureResourceName}
                    onChange={(e) => setAzureResourceName(e.target.value)}
                    placeholder="my-azure-resource"
                    className="w-full px-4 py-2.5 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">
                    API Version
                  </label>
                  <input
                    value={azureApiVersion}
                    onChange={(e) => setAzureApiVersion(e.target.value)}
                    placeholder="2025-01-01-preview"
                    className="w-full px-4 py-2.5 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 font-mono text-sm"
                  />
                </div>
              </div>
            )}

            {(provider === "custom" || provider === "azure") && (
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">
                  Base URL {provider === "azure" && "(optional — overrides resource name)"}
                </label>
                <input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder={
                    provider === "azure"
                      ? "https://your-resource.openai.azure.com/openai/deployments"
                      : "https://api.groq.com/openai/v1"
                  }
                  className="w-full px-4 py-2.5 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 font-mono text-sm"
                />
              </div>
            )}

            {/* Test result */}
            {testResult && (
              <div
                className={`flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs ${
                  testResult.success
                    ? "bg-emerald-900/20 border border-emerald-500/30 text-emerald-400"
                    : "bg-red-900/20 border border-red-500/30 text-red-400"
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Info box */}
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-surface-800/50 border border-surface-700 text-xs text-surface-400">
              <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
              <span>
                Without a configured provider, EDL runs in <strong>simulation mode</strong> —
                agents still progress through the pipeline but generate placeholder content
                instead of real code.
              </span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between gap-3 px-6 py-4 border-t border-surface-700">
          <button
            onClick={handleClear}
            className="px-4 py-2.5 text-sm rounded-lg text-red-400 hover:bg-red-900/20 transition-colors"
          >
            Clear Key
          </button>
          <div className="flex gap-3">
            <button
              onClick={handleTest}
              disabled={testing}
              className="px-4 py-2.5 text-sm rounded-lg bg-surface-800 border border-surface-700 text-surface-200 hover:bg-surface-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {testing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Test Connection
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 text-sm rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-500 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  );
}
