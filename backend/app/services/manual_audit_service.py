def generate_manual_audit_checklist() -> list[dict]:
    checks = [
        {
            "rule": "MANUAL_ACCESS_CONTROL_REVIEW",
            "title": "Access control review",
            "message": (
                "Manually verify all privileged functions: owner-only methods, "
                "admin setters, mint/burn functions, upgrade functions, pause/unpause logic."
            ),
        },
        {
            "rule": "MANUAL_EXTERNAL_CALLS_REVIEW",
            "title": "External calls review",
            "message": (
                "Review all external calls, including call, delegatecall, staticcall, "
                "transfer and send. Check whether state is updated before external interaction."
            ),
        },
        {
            "rule": "MANUAL_REENTRANCY_REVIEW",
            "title": "Reentrancy-sensitive paths review",
            "message": (
                "Manually inspect withdraw, claim, redeem, swap and callback-like functions "
                "for reentrancy risks and missing reentrancy guards."
            ),
        },
        {
            "rule": "MANUAL_ORACLE_REVIEW",
            "title": "Oracle dependencies review",
            "message": (
                "Verify whether prices, randomness or external data sources can be manipulated, "
                "stale, unavailable or controlled by a privileged actor."
            ),
        },
        {
            "rule": "MANUAL_ARITHMETIC_REVIEW",
            "title": "Arithmetic and rounding review",
            "message": (
                "Review unchecked blocks, division, rounding behavior, precision loss, "
                "share accounting and token amount calculations."
            ),
        },
        {
            "rule": "MANUAL_TOKEN_ACCOUNTING_REVIEW",
            "title": "Token accounting review",
            "message": (
                "Verify that internal balances, totalSupply, deposits, withdrawals and reserves "
                "remain consistent under normal and edge-case execution paths."
            ),
        },
        {
            "rule": "MANUAL_UPGRADEABILITY_REVIEW",
            "title": "Upgradeability review",
            "message": (
                "If proxies or upgrade mechanisms are used, verify initializer protection, "
                "storage layout compatibility and upgrade authorization."
            ),
        },
        {
            "rule": "MANUAL_DOS_GAS_REVIEW",
            "title": "DoS and gas review",
            "message": (
                "Check loops over dynamic arrays, unbounded iteration, external calls inside loops "
                "and conditions that can permanently block execution."
            ),
        },
        {
            "rule": "MANUAL_INVARIANTS_REVIEW",
            "title": "Invariant assumptions review",
            "message": (
                "Define and manually verify core invariants: total balances, collateralization, "
                "supply consistency, authorization boundaries and lifecycle constraints."
            ),
        },
        {
            "rule": "MANUAL_EMERGENCY_CONTROLS_REVIEW",
            "title": "Emergency controls review",
            "message": (
                "Review pause, emergency withdraw, admin recovery and incident response mechanisms. "
                "Check whether emergency powers are excessive or insufficient."
            ),
        },
    ]

    return [
        {
            "severity": "info",
            "rule": item["rule"],
            "message": f"{item['title']}\n\n{item['message']}",
            "line": None,
            "tool": "manual-audit",
        }
        for item in checks
    ]