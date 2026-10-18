# API contract overview

All data endpoints use the `/api/v1` prefix except `/health`, `/health/ready`, and `/`.

## Upload

`POST /datasets/upload` — multipart form fields `file` and optional `sheet_name`.

A successful first-sheet/CSV response includes `session_id`, `profile`, and `cleaning_plan`. For a multi-sheet XLSX workbook without a selected sheet, it returns `requires_sheet_selection: true` and `available_sheets`; the client must resubmit the chosen sheet.

## Cleaning

`GET /datasets/{id}/cleaning/plan` returns the action catalogue, estimated counts, and the safe default action identifiers.

`POST /datasets/{id}/cleaning/apply` accepts `{"actions": ["trim_whitespace"]}`. Only named actions are applied. The response includes the updated profile and cleaning-log entries.

## Charts

`POST /datasets/{id}/charts/data` accepts `chart_type`, optional `x_column`, optional `y_column`, and `aggregation` (`mean`, `sum`, `median`, or `count`). Chart type/column compatibility is enforced by the server. The response includes a `chart_run_id` and chart-ready data.

## Machine learning

`POST /datasets/{id}/ml/compare` accepts `target_column`, `scoring_metric`, `test_size`, and `random_state`. It returns five candidate model scores, ranked using cross-validation on the training partition.

`POST /datasets/{id}/ml/evaluate` accepts `model_run_id` and `selected_model`. The selected pipeline is evaluated on the preserved holdout partition; metrics, confusion matrix, classification report, feature signals, configuration, and artifact availability are returned.

## Exports

`GET /datasets/{id}/exports/{export_type}` supports `cleaned-data`, `data-profile`, `cleaning-log`, `chart-data`, `model-comparison`, `model-metrics`, `confusion-matrix`, `predictions`, `model-pipeline`, and `all.zip`. Model-specific exports require `run_id`; chart data requires `chart_run_id`.
