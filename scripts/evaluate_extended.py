"""Run frozen recursive forecast and held-out-basket recommendation comparisons."""
import hashlib
import json
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import pandas as pd
from utils.data_loader import prepare_adaptive_dataset
from utils.evaluation import rolling_forecasts, evaluate_recommendations

if __name__ == '__main__':
    source = ROOT / 'data/Superstore Sales Dataset.csv'
    clean, _ = prepare_adaptive_dataset(pd.read_csv(source), date_format='%d/%m/%Y')
    frame, forecast = rolling_forecasts(clean)
    recommendations = evaluate_recommendations(clean)
    result = {'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
              'forecast': forecast, 'recommendations': recommendations}
    out = ROOT / 'verification'
    out.mkdir(exist_ok=True)
    frame.to_csv(out / 'rolling_origin_predictions.csv', index=False)
    (out / 'extended_evaluation.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, indent=2))
