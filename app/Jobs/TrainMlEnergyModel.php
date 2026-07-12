<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;

class TrainMlEnergyModel implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 120;

    public int $tries = 1;

    public function __construct(private readonly int|string $modelId)
    {
    }

    public function handle(): void
    {
        $jobPath      = storage_path('app/private/ml_models/' . $this->modelId . '.job.json');
        $progressPath = storage_path('app/private/ml_models/' . $this->modelId . '.progress.log');

        $payload = json_decode((string) file_get_contents($jobPath), true);
        if (!$payload) {
            $this->appendLine($progressPath, 'ERROR Training job file missing or invalid.');
            return;
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
                    'model_id'    => $this->modelId,
                    'model_type'  => $payload['model_type'] ?? 'ridge',
                    'hyperparams' => $payload['hyperparams'] ?? [],
                    'auto_tune'   => $payload['auto_tune'] ?? false,
                    'training'    => $payload['training'] ?? [],
                ]);

            $data = $response->json() ?? [];

            if ($response->failed() || isset($data['error'])) {
                $this->appendLine($progressPath, 'ERROR ' . ($data['error'] ?? 'ml-service request failed: ' . $response->status()));
                return;
            }

            foreach ($data['lines'] ?? [] as $line) {
                $this->appendLine($progressPath, $line);
                usleep(150000);
            }
            $this->appendLine($progressPath, now()->format('H:i:s') . '  RESULT ' . json_encode($data['result']));
        } catch (\Throwable $e) {
            $this->appendLine($progressPath, now()->format('H:i:s') . '  ERROR ' . $e->getMessage());
        } finally {
            @unlink($jobPath);
        }
    }

    private function appendLine(string $path, string $line): void
    {
        file_put_contents($path, $line . "\n", FILE_APPEND);
    }
}
