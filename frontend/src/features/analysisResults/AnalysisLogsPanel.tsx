import type { AnalysisLogRead } from "../../shared/types/api";
import { TerminalLog } from "../../shared/ui/TerminalLog";

interface AnalysisLogsPanelProps {
  logs: AnalysisLogRead[];
}

export function AnalysisLogsPanel({ logs }: AnalysisLogsPanelProps) {
  return (
    <div className="analysis-logs-panel">
      <TerminalLog
        logs={logs}
        emptyText="Технические логи пока не получены. После запуска анализа здесь появится stdout, stderr и ошибки инструментов."
      />
    </div>
  );
}