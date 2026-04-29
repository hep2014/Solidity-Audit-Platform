import re
from pathlib import Path


FUNCTION_RE = re.compile(
    r"function\s+(?P<name>[A-Za-z_][A-Za-z0-9_]*)\s*\((?P<params>[^)]*)\)"
)

CONTROL_PATTERNS = [
    ("require", re.compile(r"\brequire\s*\(")),
    ("assert", re.compile(r"\bassert\s*\(")),
    ("if", re.compile(r"\bif\s*\(")),
    ("for", re.compile(r"\bfor\s*\(")),
    ("while", re.compile(r"\bwhile\s*\(")),
    ("return", re.compile(r"\breturn\b")),
    ("external_call", re.compile(r"\.call\s*(\{|\.|\()")),
    ("delegatecall", re.compile(r"\.delegatecall\s*(\{|\.|\()")),
    ("staticcall", re.compile(r"\.staticcall\s*(\{|\.|\()")),
    ("transfer", re.compile(r"\.transfer\s*\(")),
    ("send", re.compile(r"\.send\s*\(")),
    ("state_update", re.compile(r"\[[^\]]+\]\s*[-+*/]?=|[A-Za-z_][A-Za-z0-9_]*\s*[-+*/]?=")),
]


def _brace_delta(line: str) -> int:
    return line.count("{") - line.count("}")


def _extract_functions(content: str) -> list[dict]:
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
                    "params": match.group("params"),
                    "start_line": line_no,
                    "end_line": line_no,
                    "body_lines": [],
                }

                brace_depth = _brace_delta(line)

                if "{" in line:
                    current["body_lines"].append((line_no, line))

                if brace_depth <= 0 and "{" in line:
                    current["end_line"] = line_no
                    functions.append(current)
                    current = None

        else:
            current["body_lines"].append((line_no, line))
            brace_depth += _brace_delta(line)
            current["end_line"] = line_no

            if brace_depth <= 0:
                functions.append(current)
                current = None

    return functions


def build_cfg(project_file_path: str) -> list[dict]:
    file_path = Path(project_file_path).resolve()

    if not file_path.exists():
        return [
            {
                "severity": "high",
                "rule": "CFG_FILE_NOT_FOUND",
                "message": f"Project file not found: {file_path}",
                "line": None,
                "tool": "cfg",
            }
        ]

    content = file_path.read_text(encoding="utf-8", errors="ignore")
    functions = _extract_functions(content)

    if not functions:
        return [
            {
                "severity": "info",
                "rule": "CFG_NO_FUNCTIONS",
                "message": "No Solidity functions were found for CFG construction.",
                "line": None,
                "tool": "cfg",
            }
        ]

    findings = []

    for function in functions:
        nodes = []
        edges = []

        previous_node_id = None

        entry_id = f"{function['name']}:entry"
        nodes.append(
            {
                "id": entry_id,
                "type": "entry",
                "label": f"entry {function['name']}()",
                "line": function["start_line"],
            }
        )
        previous_node_id = entry_id

        for line_no, line in function["body_lines"]:
            stripped = line.strip()

            if not stripped or stripped in {"{", "}"}:
                continue

            matched_type = None

            for node_type, pattern in CONTROL_PATTERNS:
                if pattern.search(stripped):
                    matched_type = node_type
                    break

            if matched_type is None:
                continue

            node_id = f"{function['name']}:{line_no}:{matched_type}"

            nodes.append(
                {
                    "id": node_id,
                    "type": matched_type,
                    "label": stripped,
                    "line": line_no,
                }
            )

            if previous_node_id:
                edges.append(
                    {
                        "from": previous_node_id,
                        "to": node_id,
                        "type": "next",
                    }
                )

            previous_node_id = node_id

        exit_id = f"{function['name']}:exit"
        nodes.append(
            {
                "id": exit_id,
                "type": "exit",
                "label": f"exit {function['name']}()",
                "line": function["end_line"],
            }
        )

        if previous_node_id:
            edges.append(
                {
                    "from": previous_node_id,
                    "to": exit_id,
                    "type": "next",
                }
            )

        message = {
            "function": function["name"],
            "start_line": function["start_line"],
            "end_line": function["end_line"],
            "nodes": nodes,
            "edges": edges,
        }

        findings.append(
            {
                "severity": "info",
                "rule": "CFG_FUNCTION_GRAPH",
                "message": str(message),
                "line": function["start_line"],
                "tool": "cfg",
            }
        )

    return findings