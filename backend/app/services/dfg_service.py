import re
from pathlib import Path


STATE_VAR_RE = re.compile(
    r"^\s*(?:mapping\s*\([^)]+\)|uint\d*|int\d*|address|bool|string|bytes\d*)\s+"
    r"(?:public|private|internal|external)?\s*"
    r"(?P<name>[A-Za-z_][A-Za-z0-9_]*)"
)

FUNCTION_RE = re.compile(
    r"function\s+(?P<name>[A-Za-z_][A-Za-z0-9_]*)\s*\("
)


def _brace_delta(line: str) -> int:
    return line.count("{") - line.count("}")


def _extract_state_variables(content: str) -> set[str]:
    state_vars = set()
    brace_depth = 0

    for line in content.splitlines():
        stripped = line.strip()

        if stripped.startswith("//"):
            continue

        if brace_depth == 0:
            match = STATE_VAR_RE.search(line)
            if match:
                state_vars.add(match.group("name"))

        brace_depth += _brace_delta(line)

    return state_vars


def _extract_function_contexts(content: str) -> list[dict]:
    lines = content.splitlines()
    functions = []

    current = None
    brace_depth = 0

    for line_no, line in enumerate(lines, start=1):
        if current is None:
            match = FUNCTION_RE.search(line)

            if match:
                current = {
                    "name": match.group("name"),
                    "start_line": line_no,
                    "end_line": line_no,
                    "body_lines": [],
                }

                brace_depth = _brace_delta(line)

                if "{" in line:
                    current["body_lines"].append((line_no, line))

        else:
            current["body_lines"].append((line_no, line))
            brace_depth += _brace_delta(line)
            current["end_line"] = line_no

            if brace_depth <= 0:
                functions.append(current)
                current = None

    return functions


def _detect_access(line: str, var_name: str) -> str | None:
    escaped = re.escape(var_name)

    write_patterns = [
        rf"\b{escaped}\b\s*=",
        rf"\b{escaped}\b\s*\[.*?\]\s*=",
        rf"\b{escaped}\b\s*[-+*/%]=",
        rf"\b{escaped}\b\s*\[.*?\]\s*[-+*/%]=",
        rf"\b{escaped}\b\+\+",
        rf"\b{escaped}\b--",
        rf"\b{escaped}\b\s*\[.*?\]\+\+",
        rf"\b{escaped}\b\s*\[.*?\]--",
    ]

    for pattern in write_patterns:
        if re.search(pattern, line):
            return "write"

    read_pattern = rf"\b{escaped}\b"
    if re.search(read_pattern, line):
        return "read"

    return None


def build_dfg(project_file_path: str) -> list[dict]:
    file_path = Path(project_file_path).resolve()

    if not file_path.exists():
        return [
            {
                "severity": "high",
                "rule": "DFG_FILE_NOT_FOUND",
                "message": f"Project file not found: {file_path}",
                "line": None,
                "tool": "dfg",
            }
        ]

    content = file_path.read_text(encoding="utf-8", errors="ignore")

    state_vars = _extract_state_variables(content)
    functions = _extract_function_contexts(content)

    if not state_vars:
        return [
            {
                "severity": "info",
                "rule": "DFG_NO_STATE_VARIABLES",
                "message": "No state variables were found.",
                "line": None,
                "tool": "dfg",
            }
        ]

    accesses = []

    for function in functions:
        for line_no, line in function["body_lines"]:
            stripped = line.strip()

            if not stripped or stripped.startswith("//"):
                continue

            for var_name in state_vars:
                access_type = _detect_access(stripped, var_name)

                if access_type:
                    accesses.append(
                        {
                            "function": function["name"],
                            "state_variable": var_name,
                            "access_type": access_type,
                            "line": line_no,
                            "code": stripped,
                        }
                    )

    if not accesses:
        return [
            {
                "severity": "info",
                "rule": "DFG_NO_STATE_ACCESSES",
                "message": f"State variables found, but no read/write accesses detected: {sorted(state_vars)}",
                "line": None,
                "tool": "dfg",
            }
        ]

    findings = []

    for access in accesses:
        severity = "info"

        if access["access_type"] == "write":
            severity = "low"

        findings.append(
            {
                "severity": severity,
                "rule": f"DFG_STATE_{access['access_type'].upper()}",
                "message": str(access),
                "line": access["line"],
                "tool": "dfg",
            }
        )

    return findings