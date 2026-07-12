<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class TrainMlModel extends Command
{
    protected $signature = 'ml:train {id}';

    protected $description = 'Runs an ML Energy Model training job against the ml-service Vercel API in the background, replaying progress into the local progress log.';

    public function handle(): int
    {
        $id           = $this->argument('id');
        $jobPath      = storage_path('app/private/ml_models/' . $id . '.job.json');
        $progressPath = storage_path('app/private/ml_models/' . $id . '.progress.log');

        $job = json_decode((string) file_get_contents($jobPath), true);
        if (!$job) {
            $this->appendLine($progressPath, 'ERROR Training job file missing or invalid.');
            return self::FAILURE;
        }

        $url   = config('services.energy_ml.url');
        $token = config('services.energy_ml.token');

        try {
            if (!$url || !$token) {
                throw new \RuntimeException('ENERGY_ML_SERVICE_URL / ENERGY_ML_SERVICE_TOKEN are not configured.');
            }

            $response = Http::withToken($token)
                ->timeout(60)
                ->post(rtrim($url, '/') . '/api/train', [
                    'model_id'    => $id,
                    'model_type'  => $job['model_type'] ?? 'ridge',
                    'hyperparams' => $job['hyperparams'] ?? [],
                    'auto_tune'   => $job['auto_tune'] ?? false,
                    'training'    => $job['training'] ?? [],
                ]);

            $data = $response->json() ?? [];

            if ($response->failed() || isset($data['error'])) {
                $this->appendLine($progressPath, 'ERROR ' . ($data['error'] ?? 'ml-service request failed: ' . $response->status()));
                return self::FAILURE;
            }

            foreach ($data['lines'] ?? [] as $line) {
                $this->appendLine($progressPath, $line);
                usleep(150000);
            }
            $this->appendLine($progressPath, now()->format('H:i:s') . '  RESULT ' . json_encode($data['result']));
        } catch (\Throwable $e) {
            $this->appendLine($progressPath, now()->format('H:i:s') . '  ERROR ' . $e->getMessage());
            return self::FAILURE;
        } finally {
            @unlink($jobPath);
        }

        return self::SUCCESS;
    }

    private function appendLine(string $path, string $line): void
    {
        file_put_contents($path, $line . "\n", FILE_APPEND);
    }
}
