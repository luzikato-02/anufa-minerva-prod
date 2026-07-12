<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\TrainMlEnergyModel;
use App\Models\MlEnergyModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class MlModelController extends Controller
{
    private const MIN_TRAINING_SAMPLES = 15;

    public function index()
    {
        return response()->json(
            MlEnergyModel::with('trainedBy:id,name')
                ->orderByDesc('created_at')
                ->get()
        );
    }

    public function benchmark()
    {
        return response()->json(
            MlEnergyModel::with('trainedBy:id,name')
                ->orderByDesc('cv_r2_score')
                ->get()
        );
    }

    public function train(Request $request)
    {
        $request->validate([
            'name'                       => 'required|string|max:120',
            'model_type'                 => 'required|string|in:ridge,rf,gbm,svr,mlp',
            'auto_tune'                  => 'sometimes|boolean',
            // Ridge
            'hyperparams.alpha'          => 'sometimes|numeric|min:0.0001|max:100000',
            // RF / GBM shared
            'hyperparams.n_estimators'   => 'sometimes|integer|min:10|max:1000',
            'hyperparams.max_depth'      => 'sometimes|nullable|integer|min:1|max:50',
            // RF only
            'hyperparams.min_samples_split' => 'sometimes|integer|min:2|max:50',
            // GBM only
            'hyperparams.learning_rate'  => 'sometimes|numeric|min:0.0001|max:1.0',
            // SVR
            'hyperparams.svr_c'          => 'sometimes|numeric|min:0.001|max:100000',
            'hyperparams.epsilon'        => 'sometimes|numeric|min:0.0001|max:10',
            'hyperparams.gamma'          => 'sometimes|string|max:20',
            // MLP
            'hyperparams.hidden_layers'  => 'sometimes|string|max:100|regex:/^[\d,\s]+$/',
            'hyperparams.lr_init'        => 'sometimes|numeric|min:0.00001|max:1.0',
            'hyperparams.max_iter'       => 'sometimes|integer|min:50|max:5000',
        ]);

        $hyperparams = $request->input('hyperparams', []);
        $autoTune    = $request->boolean('auto_tune');

        $training = $this->fetchTrainingData();
        if (count($training) < self::MIN_TRAINING_SAMPLES) {
            return response()->json([
                'message' => 'Not enough training data. Need at least ' . self::MIN_TRAINING_SAMPLES . ' historical shift records with energy measurements.',
            ], 422);
        }

        // Create DB record first to obtain the ID for the job/progress files.
        $model = MlEnergyModel::create([
            'name'        => $request->input('name'),
            'model_type'  => $request->input('model_type'),
            'hyperparams' => $hyperparams ?: null,
            'auto_tuned'  => $autoTune,
            'trained_by'  => $request->user()?->id,
        ]);

        Storage::disk('local')->makeDirectory('ml_models');
        $progressPath = $this->progressPath($model->id);
        file_put_contents($progressPath, '');
        file_put_contents(
            $this->jobPath($model->id),
            json_encode([
                'model_type'  => $model->model_type,
                'hyperparams' => $hyperparams,
                'auto_tune'   => $autoTune,
                'training'    => $training,
            ]),
        );

        // Queues a job that calls the ml-service (Vercel) API and replays its
        // progress into the progress log file — the web request doesn't block
        // on the remote call. Requires a queue worker (QUEUE_CONNECTION != sync)
        // and a cron-driven `queue:work --stop-when-empty` on shared hosting.
        TrainMlEnergyModel::dispatch($model->id);

        return response()->json(['id' => $model->id], 202);
    }

    public function progress(string $id)
    {
        $model = MlEnergyModel::findOrFail($id);
        $path  = $this->progressPath($id);
        $lines = file_exists($path)
            ? array_filter(explode("\n", trim(file_get_contents($path))))
            : [];

        $resultLine = null;
        $errorLine  = null;
        $display    = [];
        foreach ($lines as $line) {
            if (str_contains($line, 'RESULT {')) {
                $resultLine = substr($line, strpos($line, 'RESULT {') + 7);
            } elseif (str_contains($line, 'ERROR ')) {
                $errorLine = substr($line, strpos($line, 'ERROR ') + 6);
            } else {
                $display[] = $line;
            }
        }

        if ($resultLine !== null && $model->r2_score === null) {
            $decoded = json_decode($resultLine, true);
            $model->update([
                'r2_score'         => $decoded['r2']               ?? null,
                'cv_r2_score'      => $decoded['cv_r2_mean']       ?? null,
                'cv_r2_std'        => $decoded['cv_r2_std']        ?? null,
                'test_r2'          => $decoded['test_r2']          ?? null,
                'test_rmse'        => $decoded['test_rmse']        ?? null,
                'test_mae'         => $decoded['test_mae']         ?? null,
                'rmse'             => $decoded['rmse']             ?? null,
                'mae'              => $decoded['mae']              ?? null,
                'overfit_gap'      => $decoded['overfit_gap']      ?? null,
                'auto_tuned'       => $decoded['auto_tuned']       ?? false,
                'hyperparams'      => $decoded['hyperparams_used'] ?? $model->hyperparams,
                'training_samples' => $decoded['training_samples'] ?? null,
                'model_file'       => $decoded['model_ref']        ?? null,
            ]);
        }

        if ($errorLine !== null) {
            Log::error('ML model training failed', ['error' => $errorLine]);
            $model->delete();
            return response()->json(['lines' => $display, 'done' => true, 'error' => $errorLine]);
        }

        return response()->json([
            'lines' => $display,
            'done'  => $resultLine !== null,
            'model' => $resultLine !== null ? $model->fresh()->load('trainedBy:id,name') : null,
        ]);
    }

    private function progressPath(string|int $id): string
    {
        Storage::disk('local')->makeDirectory('ml_models');
        return base_path('storage/app/private/ml_models/' . $id . '.progress.log');
    }

    private function jobPath(string|int $id): string
    {
        Storage::disk('local')->makeDirectory('ml_models');
        return base_path('storage/app/private/ml_models/' . $id . '.job.json');
    }

    public function setDefault(string $id)
    {
        MlEnergyModel::query()->update(['is_active' => false]);
        MlEnergyModel::findOrFail($id)->update(['is_active' => true]);

        return response()->json(['message' => 'Default model updated.']);
    }

    public function destroy(string $id)
    {
        $model = MlEnergyModel::findOrFail($id);

        if ($model->model_file) {
            try {
                Http::withToken(config('services.energy_ml.token'))
                    ->timeout(30)
                    ->post(rtrim(config('services.energy_ml.url'), '/') . '/api/delete', [
                        'model_ref' => $model->model_file,
                    ])
                    ->throw();
            } catch (\Throwable $e) {
                Log::warning('Failed to delete remote ML model blob', ['id' => $id, 'error' => $e->getMessage()]);
            }
        }

        $model->delete();

        return response()->json(['message' => 'Model deleted.']);
    }

    // One training row per (machine, date, shift) — no bucketing/aggregation, so the
    // model sees continuous speed and per-row yarn_type/machine_type identity. Speed
    // bucketing is only used by the GA optimizer's own sampling, not for training.
    private function fetchTrainingData(): array
    {
        $rows = DB::select("
            SELECT
                CAST(JSON_UNQUOTE(JSON_EXTRACT(rsa.styles_parsed, '\$[0].dtex')) AS UNSIGNED) AS dtex,
                CAST(JSON_UNQUOTE(JSON_EXTRACT(rsa.styles_parsed, '\$[0].tpm'))  AS UNSIGNED) AS tpm,
                JSON_UNQUOTE(JSON_EXTRACT(rsa.styles_parsed, '\$[0].yarn_type'))              AS yarn_type,
                mt.type_name                                                                  AS machine_type,
                rsa.avg_rpm                                                                    AS speed,
                rsa.total_runtime_hours                                                        AS runtime_hours,
                rsa.energy_kwh / rsa.total_runtime_hours                                       AS energy_per_machine_hour
            FROM runtime_shift_aggregates rsa
            LEFT JOIN machine_definitions md ON md.id = rsa.machine_definition_id
            LEFT JOIN machine_types mt ON mt.id = md.machine_type_id
            WHERE rsa.energy_kwh IS NOT NULL
              AND JSON_LENGTH(rsa.styles_parsed) = 1
              AND rsa.has_speed_outlier   = 0
              AND rsa.has_runtime_outlier = 0
              AND rsa.total_runtime_hours > 0
        ");

        return array_map(fn ($r) => [
            'dtex'                    => (int) $r->dtex,
            'tpm'                     => (int) $r->tpm,
            'yarn_type'               => (string) $r->yarn_type,
            'machine_type'            => $r->machine_type,
            'speed'                   => (float) $r->speed,
            'runtime_hours'           => (float) $r->runtime_hours,
            'energy_per_machine_hour' => (float) $r->energy_per_machine_hour,
        ], $rows);
    }
}
