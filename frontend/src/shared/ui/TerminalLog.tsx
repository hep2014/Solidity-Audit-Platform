import { Terminal } from "lucide-react";
import type { AnalysisLogRead } from "../types/api";
import { formatDateTime, formatDurationMs } from "../utils/format";
import { Badge, statusTone } from "./Badge";

interface TerminalLogProps {
  logs: AnalysisLogRead[];
  emptyText?: string;
}

export function TerminalLog({
  logs,
  emptyText = "Логи пока не получены. После запуска анализа здесь появится вывод инструментов."
}: TerminalLogProps) {
  if (!logs.length) {
    return (
      <div className="terminal terminal-empty">
        <Terminal size={18} />
        <span>{emptyText}</span>
      </div>
    );
  }

  return (
    <div className="terminal">
      <div className="terminal-topbar">
        <div className="terminal-dots">
          <span />
          <span />
          <span />
        </div>
        <strong>analysis.log</strong>
      </div>

      <div className="terminal-body">
        {logs.map((log) => (
          <article key={log.id} className="terminal-entry">
            <header>
              <div>
                <strong>{log.tool}</strong>
                <span>
                  {formatDateTime(log.created_at)} · {formatDurationMs(log.duration_ms)}
                </span>
              </div>

              <Badge tone={statusTone(log.status)}>{log.status}</Badge>
            </header>

            {log.stdout && (
              <pre>
                <code>{log.stdout}</code>
              </pre>
            )}

            {log.stderr && (
              <pre className="terminal-stderr">
                <code>{log.stderr}</code>
              </pre>
            )}

            {log.error_message && (
              <pre className="terminal-error">
                <code>{log.error_message}</code>
              </pre>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}