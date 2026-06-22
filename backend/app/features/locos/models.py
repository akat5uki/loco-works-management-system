from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class LocoType(Base):
    __tablename__ = "loco_type"
    loco_type_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    loco_type_name: Mapped[str] = mapped_column(String, nullable=False, unique=True)


class Loco(Base):
    __tablename__ = "loco"
    loco_number: Mapped[int] = mapped_column(Integer, primary_key=True)
    loco_type_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("loco_type.loco_type_id"), nullable=False
    )
    stage: Mapped[int] = mapped_column(Integer, nullable=False)
    despatched: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    loco_type: Mapped["LocoType"] = relationship()
