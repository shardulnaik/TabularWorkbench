# Supported behavior and known limitations

- Classification only; regression is deferred.
- Candidate models are deliberately limited to a baseline, Logistic Regression, and Random Forest.
- Cross-validation scores are not final test metrics. The UI reports the held-out score separately after model selection.
- Datasets must contain enough labels per class for a stratified holdout and cross-validation. Very small or rare-class datasets return a validation error.
- The parser allows CSV/XLSX up to the configured upload cap, 500 columns, and 500,000 rows; model training is more computationally expensive and should be limited by deployment resources.
- Local artifact storage is temporary on ephemeral hosts. Configure durable storage before promising that sessions survive deploys or restarts.
- Anonymous UUID session access is suitable for a portfolio demo, not a multi-tenant environment with private production data. Add authentication, ownership checks, rate limits, and stronger abuse protection before production use.
- Exported pipelines are Python-version/dependency-sensitive and may only be loaded from trusted sources.
- Numeric feature signals are predictive associations and not causal explanation.
