import type {
  ClassifiedFinding,
  ParsedCfgEvidence,
  ParsedDfgEvidence,
  ParsedReentrancyEvidence,
  SpecializedEvidence
} from "./analysisTypes";

export function parseSpecializedEvidence(
  finding: ClassifiedFinding
): SpecializedEvidence {
  if (finding.analyzer === "cfg" && finding.rule === "CFG_FUNCTION_GRAPH") {
    return {
      type: "cfg",
      data: parseCfgEvidence(finding.message)
    };
  }

  if (
    finding.analyzer === "dfg" &&
    (finding.rule === "DFG_STATE_READ" || finding.rule === "DFG_STATE_WRITE")
  ) {
    return {
      type: "dfg",
      data: parseDfgEvidence(finding.message)
    };
  }

  if (
    finding.analyzer === "custom-cfg-dfg" &&
    finding.rule === "POSSIBLE_REENTRANCY_BY_CFG_DFG"
  ) {
    return {
      type: "reentrancy",
      data: parseReentrancyEvidence(finding.message)
    };
  }

  return {
    type: "none"
  };
}

function parseCfgEvidence(message: string): ParsedCfgEvidence {
  const jsonLike = parsePythonDictLike(message);

  if (jsonLike && typeof jsonLike === "object") {
    const payload = jsonLike as Record<string, unknown>;
    const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
    const edges = Array.isArray(payload.edges) ? payload.edges : [];

    return {
      functionName: toStringOrNull(payload.function),
      startLine: toNumberOrNull(payload.start_line),
      endLine: toNumberOrNull(payload.end_line),
      nodesCount: nodes.length,
      edgesCount: edges.length,
      nodes: nodes
        .filter((node): node is Record<string, unknown> => isRecord(node))
        .map((node) => ({
          id: toStringOrUndefined(node.id),
          type: toStringOrUndefined(node.type),
          label: toStringOrUndefined(node.label),
          line: toNumberOrUndefined(node.line)
        })),
      edges: edges
        .filter((edge): edge is Record<string, unknown> => isRecord(edge))
        .map((edge) => ({
          from: toStringOrUndefined(edge.from),
          to: toStringOrUndefined(edge.to),
          type: toStringOrUndefined(edge.type)
        }))
    };
  }

  return {
    functionName: extractString(message, /['"]function['"]\s*:\s*['"]([^'"]+)['"]/),
    startLine: extractNumber(message, /['"]start_line['"]\s*:\s*(\d+)/),
    endLine: extractNumber(message, /['"]end_line['"]\s*:\s*(\d+)/),
    nodesCount: countOccurrences(message, /['"]id['"]\s*:/g),
    edgesCount: countOccurrences(message, /['"]from['"]\s*:/g),
    nodes: [],
    edges: []
  };
}

function parseDfgEvidence(message: string): ParsedDfgEvidence {
  const jsonLike = parsePythonDictLike(message);

  if (jsonLike && typeof jsonLike === "object") {
    const payload = jsonLike as Record<string, unknown>;

    return {
      functionName: toStringOrNull(payload.function),
      stateVariable: toStringOrNull(payload.state_variable),
      accessType: toStringOrNull(payload.access_type),
      line: toNumberOrNull(payload.line),
      code: toStringOrNull(payload.code)
    };
  }

  return {
    functionName: extractString(message, /['"]function['"]\s*:\s*['"]([^'"]+)['"]/),
    stateVariable: extractString(message, /['"]state_variable['"]\s*:\s*['"]([^'"]+)['"]/),
    accessType: extractString(message, /['"]access_type['"]\s*:\s*['"]([^'"]+)['"]/),
    line: extractNumber(message, /['"]line['"]\s*:\s*(\d+)/),
    code: extractString(message, /['"]code['"]\s*:\s*['"]([^'"]+)['"]/)
  };
}

function parseReentrancyEvidence(message: string): ParsedReentrancyEvidence {
  const lines = extractKeyValueLines(message);

  return {
    file: lines["File"] ?? null,
    functionName: lines["Function"] ?? null,
    externalCallLine: toNumberOrNull(lines["External call line"]),
    externalCallCode: lines["External call code"] ?? null,
    stateWriteLine: toNumberOrNull(lines["State write line"]),
    stateVariable:
      lines["State variable written after external call"] ?? null,
    stateWriteCode: lines["State write code"] ?? null
  };
}

function parsePythonDictLike(message: string): unknown | null {
  const trimmed = message.trim();

  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // backend currently returns Python str(dict), not JSON.
  }

  try {
    const jsonCandidate = trimmed
      .replace(/\bNone\b/g, "null")
      .replace(/\bTrue\b/g, "true")
      .replace(/\bFalse\b/g, "false")
      .replace(/'/g, '"');

    return JSON.parse(jsonCandidate);
  } catch {
    return null;
  }
}

function extractKeyValueLines(message: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of message.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line.includes(":")) {
      continue;
    }

    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim();
    const value = rest.join(":").trim();

    if (key && value) {
      result[key] = value;
    }
  }

  return result;
}

function extractString(message: string, pattern: RegExp): string | null {
  const match = message.match(pattern);
  return match?.[1]?.trim() || null;
}

function extractNumber(message: string, pattern: RegExp): number | null {
  const match = message.match(pattern);
  return toNumberOrNull(match?.[1]);
}

function countOccurrences(message: string, pattern: RegExp): number {
  return message.match(pattern)?.length ?? 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

function toStringOrUndefined(value: unknown): string | undefined {
  return toStringOrNull(value) ?? undefined;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNumberOrUndefined(value: unknown): number | undefined {
  return toNumberOrNull(value) ?? undefined;
}