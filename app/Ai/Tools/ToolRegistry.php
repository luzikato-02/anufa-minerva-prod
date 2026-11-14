<?php

namespace App\Ai\Tools;

use App\Models\User;

/** Every tool the data chat knows, and the subset a given user may be offered. */
class ToolRegistry
{
    /** @var array<int, class-string<Tool>> */
    public const TOOLS = [
        TensionRecordsTool::class,
        TensionProblemsTool::class,
        StockSheetsTool::class,
        TorqueChecksTool::class,
    ];

    /** @return array<string, Tool> keyed by name */
    public function forUser(User $user): array
    {
        $tools = [];
        foreach (self::TOOLS as $class) {
            $tool = app($class);
            if ($tool->permission() === null || $user->can($tool->permission())) {
                $tools[$tool->name()] = $tool;
            }
        }

        return $tools;
    }
}
