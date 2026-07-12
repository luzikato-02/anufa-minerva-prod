# Energy ML service

Standalone Vercel project that trains and serves the energy regression models
used by the Laravel app's "ML Energy Models" page and the Speed Optimization
GA fallback. Runs independently from the main Laravel deployment (which stays
on cPanel/FTP — see `../deploy/deploy.sh`).

All the actual ML logic (feature engineering, model fitting, cross-validation,
hyperparameter search) lives in `api/_common.py`. `api/train.py`, `api/predict.py`
and `api/delete.py` are thin `http.server.BaseHTTPRequestHandler` wrappers around
it — deliberately not Flask/FastAPI, to keep the cold-start bundle small.

## What it predicts, and how

The model predicts `energy_per_machine_hour` (kWh consumed per machine-hour) for
a twisting machine, as a function of the yarn spec being run and the machine
itself. It's used whenever the GA speed optimizer needs an energy estimate for a
(yarn_type, dtex, tpm) combination that has no exact historical match.

### Training data

Laravel (`MlModelController::fetchTrainingData()`) pulls one training row per
historical **(machine, date, shift)** record from `runtime_shift_aggregates`
(joined to `machine_types` for machine identity), filtered to single-style,
non-outlier shifts with a recorded energy figure:

| field | meaning |
|---|---|
| `speed` | that shift's average RPM (continuous — **not** bucketed) |
| `dtex`, `tpm` | parsed from the shift's style spec |
| `yarn_type` | parsed from the style spec (e.g. `NY`, `PE`, `N6`) |
| `machine_type` | joined from `machine_types.type_name`; can be `null` if the shift's machine isn't linked to a `machine_definition` |
| `runtime_hours` | total runtime for that shift — used as a training weight, not a feature |
| `energy_per_machine_hour` | the regression target: that shift's energy ÷ its runtime hours |

Speed is deliberately **not** bucketed for training (that would throw away
resolution) — bucketing to the nearest 500 RPM only happens on the GA side
(`SpeedOptimizationController`), which needs a small number of representative
sample points to build an energy curve, not raw training data.

### Features (`build_features()`)

Nine columns per row, built as a `dtype=object` numpy array (no pandas
dependency, to keep the bundle small):

1. `speed`
2. `dtex`
3. `tpm`
4. `speed²`
5. `tpm²`
6. `dtex × tpm`
7. `speed × dtex`
8. `yarn_type` (categorical)
9. `machine_type` (categorical, may be a sentinel — see below)

Columns 1–7 go through `StandardScaler`; columns 8–9 go through
`OneHotEncoder(handle_unknown='ignore', min_frequency=5)`, composed with a
`ColumnTransformer`. Two things matter here because **the set of yarn types and
machine types grows over time**, and this can't require a code change every
time it does:

- `handle_unknown='ignore'` means a yarn/machine type never seen during
  training (or, for `machine_type`, simply absent from a prediction query —
  the GA fallback only ever knows `yarn_type`, never a specific machine) is
  encoded as an all-zero row instead of raising. The model effectively falls
  back to "no signal from this categorical" for that prediction, rather than
  failing.
- `min_frequency=5` buckets rare categories (fewer than 5 training rows) into
  a shared "infrequent" column instead of giving each one its own
  near-zero-variance one-hot column, which a few-hundred-row model could
  trivially overfit to. As a new yarn/machine type accumulates more shift
  records over subsequent retrains, it naturally graduates into its own
  column.
- Missing `machine_type` at either train or predict time is mapped to a fixed
  sentinel string (`_MISSING_CATEGORY` in `_common.py`) so it's encoded
  consistently rather than as `None`/`null`.

None of this requires touching the code when a new yarn or machine type shows
up in production data — just retrain.

### Target transform

The pipeline is wrapped in `sklearn.compose.TransformedTargetRegressor` with
`func=np.log1p` / `inverse_func=np.expm1`. `energy_per_machine_hour` is a
strictly positive rate that's typically right-skewed, and the log transform
stabilises variance and plays better with the linear/kernel model types. This
is fully transparent to callers — `pipeline.predict()` returns energy values
directly, not log-space ones.

### Sample weighting

`runtime_hours` is passed as `sample_weight` at every `.fit()` call (a shift
that ran 12 hours should influence the fit more than one that ran 2), for
every model type **except MLP** — `MLPRegressor.fit()` doesn't accept
`sample_weight` at all, so that model type is fit unweighted. This is a
scikit-learn limitation, not a bug.

### Models available

`model_type` selects the estimator (`build_estimator()`): `ridge`, `rf`
(RandomForestRegressor), `gbm` (GradientBoostingRegressor), `svr` (SVR, RBF
kernel), `mlp` (MLPRegressor). All five are scikit-learn only — deliberately
no XGBoost/LightGBM/etc., to keep the Vercel function bundle light and
cold-starts fast.

### Hyperparameters: manual or auto-tuned

Callers either supply `hyperparams` directly (validated/bounded on the
Laravel side in `MlModelController::train()`), or set `auto_tune: true` to
have the service run `RandomizedSearchCV` instead and pick its own. Auto-tune
uses a small, fixed-cost search per model type — `n_iter` and fold counts are
capped (`_search_n_iter()`, `_fold_count()` in `_common.py`) specifically to
fit inside Vercel's function timeout (`maxDuration: 15` in `vercel.json`) even
on the slowest of the five estimators. MLP's `max_iter`/`early_stopping` are
held fixed during search — only architecture and learning rate are tuned —
since convergence behaviour is the least predictable part of its cost.
Whichever path is used, the actually-used hyperparameters are returned to the
caller as `hyperparams_used` and persisted, so the UI shows what was really
fit regardless of whether a human or the search picked it.

### Evaluation

`train_model()` reports three distinct signals, because "training accuracy"
alone is misleading on a few-hundred-row dataset:

- **`r2`/`rmse`/`mae`** — in-sample metrics from the final production fit
  (100% of the data). Optimistic by construction; useful mainly as a sanity
  check and for the overfit-gap comparison below.
- **`cv_r2_mean`/`cv_r2_std`** — mean and standard deviation of R² across a
  `RepeatedKFold` cross-validation (fold/repeat counts also scaled per model
  type and dataset size, `_eval_cv_plan()`), computed on the train-only
  portion. This is the primary, trustworthy generalisation estimate, and
  what the Benchmark tab in the UI ranks models by.
- **`test_r2`/`test_rmse`/`test_mae`** — a genuine held-out score from an
  80/20 split, but **only when there are ≥100 training rows**
  (`HOLD_OUT_THRESHOLD`); below that, a held-out slice would be too small and
  noisy to trust, so these come back `null` and the repeated CV above is the
  only generalisation signal.
- **`overfit_gap`** = `r2 − cv_r2_mean`, a plain number (not a boolean) — the
  UI applies its own display threshold rather than the backend baking one in.

The model that actually gets pickled and uploaded to Blob storage is always
refit on **100% of the data** with whichever hyperparameters were chosen — the
held-out split exists purely for honest reporting, not to starve the deployed
model of training data.

## Endpoints

All endpoints require `Authorization: Bearer $ML_SERVICE_TOKEN`.

- `POST /api/train` — body:
  ```json
  {
    "model_id": "123",
    "model_type": "ridge",
    "hyperparams": {},
    "auto_tune": false,
    "training": [
      {"speed": 8973.5, "dtex": 1400, "tpm": 365, "yarn_type": "NY",
       "machine_type": "B92", "runtime_hours": 11.5, "energy_per_machine_hour": 1.34}
    ]
  }
  ```
  → `{lines, result}` on success, `{lines, error}` on failure, where `result`
  is the metrics object described above plus `model_used`, `hyperparams_used`,
  `training_samples`, and `model_ref` (the Blob URL). Laravel's
  `App\Jobs\TrainMlEnergyModel` queued job replays `lines` into its local
  progress log for the UI to poll.
  (Vercel's Python runtime does support streaming responses; this could become
  a true SSE endpoint later if it's worth the complexity — not done here since
  even with auto-tune and repeated CV, a training run stays within single-digit
  seconds at the dataset sizes this app produces.)
- `POST /api/predict` — body:
  ```json
  {"model_ref": "...", "query": {"dtex": 1400, "tpm": 365, "yarn_type": "NY",
   "machine_type": "B92", "speed_points": [8000, 9000, 10000]}}
  ```
  `machine_type` is optional — the GA fallback caller never has one — and
  falls back to the same "no signal" encoding as an unseen category. →
  `{predictions}` (one number per `speed_points` entry, floored at `0.01`).
- `POST /api/delete` — `{model_ref}` → `{ok: true}`.
- `POST /api/blob` — internal only, called by the Python functions above
  (never by Laravel). Wraps `@vercel/blob` (JS-only SDK) for upload/download/
  delete since there's no official Python client.

## Deploying (dashboard + CLI, step by step)

1. **Create the Vercel project**, rooted at this subdirectory:
   - Go to vercel.com → **Add New… → Project** → import the `anufa-minerva-prod` repo.
   - Under **Root Directory**, click Edit and set it to `ml-service`.
   - Framework Preset: **Other** (no build step needed — leave Build/Output/Install commands blank/default).
   - Don't deploy yet — set env vars first (next step), or deploy and it'll just be missing them until you redeploy.

2. **Attach a Blob store** (this is what actually persists the trained `.pkl` files):
   - In the new project → **Storage** tab → **Create Database** → **Blob** → follow the prompts, attach it to this project.
   - This auto-adds `BLOB_READ_WRITE_TOKEN` to the project's environment variables — you don't set it by hand.

3. **Set the shared secret** — Project → **Settings → Environment Variables**:
   - `ML_SERVICE_TOKEN` = any long random string, e.g. generate one with:
     ```
     openssl rand -hex 32
     ```
   - Add it for all three environments (Production/Preview/Development) unless you want separate secrets per environment.

4. **Deploy**:
   - Either push to the connected branch (if using Git integration — a push touching `ml-service/**` triggers a build), or from this directory run:
     ```
     cd ml-service
     npx vercel login        # one-time, opens a browser/device-code flow
     npx vercel link         # link this directory to the project you created above
     npx vercel --prod
     ```
   - Note the deployment URL it prints (e.g. `https://energy-ml-service.vercel.app`).
   - `requirements.txt` is version-pinned (numpy/scipy/scikit-learn/joblib/
     requests) rather than left open — the pickled model objects are a fairly
     rich sklearn object graph (`ColumnTransformer` + `OneHotEncoder` +
     `TransformedTargetRegressor`), and scikit-learn does not guarantee
     cross-version unpickling. Bump these deliberately, not incidentally, and
     treat a scikit-learn version bump as something that may require
     retraining previously-saved models.

5. **Smoke-test it** before wiring up Laravel:
   ```
   curl -s https://<your-deployment>.vercel.app/api/predict \
     -H "Authorization: Bearer <ML_SERVICE_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"model_ref":"nonexistent","query":{"dtex":100,"tpm":800,"yarn_type":"NY","speed_points":[8000]}}'
   ```
   A `422` with a "Blob fetch failed" error means auth + routing are working (there's just no model at that ref yet) — that's the expected result of this specific test. A `401` means the token doesn't match; anything else means the deploy itself is broken.

6. **Point Laravel at it** — in the Laravel app's real `.env` (on the cPanel server, not this repo):
   ```
   ENERGY_ML_SERVICE_URL=https://<your-deployment>.vercel.app
   ENERGY_ML_SERVICE_TOKEN=<same ML_SERVICE_TOKEN as step 3>
   ```
   Then `php artisan config:clear` on the server (or just wait for the next deploy, which runs `optimize` anyway per `deploy:finalize`).

7. **End-to-end check**: train a model from the "ML Energy Models" page (try
   both a manual-hyperparameter run and an auto-tuned one), confirm the
   progress log fills in, the model appears in the table with CV R²/Test R²/
   overfit indicators populated sensibly, delete works, and (if you have a
   material with no direct energy record) the Speed Optimization page's GA
   fallback still returns numbers.
   **Also worth doing once after any deploy that touches auto-tune:** time
   each of the 5 `model_type` values with `auto_tune: true` against a
   realistic-sized training set (a few hundred rows) and confirm none of them
   are getting close to the 15s `maxDuration`. The fold/iteration constants in
   `_common.py` (`_fold_count`, `_search_n_iter`, `_eval_cv_plan`) were sized
   from local timing, not measured against Vercel's actual runtime — tighten
   them (especially `rf`'s, the most expensive) if real deploys run hotter
   than expected. MLP is the least predictable of the five; if it's
   unreliable within budget even after tightening, the pragmatic fix is to
   disable `auto_tune` for `model_type == 'mlp'` specifically rather than
   squeezing its search further.

## Local testing without deploying

`npx vercel dev` from this directory runs the whole thing (Python + Node
functions) locally, including asking you to link/pull env vars. Or, for just
the ML logic without touching Vercel at all — stub out `blob_upload`/
`blob_download` so nothing tries to reach the real Blob store:

```
cd ml-service
python3 -c "
import sys; sys.path.insert(0, 'api')
import _common as c

# In-memory stand-in for Blob storage.
_store = {}
c.blob_upload = lambda pathname, data: (_store.__setitem__(pathname, data), pathname)[1]
c.blob_download = lambda ref: _store[ref]

training = [
    {'speed': 8000, 'dtex': 100, 'tpm': 800, 'yarn_type': 'NY', 'machine_type': 'B92', 'runtime_hours': 8, 'energy_per_machine_hour': 1.2},
    {'speed': 8500, 'dtex': 150, 'tpm': 900, 'yarn_type': 'PE', 'machine_type': 'B92', 'runtime_hours': 10, 'energy_per_machine_hour': 1.6},
    {'speed': 8000, 'dtex': 200, 'tpm': 1000, 'yarn_type': 'NY', 'machine_type': None, 'runtime_hours': 9, 'energy_per_machine_hour': 1.9},
    {'speed': 8500, 'dtex': 100, 'tpm': 900, 'yarn_type': 'N6', 'machine_type': 'B94', 'runtime_hours': 7, 'energy_per_machine_hour': 1.4},
    {'speed': 8000, 'dtex': 200, 'tpm': 800, 'yarn_type': 'NY', 'machine_type': 'B92', 'runtime_hours': 11, 'energy_per_machine_hour': 1.7},
] * 3  # train_model() requires >= 15 rows (see MIN_TRAINING_SAMPLES in _common.py)

lines = []
result = c.train_model('local-test', 'ridge', {}, training, lines, auto_tune=False)
print(result)

# Query with a yarn_type/machine_type never seen above — should still return
# sane numbers via the OneHotEncoder's handle_unknown='ignore' fallback.
preds = c.predict_model(result['model_ref'], {
    'dtex': 150, 'tpm': 900, 'yarn_type': 'UNSEEN_TYPE',
    'speed_points': [8000, 9000],
})
print(preds)
"
```

Swap `auto_tune=False` for `True`, or `'ridge'` for `'rf'`/`'gbm'`/`'svr'`/
`'mlp'`, to exercise the other code paths the same way.
