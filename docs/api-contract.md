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

`GET /datasets/{id}/profile` includes target eligibility based on data type, value cardinality, and missingness.

`POST /datasets/{id}/ml/train` accepts `target_column`. The service detects the task, trains RandomForestClassifier or RandomForestRegressor, evaluates a held-out split, refits the final pipeline on all labeled rows, and returns the metrics and dynamic feature schema.

`POST /datasets/{id}/ml/predict` accepts `model_run_id` and an `inputs` object containing exactly one value for each trained feature. It returns one predicted target and optional class probabilities.

`GET /datasets/{id}/ml/runs/{run_id}` returns the saved metrics and feature schema so a trained model can be resumed for later predictions.


## Exports

`GET /datasets/{id}/exports/{export_type}` supports `cleaned-data`, `data-profile`, `cleaning-log`, `chart-data`, `model-metrics`, `model-pipeline`, and `all.zip`. Model-specific exports require `run_id`; chart data requires `chart_run_id`.
