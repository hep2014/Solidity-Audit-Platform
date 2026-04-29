import re


def scan_solidity(content: str):
    issues = []
    lines = content.splitlines()

    def add(rule, message, severity="info", line=None):
        issues.append({
            "severity": severity,
            "rule": rule,
            "message": message,
            "line": line
        })

    if not content.strip():
        add("EMPTY_FILE", "Uploaded file is empty", "high")
        return issues

    if "SPDX-License-Identifier" not in content:
        add("NO_SPDX", "SPDX license identifier missing", "low")

    if "pragma solidity" not in content:
        add("NO_PRAGMA", "pragma solidity not found", "high")

    if "contract " not in content:
        add("NO_CONTRACT", "No contract declaration found", "high")

    patterns = [
        ("TX_ORIGIN", r"tx\.origin", "Use of tx.origin detected", "high"),
        ("SELFDESTRUCT", r"selfdestruct", "selfdestruct detected", "critical"),
        ("DELEGATECALL", r"delegatecall", "delegatecall detected", "high"),
        ("LOW_LEVEL_CALL", r"\.call\(", "Low level call detected", "medium"),
        ("BLOCK_TIMESTAMP", r"block\.timestamp", "block.timestamp detected", "medium"),
    ]

    for idx, line in enumerate(lines, start=1):
        for rule, pattern, msg, sev in patterns:
            if re.search(pattern, line):
                add(rule, msg, sev, idx)

    return issues