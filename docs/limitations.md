# Supported behavior and known limitations

- Classification uses RandomForestClassifier; regression uses RandomForestRegressor. The task is inferred from target values and cardinality.
- Metrics come from a single held-out split. Small datasets and imbalanced classes receive warnings; metrics do not guarantee future performance.
- Classification needs at least two examples of every class and enough rows for a stratified holdout. Regression needs at least ten usable target rows.
- The parser allows CSV/XLSX up to the configured upload cap, 500 columns, and 500,000 rows; model training is more computationally expensive and should be limited by deployment resources.
- Local artifact storage is temporary on ephemeral hosts. Configure durable storage before promising that sessions survive deploys or restarts.
- Anonymous UUID session access is suitable for a portfolio demo, not a multi-tenant environment with private production data. Add authentication, ownership checks, rate limits, and stronger abuse protection before production use.
- Saved pipelines are Python-version/dependency-sensitive and remain in application-managed artifact storage.
