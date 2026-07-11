"""Shared helpers for the energy ML Vercel service.

Ported from the retired Laravel-side scripts/energy_ml.py, plus auth and
blob-storage helpers. Model files are persisted via the internal api/blob.js
Node function (the official @vercel/blob SDK is JS-only), not called directly.
"""
import base64
import hmac
import io
import json
import os
import time

import numpy as np
import requests
from sklearn.base import clone
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVR
import joblib


def check_auth(headers) -> bool:
    token = os.environ.get('ML_SERVICE_TOKEN', '')
    auth = headers.get('Authorization') or headers.get('authorization') or ''
    provided = auth[7:] if auth.lower().startswith('bearer ') else ''
    return bool(token) and hmac.compare_digest(provided, token)


def json_response(handler, status: int, payload: dict):
    body = json.dumps(payload).encode()
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json')
    handler.end_headers()
    handler.wfile.write(body)


def read_json_body(handler) -> dict:
    length = int(handler.headers.get('Content-Length', 0) or 0)
    return json.loads(handler.rfile.read(length) or b'{}')


def _internal_base_url() -> str:
    base = os.environ.get('INTERNAL_BASE_URL')
    if base:
        return base.rstrip('/')
    vercel_url = os.environ.get('VERCEL_URL')
    if vercel_url:
        return f'https://{vercel_url}'
    raise RuntimeError('Neither INTERNAL_BASE_URL nor VERCEL_URL is set — cannot reach api/blob.js.')


def _blob_call(action: str, **fields) -> dict:
    resp = requests.post(
        f'{_internal_base_url()}/api/blob',
        json={'action': action, **fields},
        headers={'Authorization': f"Bearer {os.environ.get('ML_SERVICE_TOKEN', '')}"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def blob_upload(pathname: str, data: bytes) -> str:
    return _blob_call('upload', pathname=pathname, contentBase64=base64.b64encode(data).decode())['url']


def blob_download(url: str) -> bytes:
    return base64.b64decode(_blob_call('download', url=url)['contentBase64'])


def blob_delete(url: str) -> None:
    _blob_call('delete', url=url)


def _parse_hidden_layers(s: str):
    """Parse '64,32' → (64, 32)."""
    parts = [p.strip() for p in s.split(',') if p.strip()]
    return tuple(int(p) for p in parts) if parts else (64, 32)


def _gamma(s: str):
    """Return float if numeric, otherwise the string ('scale'/'auto')."""
    try:
        return float(s)
    except (ValueError, TypeError):
        return s if s in ('scale', 'auto') else 'scale'


def build_estimator(model_type: str, hp: dict):
    """Construct an sklearn estimator from model_type + hyperparams dict."""
    if model_type == 'ridge':
        return Ridge(alpha=float(hp.get('alpha', 1.0)))

    if model_type == 'rf':
        depth = hp.get('max_depth')
        return RandomForestRegressor(
            n_estimators=int(hp.get('n_estimators', 100)),
            max_depth=int(depth) if depth else None,
            min_samples_split=int(hp.get('min_samples_split', 2)),
            random_state=42,
        )

    if model_type == 'gbm':
        return GradientBoostingRegressor(
            n_estimators=int(hp.get('n_estimators', 100)),
            learning_rate=float(hp.get('learning_rate', 0.1)),
            max_depth=int(hp.get('max_depth', 3)),
            random_state=42,
        )

    if model_type == 'svr':
        return SVR(
            kernel='rbf',
            C=float(hp.get('svr_c', 1.0)),
            epsilon=float(hp.get('epsilon', 0.1)),
            gamma=_gamma(hp.get('gamma', 'scale')),
        )

    if model_type == 'mlp':
        return MLPRegressor(
            hidden_layer_sizes=_parse_hidden_layers(hp.get('hidden_layers', '64,32')),
            learning_rate_init=float(hp.get('lr_init', 0.001)),
            max_iter=int(hp.get('max_iter', 500)),
            random_state=42,
        )

    raise ValueError(f'Unknown model type: {model_type!r}')


def build_features(samples):
    """Returns (n, 6) feature matrix: [speed, dtex, tpm, speed², dtex×tpm, speed×dtex]"""
    X = []
    for s in samples:
        speed = float(s['speed_bucket'])
        dtex = float(s['dtex'])
        tpm = float(s['tpm'])
        X.append([speed, dtex, tpm, speed ** 2, dtex * tpm, speed * dtex])
    return np.array(X, dtype=float)


def make_pipeline(model_type: str, hp: dict = None) -> Pipeline:
    estimator = build_estimator(model_type, hp or {})
    return Pipeline([('scaler', StandardScaler()), ('model', estimator)])


def train_model(model_id, model_type: str, hyperparams: dict, training: list, lines: list):
    """Fits the pipeline + runs CV, appending human-readable progress lines to `lines`
    as it goes (so a caller still has them even if this raises partway through)."""

    def emit(msg):
        lines.append(f'{time.strftime("%H:%M:%S")}  {msg}')

    if len(training) < 5:
        raise ValueError(f'Need at least 5 training samples, got {len(training)}')

    X = build_features(training)
    y = np.array([float(s['energy_per_machine_hour']) for s in training])

    emit(f'Fitting {model_type} on {len(training)} samples...')
    pipeline = make_pipeline(model_type, hyperparams)
    pipeline.fit(X, y)

    y_pred = pipeline.predict(X)
    r2 = float(pipeline.score(X, y))
    rmse = float(np.sqrt(mean_squared_error(y, y_pred)))
    mae = float(mean_absolute_error(y, y_pred))
    emit(f'Full-data fit complete (R²={r2:.4f}, RMSE={rmse:.4f})')

    n_folds = max(2, min(5, len(training) // 2))
    emit(f'Cross-validating over {n_folds} folds...')
    fold_scores = []
    for i, (train_idx, test_idx) in enumerate(KFold(n_splits=n_folds, shuffle=True, random_state=42).split(X), start=1):
        fold_pipeline = clone(pipeline)
        fold_pipeline.fit(X[train_idx], y[train_idx])
        fold_r2 = r2_score(y[test_idx], fold_pipeline.predict(X[test_idx]))
        fold_scores.append(fold_r2)
        emit(f'Fold {i}/{n_folds} complete (R²={fold_r2:.4f})')

    valid_cv = np.array(fold_scores)
    valid_cv = valid_cv[np.isfinite(valid_cv)]
    cv_r2 = float(np.mean(valid_cv)) if len(valid_cv) > 0 else None

    buf = io.BytesIO()
    joblib.dump(pipeline, buf)
    emit('Uploading model...')
    model_ref = blob_upload(f'models/{model_id}.pkl', buf.getvalue())
    emit('Model saved.')

    return {
        'r2': round(r2, 4),
        'cv_r2': round(cv_r2, 4) if cv_r2 is not None else None,
        'rmse': round(rmse, 4),
        'mae': round(mae, 4),
        'training_samples': len(training),
        'model_used': model_type,
        'model_ref': model_ref,
    }


def predict_model(model_ref: str, query: dict):
    data = blob_download(model_ref)
    pipeline = joblib.load(io.BytesIO(data))

    samples = [
        {'speed_bucket': sp, 'dtex': query['dtex'], 'tpm': query['tpm']}
        for sp in query['speed_points']
    ]
    X = build_features(samples)
    return [max(0.01, float(p)) for p in pipeline.predict(X)]
