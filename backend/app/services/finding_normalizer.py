import hashlib
import json
from typing import Any

from app.core.enums import FindingSeverity


SEVERITY_ALIASES = {
    "critical": FindingSeverity.CRITICAL.value,
    "crit": FindingSeverity.CRITICAL.value,

    "high": FindingSeverity.HIGH.value,

    "medium": FindingSeverity.MEDIUM.value,
    "moderate": FindingSeverity.MEDIUM.value,

    "low": FindingSeverity.LOW.value,

    "info": FindingSeverity.INFO.value,
    "informational": FindingSeverity.INFO.value,
    "optimization": FindingSeverity.INFO.value,
    "unknown": FindingSeverity.INFO.value,
}


def normalize_severity(value: str | None) -> str:
    if not value:
        return FindingSeverity.INFO.value

    normalized = value.strip().lower()
    return SEVERITY_ALIASES.get(normalized, FindingSeverity.INFO.value)


def normalize_rule(value: str | None) -> str:
    if not value:
        return "UNKNOWN_RULE"

    return value.strip().upper().replace("-", "_").replace(" ", "_")


def _normalize_optional_int(value: Any) -> int | None:
    if value is None:
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _normalize_string(value: Any) -> str | None:
    if value is None:
        return None

    normalized = str(value).strip()

    if not normalized:
        return None

    return normalized


def _normalize_references(value: Any) -> list[str] | dict | None:
    if value is None:
        return None

    if isinstance(value, dict):
        return value

    if isinstance(value, list):
        normalized_items = [
            str(item).strip()
            for item in value
            if str(item).strip()
        ]
        return normalized_items or None

    normalized = str(value).strip()

    if not normalized:
        return None

    return [normalized]


def build_fingerprint(item: dict, default_tool: str) -> str:
    payload = {
        "tool": item.get("tool") or default_tool,
        "rule": normalize_rule(item.get("rule")),
        "file_path": item.get("file_path") or "",
        "line": _normalize_optional_int(item.get("line")),
        "column": _normalize_optional_int(item.get("column")),
        "message": item.get("message") or "",
    }

    serialized = json.dumps(
        payload,
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
    )

    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def normalize_finding(item: dict, default_tool: str) -> dict:
    message = item.get("message") or item.get("description") or ""

    normalized = {
        "severity": normalize_severity(item.get("severity")),
        "rule": normalize_rule(item.get("rule")),
        "message": str(message),

        "file_path": _normalize_string(item.get("file_path")),

        "line": _normalize_optional_int(item.get("line")),
        "column": _normalize_optional_int(item.get("column")),
        "end_line": _normalize_optional_int(item.get("end_line")),

        "tool": item.get("tool") or default_tool,

        "confidence": _normalize_string(item.get("confidence")),
        "description": _normalize_string(item.get("description")),
        "recommendation": _normalize_string(item.get("recommendation")),
        "references": _normalize_references(item.get("references")),
    }

    normalized["fingerprint"] = item.get("fingerprint") or build_fingerprint(
        normalized,
        default_tool=default_tool,
    )

    return normalized