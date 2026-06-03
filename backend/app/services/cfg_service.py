import re
from pathlib import Path


EXCLUDED_DIRS = {
    "test",
    "tests",
    "script",
    "scripts",
    "lib",
    "node_modules",
    "out",
    "cache",
    "broadcast",
}


FUNCTION_RE = re.compile(
    r"\bfunction\s+(?P<name>[A-Za-z_][A-Za-z0-9_]*)\s*\("
)

MODIFIER_RE = re.compile(
    r"\bmodifier\s+(?P<name>[A-Za-z_][A-Za-z0-9_]*)\s*\("
)

EXTERNAL_CALL_RE = re.compile(
    r"\.(call|delegatecall|staticcall|send|transfer)\s*(?:\{|ほん|\()"
)

REQUIRE_RE = re.compile(r"\brequire\s*\(")
REVERT_RE = re.compile(r"\brevert\s*\(")
EMIT_RE = re.compile(r"\bemit\s+")
RETURN_RE = re.compile(r"\breturn\b")


def _brace_delta(line: str) -> int:
    return line.count("{") - line.count("}")


def _is_excluded_solidity_file(path: Path, root: Path) -> bool:
    relative_parts = path.relative_to(root).parts
    return any(part in EXCLUDED_DIRS for part in relative_parts)


def _collect_solidity_files(project_path: str) -> tuple[Path, list[Path]]:
    path = Path(project_path).resolve()

    if path.is_file() and path.suffix == ".sol":
        return path.parent, [path]

    if path.is_file():
        root = path.parent
    else:
        root = path

    sol_files = sorted(
        sol_file
        for sol_file in root.rglob("*.sol")
        if not _is_excluded_solidity_file(sol_file, root)
    )

    return root, sol_files


def _extract_blocks(content: str, regex: re.Pattern) -> list[dict]:
    lines = content.splitlines()
    blocks = []

    current = None
    brace_depth = 0

    for line_no, line in enumerate(lines, start=1):
        stripped = line.strip()

        if stripped.startswith("//"):
            continue

        if current is None:
            match = regex.search(line)

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

                if brace_depth <= 0 and "{" in line:
                    blocks.append(current)
                    current = None

        else:
            current["body_lines"].append((line_no, line))
            brace_depth += _brace_delta(line)
            current["end_line"] = line_no

            if brace_depth <= 0:
                blocks.append(current)
                current = None

    return blocks


def _classify_cfg_node(line: str) -> str | None:
    stripped = line.strip()

    if not stripped or stripped.startswith("//"):
        return None

    if REQUIRE_RE.search(stripped):
        return "condition"

    if REVERT_RE.search(stripped):
        return "revert"

    if EXTERNAL_CALL_RE.search(stripped):
        return "external_call"

    if EMIT_RE.search(stripped):
        return "event"

    if RETURN_RE.search(stripped):
        return "return"

    return "statement"


def _build_function_summary(function: dict) -> dict:
    nodes = []

    for line_no, line in function["body_lines"]:
        node_type = _classify_cfg_node(line)

        if node_type is None:
            continue

        nodes.append(
            {
                "line": line_no,
                "type": node_type,
                "code": line.strip(),
            }
        )

    external_calls = [
        node
        for node in nodes
        if node["type"] == "external_call"
    ]

    conditions = [
        node
        for node in nodes
        if node["type"] == "condition"
    ]

    return {
        "function": function["name"],
        "start_line": function["start_line"],
        "end_line": function["end_line"],
        "nodes_count": len(nodes),
        "conditions_count": len(conditions),
        "external_calls_count": len(external_calls),
        "nodes": nodes,
    }


def build_cfg(project_file_path: str) -> list[dict]:
    root, sol_files = _collect_solidity_files(project_file_path)

    if not root.exists():
        return [
            {
                "severity": "high",
                "rule": "CFG_FILE_NOT_FOUND",
                "message": f"Project path not found: {root}",
                "line": None,
                "tool": "cfg",
            }
        ]

    if not sol_files:
        return [
            {
                "severity": "info",
                "rule": "CFG_NO_SOLIDITY_FILES",
                "message": f"No Solidity files were found for CFG construction: {root}",
                "line": None,
                "tool": "cfg",
            }
        ]

    findings = []

    for sol_file in sol_files:
        relative_path = sol_file.relative_to(root).as_posix()
        content = sol_file.read_text(encoding="utf-8", errors="ignore")

        functions = _extract_blocks(content, FUNCTION_RE)
        modifiers = _extract_blocks(content, MODIFIER_RE)

        if not functions and not modifiers:
            findings.append(
                {
                    "severity": "info",
                    "rule": "CFG_NO_FUNCTIONS",
                    "message": "No Solidity functions or modifiers were found for CFG construction.",
                    "file_path": relative_path,
                    "line": None,
                    "tool": "cfg",
                }
            )
            continue

        for function in functions:
            summary = _build_function_summary(function)

            severity = "info"
            rule = "CFG_FUNCTION_SUMMARY"

            if summary["external_calls_count"] > 0:
                severity = "low"
                rule = "CFG_EXTERNAL_CALL_PATH"

            findings.append(
                {
                    "severity": severity,
                    "rule": rule,
                    "message": str(summary),
                    "file_path": relative_path,
                    "line": function["start_line"],
                    "tool": "cfg",
                }
            )

        for modifier in modifiers:
            summary = _build_function_summary(modifier)

            findings.append(
                {
                    "severity": "info",
                    "rule": "CFG_MODIFIER_SUMMARY",
                    "message": str(summary),
                    "file_path": relative_path,
                    "line": modifier["start_line"],
                    "tool": "cfg",
                }
            )

    return findings