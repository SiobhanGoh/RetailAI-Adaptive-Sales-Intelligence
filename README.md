# RetailAI — Adaptive Sales Intelligence & Recommendation Platform

A deployable AI-enhanced retail analytics platform built with Streamlit, machine learning, adaptive dataset intelligence, and executive-focused business storytelling.

RetailAI transforms raw retail and e-commerce datasets into interactive business intelligence dashboards, forecasting systems, recommendation engines, and executive PDF reports — while adapting dynamically to different dataset structures.

---

## Live Demo

```text
[https://retailai-adaptive-intelligence.streamlit.app/]
```

---

# Project Overview

RetailAI was designed to go beyond a traditional student dashboard project.

Instead of building a static analytics interface, the platform was developed as an adaptive analytics SaaS-style prototype capable of:

* detecting dataset capabilities dynamically
* enabling/disabling analytics intelligently
* generating forecasting insights
* producing recommendation intelligence
* delivering executive-style business narratives
* exporting professional PDF reports

The system emphasizes:

* business usability
* defensive programming
* modular architecture
* adaptive analytics intelligence
* executive storytelling

---

# Key Features

## Adaptive Dataset Intelligence

RetailAI dynamically detects available dataset capabilities and adjusts the platform experience accordingly.

Supported dataset modes include:

* Full Transaction Dataset
* Time-Based Sales Dataset
* Product/Category Sales Dataset
* Basic Sales Dataset
* Product Catalog Dataset
* Limited Dataset

The system intelligently detects:

* sales columns
* date columns
* product information
* customer identifiers
* category fields
* region/state fields

This prevents module crashes and creates a more resilient analytics workflow.

---

# Overview Dashboard

The executive overview page includes:

* KPI intelligence cards
* business health scoring
* dataset readiness evaluation
* AI capability diagnostics
* sales trend analysis
* contribution analysis
* distribution insights
* executive quick-read narratives
* adaptive dataset summaries

---

# Business Intelligence Analytics

RetailAI provides interactive business analysis features such as:

* Top Products Analysis
* Regional Sales Analysis
* Category Performance
* Segment Analysis
* Pareto Analysis
* Sales Heatmaps
* Concentration & Dependency Diagnostics

The platform automatically generates:

* strategic risk interpretation
* dependency warnings
* diversification analysis
* executive-style recommendations

---

# Forecasting Engine

The forecasting module uses machine learning to generate future sales intelligence.

Implemented forecasting workflow:

* weekly aggregation
* lag feature engineering
* rolling average features
* K-Nearest Neighbors forecasting

Evaluation metrics:

* RMSE
* MAE
* R²
* WAPE

Additional intelligence layers:

* Forecast Confidence Meter
* Demand Momentum Analysis
* Inventory Pressure Interpretation
* Forecast Anomaly Detection
* Forecast Risk Narratives

---

# Recommendation Engine

RetailAI includes an adaptive recommendation system.

Capabilities:

* content-based recommendations
* hybrid recommendations
* similarity scoring
* recommendation opportunity analysis

When customer transactional data is available, the platform enhances recommendation quality using hybrid recommendation logic.

---

# Executive PDF Reporting

The platform generates professional PDF reports containing:

* executive summaries
* strategic diagnostics
* forecasting intelligence
* recommendation insights
* business narratives
* operational recommendations

The reporting engine was designed to resemble lightweight executive BI reporting rather than simple data exports.

---

# Tech Stack

## Frontend & Framework

* Streamlit

## Data Processing

* Pandas
* NumPy

## Visualization

* Plotly
* Matplotlib

## Machine Learning

* scikit-learn

## Reporting

* ReportLab

---

# Project Architecture

```text
User Dataset Upload
        ↓
Adaptive Dataset Detection Engine
        ↓
Capability Validation Layer
        ↓
RetailAI Intelligence Modules
    ├── Overview Analytics
    ├── Business Intelligence
    ├── Forecasting Engine
    ├── Recommendation Engine
    └── Executive Reporting
        ↓
Interactive Dashboard + PDF Export
```

---

# Project Structure

```text
RetailAI/
│
├── app.py
├── requirements.txt
├── README.md
│
├── app_pages/
│   ├── overview.py
│   ├── business_analysis.py
│   ├── forecasting.py
│   ├── recommendations.py
│   └── project_summary.py
│
├── utils/
│   ├── adaptive_utils.py
│   ├── forecasting_utils.py
│   ├── interpretation_utils.py
│   ├── insight_utils.py
│   ├── pdf_report.py
│   ├── data_loader.py
│   ├── filters.py
│   └── ui.py
│
└── assets/
```

---

# Installation

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/RetailAI-Adaptive-Sales-Intelligence.git
```

Navigate into the project folder:

```bash
cd RetailAI-Adaptive-Sales-Intelligence
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run the Streamlit application:

```bash
python -m streamlit run app.py
```

---

# Deployment

RetailAI is deployed using:

* GitHub
* Streamlit Community Cloud

---

# Future Improvements

Potential future enhancements include:

* advanced forecasting models
* automated anomaly classification
* LLM-powered executive summaries
* real-time database connectivity
* authentication system
* cloud storage integration
* dashboard personalization
* multi-user support

---

# Author

**Siobhan Goh**

Bachelor of Information Systems (Data Analytics)
Sunway University

Interests:

* Data Analytics
* Business Intelligence
* AI Applications
* Machine Learning
* Retail Intelligence Systems

---

# License

This project is intended for educational, portfolio, and demonstration purposes.
