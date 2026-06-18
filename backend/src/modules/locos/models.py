from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base


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
    date_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    stage: Mapped[int] = mapped_column(Integer, nullable=False)
    shift: Mapped[int] = mapped_column(Integer, nullable=False)

    loco_type: Mapped["LocoType"] = relationship()
