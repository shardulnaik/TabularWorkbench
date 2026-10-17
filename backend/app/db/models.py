from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DatasetSession(Base):
    __tablename__ = "dataset_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_extension: Mapped[str] = mapped_column(String(10), nullable=False)
    selected_sheet: Mapped[str | None] = mapped_column(String(255), nullable=True)
    original_upload_path: Mapped[str] = mapped_column(Text, nullable=False)
    original_dataframe_path: Mapped[str] = mapped_column(Text, nullable=False)
    cleaned_dataframe_path: Mapped[str] = mapped_column(Text, nullable=False)
    row_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    column_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    data_revision: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cleaning_applied: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    cleaning_logs: Mapped[list["CleaningLog"]] = relationship(back_populates="dataset", cascade="all, delete-orphan")
    chart_runs: Mapped[list["ChartRun"]] = relationship(back_populates="dataset", cascade="all, delete-orphan")
    model_runs: Mapped[list["ModelRun"]] = relationship(back_populates="dataset", cascade="all, delete-orphan")


class CleaningLog(Base):
    __tablename__ = "cleaning_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dataset_id: Mapped[str] = mapped_column(ForeignKey("dataset_sessions.id", ondelete="CASCADE"), index=True)
    action_id: Mapped[str] = mapped_column(String(80), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    rows_affected: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    details_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    dataset: Mapped[DatasetSession] = relationship(back_populates="cleaning_logs")


class ChartRun(Base):
    __tablename__ = "chart_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    dataset_id: Mapped[str] = mapped_column(ForeignKey("dataset_sessions.id", ondelete="CASCADE"), index=True)
    chart_type: Mapped[str] = mapped_column(String(50), nullable=False)
    config_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    chart_data_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    data_revision: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    dataset: Mapped[DatasetSession] = relationship(back_populates="chart_runs")


class ModelRun(Base):
    __tablename__ = "model_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    dataset_id: Mapped[str] = mapped_column(ForeignKey("dataset_sessions.id", ondelete="CASCADE"), index=True)
    data_revision: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    target_column: Mapped[str] = mapped_column(String(255), nullable=False)
    scoring_metric: Mapped[str] = mapped_column(String(50), nullable=False)
    comparison_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    split_manifest_path: Mapped[str] = mapped_column(Text, nullable=False)
    selected_model: Mapped[str | None] = mapped_column(String(80), nullable=True)
    evaluation_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    artifact_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    predictions_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    dataset: Mapped[DatasetSession] = relationship(back_populates="model_runs")
