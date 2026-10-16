<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A document code (SP, WI, form…) that control plans refer to, with its title and where to find it. */
class ControlPlanReference extends Model
{
    protected $fillable = ['code', 'title', 'type', 'revision', 'link'];
}
