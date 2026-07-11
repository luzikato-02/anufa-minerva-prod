<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MlEnergyModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;

class MlModelController extends Controller
{
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

        $training = $this->fetchTrainingData();
        if (count($training) < 5) {
            return response()->json([
                'message' => 'Not enough training data. Need at least 5 grouped (dtex, tpm, speed) data points with energy measurements.',
            ], 422);
        }

        // Create DB record first to obtain the ID for the job/progress files.
        $model = MlEnergyModel::create([
            'name'        => $request->input('name'),
            'model_type'  => $request->input('model_type'),
            'hyperparams' => $hyperparams ?: null,
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
                'training'    => $training,
            ]),
        );

        // Runs `ml:train` in the background, which calls the ml-service (Vercel)
        // API and replays its progress into the progress log file — the web
        // request doesn't block on the remote call.
        Process::start('php ' . escapeshellarg(base_path('artisan')) . ' ml:train ' . escapeshellarg($model->id));

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
                'cv_r2_score'      => $decoded['cv_r2']            ?? null,
                'rmse'             => $decoded['rmse']             ?? null,
                'mae'              => $decoded['mae']              ?? null,
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

    private function fetchTrainingData(): array
    {
        $rows = DB::select("
            SELECT
                CAST(JSON_UNQUOTE(JSON_EXTRACT(styles_parsed, '\$[0].dtex')) AS UNSIGNED) AS dtex,
                CAST(JSON_UNQUOTE(JSON_EXTRACT(styles_parsed, '\$[0].tpm'))  AS UNSIGNED) AS tpm,
                ROUND(avg_rpm / 500) * 500                                                AS speed_bucket,
                SUM(energy_kwh) / NULLIF(SUM(total_runtime_hours), 0)                    AS energy_per_machine_hour
            FROM runtime_shift_aggregates
            WHERE energy_kwh IS NOT NULL
              AND JSON_LENGTH(styles_parsed) = 1
              AND has_speed_outlier   = 0
              AND has_runtime_outlier = 0
            GROUP BY dtex, tpm, speed_bucket
            HAVING energy_per_machine_hour IS NOT NULL
        ");

        return array_map(fn ($r) => [
            'dtex'                   => (int) $r->dtex,
            'tpm'                    => (int) $r->tpm,
            'speed_bucket'           => (int) $r->speed_bucket,
            'energy_per_machine_hour' => (float) $r->energy_per_machine_hour,
        ], $rows);
    }
}
