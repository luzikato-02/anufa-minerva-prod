<?php

namespace Tests\Feature;

use App\ControlPlans\PdfExport;
use App\ControlPlans\PlanDates;
use App\ControlPlans\PrintSheet;
use App\ControlPlans\WordExport;
use App\Models\ControlPlan;
use App\Models\ControlPlanReference;
use App\Models\ControlPlanRevision;
use App\Models\ControlPlanSetting;
use App\Models\User;
use Database\Seeders\ControlPlanSampleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class ControlPlanImportTest extends TestCase
{
    use RefreshDatabase;

    private const ALL = ['control-plans.view', 'control-plans.author', 'control-plans.review', 'control-plans.approve', 'control-plans.settings'];

    protected function setUp(): void
    {
        parent::setUp();
        foreach ([...self::ALL, 'control-plans.delete'] as $p) {
            Permission::findOrCreate($p, 'web');
        }
    }

    private function user(array $perms): User
    {
        return User::factory()->withoutTwoFactor()->create()->givePermissionTo($perms);
    }

    private function author(): User
    {
        return $this->user(['control-plans.view', 'control-plans.author']);
    }

    /** W-WSD-W-30 Rev 11 from the sample, with everything the document can carry filled in. */
    private function released(int $extraLines = 0): ControlPlanRevision
    {
        $this->seed(ControlPlanSampleSeeder::class);
        $plan = ControlPlan::where('doc_no', 'W-WSD-W-30')->firstOrFail();
        $plan->update(['legacy_history' => [['page' => 'All', 'date' => '27 Oktober 2016', 'rev' => '00', 'description' => 'First issue', 'revised_by' => 'Budi']]]);
        $revision = $plan->revisions()->where('rev_no', 11)->firstOrFail();

        $content = $revision->content;
        for ($i = 1; $i <= $extraLines; $i++) {
            $content['lines'][] = ['id' => "x{$i}", 'step_id' => 's6b', 'product' => "Check {$i}", 'size' => '1x', 'frequency' => 'Every shift', 'reaction' => 'Stop the line', 'reaction_ref' => 'QA-IK-14']
                + array_fill_keys(ControlPlanRevision::LINE_FIELDS, '-');
        }
        $content['notes'] = "* Depends on the article\n** Checked by QA";
        $content['signatures'] = [
            'prepared' => [['id' => 'a', 'user_id' => null, 'name' => 'Andi', 'position' => 'Section Head']],
            'approved' => [['id' => 'b', 'user_id' => null, 'name' => 'Sari', 'position' => 'Dept. Head'], ['id' => 'c', 'user_id' => null, 'name' => 'Joko', 'position' => 'QA Manager']],
        ];
        $info = array_replace($revision->info, ['title' => 'Mill Production Control Plan', 'key_contact' => 'Andi / 123', 'cust_eng_name' => 'Pak Dedi', 'cust_eng_date' => '01/02/2020']);
        $revision->update(['content' => $content, 'info' => $info, 'history' => [['pages' => '2', 'description' => "Add width check\nNew splice limit"]]]);

        return $revision->fresh();
    }

    private function upload(string $path, string $name): UploadedFile
    {
        return new UploadedFile($path, $name, null, null, true);
    }

    private function wordFile(ControlPlanRevision $revision): UploadedFile
    {
        return $this->upload(WordExport::save(PrintSheet::build($revision, ControlPlanSetting::current())), 'W-WSD-W-30.docx');
    }

    private function pdfFile(ControlPlanRevision $revision): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'cp').'.pdf';
        file_put_contents($path, PdfExport::make(PrintSheet::build($revision, ControlPlanSetting::current()))->output());

        return $this->upload($path, 'W-WSD-W-30.pdf');
    }

    /** A plan's lines without ids, each with its step: what must survive the trip through a file. */
    private function shape(array $content): array
    {
        $steps = collect($content['steps'])->keyBy('id');

        return array_map(function ($l) use ($steps) {
            $row = array_diff_key($steps[$l['step_id']], ['id' => 1]) + array_diff_key($l, ['id' => 1, 'step_id' => 1]);
            ksort($row);

            return $row;
        }, $content['lines']);
    }

    private function preview(User $user, UploadedFile $file): array
    {
        return $this->actingAs($user)->post('/control-plans/import/preview', ['file' => $file], ['Accept' => 'application/json'])
            ->assertOk()->json('data');
    }

    private function assertReadsBack(ControlPlanRevision $revision, array $data): void
    {
        $this->assertSame('W-WSD-W-30', $data['doc_no']);
        $this->assertSame(11, $data['rev_no']);
        $this->assertSame(['mill' => 'Mill Production TCF1 & TCF2', 'sp_ref' => 'W-W-01', 'sp_date' => '20 Juni 2014', 'issued' => '27 Oktober 2016'], $data['header']);
        $this->assertSame(array_replace($revision->info, ['phase' => 'production']), $data['info']);
        $this->assertSame($this->shape($revision->content), $this->shape($data['content']));
        $this->assertCount(count($revision->content['steps']), $data['content']['steps']);
        $this->assertSame("* Depends on the article\n** Checked by QA", $data['content']['notes']);
        $this->assertSame([['Andi', 'Section Head']], array_map(fn ($s) => [$s['name'], $s['position']], $data['content']['signatures']['prepared']));
        $this->assertSame([['Sari', 'Dept. Head'], ['Joko', 'QA Manager']], array_map(fn ($s) => [$s['name'], $s['position']], $data['content']['signatures']['approved']));
        $this->assertSame([
            ['page' => 'All', 'date' => '27 Oktober 2016', 'rev' => '00', 'description' => 'First issue', 'revised_by' => 'Budi'],
            ['page' => '2', 'date' => '15 Oktober 2026', 'rev' => '11', 'description' => "Add width check\nNew splice limit", 'revised_by' => $revision->submitter?->name ?? $revision->author?->name ?? ''],
        ], $data['history']);
        $this->assertSame('2026-10-15', $data['release_date']);
        $this->assertSame('2028-10-15', $data['next_review_date']);
        $this->assertSame($revision->control_plan_id, $data['existing']['id']);
    }

    public function test_a_word_export_reads_back_as_the_same_plan(): void
    {
        $revision = $this->released();
        $data = $this->preview($this->author(), $this->wordFile($revision));

        $this->assertReadsBack($revision, $data);
        $this->assertSame('docx', $data['format']);
        // The sample's history jumps from Rev 00 to Rev 11, and the preview says so.
        $this->assertSame(['The revision history has no row for Rev 01 to 10. If the file lists them, check its history table: they were not read.'], $data['warnings']);
    }

    public function test_a_pdf_export_reads_back_as_the_same_plan(): void
    {
        $revision = $this->released();
        $data = $this->preview($this->author(), $this->pdfFile($revision));

        $this->assertReadsBack($revision, $data);
        $this->assertSame('pdf', $data['format']);
    }

    public function test_a_pdf_plan_over_several_pages_keeps_its_steps(): void
    {
        // The step's merged cells are printed again at the top of each new page; that is still the same step.
        $revision = $this->released(extraLines: 40);
        $data = $this->preview($this->author(), $this->pdfFile($revision));

        $this->assertCount(47, $data['content']['lines']);
        $this->assertCount(3, $data['content']['steps']);
        $this->assertSame($this->shape($revision->content), $this->shape($data['content']));
    }

    public function test_importing_as_a_draft_starts_the_normal_workflow(): void
    {
        $revision = $this->released();
        $author = $this->author();
        $data = $this->preview($author, $this->wordFile($revision));

        $res = $this->actingAs($author)->postJson('/control-plans/import', ['status' => 'draft', 'doc_no' => 'W-WSD-W-31'] + $data)->assertCreated();

        $plan = ControlPlan::findOrFail($res->json('data.plan_id'));
        $draft = $plan->revisions()->sole();
        $this->assertSame('W-WSD-W-31', $plan->doc_no);
        $this->assertSame([ControlPlanRevision::DRAFT, 11, $author->id], [$draft->status, $draft->rev_no, $draft->author_id]);
        $this->assertNull($draft->release_date);
        // The earlier rows stay as printed; this revision's own row prefills the submit dialog.
        $this->assertSame(['00'], array_column($plan->legacy_history, 'rev'));
        $this->assertSame([['pages' => '2', 'description' => "Add width check\nNew splice limit"]], $draft->history);
        $this->assertSame($this->shape($revision->content), $this->shape($draft->content));
        $this->assertSame('Imported Rev 11 from W-WSD-W-30.docx.', $draft->comments()->sole()->body);
        $this->actingAs($author)->get("/control-plans/{$plan->id}")->assertOk();
    }

    public function test_importing_as_released_needs_the_release_permission(): void
    {
        $revision = $this->released();
        ControlPlanReference::where('code', 'QA-IK-14')->update(['title' => 'Nonconforming product']);
        $data = ['status' => 'released', 'doc_no' => 'W-WSD-W-31'] + $this->preview($this->author(), $this->wordFile($revision));

        $this->actingAs($this->author())->postJson('/control-plans/import', $data)->assertForbidden();

        $approver = $this->user(['control-plans.view', 'control-plans.author', 'control-plans.approve']);
        $res = $this->actingAs($approver)->postJson('/control-plans/import', $data)->assertCreated();

        $plan = ControlPlan::findOrFail($res->json('data.plan_id'));
        $rev = $plan->released;
        $this->assertSame(11, $rev->rev_no);
        $this->assertSame(['2026-10-15', '2028-10-15'], [$rev->release_date->toDateString(), $rev->next_review_date->toDateString()]);
        $this->assertSame([$approver->id, $approver->id], [$rev->submitted_by, $rev->released_by]);
        $this->assertSame(['00', '11'], array_column($plan->legacy_history, 'rev'));
        $this->assertNull($rev->history);
        $this->assertContains('Nonconforming product', array_column($rev->reference_snapshot, 'title'));
        $this->assertSame('released', $rev->comments()->sole()->kind);

        // Without a next review date from the document, it is the release date plus the review period.
        $res = $this->actingAs($approver)->postJson('/control-plans/import', ['doc_no' => 'W-WSD-W-32', 'next_review_date' => null] + $data)->assertCreated();
        $this->assertSame('2028-10-15', ControlPlan::findOrFail($res->json('data.plan_id'))->released->next_review_date->toDateString());
        $this->actingAs($approver)->postJson('/control-plans/import', ['doc_no' => 'W-WSD-W-33', 'release_date' => null] + $data)->assertJsonValidationErrors('release_date');
    }

    public function test_an_import_needs_a_new_document_number(): void
    {
        $revision = $this->released();
        $author = $this->author();
        $data = $this->preview($author, $this->wordFile($revision));

        $this->actingAs($author)->postJson('/control-plans/import', ['status' => 'draft'] + $data)->assertJsonValidationErrors('doc_no');
        $this->actingAs($author)->postJson('/control-plans/import', ['status' => 'draft', 'doc_no' => ''] + $data)->assertJsonValidationErrors('doc_no');
        $this->assertSame(1, ControlPlan::count());
    }

    public function test_an_import_can_replace_the_plan_with_its_document_number(): void
    {
        $revision = $this->released();
        $plan = $revision->plan;
        $author = $this->author();
        $data = $this->preview($author, $this->wordFile($revision));
        $before = $plan->revisionSummary();
        $this->assertSame($before, $data['existing']['revisions']);
        $this->assertStringContainsString('Rev 11 released', $before);

        $this->actingAs($author)->postJson('/control-plans/import', ['status' => 'draft', 'replace' => true] + $data)->assertForbidden();

        $admin = $this->user(['control-plans.view', 'control-plans.author', 'control-plans.delete']);
        $res = $this->actingAs($admin)->postJson('/control-plans/import', ['status' => 'draft', 'replace' => true] + $data)->assertCreated();

        // The same plan, so links to it still work, now holding only the imported draft.
        $this->assertSame($plan->id, $res->json('data.plan_id'));
        $this->assertSame(1, ControlPlan::count());
        $draft = $plan->fresh()->revisions()->sole();
        $this->assertSame([ControlPlanRevision::DRAFT, 11], [$draft->status, $draft->rev_no]);
        $this->assertNull($plan->fresh()->released);
        $this->assertSame("Imported Rev 11 from W-WSD-W-30.docx. It replaced {$before}.", $draft->comments()->sole()->body);
    }

    public function test_deleting_a_whole_plan_needs_the_delete_permission_and_frees_its_number(): void
    {
        $plan = $this->released()->plan;
        $this->actingAs($this->author())->deleteJson("/control-plans/{$plan->id}")->assertForbidden();

        $admin = $this->user(['control-plans.view', 'control-plans.author', 'control-plans.delete']);
        $this->actingAs($admin)->deleteJson("/control-plans/{$plan->id}")->assertOk();
        $this->assertSoftDeleted($plan);
        $this->assertSame(0, ControlPlanRevision::where('control_plan_id', $plan->id)->count());

        // The document number can be used again.
        $this->actingAs($admin)->postJson('/control-plans', ['doc_no' => 'W-WSD-W-30', 'title' => 'Again', 'rev_no' => 0])->assertCreated();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);
        $this->assertTrue(\Spatie\Permission\Models\Role::findByName('admin')->hasPermissionTo('control-plans.delete'));
    }

    public function test_history_tables_are_read_in_the_ways_plans_lay_them_out(): void
    {
        $english = ['Page', 'Date of Revision', 'Revision No', 'Description', 'Revised by'];
        $row = fn (int $rev) => ['All', "1 Januari 20{$rev}", sprintf('%02d', $rev), "Change {$rev}", 'Budi'];
        $layouts = [
            'Indonesian header' => [[['Halaman', 'Tanggal Revisi', 'No. Revisi', 'Keterangan', 'Diubah oleh'], $row(0), $row(1)]],
            'both languages' => [[['Halaman / Page', 'Tanggal / Date', 'Revisi / Rev', 'Keterangan / Description', 'Oleh / Revised by'], $row(0), $row(1)]],
            'title row above the header' => [[['REVISION HISTORY'], $english, $row(0), $row(1)]],
            'continued without its header' => [[$english, $row(0)], [$row(1)]],
        ];
        foreach ($layouts as $layout => $tables) {
            $word = new \PhpOffice\PhpWord\PhpWord;
            $section = $word->addSection();
            foreach ($tables as $rows) {
                $table = $section->addTable();
                foreach ($rows as $cells) {
                    $table->addRow();
                    count($cells) === 1
                        ? $table->addCell(10000, ['gridSpan' => 5])->addText($cells[0])
                        : array_map(fn ($c) => $table->addCell(2000)->addText($c), $cells);
                }
                $section->addText('');
            }
            $path = tempnam(sys_get_temp_dir(), 'cp').'.docx';
            \PhpOffice\PhpWord\IOFactory::createWriter($word)->save($path);

            $data = $this->preview($this->author(), $this->upload($path, 'plan.docx'));
            $this->assertSame([
                ['page' => 'All', 'date' => '1 Januari 200', 'rev' => '00', 'description' => 'Change 0', 'revised_by' => 'Budi'],
                ['page' => 'All', 'date' => '1 Januari 201', 'rev' => '01', 'description' => 'Change 1', 'revised_by' => 'Budi'],
            ], $data['history'], $layout);
        }

        // Rows missing from the start or the middle are pointed out.
        $word = new \PhpOffice\PhpWord\PhpWord;
        $table = $word->addSection()->addTable();
        foreach ([$english, $row(3), $row(5)] as $cells) {
            $table->addRow();
            array_map(fn ($c) => $table->addCell(2000)->addText($c), $cells);
        }
        $path = tempnam(sys_get_temp_dir(), 'cp').'.docx';
        \PhpOffice\PhpWord\IOFactory::createWriter($word)->save($path);
        $this->assertContains('The revision history has no row for Rev 00 to 02, 04. If the file lists them, check its history table: they were not read.', $this->preview($this->author(), $this->upload($path, 'plan.docx'))['warnings']);
    }

    public function test_files_that_cannot_be_imported_say_why(): void
    {
        $author = $this->author();
        $post = fn (UploadedFile $file) => $this->actingAs($author)->post('/control-plans/import/preview', ['file' => $file], ['Accept' => 'application/json']);

        $post(UploadedFile::fake()->create('old.doc', 10))->assertJsonValidationErrors(['file' => 'save it as Word Document (.docx)']);
        $post(UploadedFile::fake()->create('notes.txt', 10))->assertJsonValidationErrors(['file' => 'Word (.docx) or PDF']);
        $post(UploadedFile::fake()->createWithContent('broken.docx', 'not a zip'))->assertJsonValidationErrors(['file' => 'Not a Word (.docx) file.']);
        $post(UploadedFile::fake()->createWithContent('broken.pdf', 'not a pdf'))->assertJsonValidationErrors('file');

        $this->actingAs($this->user(['control-plans.view']))->post('/control-plans/import/preview', ['file' => UploadedFile::fake()->create('a.docx', 1)])->assertForbidden();
        $this->actingAs($this->user(['control-plans.view']))->postJson('/control-plans/import', [])->assertForbidden();
    }

    public function test_dates_are_read_in_the_ways_plans_write_them(): void
    {
        $this->assertSame('2026-10-15', PlanDates::parse('15 Oktober 2026'));
        $this->assertSame('2026-08-03', PlanDates::parse('3 Agt 2026'));
        $this->assertSame('2026-05-09', PlanDates::parse('09 May 2026'));
        $this->assertSame('2020-02-01', PlanDates::parse('01/02/2020'));
        $this->assertSame('2020-02-01', PlanDates::parse('1-2-20'));
        $this->assertSame('2026-10-15', PlanDates::parse('2026-10-15'));
        $this->assertNull(PlanDates::parse('[set on release]'));
        $this->assertNull(PlanDates::parse('31/02/2020'));
    }
}
