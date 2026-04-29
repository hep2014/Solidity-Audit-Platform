from pydantic import BaseModel
from typing import List


class ScanIssue(BaseModel):
    severity: str
    rule: str
    message: str
    line: int | None = None


class ScanResponse(BaseModel):
    filename: str
    issues: List[ScanIssue]
    total: int