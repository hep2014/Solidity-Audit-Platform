export function extractExitCode(message: string): number | null {
  const match = message.match(/Exit code:\s*(-?\d+)/i);

  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function extractTargetFile(message: string): string | null {
  const match = message.match(/Target file:\s*(.+)/i);

  if (!match) {
    return null;
  }

  return match[1].trim() || null;
}

export function extractConfidence(message: string): "High" | "Medium" | "Low" | null {
  const match = message.match(/Confidence:\s*(High|Medium|Low)/i);

  if (!match) {
    return null;
  }

  const value = match[1].toLowerCase();

  if (value === "high") return "High";
  if (value === "medium") return "Medium";
  if (value === "low") return "Low";

  return null;
}

export function splitStdoutStderr(message: string): {
  stdout?: string;
  stderr?: string;
  rest: string;
} {
  const stdoutIndex = message.indexOf("STDOUT:");
  const stderrIndex = message.indexOf("STDERR:");

  if (stdoutIndex === -1 && stderrIndex === -1) {
    return {
      rest: message
    };
  }

  let rest = message;
  let stdout: string | undefined;
  let stderr: string | undefined;

  if (stdoutIndex !== -1) {
    rest = message.slice(0, stdoutIndex).trim();

    const stdoutStart = stdoutIndex + "STDOUT:".length;
    const stdoutEnd = stderrIndex !== -1 && stderrIndex > stdoutIndex ? stderrIndex : message.length;

    stdout = message.slice(stdoutStart, stdoutEnd).trim() || undefined;
  }

  if (stderrIndex !== -1) {
    if (stdoutIndex === -1) {
      rest = message.slice(0, stderrIndex).trim();
    }

    const stderrStart = stderrIndex + "STDERR:".length;
    stderr = message.slice(stderrStart).trim() || undefined;
  }

  return {
    stdout,
    stderr,
    rest
  };
}

export function extractKeyValueLines(message: string): Record<string, string> {
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

export function containsAny(message: string, patterns: Array<string | RegExp>): boolean {
  return patterns.some((pattern) => {
    if (typeof pattern === "string") {
      return message.toLowerCase().includes(pattern.toLowerCase());
    }

    return pattern.test(message);
  });
}

export function normalizeRule(rule: string | null | undefined): string {
  return String(rule ?? "UNKNOWN_RULE")
    .trim()
    .toUpperCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");
}

export function buildEvidence(message: string) {
  const split = splitStdoutStderr(message);

  return {
    exitCode: extractExitCode(message),
    targetFile: extractTargetFile(message),
    confidence: extractConfidence(message),
    stdout: split.stdout,
    stderr: split.stderr,
    rest: split.rest,
    keyValues: extractKeyValueLines(message),
    warnings: [] as string[]
  };
}