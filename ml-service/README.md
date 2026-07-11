# Energy ML service

Standalone Vercel project that trains and serves the energy regression models
used by the Laravel app's "ML Energy Models" page and the Speed Optimization
GA fallback. Runs independently from the main Laravel deployment (which stays
on cPanel/FTP — see `../deploy/deploy.sh`).

## Endpoints

All endpoints require `Authorization: Bearer $ML_SERVICE_TOKEN`.

- `POST /api/train` — `{model_id, model_type, hyperparams, training}` → `{lines, result}` on success, `{lines, error}` on failure. Fits the pipeline, runs KFold CV, uploads the fitted model, and returns everything in one buffered response — Laravel's `ml:train` command replays the `lines` into its local progress log for the UI to poll. (Vercel's Python runtime does support streaming responses today, so this could become a true SSE endpoint later if it's worth the added complexity — not done here since the whole training run finishes in well under a second on this dataset size.)
- `POST /api/predict` — `{model_ref, query: {dtex, tpm, speed_points}}` → `{predictions}`.
- `POST /api/delete` — `{model_ref}` → `{ok: true}`.
- `POST /api/blob` — internal only, called by the Python functions above (never by Laravel). Wraps `@vercel/blob` (JS-only SDK) for upload/download/delete since there's no official Python client.

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

5. **Smoke-test it** before wiring up Laravel:
   ```
   curl -s https://<your-deployment>.vercel.app/api/predict \
     -H "Authorization: Bearer <ML_SERVICE_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"model_ref":"nonexistent","query":{"dtex":100,"tpm":800,"speed_points":[8000]}}'
   ```
   A `422` with a "Blob fetch failed" error means auth + routing are working (there's just no model at that ref yet) — that's the expected result of this specific test. A `401` means the token doesn't match; anything else means the deploy itself is broken.

6. **Point Laravel at it** — in the Laravel app's real `.env` (on the cPanel server, not this repo):
   ```
   ENERGY_ML_SERVICE_URL=https://<your-deployment>.vercel.app
   ENERGY_ML_SERVICE_TOKEN=<same ML_SERVICE_TOKEN as step 3>
   ```
   Then `php artisan config:clear` on the server (or just wait for the next deploy, which runs `optimize` anyway per `DeployController::finalize`).

7. **End-to-end check**: train a model from the "ML Energy Models" page, confirm the progress log fills in, the model appears in the table, delete works, and (if you have a material with no direct energy record) the Speed Optimization page's GA fallback still returns numbers.

## Local testing without deploying

`npx vercel dev` from this directory runs the whole thing (Python + Node
functions) locally, including asking you to link/pull env vars. Or, for just
the ML logic without touching Vercel at all:

```
cd ml-service
python3 -c "
import sys; sys.path.insert(0, 'api')
import _common
_common.blob_upload = lambda pathname, data: f'stub://{pathname}'
lines = []
print(_common.train_model('1', 'ridge', {}, [
    {'dtex': 100, 'tpm': 800, 'speed_bucket': 8000, 'energy_per_machine_hour': 1.2},
    {'dtex': 150, 'tpm': 900, 'speed_bucket': 8500, 'energy_per_machine_hour': 1.6},
    {'dtex': 200, 'tpm': 1000, 'speed_bucket': 8000, 'energy_per_machine_hour': 1.9},
    {'dtex': 100, 'tpm': 900, 'speed_bucket': 8500, 'energy_per_machine_hour': 1.4},
    {'dtex': 200, 'tpm': 800, 'speed_bucket': 8000, 'energy_per_machine_hour': 1.7},
], lines))
"
```
