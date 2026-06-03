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


STATE_VAR_RE = re.compile(
    r"^\s*"
    r"(?:mapping\s*\([^)]+\)|uint\d*|int\d*|address|bool|string|bytes\d*|bytes|"
    r"[A-Za-z_][A-Za-z0-9_]*)"
    r"(?:\s+(?:public|private|internal|external|constant|immutable|payable))*\s+"
    r"(?P<name>[A-Za-z_][A-Za-z0-9_]*)"
    r"(?:\s*=.*)?;"
)

FUNCTION_RE = re.compile(
    r"\bfunction\s+(?P<name>[A-Za-z_][A-Za-z0-9_]*)\s*\("
)

EXTERNAL_CALL_RE = re.compile(
    r"\.(call|delegatecall|staticcall|send|transfer)\s*(?:\{|\()"
)


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


def _strip_inline_comment(line: str) -> str:
    return line.split("//", 1)[0]


def _extract_state_variables(content: str) -> set[str]:
    state_vars = set()
    brace_depth = 0

    for line in content.splitlines():
        cleaned = _strip_inline_comment(line).strip()

        if not cleaned:
            brace_depth += _brace_delta(line)
            continue

        if brace_depth == 1:
            match = STATE_VAR_RE.search(cleaned)

            if match:
                name = match.group("name")

                if name not in {
                    "function",
                    "modifier",
                    "event",
                    "error",
                    "struct",
                    "enum",
                    "mapping",
                }:
                    state_vars.add(name)

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

                if brace_depth <= 0 and "{" in line:
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


def _detect_external_call(line: str) -> bool:
    return bool(EXTERNAL_CALL_RE.search(line))


def build_dfg(project_file_path: str) -> list[dict]:
    root, sol_files = _collect_solidity_files(project_file_path)

    if not root.exists():
        return [
            {
                "severity": "high",
                "rule": "DFG_FILE_NOT_FOUND",
                "message": f"Project path not found: {root}",
                "line": None,
                "tool": "dfg",
            }
        ]

    if not sol_files:
        return [
            {
                "severity": "info",
                "rule": "DFG_NO_SOLIDITY_FILES",
                "message": f"No Solidity files were found for DFG construction: {root}",
                "line": None,
                "tool": "dfg",
            }
        ]

    findings = []

    for sol_file in sol_files:
        relative_path = sol_file.relative_to(root).as_posix()
        content = sol_file.read_text(encoding="utf-8", errors="ignore")

        state_vars = _extract_state_variables(content)
        functions = _extract_function_contexts(content)

        if not state_vars:
            findings.append(
                {
                    "severity": "info",
                    "rule": "DFG_NO_STATE_VARIABLES",
                    "message": "No state variables were found.",
                    "file_path": relative_path,
                    "line": None,
                    "tool": "dfg",
                }
            )
            continue

        accesses = []
        external_calls = []

        for function in functions:
            for line_no, line in function["body_lines"]:
                stripped = _strip_inline_comment(line).strip()

                if not stripped:
                    continue

                if _detect_external_call(stripped):
                    external_calls.append(
                        {
                            "function": function["name"],
                            "line": line_no,
                            "code": stripped,
                        }
                    )

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
            findings.append(
                {
                    "severity": "info",
                    "rule": "DFG_NO_STATE_ACCESSES",
                    "message": (
                        "State variables found, but no read/write accesses detected: "
                        f"{sorted(state_vars)}"
                    ),
                    "file_path": relative_path,
                    "line": None,
                    "tool": "dfg",
                }
            )
            continue

        for access in accesses:
            severity = "info"

            if access["access_type"] == "write":
                severity = "low"

            findings.append(
                {
                    "severity": severity,
                    "rule": f"DFG_STATE_{access['access_type'].upper()}",
                    "message": str(access),
                    "file_path": relative_path,
                    "line": access["line"],
                    "tool": "dfg",
                }
            )

        for external_call in external_calls:
            findings.append(
                {
                    "severity": "low",
                    "rule": "DFG_EXTERNAL_CALL",
                    "message": str(external_call),
                    "file_path": relative_path,
                    "line": external_call["line"],
                    "tool": "dfg",
                }
            )

    return findings