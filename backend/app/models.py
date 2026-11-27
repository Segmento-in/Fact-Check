from datetime import datetime, timezone
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class Article(BaseModel):
    """Article model representing an ingested news article."""

    model_config = ConfigDict(populate_by_name=True)

    id: Optional[str] = None
    hn_id: Optional[int] = 0
    title: str
    url: str
    published_at: Optional[datetime] = None
    hn_score: int = 0
    source: str = "Hacker News"
    publisher: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None

    @field_validator("published_at")
    @classmethod
    def ensure_utc_timezone(cls, v: Optional[datetime]) -> Optional[datetime]:
        """Ensure published_at is timezone-aware UTC if provided."""
        if v is not None and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v


ExtractionStatus = Literal["ok", "too_short", "no_text", "not_html", "fetch_failed"]


class ExtractionResult(BaseModel):
    """Result of extracting readable article text from a web page."""

    model_config = ConfigDict(populate_by_name=True)

    status: ExtractionStatus
    text: str = ""
    word_count: int = 0
    final_url: Optional[str] = None


# Domain contract types
VerdictKey = Literal["supported", "refuted", "mixed", "not_enough_evidence"]
ConfidenceLevel = Literal["Low", "Medium", "High"]
StanceKey = Literal["supports", "refutes", "neutral"]


class TrustedSource(BaseModel):
    """A verified, trusted source domain for factual corroboration."""

    model_config = ConfigDict(populate_by_name=True)

    name: str
    domain: str
    category: str


class Evidence(BaseModel):
    """A single piece of evidence retrieved from a source to verify a claim."""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    source_name: str
    source_domain: str
    url: str
    snippet: str
    stance: StanceKey
    fetched_at: datetime
    wire_origin: Optional[str] = None

    @field_validator("fetched_at")
    @classmethod
    def ensure_utc_timezone(cls, v: datetime) -> datetime:
        """Ensure fetched_at is timezone-aware UTC."""
        if v is not None and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v


class ClaimCheck(BaseModel):
    """A factual claim extracted from an article and its verification verdict."""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    claim_text: str
    verdict_key: VerdictKey
    confidence: ConfidenceLevel
    explanation: str
    independent_source_count: int
    evidence: List[Evidence] = Field(default_factory=list)


class ExtractionSummary(BaseModel):
    """Summary of article text extraction for the ArticleReport contract."""

    model_config = ConfigDict(populate_by_name=True)

    status: Literal["ok", "too_short", "no_text", "not_html", "fetch_failed", "not_requested"]
    word_count: int
    text_preview: str
    final_url: Optional[str] = None


class ArticleReport(BaseModel):
    """The unified report for an article, its extraction status, and claim verdicts."""

    model_config = ConfigDict(populate_by_name=True)

    article: Article
    extraction: ExtractionSummary
    checked: bool = False
    overall_verdict_key: Optional[VerdictKey] = None
    overall_confidence: Optional[ConfidenceLevel] = None
    claims: List[ClaimCheck] = Field(default_factory=list)
    skipped_statements: List[str] = Field(default_factory=list)


class ArticlesResponse(BaseModel):
    """API response model for GET /api/articles."""

    model_config = ConfigDict(populate_by_name=True)

    articles: List[ArticleReport]
    total: int
    cached: bool


class TrustedSourcesResponse(BaseModel):
    """API response model for GET /api/trusted-sources."""

    model_config = ConfigDict(populate_by_name=True)

    sources: List[TrustedSource]
