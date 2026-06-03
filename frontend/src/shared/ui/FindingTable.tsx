import type { FindingRead } from "../types/api";
import { formatDateTime, stringifyJson } from "../utils/format";
import { getSeverityLabel } from "../utils/severity";
import { Badge, severityTone } from "./Badge";

interface FindingTableProps {
  findings: FindingRead[];
}

export function FindingTable({ findings }: FindingTableProps) {
  if (!findings.length) {
    return (
      <div className="empty-state">
        <strong>Findings не найдены</strong>
        <p>После завершения анализа здесь появится список обнаруженных проблем.</p>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <table className="audit-table">
        <thead>
          <tr>
            <th>Severity</th>
            <th>Rule</th>
            <th>Tool</th>
            <th>Location</th>
            <th>Message</th>
            <th>Created</th>
          </tr>
        </thead>

        <tbody>
          {findings.map((finding) => (
            <tr key={finding.id}>
              <td>
                <Badge tone={severityTone(finding.severity)}>
                  {getSeverityLabel(finding.severity)}
                </Badge>
              </td>
              <td>
                <code>{finding.rule}</code>
              </td>
              <td>{finding.tool}</td>
              <td>
                {finding.file_path || "—"}
                {finding.line ? `:${finding.line}` : ""}
                {finding.column ? `:${finding.column}` : ""}
              </td>
              <td>
                <details>
                  <summary>{finding.message.slice(0, 120)}</summary>
                  <pre>{finding.message}</pre>

                  {finding.recommendation && (
                    <>
                      <strong>Recommendation</strong>
                      <pre>{finding.recommendation}</pre>
                    </>
                  )}

                  {finding.references && (
                    <>
                      <strong>References</strong>
                      <pre>{stringifyJson(finding.references)}</pre>
                    </>
                  )}
                </details>
              </td>
              <td>{formatDateTime(finding.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}