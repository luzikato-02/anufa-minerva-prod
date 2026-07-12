<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MlEnergyModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SpeedOptimizationController extends Controller
{
    public function checkMaterials(Request $request)
    {
        $request->validate([
            'materials'              => 'required|array|min:1|max:20',
            'materials.*.yarn_type'  => 'required|string',
            'materials.*.dtex'       => 'required|integer|min:1',
            'materials.*.tpm'        => 'required|integer|min:1',
        ]);

        $results = [];
        foreach ($request->input('materials') as $m) {
            $model = $this->buildEnergyModel($m['yarn_type'], (int) $m['dtex'], (int) $m['tpm']);
            $results[] = [
                'yarn_type'    => $m['yarn_type'],
                'dtex'         => (int) $m['dtex'],
                'tpm'          => (int) $m['tpm'],
                'has_data'     => !empty($model),
                'speed_buckets' => array_keys($model),
            ];
        }

        return response()->json($results);
    }

    public function run(Request $request)
    {
        $request->validate([
            'rows'                 => 'required|array|min:1|max:20',
            'rows.*.yarn_type'     => 'required|string',
            'rows.*.dtex'          => 'required|integer|min:1',
            'rows.*.tpm'           => 'required|integer|min:1',
            'rows.*.initial_speed' => 'required|numeric|min:100',
            'rows.*.target_tonnes' => 'required|numeric|min:0.001',
            'ga.population_size'   => 'sometimes|integer|min:10|max:500',
            'ga.generations'       => 'sometimes|integer|min:10|max:1000',
            'ga.mutation_rate'     => 'sometimes|numeric|min:0.01|max:0.5',
            'ga.crossover_rate'    => 'sometimes|numeric|min:0.1|max:0.99',
            'ga.early_stop'        => 'sometimes|integer|min:5|max:200',
            'ga.ml_model_id'       => 'sometimes|nullable|integer|exists:ml_energy_models,id',
        ]);

        $ga = array_merge([
            'population_size' => 50,
            'generations'     => 150,
            'mutation_rate'   => 0.08,
            'crossover_rate'  => 0.70,
            'early_stop'      => 20,
            'ml_model_id'     => null,
        ], $request->input('ga', []));

        // Resolve fallback ML model: use explicit ID, or the active default.
        $mlModelId = $ga['ml_model_id']
            ?? MlEnergyModel::where('is_active', true)->value('id');

        $results = [];

        foreach ($request->input('rows') as $row) {
            $dtex  = (int) $row['dtex'];
            $tpm   = (int) $row['tpm'];
            $model = $this->buildEnergyModel($row['yarn_type'], $dtex, $tpm);
            $isEstimated = false;

            if (empty($model) && $mlModelId) {
                $synthetic = $this->buildModelFromSaved((int) $mlModelId, $row['yarn_type'], $dtex, $tpm);
                if ($synthetic !== null) {
                    $model       = $synthetic;
                    $isEstimated = true;
                }
            }

            $row['is_estimated'] = $isEstimated;
            $results[] = $this->runGA($row, $model, $ga);
        }

        return response()->json($results);
    }

    // Builds a synthetic energy model for (yarn_type, dtex, tpm) using a saved sklearn
    // .pkl file. Generates 9 speed points across the historical speed range and calls
    // Python predict. No machine_type is available at this call site (GA reasons about
    // a yarn spec in the abstract, not a specific machine) — the ML service degrades
    // gracefully for a missing machine_type, same as an unseen category.
    private function buildModelFromSaved(int $modelId, string $yarnType, int $dtex, int $tpm): ?array
    {
        $mlModel = MlEnergyModel::find($modelId);
        if (!$mlModel || !$mlModel->model_file) {
            return null;
        }

        // Get global speed range from training data.
        $range = DB::selectOne("
            SELECT MIN(ROUND(avg_rpm / 500) * 500) AS speed_min,
                   MAX(ROUND(avg_rpm / 500) * 500) AS speed_max
            FROM runtime_shift_aggregates
            WHERE energy_kwh IS NOT NULL
              AND JSON_LENGTH(styles_parsed) = 1
              AND has_speed_outlier   = 0
              AND has_runtime_outlier = 0
        ");

        if (!$range || $range->speed_min === null) {
            return null;
        }

        $speedMin   = (float) $range->speed_min;
        $speedMax   = (float) $range->speed_max;
        $nPoints    = 9;
        $step       = ($speedMax - $speedMin) / ($nPoints - 1);
        $speedPoints = array_map(fn ($i) => round($speedMin + $i * $step), range(0, $nPoints - 1));

        try {
            $response = Http::withToken(config('services.energy_ml.token'))
                ->timeout(30)
                ->post(rtrim(config('services.energy_ml.url'), '/') . '/api/predict', [
                    'model_ref' => $mlModel->model_file,
                    'query'     => ['dtex' => $dtex, 'tpm' => $tpm, 'yarn_type' => $yarnType, 'speed_points' => $speedPoints],
                ])
                ->throw();
        } catch (\Throwable $e) {
            Log::warning('ML predict failed', ['error' => $e->getMessage()]);
            return null;
        }

        $decoded = $response->json();
        if (!isset($decoded['predictions']) || count($decoded['predictions']) !== count($speedPoints)) {
            return null;
        }

        $model = [];
        foreach ($speedPoints as $i => $speed) {
            $model[$speed] = max(0.01, (float) $decoded['predictions'][$i]);
        }

        return $model;
    }

    // Returns [(speed_bucket => energy_per_machine_hour)] sorted by speed ascending.
    private function buildEnergyModel(string $yarnType, int $dtex, int $tpm): array
    {
        $rows = DB::select("
            SELECT
                ROUND(avg_rpm / 500) * 500                             AS speed_bucket,
                SUM(energy_kwh) / NULLIF(SUM(total_runtime_hours), 0) AS energy_per_machine_hour
            FROM runtime_shift_aggregates
            WHERE energy_kwh IS NOT NULL
              AND JSON_LENGTH(styles_parsed) = 1
              AND has_speed_outlier   = 0
              AND has_runtime_outlier = 0
              AND JSON_UNQUOTE(JSON_EXTRACT(styles_parsed, '\$[0].yarn_type')) = ?
              AND JSON_UNQUOTE(JSON_EXTRACT(styles_parsed, '\$[0].dtex'))      = ?
              AND JSON_UNQUOTE(JSON_EXTRACT(styles_parsed, '\$[0].tpm'))       = ?
            GROUP BY speed_bucket
            ORDER BY speed_bucket ASC
        ", [$yarnType, $dtex, $tpm]);

        $model = [];
        foreach ($rows as $r) {
            $model[(int) $r->speed_bucket] = (float) $r->energy_per_machine_hour;
        }

        return $model;
    }

    // Linear interpolation; clamps to nearest known bucket outside the range.
    private function interpolateEnergy(array $model, float $speed): ?float
    {
        if (empty($model)) {
            return null;
        }

        $buckets = array_keys($model);
        sort($buckets);

        // Exact hit
        $nearest = (int) (round($speed / 500) * 500);
        if (isset($model[$nearest])) {
            return $model[$nearest];
        }

        // Below range → use lowest
        if ($speed <= $buckets[0]) {
            return $model[$buckets[0]];
        }

        // Above range → use highest
        $last = end($buckets);
        if ($speed >= $last) {
            return $model[$last];
        }

        // Between two known buckets — linear interpolate
        for ($i = 0; $i < count($buckets) - 1; $i++) {
            $lo = $buckets[$i];
            $hi = $buckets[$i + 1];
            if ($speed >= $lo && $speed <= $hi) {
                $t = ($speed - $lo) / ($hi - $lo);
                return $model[$lo] + $t * ($model[$hi] - $model[$lo]);
            }
        }

        return $model[$buckets[0]];
    }

    // kg/h for two-ply twisted cable: output_m_per_h = speed*60/tpm, mass = 2 plies × dtex × 1e-7 kg/m
    private function kgPerHour(float $speed, int $dtex, int $tpm): float
    {
        return ($speed * 120.0 * $dtex * 1e-7) / $tpm;
    }

    // Total energy (kWh) to produce target_tonnes at a given speed.
    private function totalEnergy(float $speed, array $params, array $model): ?float
    {
        $energyPerHour = $this->interpolateEnergy($model, $speed);
        if ($energyPerHour === null) {
            return null;
        }

        $kgPerHour = $this->kgPerHour($speed, (int) $params['dtex'], (int) $params['tpm']);
        if ($kgPerHour <= 0) {
            return null;
        }

        $machineHours = ((float) $params['target_tonnes'] * 1000.0) / $kgPerHour;
        return $energyPerHour * $machineHours;
    }

    private function runGA(array $params, array $model, array $ga): array
    {
        $yarnType    = $params['yarn_type'];
        $dtex        = (int) $params['dtex'];
        $tpm         = (int) $params['tpm'];
        $initialSpeed = (float) $params['initial_speed'];

        if (empty($model)) {
            return [
                'yarn_type'    => $yarnType,
                'dtex'         => $dtex,
                'tpm'          => $tpm,
                'error'        => 'No energy data found for this material in the database.',
                'initial_speed' => $initialSpeed,
            ];
        }

        $buckets   = array_keys($model);
        sort($buckets);
        $speedMin  = (float) $buckets[0];
        $speedMax  = (float) end($buckets);
        $speedRange = $speedMax - $speedMin;

        if ($speedRange < 1) {
            $speedMin = max(100, $speedMin - 250);
            $speedMax = $speedMax + 250;
            $speedRange = $speedMax - $speedMin;
        }

        $popSize     = (int) $ga['population_size'];
        $generations  = (int) $ga['generations'];
        $mutRate     = (float) $ga['mutation_rate'];
        $crossRate   = (float) $ga['crossover_rate'];
        $earlyStop   = (int) $ga['early_stop'];
        $sigma       = 0.05 * $speedRange;
        $staleness   = 0;

        // Initialise population uniformly across the speed range
        $pop = [];
        for ($i = 0; $i < $popSize; $i++) {
            $pop[] = $speedMin + ($i / ($popSize - 1)) * $speedRange;
        }

        $fitness = array_map(fn ($s) => $this->totalEnergy($s, $params, $model) ?? PHP_FLOAT_MAX, $pop);
        $bestFitness = min($fitness);
        $bestSpeed   = $pop[array_search($bestFitness, $fitness)];
        $convergenceGen = 0;

        for ($gen = 0; $gen < $generations; $gen++) {
            // Sort by fitness ascending
            array_multisort($fitness, SORT_ASC, $pop);

            // Elitism: keep top 2
            $newPop = [$pop[0], $pop[1]];

            // Tournament selection + crossover + mutation to fill rest
            while (count($newPop) < $popSize) {
                // Tournament: pick 3 random, take best
                $candidates = array_rand($pop, min(3, $popSize));
                if (!is_array($candidates)) {
                    $candidates = [$candidates];
                }
                usort($candidates, fn ($a, $b) => $fitness[$a] <=> $fitness[$b]);
                $p1 = $pop[$candidates[0]];

                if (mt_rand() / mt_getrandmax() < $crossRate) {
                    // Arithmetic crossover with a second tournament winner
                    $candidates2 = array_rand($pop, min(3, $popSize));
                    if (!is_array($candidates2)) {
                        $candidates2 = [$candidates2];
                    }
                    usort($candidates2, fn ($a, $b) => $fitness[$a] <=> $fitness[$b]);
                    $p2    = $pop[$candidates2[0]];
                    $alpha = 0.3 + (mt_rand() / mt_getrandmax()) * 0.4;
                    $child = $alpha * $p1 + (1 - $alpha) * $p2;
                } else {
                    $child = $p1;
                }

                // Gaussian mutation
                if (mt_rand() / mt_getrandmax() < $mutRate) {
                    // Box-Muller for Gaussian noise
                    $u1    = max(1e-10, mt_rand() / mt_getrandmax());
                    $u2    = mt_rand() / mt_getrandmax();
                    $gauss = sqrt(-2 * log($u1)) * cos(2 * M_PI * $u2);
                    $child += $gauss * $sigma;
                }

                $child    = max($speedMin, min($speedMax, $child));
                $newPop[] = $child;
            }

            $pop     = $newPop;
            $fitness = array_map(fn ($s) => $this->totalEnergy($s, $params, $model) ?? PHP_FLOAT_MAX, $pop);

            $genBest = min($fitness);
            if ($genBest < $bestFitness * (1 - 0.001)) {
                $bestFitness    = $genBest;
                $bestSpeed      = $pop[array_search($genBest, $fitness)];
                $convergenceGen = $gen + 1;
                $staleness      = 0;
            } else {
                $staleness++;
                if ($staleness >= $earlyStop) {
                    break;
                }
            }
        }

        $initialEnergy = $this->totalEnergy($initialSpeed, $params, $model);
        $savings       = $initialEnergy !== null ? $initialEnergy - $bestFitness : null;
        $savingsPct    = ($initialEnergy !== null && $initialEnergy > 0)
            ? round(($savings / $initialEnergy) * 100, 2)
            : null;

        $kgPerHour       = $this->kgPerHour($bestSpeed, $dtex, $tpm);
        $machineHoursNeeded = $kgPerHour > 0
            ? round(((float) $params['target_tonnes'] * 1000) / $kgPerHour, 2)
            : null;

        return [
            'yarn_type'            => $yarnType,
            'dtex'                 => $dtex,
            'tpm'                  => $tpm,
            'initial_speed'        => round($initialSpeed, 0),
            'optimal_speed'        => round($bestSpeed, 0),
            'initial_energy_kwh'   => $initialEnergy !== null ? round($initialEnergy, 1) : null,
            'optimal_energy_kwh'   => round($bestFitness, 1),
            'savings_kwh'          => $savings !== null ? round($savings, 1) : null,
            'savings_pct'          => $savingsPct,
            'machine_hours_needed' => $machineHoursNeeded,
            'convergence_gen'      => $convergenceGen,
            'speed_range'          => ['min' => $speedMin, 'max' => $speedMax],
            'is_estimated'         => (bool) ($params['is_estimated'] ?? false),
        ];
    }
}
