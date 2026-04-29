SEVERITY_ORDER = {
    "critical": "critical",
    "high": "high",
    "medium": "medium",
    "low": "low",
    "info": "info",
    "informational": "info",
    "optimization": "info",
    "unknown": "info",
}


def normalize_severity(value: str | None) -> str:
    if not value:
        return "info"

    value = value.strip().lower()
    return SEVERITY_ORDER.get(value, "info")


def normalize_rule(value: str | None) -> str:
    if not value:
        return "UNKNOWN_RULE"

    return value.strip().upper().replace("-", "_")


def normalize_finding(item: dict, default_tool: str) -> dict:
    return {
        "severity": normalize_severity(item.get("severity")),
        "rule": normalize_rule(item.get("rule")),
        "message": item.get("message") or "",
        "line": item.get("line"),
        "tool": item.get("tool") or default_tool,
    }