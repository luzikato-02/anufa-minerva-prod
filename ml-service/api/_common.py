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
from scipy.stats import loguniform, randint, uniform
from sklearn.base import clone
from sklearn.compose import ColumnTransformer, TransformedTargetRegressor
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, RandomizedSearchCV, RepeatedKFold, train_test_split
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.svm import SVR
import joblib

MIN_TRAINING_SAMPLES = 15
HOLD_OUT_THRESHOLD = 100
_MISSING_CATEGORY = '__missing__'
_NUMERIC_COLS = list(range(7))
_CATEGORICAL_COLS = [7, 8]


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


def _parse_hidden_layers(s) -> tuple:
    """Parse '64,32' → (64, 32)."""
    if isinstance(s, (tuple, list)):
        return tuple(int(p) for p in s)
    parts = [p.strip() for p in str(s).split(',') if p.strip()]
    return tuple(int(p) for p in parts) if parts else (64, 32)


def _gamma(s):
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
            min_samples_leaf=int(hp.get('min_samples_leaf', 1)),
            random_state=42,
        )

    if model_type == 'gbm':
        return GradientBoostingRegressor(
            n_estimators=int(hp.get('n_estimators', 100)),
            learning_rate=float(hp.get('learning_rate', 0.1)),
            max_depth=int(hp.get('max_depth', 3)),
            subsample=float(hp.get('subsample', 1.0)),
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
            alpha=float(hp.get('alpha', 0.0001)),
            learning_rate_init=float(hp.get('lr_init', 0.001)),
            max_iter=int(hp.get('max_iter', 500)),
            random_state=42,
        )

    raise ValueError(f'Unknown model type: {model_type!r}')


def build_features(samples):
    """Returns (n, 9) object array:
    [speed, dtex, tpm, speed², tpm², dtex×tpm, speed×dtex, yarn_type, machine_type]
    """
    rows = []
    for s in samples:
        speed = float(s['speed'])
        dtex = float(s['dtex'])
        tpm = float(s['tpm'])
        yarn_type = str(s['yarn_type'])
        mt = s.get('machine_type')
        machine_type = str(mt) if mt not in (None, '') else _MISSING_CATEGORY
        rows.append([
            speed, dtex, tpm, speed ** 2, tpm ** 2, dtex * tpm, speed * dtex,
            yarn_type, machine_type,
        ])
    return np.array(rows, dtype=object)


def _feature_transformer() -> ColumnTransformer:
    return ColumnTransformer([
        ('num', StandardScaler(), _NUMERIC_COLS),
        ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False, min_frequency=5),
         _CATEGORICAL_COLS),
    ])


def make_pipeline(model_type: str, hp: dict = None) -> TransformedTargetRegressor:
    estimator = build_estimator(model_type, hp or {})
    inner = Pipeline([('features', _feature_transformer()), ('model', estimator)])
    return TransformedTargetRegressor(regressor=inner, func=np.log1p, inverse_func=np.expm1)


def _fit_kwargs(model_type: str, sample_weight, prefix: str = 'model') -> dict:
    """MLPRegressor.fit() doesn't accept sample_weight — skip weighting for it."""
    if model_type == 'mlp' or sample_weight is None:
        return {}
    return {f'{prefix}__sample_weight': sample_weight}


def _fold_count(model_type: str, n_train: int) -> int:
    base = {'ridge': 5, 'rf': 3, 'gbm': 3, 'svr': 3, 'mlp': 2}.get(model_type, 3)
    return max(2, min(base, n_train // 15))


def _search_n_iter(model_type: str) -> int:
    return {'ridge': 10, 'rf': 8, 'svr': 10, 'gbm': 8, 'mlp': 6}.get(model_type, 8)


def _eval_cv_plan(model_type: str, n_train: int):
    n_splits, n_repeats = {
        'ridge': (5, 3), 'rf': (5, 2), 'gbm': (4, 2), 'svr': (4, 2), 'mlp': (3, 1),
    }.get(model_type, (5, 2))
    n_splits = max(2, min(n_splits, n_train // 15))
    if n_train > 300:
        n_repeats = max(1, n_repeats - 1)
    return n_splits, n_repeats


def _search_space(model_type: str) -> dict:
    """Param distributions for RandomizedSearchCV, keyed for the
    TransformedTargetRegressor -> Pipeline -> 'model' step nesting."""
    p = 'regressor__model__'
    if model_type == 'ridge':
        return {f'{p}alpha': loguniform(1e-2, 1e2)}
    if model_type == 'rf':
        return {
            f'{p}n_estimators': randint(50, 150),
            f'{p}max_depth': [None, 4, 6, 8, 12],
            f'{p}min_samples_split': randint(2, 10),
            f'{p}min_samples_leaf': randint(1, 5),
        }
    if model_type == 'gbm':
        return {
            f'{p}n_estimators': randint(50, 150),
            f'{p}learning_rate': loguniform(0.01, 0.3),
            f'{p}max_depth': randint(2, 5),
            f'{p}subsample': uniform(0.7, 0.3),
        }
    if model_type == 'svr':
        return {
            f'{p}C': loguniform(0.1, 100),
            f'{p}epsilon': loguniform(1e-3, 0.5),
        }
    if model_type == 'mlp':
        return {
            f'{p}hidden_layer_sizes': [(32,), (64,), (64, 32), (32, 16)],
            f'{p}alpha': loguniform(1e-5, 1e-2),
            f'{p}learning_rate_init': loguniform(1e-3, 1e-1),
        }
    raise ValueError(f'Unknown model type: {model_type!r}')


def _mlp_search_estimator(hp: dict) -> TransformedTargetRegressor:
    """MLP search fixes max_iter/early_stopping so the search space only
    varies architecture/learning-rate — convergence params aren't tuned."""
    hp = {**hp, 'max_iter': hp.get('max_iter', 200)}
    pipeline = make_pipeline('mlp', hp)
    pipeline.regressor.named_steps['model'].set_params(early_stopping=True, n_iter_no_change=10)
    return pipeline


def _jsonify(value):
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, (tuple, list)):
        return [_jsonify(v) for v in value]
    return value


def _denormalize_hp(model_type: str, best_params: dict) -> dict:
    """Strip the regressor__model__ prefix, jsonify numpy scalars, and map
    back onto the app's canonical hyperparam schema (e.g. mlp's tuple ->
    comma-string) so auto-tuned results look like manually-entered ones."""
    prefix = 'regressor__model__'
    hp = {k[len(prefix):]: _jsonify(v) for k, v in best_params.items()}
    if model_type == 'mlp' and 'hidden_layer_sizes' in hp:
        hp['hidden_layers'] = ','.join(str(n) for n in hp.pop('hidden_layer_sizes'))
    if model_type == 'rf' and hp.get('max_depth') is None:
        hp['max_depth'] = ''
    return hp


def train_model(model_id, model_type: str, hyperparams: dict, training: list, lines: list, auto_tune: bool = False):
    """Fits the pipeline + runs CV, appending human-readable progress lines to `lines`
    as it goes (so a caller still has them even if this raises partway through)."""

    def emit(msg):
        lines.append(f'{time.strftime("%H:%M:%S")}  {msg}')

    if len(training) < MIN_TRAINING_SAMPLES:
        raise ValueError(f'Need at least {MIN_TRAINING_SAMPLES} training samples, got {len(training)}')

    X = build_features(training)
    y = np.array([float(s['energy_per_machine_hour']) for s in training])
    w = np.array([max(float(s.get('runtime_hours') or 0), 1e-6) for s in training])

    n = len(training)
    has_holdout = n >= HOLD_OUT_THRESHOLD
    if has_holdout:
        X_tr, X_te, y_tr, y_te, w_tr, w_te = train_test_split(X, y, w, test_size=0.2, random_state=42)
        emit(f'Held out {len(X_te)} of {n} samples for testing ({len(X_tr)} for training/CV).')
    else:
        X_tr, y_tr, w_tr = X, y, w
        X_te = y_te = w_te = None
        emit(f'Only {n} samples — skipping held-out test split, relying on cross-validation.')

    # --- Hyperparameter selection (train-only data) ---
    if auto_tune:
        n_iter = _search_n_iter(model_type)
        folds = _fold_count(model_type, len(X_tr))
        emit(f'Auto-tuning {model_type} ({n_iter} candidates × {folds} folds)...')
        base_pipeline = _mlp_search_estimator(hyperparams) if model_type == 'mlp' else make_pipeline(model_type, {})
        search = RandomizedSearchCV(
            base_pipeline,
            param_distributions=_search_space(model_type),
            n_iter=n_iter,
            cv=KFold(n_splits=folds, shuffle=True, random_state=42),
            scoring='r2',
            random_state=42,
            n_jobs=1,
            refit=True,
        )
        search.fit(X_tr, y_tr, **_fit_kwargs(model_type, w_tr))
        tr_pipeline = search.best_estimator_
        chosen_hp = _denormalize_hp(model_type, search.best_params_)
        emit(f'Best params: {json.dumps(chosen_hp)} (search R²={search.best_score_:.4f})')
    else:
        chosen_hp = hyperparams
        tr_pipeline = make_pipeline(model_type, chosen_hp)
        tr_pipeline.fit(X_tr, y_tr, **_fit_kwargs(model_type, w_tr))
        emit(f'Fitted {model_type} on {len(X_tr)} samples with supplied hyperparameters.')

    # --- Held-out test metrics ---
    if has_holdout:
        y_te_pred = tr_pipeline.predict(X_te)
        test_r2 = float(r2_score(y_te, y_te_pred))
        test_rmse = float(np.sqrt(mean_squared_error(y_te, y_te_pred)))
        test_mae = float(mean_absolute_error(y_te, y_te_pred))
        emit(f'Held-out test: R²={test_r2:.4f}, RMSE={test_rmse:.4f}')
    else:
        test_r2 = test_rmse = test_mae = None

    # --- Repeated cross-validation (train-only data, chosen hyperparameters) ---
    n_splits, n_repeats = _eval_cv_plan(model_type, len(X_tr))
    emit(f'Cross-validating over {n_splits} folds × {n_repeats} repeats...')
    fold_scores = []
    for i, (train_idx, test_idx) in enumerate(
        RepeatedKFold(n_splits=n_splits, n_repeats=n_repeats, random_state=42).split(X_tr), start=1
    ):
        fold_pipeline = clone(make_pipeline(model_type, chosen_hp))
        fold_pipeline.fit(X_tr[train_idx], y_tr[train_idx], **_fit_kwargs(model_type, w_tr[train_idx]))
        fold_r2 = r2_score(y_tr[test_idx], fold_pipeline.predict(X_tr[test_idx]))
        fold_scores.append(fold_r2)
        if i % max(1, (n_splits * n_repeats) // 5) == 0 or i == n_splits * n_repeats:
            emit(f'Fold {i}/{n_splits * n_repeats} complete (R²={fold_r2:.4f})')

    valid_cv = np.array(fold_scores)
    valid_cv = valid_cv[np.isfinite(valid_cv)]
    cv_r2_mean = float(np.mean(valid_cv)) if len(valid_cv) > 0 else None
    cv_r2_std = float(np.std(valid_cv)) if len(valid_cv) > 0 else None

    # --- Final production refit on 100% of the data ---
    emit('Refitting on full dataset for deployment...')
    final_pipeline = make_pipeline(model_type, chosen_hp)
    final_pipeline.fit(X, y, **_fit_kwargs(model_type, w))
    y_pred = final_pipeline.predict(X)
    r2 = float(r2_score(y, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y, y_pred)))
    mae = float(mean_absolute_error(y, y_pred))
    overfit_gap = round(r2 - cv_r2_mean, 4) if cv_r2_mean is not None else None
    emit(f'Full-data fit complete (R²={r2:.4f}, RMSE={rmse:.4f})')

    buf = io.BytesIO()
    joblib.dump(final_pipeline, buf)
    emit('Uploading model...')
    model_ref = blob_upload(f'models/{model_id}.pkl', buf.getvalue())
    emit('Model saved.')

    return {
        'r2': round(r2, 4),
        'cv_r2_mean': round(cv_r2_mean, 4) if cv_r2_mean is not None else None,
        'cv_r2_std': round(cv_r2_std, 4) if cv_r2_std is not None else None,
        'test_r2': round(test_r2, 4) if test_r2 is not None else None,
        'test_rmse': round(test_rmse, 4) if test_rmse is not None else None,
        'test_mae': round(test_mae, 4) if test_mae is not None else None,
        'rmse': round(rmse, 4),
        'mae': round(mae, 4),
        'overfit_gap': overfit_gap,
        'auto_tuned': bool(auto_tune),
        'hyperparams_used': {k: _jsonify(v) for k, v in chosen_hp.items()},
        'training_samples': len(training),
        'model_used': model_type,
        'model_ref': model_ref,
    }


def predict_model(model_ref: str, query: dict):
    data = blob_download(model_ref)
    pipeline = joblib.load(io.BytesIO(data))

    yarn_type = query.get('yarn_type') or _MISSING_CATEGORY
    machine_type = query.get('machine_type')
    samples = [
        {
            'speed': sp,
            'dtex': query['dtex'],
            'tpm': query['tpm'],
            'yarn_type': yarn_type,
            'machine_type': machine_type,
        }
        for sp in query['speed_points']
    ]
    X = build_features(samples)
    return [max(0.01, float(p)) for p in pipeline.predict(X)]
