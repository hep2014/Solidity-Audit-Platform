import re


def _strip_comments_preserve_lines(content: str) -> str:
    result = []
    i = 0
    in_block_comment = False

    while i < len(content):
        if in_block_comment:
            if content.startswith("*/", i):
                in_block_comment = False
                i += 2
            else:
                # Preserve newlines so line numbers remain correct.
                if content[i] == "\n":
                    result.append("\n")
                else:
                    result.append(" ")
                i += 1

            continue

        if content.startswith("/*", i):
            in_block_comment = True
            result.append(" ")
            result.append(" ")
            i += 2
            continue

        if content.startswith("//", i):
            # Skip until newline, but preserve the newline itself.
            while i < len(content) and content[i] != "\n":
                result.append(" ")
                i += 1
            continue

        result.append(content[i])
        i += 1

    return "".join(result)


def scan_solidity(content: str):
    issues = []

    def add(rule, message, severity="info", line=None):
        issues.append(
            {
                "severity": severity,
                "rule": rule,
                "message": message,
                "line": line,
            }
        )

    if not content.strip():
        add("EMPTY_FILE", "Uploaded file is empty", "high")
        return issues

    code_content = _strip_comments_preserve_lines(content)
    lines = code_content.splitlines()

    if "SPDX-License-Identifier" not in content:
        add("NO_SPDX", "SPDX license identifier missing", "low")

    if "pragma solidity" not in code_content:
        add("NO_PRAGMA", "pragma solidity not found", "high")

    if "contract " not in code_content:
        add("NO_CONTRACT", "No contract declaration found", "high")

    patterns = [
        ("TX_ORIGIN", r"\btx\.origin\b", "Use of tx.origin detected", "high"),
        ("SELFDESTRUCT", r"\bselfdestruct\b", "selfdestruct detected", "critical"),
        ("DELEGATECALL", r"\bdelegatecall\b", "delegatecall detected", "high"),
        ("LOW_LEVEL_CALL", r"\.call\s*(?:\{|\()", "Low level call detected", "medium"),
        ("BLOCK_TIMESTAMP", r"\bblock\.timestamp\b", "block.timestamp detected", "medium"),
    ]

    for idx, line in enumerate(lines, start=1):
        if not line.strip():
            continue

        for rule, pattern, msg, sev in patterns:
            if re.search(pattern, line):
                add(rule, msg, sev, idx)

    return issues