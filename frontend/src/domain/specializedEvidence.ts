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
  if (finding.analyzer === "cfg" && looksLikeCfgEvidence(finding.message)) {
    return {
      type: "cfg",
      data: parseCfgEvidence(finding.message)
    };
  }

  if (finding.analyzer === "dfg" && looksLikeDfgEvidence(finding.message)) {
    return {
      type: "dfg",
      data: parseDfgEvidence(finding.message)
    };
  }

  if (
    finding.analyzer === "custom-cfg-dfg" &&
    looksLikeReentrancyEvidence(finding.message)
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

function looksLikeCfgEvidence(message: string): boolean {
  return (
    (message.includes("'function'") || message.includes('"function"')) &&
    (
      message.includes("'nodes'") ||
      message.includes('"nodes"') ||
      message.includes("'nodes_count'") ||
      message.includes('"nodes_count"')
    )
  );
}

function looksLikeDfgEvidence(message: string): boolean {
  return (
    message.includes("state_variable") ||
    message.includes("access_type") ||
    message.includes("'code'") ||
    message.includes('"code"')
  );
}

function looksLikeReentrancyEvidence(message: string): boolean {
  return (
    message.includes("External call line") ||
    message.includes("State write line") ||
    message.includes("State variable written after external call")
  );
}

function parseCfgEvidence(message: string): ParsedCfgEvidence {
  const payload = parseStructuredObject(message);

  if (payload) {
    const functionName =
      readString(payload, ["function", "function_name", "name"]) ||
      extractString(message, /['"]function['"]\s*:\s*['"]([^'"]+)['"]/) ||
      extractString(message, /['"]name['"]\s*:\s*['"]([^'"]+)['"]/);

    const startLine =
      readNumber(payload, ["start_line", "startLine"]) ??
      extractNumber(message, /['"]start_line['"]\s*:\s*(\d+)/);

    const endLine =
      readNumber(payload, ["end_line", "endLine"]) ??
      extractNumber(message, /['"]end_line['"]\s*:\s*(\d+)/);

    const rawNodes = readArray(payload, ["nodes", "cfg_nodes"]);
    const rawEdges = readArray(payload, ["edges", "cfg_edges"]);

    const nodes = rawNodes
      .filter(isRecord)
      .map((node, index) => ({
        id:
          readString(node, ["id", "node_id"]) ??
          readNumber(node, ["line", "line_no", "start_line"])?.toString() ??
          String(index + 1),
        type: readString(node, ["type", "kind"]) ?? undefined,
        label:
          readString(node, ["label", "title", "code", "condition"]) ??
          undefined,
        line: readNumber(node, ["line", "line_no", "start_line"]) ?? undefined
      }));

    const edges = rawEdges
      .filter(isRecord)
      .map((edge) => ({
        from: readString(edge, ["from", "source", "src"]) ?? undefined,
        to: readString(edge, ["to", "target", "dst"]) ?? undefined,
        type: readString(edge, ["type", "kind", "label"]) ?? undefined
      }));

    return {
      functionName,
      startLine,
      endLine,
      nodesCount:
        nodes.length ||
        readNumber(payload, ["nodes_count", "node_count"]) ||
        null,
      edgesCount:
        edges.length ||
        readNumber(payload, ["edges_count", "edge_count"]) ||
        null,
      nodes,
      edges
    };
  }

  return parseCfgByRegex(message);
}

function parseDfgEvidence(message: string): ParsedDfgEvidence {
  const payload = parseStructuredObject(message);

  if (payload) {
    return {
      functionName:
        readString(payload, ["function", "function_name", "name"]) ||
        extractString(message, /['"]function['"]\s*:\s*['"]([^'"]+)['"]/),
      stateVariable:
        readString(payload, ["state_variable", "stateVariable", "variable"]) ||
        extractString(message, /['"]state_variable['"]\s*:\s*['"]([^'"]+)['"]/),
      accessType:
        readString(payload, ["access_type", "accessType", "type"]) ||
        extractString(message, /['"]access_type['"]\s*:\s*['"]([^'"]+)['"]/),
      line:
        readNumber(payload, ["line", "line_no"]) ??
        extractNumber(message, /['"]line['"]\s*:\s*(\d+)/),
      code:
        readString(payload, ["code", "snippet", "source"]) ||
        extractString(message, /['"]code['"]\s*:\s*['"]([^'"]+)['"]/)
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
    stateVariable: lines["State variable written after external call"] ?? null,
    stateWriteCode: lines["State write code"] ?? null
  };
}

function parseCfgByRegex(message: string): ParsedCfgEvidence {
  const functionName =
    extractString(message, /['"]function['"]\s*:\s*['"]([^'"]+)['"]/) ||
    extractString(message, /['"]function_name['"]\s*:\s*['"]([^'"]+)['"]/) ||
    extractString(message, /Function:\s*([^\n]+)/);

  const startLine =
    extractNumber(message, /['"]start_line['"]\s*:\s*(\d+)/) ??
    extractNumber(message, /Start line:\s*(\d+)/i);

  const endLine =
    extractNumber(message, /['"]end_line['"]\s*:\s*(\d+)/) ??
    extractNumber(message, /End line:\s*(\d+)/i);

  const rawNodesList = extractListChunk(message, "nodes");
  const rawEdgesList = extractListChunk(message, "edges");

  const nodes = rawNodesList
    ? extractDictChunks(rawNodesList)
        .slice(0, 80)
        .map((chunk, index) => ({
          id:
            extractString(chunk, /['"]id['"]\s*:\s*['"]([^'"]+)['"]/) ||
            extractNumber(chunk, /['"]line['"]\s*:\s*(\d+)/)?.toString() ||
            String(index + 1),
          type:
            extractString(chunk, /['"]type['"]\s*:\s*['"]([^'"]+)['"]/) ||
            extractString(chunk, /['"]kind['"]\s*:\s*['"]([^'"]+)['"]/) ||
            undefined,
          label:
            extractString(chunk, /['"]label['"]\s*:\s*['"]([^'"]*)['"]/) ||
            extractString(chunk, /['"]code['"]\s*:\s*['"]([^'"]*)['"]/) ||
            undefined,
          line:
            extractNumber(chunk, /['"]line['"]\s*:\s*(\d+)/) ??
            undefined
        }))
    : [];

  const edges = rawEdgesList
    ? extractDictChunks(rawEdgesList)
        .slice(0, 120)
        .map((chunk) => ({
          from:
            extractString(chunk, /['"]from['"]\s*:\s*['"]([^'"]+)['"]/) ||
            extractString(chunk, /['"]source['"]\s*:\s*['"]([^'"]+)['"]/) ||
            undefined,
          to:
            extractString(chunk, /['"]to['"]\s*:\s*['"]([^'"]+)['"]/) ||
            extractString(chunk, /['"]target['"]\s*:\s*['"]([^'"]+)['"]/) ||
            undefined,
          type:
            extractString(chunk, /['"]type['"]\s*:\s*['"]([^'"]+)['"]/) ||
            extractString(chunk, /['"]label['"]\s*:\s*['"]([^'"]+)['"]/) ||
            undefined
        }))
    : [];

  return {
    functionName,
    startLine,
    endLine,
    nodesCount:
      nodes.length ||
      extractNumber(message, /['"]nodes_count['"]\s*:\s*(\d+)/) ||
      countOccurrences(message, /['"]line['"]\s*:/g) ||
      null,
    edgesCount:
      edges.length ||
      extractNumber(message, /['"]edges_count['"]\s*:\s*(\d+)/) ||
      countOccurrences(message, /['"]from['"]\s*:/g) ||
      countOccurrences(message, /['"]source['"]\s*:/g) ||
      null,
    nodes,
    edges
  };
}

function parseStructuredObject(message: string): Record<string, unknown> | null {
  const trimmed = message.trim();

  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null;
  }

  const directJson = tryJsonParse(trimmed);

  if (isRecord(directJson)) {
    return directJson;
  }

  const normalized = normalizePythonDictString(trimmed);
  const parsed = tryJsonParse(normalized);

  if (isRecord(parsed)) {
    return parsed;
  }

  return null;
}

function normalizePythonDictString(value: string): string {
  let result = value;

  result = result.replace(/\bNone\b/g, "null");
  result = result.replace(/\bTrue\b/g, "true");
  result = result.replace(/\bFalse\b/g, "false");
  result = replaceSingleQuotedStrings(result);

  return result;
}

function replaceSingleQuotedStrings(input: string): string {
  let result = "";
  let index = 0;

  while (index < input.length) {
    const char = input[index];

    if (char !== "'") {
      result += char;
      index += 1;
      continue;
    }

    let value = "";
    index += 1;

    while (index < input.length) {
      const current = input[index];

      if (current === "\\" && index + 1 < input.length) {
        value += current + input[index + 1];
        index += 2;
        continue;
      }

      if (current === "'") {
        index += 1;
        break;
      }

      value += current;
      index += 1;
    }

    result += JSON.stringify(value);
  }

  return result;
}

function tryJsonParse(value: string): unknown | null {
  try {
    return JSON.parse(value);
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

function extractListChunk(message: string, key: string): string | null {
  const singleQuoteKey = `'${key}'`;
  const doubleQuoteKey = `"${key}"`;

  let keyIndex = message.indexOf(singleQuoteKey);

  if (keyIndex === -1) {
    keyIndex = message.indexOf(doubleQuoteKey);
  }

  if (keyIndex === -1) {
    return null;
  }

  const listStart = message.indexOf("[", keyIndex);

  if (listStart === -1) {
    return null;
  }

  let depth = 0;

  for (let index = listStart; index < message.length; index += 1) {
    const char = message[index];

    if (char === "[") {
      depth += 1;
    }

    if (char === "]") {
      depth -= 1;

      if (depth === 0) {
        return message.slice(listStart, index + 1);
      }
    }
  }

  return null;
}

function extractDictChunks(listChunk: string): string[] {
  const chunks: string[] = [];
  let start = -1;
  let depth = 0;

  for (let index = 0; index < listChunk.length; index += 1) {
    const char = listChunk[index];

    if (char === "{") {
      if (depth === 0) {
        start = index;
      }

      depth += 1;
    }

    if (char === "}") {
      depth -= 1;

      if (depth === 0 && start !== -1) {
        chunks.push(listChunk.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return chunks;
}

function readString(
  record: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = record[key];

    if (value === null || value === undefined) {
      continue;
    }

    const normalized = String(value).trim();

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function readNumber(
  record: Record<string, unknown>,
  keys: string[]
): number | null {
  for (const key of keys) {
    const value = toNumberOrNull(record[key]);

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function readArray(
  record: Record<string, unknown>,
  keys: string[]
): unknown[] {
  for (const key of keys) {
    const value = record[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
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

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
