from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Category(Base):
    """
    The folder structure — Plants, Trees, Succulents, and so on.

    Self-referential so categories can nest (Plants > Indoor > Low light)
    without a schema change.
    """

    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(String(500))

    parent_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"))
    children: Mapped[list["Category"]] = relationship(
        back_populates="parent", cascade="all, delete-orphan"
    )
    parent: Mapped["Category | None"] = relationship(
        back_populates="children", remote_side="Category.id"
    )

    plants: Mapped[list["Plant"]] = relationship(back_populates="category")  # noqa: F821
