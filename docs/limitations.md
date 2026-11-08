# Supported behavior and known limitations

- Classification compares Logistic Regression, Random Forest Classifier, and K-Nearest Neighbors. Regression currently provides Linear Regression. K-Means clustering is available without a target.
- Cross-validation scores are not final test metrics. The UI reports the held-out score separately after model selection.
- Classification datasets must contain enough labels per class for a stratified holdout and cross-validation. Regression and clustering also require enough usable rows for evaluation and scoring.
- The parser allows CSV/XLSX up to the configured upload cap, 500 columns, and 500,000 rows; model training is more computationally expensive and should be limited by deployment resources.
- Local artifact storage is temporary on ephemeral hosts. Configure durable storage before promising that sessions survive deploys or restarts.
- Anonymous UUID session access is suitable for a portfolio demo, not a multi-tenant environment with private production data. Add authentication, ownership checks, rate limits, and stronger abuse protection before production use.
- Exported pipelines are Python-version/dependency-sensitive and may only be loaded from trusted sources.
- Numeric feature signals are predictive associations and not causal explanation.
