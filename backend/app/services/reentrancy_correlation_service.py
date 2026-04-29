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

EXTERNAL_CALL_RE = re.compile(
    r"(\.call\s*(\{|\.|\()|\.delegatecall\s*(\{|\.|\()|\.send\s*\(|\.transfer\s*\()"
)

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


def _brace_delta(line: str) -> int:
    return line.count("{") - line.count("}")


def _is_excluded_file(path: Path, workspace_dir: Path) -> bool:
    parts = path.relative_to(workspace_dir).parts
    return any(part in EXCLUDED_DIRS for part in parts)


def _collect_solidity_files(project_file_path: str) -> list[Path]:
    file_path = Path(project_file_path).resolve()

    if not file_path.exists():
        return []

    if file_path.suffix == ".sol":
        return [file_path]

    workspace_dir = file_path.parent

    return sorted(
        sol_file
        for sol_file in workspace_dir.rglob("*.sol")
        if not _is_excluded_file(sol_file, workspace_dir)
    )


def _extract_state_variables(content: str) -> set[str]:
    state_vars = set()
    brace_depth = 0

    for line in content.splitlines():
        stripped = line.strip()

        if not stripped or stripped.startswith("//"):
            continue

        if brace_depth == 0:
            match = STATE_VAR_RE.search(line)
            if match:
                state_vars.add(match.group("name"))

        brace_depth += _brace_delta(line)

    return state_vars


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


def _is_state_write(line: str, state_vars: set[str]) -> str | None:
    for var_name in state_vars:
        escaped = re.escape(var_name)

        patterns = [
            rf"\b{escaped}\b\s*=",
            rf"\b{escaped}\b\s*\[.*?\]\s*=",
            rf"\b{escaped}\b\s*[-+*/%]=",
            rf"\b{escaped}\b\s*\[.*?\]\s*[-+*/%]=",
            rf"\b{escaped}\b\+\+",
            rf"\b{escaped}\b--",
            rf"\b{escaped}\b\s*\[.*?\]\+\+",
            rf"\b{escaped}\b\s*\[.*?\]--",
        ]

        for pattern in patterns:
            if re.search(pattern, line):
                return var_name

    return None


def analyze_reentrancy_correlation(project_file_path: str) -> list[dict]:
    sol_files = _collect_solidity_files(project_file_path)

    if not sol_files:
        return [
            {
                "severity": "info",
                "rule": "REENTRANCY_CORRELATION_NO_FILES",
                "message": "No Solidity files were found for reentrancy correlation analysis.",
                "line": None,
                "tool": "custom-cfg-dfg",
            }
        ]

    findings: list[dict] = []

    for sol_file in sol_files:
        content = sol_file.read_text(encoding="utf-8", errors="ignore")

        state_vars = _extract_state_variables(content)
        functions = _extract_functions(content)

        if not state_vars:
            continue

        for function in functions:
            external_call = None

            for line_no, line in function["body_lines"]:
                stripped = line.strip()

                if not stripped or stripped.startswith("//"):
                    continue

                if external_call is None and EXTERNAL_CALL_RE.search(stripped):
                    external_call = {
                        "line": line_no,
                        "code": stripped,
                    }
                    continue

                if external_call is not None:
                    written_var = _is_state_write(stripped, state_vars)

                    if written_var:
                        message = (
                            "Possible reentrancy pattern detected by CFG/DFG correlation.\n\n"
                            f"File: {sol_file.name}\n"
                            f"Function: {function['name']}\n"
                            f"External call line: {external_call['line']}\n"
                            f"External call code: {external_call['code']}\n"
                            f"State write line: {line_no}\n"
                            f"State variable written after external call: {written_var}\n"
                            f"State write code: {stripped}\n\n"
                            "The function performs an external call before updating contract state. "
                            "Consider applying the checks-effects-interactions pattern or using a reentrancy guard."
                        )

                        findings.append(
                            {
                                "severity": "high",
                                "rule": "POSSIBLE_REENTRANCY_BY_CFG_DFG",
                                "message": message,
                                "line": external_call["line"],
                                "tool": "custom-cfg-dfg",
                            }
                        )

                        break

    if not findings:
        findings.append(
            {
                "severity": "info",
                "rule": "REENTRANCY_CORRELATION_NO_ISSUES",
                "message": "No external-call-before-state-write pattern was detected.",
                "line": None,
                "tool": "custom-cfg-dfg",
            }
        )

    return findings