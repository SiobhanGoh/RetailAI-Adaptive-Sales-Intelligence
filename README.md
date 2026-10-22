<p align="center"><img src="assets/retailai-hero.svg" width="100%" alt="RetailAI: Adaptive Sales Intelligence and Recommendations" /></p>

<p align="center"><strong>Explore sales · Forecast patterns · Discover product relationships · Export insight</strong></p>
<p align="center">
<a href="https://retailai-adaptive-intelligence.streamlit.app/">Live app</a> · <a href="https://github.com/SiobhanGoh/RetailAI-Adaptive-Sales-Intelligence">Source</a> · <a href="#walkthrough">Walkthrough</a> · <a href="#methods-and-evidence">Methods &amp; evidence</a> · <a href="#run-locally">Run locally</a>
</p>

## Overview

**RetailAI** is a modular Python/Streamlit portfolio prototype for exploring retail transaction data. It combines **business intelligence**, **feature-aware data ingestion**, **sales forecasting**, **product-similarity recommendations** and **downloadable executive reporting** in a single workflow. Available analytical sections depend on the fields in the uploaded dataset.

> **Project status:** Analytics prototype with corrected date handling and historical-only forecast features. See [Evaluation and limitations](#evaluation-and-limitations) for the retrospective evaluation protocol and remaining limits.

## At a glance

| Analytics & BI | Machine learning | Product experience |
|---|---|---|
| Revenue/order KPIs, category and regional analysis, Pareto trends, business narratives | Time-aggregated sales modelling and hybrid content/transaction similarity recommendations | CSV/Excel uploads, adaptive feature availability, modular pages and PDF exports |

## Walkthrough

1. **Load and inspect:** select the bundled example or upload CSV/Excel; detect known sales, date, product, category, region and customer fields.
2. **Understand the business:** explore sales patterns, composition and concentration in interactive dashboards.
3. **Model sales:** inspect weekly time-series forecasts *as an experimental feature*; methodology and known validation issues are disclosed below.
4. **Recommend products:** choose TF-IDF/cosine content similarity or a blended transaction/content approach when customer history is available.
5. **Export a report:** generate an executive-oriented PDF combining compatible modules and plain-language interpretations.

<p align="center"><img src="assets/architecture.svg" width="100%" alt="RetailAI system architecture diagram" /></p>

<details>
<summary><strong>Explore the repository structure</strong></summary>

```text
app.py
app_pages/
  overview.py
  business_analysis.py
  forecasting.py
  recommendations.py
  project_summary.py
utils/
  data_loader.py
  column_mapper.py
  adaptive_utils.py
  forecasting_utils.py
  recommendation_utils.py
  interpretation_utils.py
  insight_utils.py
  pdf_report.py
data/
requirements.txt
```

The project is arranged as a multi-page Streamlit application with separate data, modelling, visualisation and reporting utilities.
</details>

## App screenshots

Actual local app screens captured with the corrected bundled-data pipeline on 22 October 2026.

![RetailAI overview with 9,800 records](assets/app-overview.png)

![Forecast evaluation and baseline comparison](assets/app-forecast.png)

## Methods and evidence

### 1 · Analytics and adaptive data handling

`utils/data_loader.py`, `column_mapper.py` and `adaptive_utils.py` load files, map common column names, standardise values and determine which sections are applicable. The dashboards support category/region/customer/product summaries and composition views. Interpretations are **rules and heuristics**, not responses from a generative language model.

### 2 · Forecasting research

The original research compared **12 weekly regression model families** on 209 aggregated weeks, with 197 feature-complete rows and a chronological **157/40** split. The selected research KNN used scaling, five Euclidean neighbours and uniform weights; 24 KNN settings were explored on the same holdout. These saved comparisons are **model-selection evidence**, not an untouched external assessment.

<details>
<summary><strong>View exploratory saved benchmark figures</strong></summary>

| Weekly research KNN | Saved selected-split value |
|---|---:|
| MAE | 4,200.77 sales units |
| RMSE | 5,741.21 sales units |
| R² | 0.404 |
| WAPE | 27.40% |

Source: [`data/weekly_forecast_benchmark_results.csv`](data/weekly_forecast_benchmark_results.csv) and [`data/final_forecasting_summary.csv`](data/final_forecasting_summary.csv). **These are exploratory research-selection numbers.** The benchmark's selection holdout was reused for tuning. The corrected one-step reproduction and frozen recursive checks below provide retrospective evidence, not an untouched external assessment.
</details>

### 3 · Recommendations

The source contains a customer–product sales pivot for collaborative item similarity, product text transformed with **TF-IDF**, cosine-similarity scoring and a conditional blended recommender. `utils/recommendation_utils.py` uses a **70/30 transaction/content** blend when transaction similarity is sufficiently informative, otherwise a **20/80** blend favouring content. A chronological offline basket-completion benchmark is now included below; the popularity baseline performed better. No conversion uplift or revenue impact has been established.

### 4 · Executive reporting

`utils/pdf_report.py` generates reports with tables, figures, business interpretations and appropriate fallback sections when a dataset lacks required fields.

<details>
<summary><strong>Tech stack and implementation notes</strong></summary>

**Python · Streamlit · Pandas · NumPy · scikit-learn · Plotly · Matplotlib · ReportLab · openpyxl**

Relevant source entry points: `app.py`, `utils/data_loader.py`, `utils/forecasting_utils.py`, `utils/recommendation_utils.py`, `utils/pdf_report.py`. The application runs models and analytics at interaction time; it is not an AutoML, database-backed or authenticated SaaS platform.
</details>

## Run locally

```bash
git clone https://github.com/SiobhanGoh/RetailAI-Adaptive-Sales-Intelligence.git
cd RetailAI-Adaptive-Sales-Intelligence
python -m venv .venv
# Activate your environment (Windows: .venv\Scripts\activate; macOS/Linux: source .venv/bin/activate)
python -m pip install -r requirements.txt
python -m streamlit run app.py
```

Use Python 3.12 and the versions in `requirements.txt`. Run `python -m pytest -q tests` after installing `pytest` to check date handling and forecasting invariants.

## Verified repair results

The bundled dataset now retains **9,800 records**, with sales totalling **2,261,536.7827**. The first row's order date is correctly read as **8 November 2017**. Six data/forecast regression checks and five default-page checks passed on Windows with Python 3.12.

| Corrected one-week-ahead evaluation | Result |
|---|---:|
| Training / evaluation weeks | 157 / 40 |
| Scaled KNN MAE | 4,200.77 |
| Scaled KNN RMSE | 5,741.21 |
| Scaled KNN R² | 0.4040 |
| Scaled KNN WAPE | 27.40% |
| Previous-week baseline MAE | 6,410.25 |
| Previous-week baseline RMSE | 7,448.08 |

Reproduce with `python scripts/verify_repair.py`. [Aggregate evidence](verification/corrected_evaluation.json) and [dated predictions](verification/one_step_predictions.csv) are included. These reproduce historical research values after aligning the app pipeline; the historical selection holdout was already explored, so this is **not a new independent accuracy claim**.

## Extended retrospective evaluation · 23 October 2026

Run `python scripts/evaluate_extended.py`. The complete [aggregate results](verification/extended_evaluation.json) and [dated recursive predictions](verification/rolling_origin_predictions.csv) are versioned. Settings were fixed before these checks; no tuning used the new results.

**Recursive forecasts:** 37 expanding-window origins from 25 March to 2 December 2018, each predicting the next four weeks (148 forecast-target pairs). The scaler and KNN are fitted only to history available at each origin. Future lags use predictions, never later actual sales. A regression test also poisons future values to detect leakage through inherited DataFrame history.

| All horizons | MAE | RMSE | WAPE |
|---|---:|---:|---:|
| Fixed scaled KNN | 5,222.01 | 6,667.38 | 34.00% |
| Repeat last observed week | 6,687.06 | 8,340.18 | 43.54% |
| Previous four-week mean | 5,674.42 | 6,854.35 | 36.94% |

KNN WAPE by horizon: **31.79%, 32.36%, 35.61%, 36.17%** for weeks 1–4. KNN improves aggregate error over both baselines, but the four-week-mean baseline has lower first-horizon RMSE. Forecasts overlap and are not independent samples; the underlying dataset had already been explored.

**Product suggestions:** train through 6 April 2018 (7,053 rows); test later orders (2,747 rows). Each known seed item in a held-out multi-item order is used to retrieve the other known items in that order. Customer–product matrices, TF-IDF vocabulary, metadata and popularity use training data only. Popularity counts distinct training orders per product. Each method returns five candidates, excluding the seed.

| Method | Hit rate@5 | Recall@5 | NDCG@5 | Catalog coverage |
|---|---:|---:|---:|---:|
| Hybrid similarity | 0.62% | 0.16% | 0.0017 | 94.57% |
| Content similarity | 1.49% | 0.60% | 0.0041 | 75.17% |
| Training popularity | 4.07% | 1.65% | 0.0134 | 0.33% |

There are **1,940 eligible seed queries** from 679 later multi-item orders. Exclusions: 57 unknown seeds and 20 known seeds with no known target; 97.47% of targets for known seeds were in the training catalog. Queries from the same order are dependent. The popularity baseline is stronger on this task; the similarity methods remain exploratory product-discovery features. Wider catalog coverage does not establish better relevance. This test is not personalised next-purchase prediction or an online business-impact study.

## Evaluation and limitations

**Corrections in this revision:**

- The bundled day/month/year dates use an explicit format. Uploaded data exposes a day-first/month-first choice; ISO dates retain year-month-day ordering. Invalid order dates are reported.
- All forecast lags, rolling statistics and changes use only observations before the predicted week. Historical and future features use the same standard-deviation definition and calendar index.
- Both evaluation and final forecasting use a StandardScaler + five-neighbour KNN pipeline. Evaluation scaling is fitted only on the training period.
- The final 20% of eligible weeks is evaluated chronologically, with previous observed weeks available for each one-week-ahead prediction. A previous-week-sales baseline is scored on those same weeks. The model settings were fixed before this repair's evaluation and were not tuned against its results.
- Four-week future forecasts are recursive. Their retrospective errors are assessed separately in the rolling-origin comparison above and can compound over the horizon.

**Remaining limits:** These are retrospective estimates on an already explored dataset, not independent external validation. The archived research CSVs describe model selection; some numerical values are reproduced by the corrected one-step path but do not validate future performance. Similarity scores are not purchase probabilities. Recommendation labels describe similarity strength; forecast confidence, inventory-pressure and business-health labels are heuristics, not calibrated probabilities or measured stock outcomes.

<details>
<summary><strong>Data provenance and responsible reuse</strong></summary>

The demo includes a Superstore-labelled CSV. Verify its licence and redistribution terms before republishing or creating derivatives. Remove any confidential user-uploaded content from screenshots and reports. The current repository also includes generated similarity artefacts; check their use and size before moving them out of version control.
</details>

## Next improvements

- [x] Correct date parsing, forecast leakage, scaling and prediction-time feature alignment.
- [x] Add real app screenshots.
- [x] Add regression checks for dates, leakage, feature parity and chronological evaluation.
- [ ] Confirm redistribution terms for the bundled sample data.
- [x] Remove tracked Python bytecode and ignore future cache files.
- [ ] Review large generated similarity artefacts before removing them.

---

**Siobhan Goh** · Master of Artificial Intelligence, Monash University Malaysia · [LinkedIn](https://www.linkedin.com/in/siobhan-goh/)
