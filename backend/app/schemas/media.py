from pydantic import BaseModel


class UploadedImage(BaseModel):
    """An optimised upload, ready to drop into a plant's `image`."""

    url: str
    placeholder: str
    background: str
    width: int
    height: int
    size_bytes: int
