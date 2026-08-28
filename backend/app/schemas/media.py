from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MediaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    url: str
    content_type: str | None = None
    size_bytes: int | None = None
    uploaded_by: str | None = None
    created_at: datetime
