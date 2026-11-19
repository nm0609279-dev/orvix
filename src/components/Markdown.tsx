"use client";

import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Icon from "./Icons";

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);
  const previewable = ["html", "svg"].includes(lang.toLowerCase()) && /<(html|body|svg|div|canvas|script)/i.test(code);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };
  const download = () => {
    const ext = lang.toLowerCase() === "svg" ? "svg" : lang.toLowerCase() === "html" ? "html" : lang || "txt";
    const blob = new Blob([code], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `orvix.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="code-block my-3 overflow-hidden rounded-2xl border border-line bg-soft text-fg">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5 text-xs text-muted">
        <span className="font-mono uppercase tracking-wide">{lang}</span>
        <div className="flex items-center gap-1">
          {previewable && (
            <button
              onClick={() => setPreview((p) => !p)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 transition hover:bg-hov hover:text-fg"
            >
              <Icon name={preview ? "code" : "play"} className="h-3.5 w-3.5" />
              {preview ? "Code" : "Preview"}
            </button>
          )}
          <button onClick={download} className="rounded-lg p-1.5 transition hover:bg-hov hover:text-fg" aria-label="Download">
            <Icon name="download" className="h-3.5 w-3.5" />
          </button>
          <button onClick={copy} className="flex items-center gap-1 rounded-lg px-2 py-1 transition hover:bg-hov hover:text-fg">
            <Icon name={copied ? "check" : "copy"} className="h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      {preview ? (
        <iframe
          title="preview"
          sandbox="allow-scripts"
          srcDoc={code}
          className="h-[min(70vh,520px)] w-full bg-white"
        />
      ) : (
        <pre>
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => {
            const text = String(children ?? "").replace(/\n$/, "");
            const m = /language-([\w+-]+)/.exec(className || "");
            if (m || text.includes("\n")) return <CodeBlock lang={m?.[1] || "text"} code={text} />;
            return <code className="inline-code">{children}</code>;
          },
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export default memo(Markdown);
