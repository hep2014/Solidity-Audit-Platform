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


def _strip_inline_comment(line: str) -> str:
    return line.split("//", 1)[0]


def _is_excluded_file(path: Path, workspace_dir: Path) -> bool:
    parts = path.relative_to(workspace_dir).parts
    return any(part in EXCLUDED_DIRS for part in parts)


def _collect_solidity_files(project_file_path: str) -> tuple[Path, list[Path]]:
    path = Path(project_file_path).resolve()

    if not path.exists():
        return path, []

    if path.is_file() and path.suffix == ".sol":
        return path.parent, [path]

    workspace_dir = path if path.is_dir() else path.parent

    sol_files = sorted(
        sol_file
        for sol_file in workspace_dir.rglob("*.sol")
        if not _is_excluded_file(sol_file, workspace_dir)
    )

    return workspace_dir, sol_files


def _extract_state_variables(content: str) -> set[str]:
    state_vars: set[str] = set()
    contract_depth = 0

    for line in content.splitlines():
        cleaned = _strip_inline_comment(line).strip()

        if not cleaned:
            contract_depth += _brace_delta(line)
            continue

        if contract_depth == 1:
            if cleaned.startswith((
                "function ",
                "modifier ",
                "event ",
                "error ",
                "struct ",
                "enum ",
                "using ",
            )):
                contract_depth += _brace_delta(line)
                continue

            match = STATE_VAR_RE.search(cleaned)

            if match:
                state_vars.add(match.group("name"))

        contract_depth += _brace_delta(line)

    return state_vars


def _extract_functions(content: str) -> list[dict]:
    lines = content.splitlines()
    functions: list[dict] = []

    current = None
    brace_depth = 0
    pending_function = None

    for line_no, line in enumerate(lines, start=1):
        if current is None:
            match = FUNCTION_RE.search(line)

            if match:
                pending_function = {
                    "name": match.group("name"),
                    "start_line": line_no,
                    "end_line": line_no,
                    "body_lines": [],
                }

                if "{" in line:
                    current = pending_function
                    pending_function = None
                    brace_depth = _brace_delta(line)
                    current["body_lines"].append((line_no, line))

                    if brace_depth <= 0:
                        functions.append(current)
                        current = None

            elif pending_function is not None:
                pending_function["end_line"] = line_no

                if "{" in line:
                    current = pending_function
                    pending_function = None
                    brace_depth = _brace_delta(line)
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


def _make_reentrancy_finding(
    *,
    relative_path: str,
    function: dict,
    external_call_line: int,
    external_call_code: str,
    state_write_line: int,
    state_write_code: str,
    written_var: str,
) -> dict:
    message = (
        "Possible reentrancy pattern detected by CFG/DFG correlation.\n\n"
        f"File: {relative_path}\n"
        f"Function: {function['name']}\n"
        f"External call line: {external_call_line}\n"
        f"External call code: {external_call_code}\n"
        f"State write line: {state_write_line}\n"
        f"State variable written after external call: {written_var}\n"
        f"State write code: {state_write_code}\n\n"
        "The function performs an external call before updating contract state. "
        "This violates the checks-effects-interactions pattern and may allow "
        "reentrant execution before the internal balance or accounting state is updated."
    )

    return {
        "severity": "high",
        "rule": "POSSIBLE_REENTRANCY_BY_CFG_DFG",
        "message": message,
        "file_path": relative_path,
        "line": external_call_line,
        "end_line": state_write_line,
        "tool": "custom-cfg-dfg",
        "confidence": "medium",
        "description": (
            "An external call was observed before a later write to a contract state "
            "variable in the same function."
        ),
        "recommendation": (
            "Move state updates before the external call, apply the checks-effects-interactions "
            "pattern, or protect the function with a reentrancy guard."
        ),
        "references": [
            "https://docs.soliditylang.org/en/latest/security-considerations.html#reentrancy",
            "https://swcregistry.io/docs/SWC-107",
        ],
    }


def analyze_reentrancy_correlation(project_file_path: str) -> list[dict]:
    workspace_dir, sol_files = _collect_solidity_files(project_file_path)

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
        relative_path = sol_file.relative_to(workspace_dir).as_posix()
        content = sol_file.read_text(encoding="utf-8", errors="ignore")

        state_vars = _extract_state_variables(content)
        functions = _extract_functions(content)

        if not state_vars:
            continue

        for function in functions:
            seen_external_call = None

            for line_no, raw_line in function["body_lines"]:
                stripped = _strip_inline_comment(raw_line).strip()

                if not stripped:
                    continue

                if seen_external_call is None and EXTERNAL_CALL_RE.search(stripped):
                    seen_external_call = {
                        "line": line_no,
                        "code": stripped,
                    }
                    continue

                if seen_external_call is not None:
                    written_var = _is_state_write(stripped, state_vars)

                    if written_var:
                        findings.append(
                            _make_reentrancy_finding(
                                relative_path=relative_path,
                                function=function,
                                external_call_line=seen_external_call["line"],
                                external_call_code=seen_external_call["code"],
                                state_write_line=line_no,
                                state_write_code=stripped,
                                written_var=written_var,
                            )
                        )
                        break

    if not findings:
        return [
            {
                "severity": "info",
                "rule": "REENTRANCY_CORRELATION_NO_ISSUES",
                "message": "No external-call-before-state-write pattern was detected.",
                "line": None,
                "tool": "custom-cfg-dfg",
            }
        ]

    return findings