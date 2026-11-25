"""Original document input passed between the worker and assessment agents."""

from dataclasses import dataclass


@dataclass(frozen=True)
class SourceDocument:
    id: str
    contents: bytes
    page_count: int
