<p align="center"><img src="assets/retailai-hero.svg" width="100%" alt="RetailAI: Adaptive Sales Intelligence and Recommendations" /></p>

<p align="center"><strong>Explore sales · Forecast patterns · Discover product relationships · Export insight</strong></p>
<p align="center">
<a href="https://retailai-adaptive-intelligence.streamlit.app/">Live app</a> · <a href="https://github.com/SiobhanGoh/RetailAI-Adaptive-Sales-Intelligence">Source</a> · <a href="#walkthrough">Walkthrough</a> · <a href="#methods-and-evidence">Methods &amp; evidence</a> · <a href="#run-locally">Run locally</a>
</p>

## Overview

**RetailAI** is a modular Python/Streamlit portfolio prototype for exploring retail transaction data. It combines **business intelligence**, **feature-aware data ingestion**, **sales forecasting**, **product-similarity recommendations** and **downloadable executive reporting** in a single workflow. Available analytical sections depend on the fields in the uploaded dataset.

> **Project status:** Working analytics prototype. Forecasting evaluation is being corrected; see [Evaluation and limitations](#evaluation-and-limitations) before interpreting historical model scores.

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

Source: [`data/weekly_forecast_benchmark_results.csv`](data/weekly_forecast_benchmark_results.csv) and [`data/final_forecasting_summary.csv`](data/final_forecasting_summary.csv). **These are exploratory research-selection numbers and do not validate the deployed app's forecasting path.** The benchmark's selection holdout was reused for tuning; a clean, frozen evaluation is a planned next step.
</details>

### 3 · Recommendations

The source contains a customer–product sales pivot for collaborative item similarity, product text transformed with **TF-IDF**, cosine-similarity scoring and a conditional blended recommender. `utils/recommendation_utils.py` uses a **70/30 transaction/content** blend when transaction similarity is sufficiently informative, otherwise a **20/80** blend favouring content. No offline ranking benchmark, conversion uplift or revenue impact has been established.

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

The repository's dependencies are not yet locked to a tested installation environment. Use a clean Python virtual environment; a tested version matrix will be added following compatibility checks.

## Evaluation and limitations

**Documented issues being addressed:**

- **Date parsing:** the bundled Superstore file uses day/month/year dates. The current default parser can drop valid records; the audit observed **3,959** rows in the live view versus **9,800** in the underlying source. Dashboard totals from the current default view are therefore incomplete.
- **Forecast target leakage:** the app's unshifted `Weekly_Sales.diff(1)` and `.pct_change(1)` contain the target week's value. They should not be used as features to claim future forecast accuracy. Live model scores are withheld from the project summary until the code is corrected and re-evaluated.
- **Research-versus-app mismatch:** the historical benchmark and live app do not use identical scaling and input processing. Their metrics are not interchangeable.
- **Interpretation limits:** similarity scores are not purchase probabilities; rule-based business-health/forecast-confidence labels are not calibrated estimates.

**Repair sequence:** correct strict day-first parsing → shift historical-only features → ensure training and future prediction use identical transformations → rerun chronological baselines/holdout without repeated tuning → regression-test app pages and PDF outputs → update benchmarks and screenshots.

This project demonstrates an implemented analytics product and a commitment to honest evaluation, **not verified business gains or production-grade forecasting**.

<details>
<summary><strong>Data provenance and responsible reuse</strong></summary>

The demo includes a Superstore-labelled CSV. Verify its licence and redistribution terms before republishing or creating derivatives. Remove any confidential user-uploaded content from screenshots and reports. The current repository also includes generated similarity artefacts; check their use and size before moving them out of version control.
</details>

## Next improvements

- [ ] Correct date parsing and forecast leakage, then regenerate valid results.
- [ ] Add real app screenshots and a short optional demo clip.
- [ ] Document tested versions, sample-data provenance and unit tests.
- [ ] Clean tracked Python bytecode and generated artefacts without breaking deployment.

---

**Siobhan Goh** · Master of Artificial Intelligence, Monash University Malaysia · [LinkedIn](https://www.linkedin.com/in/siobhangoh/)