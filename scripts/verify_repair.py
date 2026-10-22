"""Reproduce the corrected default-data results without tuning against the holdout."""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import pandas as pd
from utils.data_loader import prepare_adaptive_dataset
from utils.forecasting_utils import train_weekly_knn_forecast


def main():
    source = ROOT/'data/Superstore Sales Dataset.csv'
    raw = pd.read_csv(source)
    clean, _ = prepare_adaptive_dataset(raw, date_format='%d/%m/%Y')
    weekly, predictions, metrics, future = train_weekly_knn_forecast(clean)
    result = {
        'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'raw_rows': len(raw), 'cleaned_rows': len(clean),
        'sales_total': float(clean.Sales.sum()),
        'first_order_date': str(clean.Order_Date.iloc[0].date()),
        'eligible_weeks': len(weekly),
        'test_start': str(predictions.Week.min().date()),
        'test_end': str(predictions.Week.max().date()),
        'metrics': metrics,
        'evaluation': 'Fixed five-neighbour scaled KNN; final 20% chronological one-step evaluation; no tuning in this repair.',
        'limitations': 'Retrospective data already explored historically; not external validation. Four-step future error is not estimated here.',
    }
    out = ROOT/'verification'
    out.mkdir(exist_ok=True)
    (out/'corrected_evaluation.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    predictions.to_csv(out/'one_step_predictions.csv', index=False)
    future.to_csv(out/'recursive_forecast.csv', index=False)
    print(json.dumps(result, indent=2))


if __name__ == '__main__': main()
