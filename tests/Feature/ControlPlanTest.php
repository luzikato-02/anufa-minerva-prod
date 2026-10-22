<?php

namespace Tests\Feature;

use App\ControlPlans\PrintSheet;
use App\ControlPlans\ReferenceCodes;
use App\ControlPlans\RevisionDiff;
use App\Models\ControlPlan;
use App\Models\ControlPlanReference;
use App\Models\ControlPlanRevision;
use App\Models\ControlPlanSetting;
use App\Models\User;
use Database\Seeders\ControlPlanSampleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class ControlPlanTest extends TestCase
{
    use RefreshDatabase;

    private const ALL = ['control-plans.view', 'control-plans.author', 'control-plans.review', 'control-plans.approve', 'control-plans.settings'];

    protected function setUp(): void
    {
        parent::setUp();
        foreach (self::ALL as $p) {
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

    private function sample(): ControlPlan
    {
        $this->seed(ControlPlanSampleSeeder::class);

        return ControlPlan::where('doc_no', 'W-WSD-W-30')->firstOrFail();
    }

    private function draftOf(ControlPlan $plan): ControlPlanRevision
    {
        return $plan->revisions()->where('status', ControlPlanRevision::DRAFT)->firstOrFail();
    }

    private function document(ControlPlanRevision $r, array $overrides = []): array
    {
        return array_replace_recursive(['header' => $r->header, 'info' => $r->info, 'content' => $r->content], $overrides);
    }

    public function test_pages_follow_the_control_plan_permissions(): void
    {
        $plan = $this->sample();
        $draft = $this->draftOf($plan);

        $viewer = $this->user(['control-plans.view']);
        $this->actingAs($viewer)->get('/control-plans')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('control-plans')
                ->where('plans.0.doc_no', 'W-WSD-W-30')
                ->where('plans.0.open', null)
                ->where('canWork', false));
        // Someone who only views sees the released revision, never the draft.
        $this->actingAs($viewer)->get("/control-plans/{$plan->id}")->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('control-plan-editor')->where('revision.rev_no', 11));
        $this->actingAs($viewer)->get("/control-plan-revisions/{$draft->id}/review")->assertForbidden();
        $this->actingAs($viewer)->get("/control-plan-revisions/{$draft->id}/print")->assertForbidden();
        $this->actingAs($viewer)->get("/control-plans/{$plan->id}/viewer")->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('control-plan-viewer')->where('revision.rev_no', 11));
        $this->actingAs($viewer)->get('/control-plan-references')->assertOk();
        $this->actingAs($viewer)->get('/control-plan-settings')->assertForbidden();
        $this->actingAs($viewer)->putJson("/control-plan-revisions/{$draft->id}", $this->document($draft))->assertForbidden();

        $author = $this->author();
        $this->actingAs($author)->get("/control-plans/{$plan->id}")->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('control-plan-editor')
                ->where('revision.rev_no', 12)
                ->where('revision.editable', true)
                ->where('released.release_date', '15 Oktober 2026'));
        $this->actingAs($author)->get("/control-plan-revisions/{$draft->id}/review")->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('control-plan-review')
                ->where('diff.added', 1)
                ->where('diff.changed', 1)
                ->where('diff.removed', 0));
        $this->actingAs($author)->get("/control-plan-revisions/{$draft->id}/preview")->assertOk();
        $this->actingAs($author)->get("/control-plans/{$plan->id}/export")->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('control-plan-export')->has('options', 2));

        $this->actingAs($this->user(['control-plans.view', 'control-plans.settings']))->get('/control-plan-settings')->assertOk();
        $this->actingAs($this->user([]))->get('/control-plans')->assertForbidden();
    }

    public function test_a_revision_goes_from_draft_through_review_to_release(): void
    {
        $plan = $this->sample();
        $draft = $this->draftOf($plan);
        $author = $this->author();
        $reviewer = $this->user(['control-plans.view', 'control-plans.review']);
        $approver = $this->user(['control-plans.view', 'control-plans.approve']);

        $doc = $this->document($draft, ['info' => ['title' => 'Mill Production Control Plan']]);
        $this->actingAs($author)->putJson("/control-plan-revisions/{$draft->id}", $doc)->assertOk()
            ->assertJsonPath('data.info.title', 'Mill Production Control Plan');

        $this->actingAs($author)->postJson("/control-plan-revisions/{$draft->id}/submit", ['history' => []])->assertUnprocessable();
        $noSize = $doc;
        $noSize['content']['lines'][0]['size'] = '';
        $this->actingAs($author)->putJson("/control-plan-revisions/{$draft->id}", $noSize)->assertOk();
        $this->actingAs($author)->postJson("/control-plan-revisions/{$draft->id}/submit", ['history' => [['pages' => '2', 'description' => 'x']]])
            ->assertUnprocessable()->assertJsonValidationErrors(['history' => '1 characteristic has no sample size']);
        $this->actingAs($author)->putJson("/control-plan-revisions/{$draft->id}", $doc)->assertOk();
        $this->actingAs($author)->postJson("/control-plan-revisions/{$draft->id}/submit", ['history' => [
            ['pages' => '2', 'description' => "Penambahan karakteristik Unwoven cord\nPerubahan frekuensi Fabric width menjadi every shift"],
        ]])->assertOk();
        $this->assertSame(ControlPlanRevision::IN_REVIEW, $draft->fresh()->status);

        // A submitted revision is locked, and nobody may skip QA review.
        $this->actingAs($author)->putJson("/control-plan-revisions/{$draft->id}", $doc)->assertUnprocessable();
        $this->actingAs($approver)->postJson("/control-plan-revisions/{$draft->id}/release")->assertUnprocessable();

        $this->actingAs($reviewer)->postJson("/control-plan-revisions/{$draft->id}/request-changes", ['body' => ''])->assertUnprocessable();
        $this->actingAs($reviewer)->postJson("/control-plan-revisions/{$draft->id}/request-changes", ['body' => 'Add the gauge number.'])->assertOk();
        $this->assertSame(ControlPlanRevision::CHANGES_REQUESTED, $draft->fresh()->status);

        $this->actingAs($author)->putJson("/control-plan-revisions/{$draft->id}", $doc)->assertOk();
        $this->actingAs($author)->postJson("/control-plan-revisions/{$draft->id}/submit", ['history' => [['pages' => '2', 'description' => 'Unwoven cord']]])->assertOk();
        $this->actingAs($reviewer)->postJson("/control-plan-revisions/{$draft->id}/approve")->assertOk();
        $this->actingAs($approver)->postJson("/control-plan-revisions/{$draft->id}/release")->assertOk();

        $released = $draft->fresh();
        $this->assertSame(ControlPlanRevision::RELEASED, $released->status);
        $this->assertSame(today()->toDateString(), $released->release_date->toDateString());
        $this->assertSame(today()->addYears(2)->toDateString(), $released->next_review_date->toDateString());
        $this->assertSame(ControlPlanRevision::SUPERSEDED, $plan->revisions()->where('rev_no', 11)->first()->status);
        $this->assertContains('QA-IK-14', array_column($released->reference_snapshot, 'code'));
        $this->assertSame(['submitted', 'changes_requested', 'submitted', 'approved', 'released'], $released->comments->pluck('kind')->all());

        // The next revision starts as a copy of the released one.
        $this->actingAs($author)->postJson("/control-plans/{$plan->id}/revisions")->assertCreated();
        $this->actingAs($author)->postJson("/control-plans/{$plan->id}/revisions")->assertUnprocessable();
        $next = $plan->revisions()->where('rev_no', 13)->firstOrFail();
        $this->assertSame($released->content, $next->content);
        $this->assertSame([], RevisionDiff::compare($released->content, $next->content)['rows']);
    }

    public function test_whoever_submitted_a_revision_cannot_review_or_release_it(): void
    {
        $draft = $this->draftOf($this->sample());
        $everything = $this->user(self::ALL);

        $this->actingAs($everything)->postJson("/control-plan-revisions/{$draft->id}/submit", ['history' => [['pages' => 'All', 'description' => 'Update']]])->assertOk();
        $this->actingAs($everything)->postJson("/control-plan-revisions/{$draft->id}/approve")->assertForbidden();

        $this->actingAs($this->user(['control-plans.view', 'control-plans.review']))->postJson("/control-plan-revisions/{$draft->id}/approve")->assertOk();
        $this->actingAs($everything)->postJson("/control-plan-revisions/{$draft->id}/release")->assertForbidden();
        $this->assertSame(ControlPlanRevision::APPROVED, $draft->fresh()->status);
    }

    public function test_the_author_can_take_a_submitted_revision_back(): void
    {
        $draft = $this->draftOf($this->sample());
        $author = $this->author();
        $this->actingAs($author)->postJson("/control-plan-revisions/{$draft->id}/submit", ['history' => [['pages' => '2', 'description' => 'x']]])->assertOk();
        $this->actingAs($author)->postJson("/control-plan-revisions/{$draft->id}/withdraw")->assertOk();
        $this->assertSame(ControlPlanRevision::DRAFT, $draft->fresh()->status);
    }

    public function test_a_new_plan_starts_as_a_draft_from_the_settings_and_can_be_discarded(): void
    {
        ControlPlanSetting::current()->update(['mill' => 'Mill TCF', 'org_plant' => 'PT. Indo Kordsa Tbk/TCF', 'org_code' => 'IK']);
        $author = $this->author();

        $res = $this->actingAs($author)->postJson('/control-plans', ['doc_no' => 'W-WSD-W-31', 'title' => 'Creel'])->assertCreated();
        $this->actingAs($author)->postJson('/control-plans', ['doc_no' => 'W-WSD-W-31'])->assertUnprocessable();

        $revision = ControlPlanRevision::findOrFail($res->json('data.revision_id'));
        $this->assertSame('Mill TCF', $revision->header['mill']);
        $this->assertSame('IK', $revision->info['org_code']);
        $this->assertSame('Creel', $revision->info['title']);
        $this->assertCount(1, $revision->content['lines']);

        $this->actingAs($author)->deleteJson("/control-plan-revisions/{$revision->id}")->assertOk();
        $this->assertSame(0, ControlPlan::count());
    }

    public function test_saving_normalises_the_document_and_rejects_lines_without_a_step(): void
    {
        $draft = $this->draftOf($this->sample());
        $author = $this->author();
        $doc = $this->document($draft);

        $orphan = $doc;
        $orphan['content']['lines'][0]['step_id'] = 'nope';
        $this->actingAs($author)->putJson("/control-plan-revisions/{$draft->id}", $orphan)->assertUnprocessable()->assertJsonValidationErrors('content.lines.0.step_id');

        // Unknown keys are dropped, missing ones filled in, and a step left with no lines is removed.
        $doc['content']['lines'][0]['bogus'] = 'x';
        unset($doc['content']['lines'][0]['pic']);
        $doc['content']['steps'][] = ['id' => 'empty', 'no' => '7', 'group' => '', 'name' => 'Nothing', 'machine' => ''];
        $doc['doc_no'] = 'W-WSD-W-30A';
        $this->actingAs($author)->putJson("/control-plan-revisions/{$draft->id}", $doc)->assertOk();

        $saved = $draft->fresh();
        $this->assertArrayNotHasKey('bogus', $saved->content['lines'][0]);
        $this->assertSame('', $saved->content['lines'][0]['pic']);
        $this->assertNotContains('empty', array_column($saved->content['steps'], 'id'));
        $this->assertSame('W-WSD-W-30A', $saved->plan->doc_no);
    }

    public function test_the_document_prints_as_html_pdf_and_word(): void
    {
        $plan = $this->sample();
        $draft = $this->draftOf($plan);
        $author = $this->author();

        $this->actingAs($author)->get("/control-plan-revisions/{$draft->id}/print")->assertOk()
            ->assertSee('WORK STATION DOCUMENT')
            ->assertSee('Unwoven cord')
            ->assertSee('DRAFT')
            ->assertSee('12 / [set on release]', false);
        $this->actingAs($author)->get("/control-plan-revisions/{$draft->id}/print?watermark=0")->assertOk()->assertDontSee('class="watermark"', false);

        $pdf = $this->actingAs($author)->get("/control-plan-revisions/{$draft->id}/download/pdf")->assertOk();
        $this->assertStringContainsString('W-WSD-W-30 Rev 12 DRAFT.pdf', $pdf->headers->get('content-disposition'));
        $this->assertStringStartsWith('%PDF', $pdf->getContent());

        $released = $plan->revisions()->where('rev_no', 11)->first();
        $docx = $this->actingAs($this->user(['control-plans.view']))->get("/control-plan-revisions/{$released->id}/download/docx")->assertOk();
        $this->assertStringContainsString('W-WSD-W-30 Rev 11.docx', $docx->headers->get('content-disposition'));
        $this->assertStringStartsWith('PK', file_get_contents($docx->getFile()->getPathname()));

        $this->actingAs($author)->get("/control-plan-revisions/{$draft->id}/download/xls")->assertNotFound();
    }

    public function test_the_print_layout_merges_shared_step_cells(): void
    {
        $draft = $this->draftOf($this->sample());
        $s = PrintSheet::build($draft, ControlPlanSetting::current());

        $this->assertSame('12 / [set on release]', $s['rev_label']);
        $this->assertCount(8, $s['rows']);
        // Step 5 is one line; step 6 spans the 7 lines of both its process names, Doff Greige Fabric 6 of them.
        $this->assertSame(['text' => '5', 'rowspan' => 1], $s['rows'][0][0]);
        $this->assertSame(7, $s['rows'][1][0]['rowspan']);
        $this->assertSame(7, $s['rows'][1][1]['rowspan']);
        $this->assertSame(6, $s['rows'][1][2]['rowspan']);
        $this->assertTrue($s['rows'][2][0]['covered']);
        $this->assertSame('Weigh greige fabric', $s['rows'][7][2]['text']);
        $this->assertSame('Reweigh product (W-WSD-W-26)', $s['rows'][7][14]['text']);
    }

    public function test_reference_codes_are_found_in_text_and_the_library_shows_where_they_are_used(): void
    {
        $this->assertSame(['T-WSD-W-21'], ReferenceCodes::in('< 100 splices (T-WSD-W-21)'));
        $this->assertSame(['TCF-W014'], ReferenceCodes::in('TCF-W014, ERP system'));
        $this->assertSame([], ReferenceCodes::in('1,300 – 2,000 mm*'));

        $this->sample();
        $author = $this->author();
        $this->actingAs($author)->get('/control-plan-references')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('control-plan-references')
                ->where('references', fn ($refs) => collect($refs)->firstWhere('code', 'QA-IK-14')['uses'][0]['where']['Reaction plan'] === 7));

        $this->actingAs($author)->postJson('/control-plan-references', ['code' => 'qa ik 15'])->assertUnprocessable();
        $this->actingAs($author)->postJson('/control-plan-references', ['code' => 'QA-IK-14'])->assertUnprocessable();
        $this->actingAs($author)->postJson('/control-plan-references', ['code' => 'QA-IK-15', 'title' => 'Segregation'])->assertCreated();
        $ref = ControlPlanReference::where('code', 'QA-IK-15')->first();
        $this->actingAs($author)->patchJson("/control-plan-references/{$ref->id}", ['code' => 'QA-IK-15', 'title' => 'Product segregation'])->assertOk();
        $this->assertSame('Product segregation', $ref->fresh()->title);
    }

    public function test_settings_set_the_date_format_and_review_period(): void
    {
        $admin = $this->user(['control-plans.view', 'control-plans.settings']);
        $this->actingAs($admin)->putJson('/control-plan-settings', ['date_format' => 'en', 'review_period_years' => 3, 'mill' => 'Mill'])->assertOk();
        $this->actingAs($admin)->putJson('/control-plan-settings', ['date_format' => 'fr', 'review_period_years' => 3])->assertUnprocessable();

        $draft = $this->draftOf($this->sample());
        $s = PrintSheet::build($draft, ControlPlanSetting::current());
        $this->assertSame('[release date + 3 years]', $s['next_review']);
        $released = $draft->plan->revisions()->where('rev_no', 11)->first();
        $this->assertSame('15 October 2026', PrintSheet::build($released, ControlPlanSetting::current())['release_date']);
    }

    public function test_notes_and_signers_are_saved_printed_and_shown_as_changed_in_review(): void
    {
        $plan = $this->sample();
        $draft = $this->draftOf($plan);
        $author = $this->author();
        $doc = $this->document($draft);
        $doc['content']['notes'] = "* Sesuai spesifikasi produk\n** Permintaan customer";
        $doc['content']['signatures'] = [
            'prepared' => [['id' => 'a', 'name' => 'Budi Santoso', 'position' => 'Weaving Engineer', 'bogus' => 'x']],
            'approved' => [['id' => 'b', 'name' => 'Dewi Lestari', 'position' => 'QA Manager'], ['id' => 'c', 'name' => 'Hendra Gunawan', 'position' => 'Mill Manager']],
        ];
        $this->actingAs($author)->putJson("/control-plan-revisions/{$draft->id}", $doc)->assertOk();

        $saved = $draft->fresh()->content;
        $this->assertSame(['id' => 'a', 'user_id' => null, 'name' => 'Budi Santoso', 'position' => 'Weaving Engineer'], $saved['signatures']['prepared'][0]);
        $this->assertCount(2, $saved['signatures']['approved']);

        $this->actingAs($author)->get("/control-plan-revisions/{$draft->id}/print")->assertOk()
            ->assertSee('** Permintaan customer')
            ->assertSee('Dibuat oleh')
            ->assertSee('Disetujui oleh')
            ->assertSee('Hendra Gunawan');

        $s = PrintSheet::build($draft->fresh(), ControlPlanSetting::current());
        $this->assertSame(['* Sesuai spesifikasi produk', '** Permintaan customer'], $s['notes']);

        // The released Rev 11 has neither, so the review flags both as changed.
        $this->actingAs($author)->get("/control-plan-revisions/{$draft->id}/review")->assertOk()
            ->assertInertia(fn ($page) => $page->where('diff.notes_changed', true)->where('diff.signatures_changed', true));

        $tooMany = $doc;
        $tooMany['content']['signatures']['approved'] = array_map(fn ($n) => ['id' => "p$n", 'name' => "P$n", 'position' => ''], range(1, 9));
        $this->actingAs($author)->putJson("/control-plan-revisions/{$draft->id}", $tooMany)->assertUnprocessable();
    }

    /** A small PNG signature as a data: URI. */
    private static function signatureImage(int $w = 120, int $h = 40): string
    {
        $img = imagecreatetruecolor($w, $h);
        imageline($img, 2, $h - 4, $w - 2, 4, imagecolorallocate($img, 255, 255, 255));
        ob_start();
        imagepng($img);

        return 'data:image/png;base64,'.base64_encode((string) ob_get_clean());
    }

    public function test_linked_people_sign_their_own_box_and_an_edit_clears_the_signatures(): void
    {
        $plan = $this->sample();
        $draft = $this->draftOf($plan);
        $author = $this->author();
        // A plant manager who only views control plans, asked to approve this one.
        $manager = $this->user(['control-plans.view']);
        $doc = $this->document($draft);
        $doc['content']['signatures'] = [
            'prepared' => [['id' => 'a', 'user_id' => $author->id, 'name' => 'Budi Santoso', 'position' => 'Weaving Engineer']],
            'approved' => [['id' => 'b', 'user_id' => $manager->id, 'name' => 'Hendra Gunawan', 'position' => 'Mill Manager'], ['id' => 'c', 'user_id' => null, 'name' => 'Paper Signer', 'position' => '']],
        ];
        $this->actingAs($author)->putJson("/control-plan-revisions/{$draft->id}", $doc)->assertOk();

        // The manager can open the draft only because they have a box in it, and it waits for their signature.
        $this->actingAs($manager)->get("/control-plan-revisions/{$draft->id}/review")->assertOk();
        $this->actingAs($manager)->get('/control-plans')->assertInertia(fn (Assert $page) => $page
            ->where('waiting.0.id', $draft->id)->where('waiting.0.to_sign', true));
        $this->actingAs($this->user(['control-plans.view']))->get("/control-plan-revisions/{$draft->id}/review")->assertForbidden();

        // Nobody signs someone else's box, or a box with no account, and the image must be a real picture.
        $this->actingAs($author)->postJson("/control-plan-revisions/{$draft->id}/signatures/b", ['image' => self::signatureImage()])->assertForbidden();
        $this->actingAs($author)->postJson("/control-plan-revisions/{$draft->id}/signatures/c", ['image' => self::signatureImage()])->assertForbidden();
        $this->actingAs($manager)->postJson("/control-plan-revisions/{$draft->id}/signatures/b", ['image' => 'data:image/png;base64,'.base64_encode('<svg/>')])->assertUnprocessable();

        $this->actingAs($author)->postJson("/control-plan-revisions/{$draft->id}/signatures/a", ['image' => self::signatureImage()])->assertCreated();
        $this->actingAs($manager)->postJson("/control-plan-revisions/{$draft->id}/signatures/b", ['image' => self::signatureImage(2000, 300)])->assertCreated();

        $signed = $draft->fresh()->signed('id');
        $this->assertSame(['a', 'b'], array_keys($signed));
        [$w] = getimagesizefromstring(base64_decode(substr($signed['b']['image'], 22)));
        $this->assertSame(800, $w, 'A large image is scaled down.');
        $this->actingAs($manager)->get('/control-plans')->assertInertia(fn (Assert $page) => $page->where('waiting', []));

        // Both print, in the preview and the Word file.
        $this->actingAs($author)->get("/control-plan-revisions/{$draft->id}/print")->assertOk()->assertSee('Signed by '.$manager->name);
        $sheet = PrintSheet::build($draft->fresh(), ControlPlanSetting::current());
        $this->assertCount(2, $sheet['signed']);
        $this->actingAs($author)->get("/control-plan-revisions/{$draft->id}/download/docx")->assertOk();

        // Saving the draft unchanged keeps them; changing anything removes them all.
        $this->actingAs($author)->putJson("/control-plan-revisions/{$draft->id}", $doc)->assertOk()->assertJsonCount(2, 'data.signed');
        $doc['content']['notes'] = '* changed';
        $this->actingAs($author)->putJson("/control-plan-revisions/{$draft->id}", $doc)->assertOk()->assertJsonCount(0, 'data.signed');
        $this->assertSame(0, $draft->signatures()->count());

        // A signer can take their signature back, but nothing changes once the revision is released.
        $this->actingAs($manager)->postJson("/control-plan-revisions/{$draft->id}/signatures/b", ['image' => self::signatureImage()])->assertCreated();
        $this->actingAs($manager)->deleteJson("/control-plan-revisions/{$draft->id}/signatures/b")->assertOk();
        $this->assertSame(0, $draft->signatures()->count());
        $draft->update(['status' => ControlPlanRevision::RELEASED]);
        $this->actingAs($manager)->postJson("/control-plan-revisions/{$draft->id}/signatures/b", ['image' => self::signatureImage()])->assertUnprocessable();
    }

    public function test_the_company_logo_is_uploaded_printed_and_removed(): void
    {
        Storage::fake('local');
        $admin = $this->user(['control-plans.view', 'control-plans.settings']);
        $this->actingAs($this->author())->postJson('/control-plan-settings/logo', ['logo' => UploadedFile::fake()->image('logo.png')])->assertForbidden();
        $this->actingAs($admin)->postJson('/control-plan-settings/logo', ['logo' => UploadedFile::fake()->create('logo.pdf', 10, 'application/pdf')])->assertUnprocessable();

        $res = $this->actingAs($admin)->postJson('/control-plan-settings/logo', ['logo' => UploadedFile::fake()->image('logo.png', 300, 80)])->assertOk();
        $this->assertStringStartsWith('data:image/png;base64,', $res->json('data.logo'));
        $path = ControlPlanSetting::current()->logo_path;
        Storage::disk('local')->assertExists($path);

        $draft = $this->draftOf($this->sample());
        $this->actingAs($this->author())->get("/control-plan-revisions/{$draft->id}/print")->assertOk()->assertSee('class="logo"', false);
        $this->assertNotNull(PrintSheet::build($draft, ControlPlanSetting::current())['logo_file']);

        $this->actingAs($admin)->deleteJson('/control-plan-settings/logo')->assertOk();
        Storage::disk('local')->assertMissing($path);
        $this->assertNull(ControlPlanSetting::current()->logo_path);
    }

    public function test_a_print_or_export_uses_the_logo_chosen_in_the_browser_without_storing_it(): void
    {
        Storage::fake('local');
        $admin = $this->user(['control-plans.view', 'control-plans.settings']);
        $this->actingAs($admin)->postJson('/control-plan-settings/logo', ['logo' => UploadedFile::fake()->image('logo.png', 300, 80)])->assertOk();
        $shared = ControlPlanSetting::current()->logo_path;
        $draft = $this->draftOf($this->sample());
        $author = $this->author();
        $print = "/control-plan-revisions/{$draft->id}/print";
        $image = self::signatureImage(300, 80);

        // The shared logo by default, none when asked.
        $this->actingAs($author)->get($print)->assertOk()->assertSee('class="logo"', false);
        $this->actingAs($author)->get("{$print}?logo=none")->assertOk()->assertDontSee('class="logo"', false);

        // A logo sent from the browser prints in the preview, the PDF and the Word file, and nothing is stored.
        $this->actingAs($author)->post($print, ['logo' => $image])->assertOk()->assertSee('class="logo"', false);
        $this->actingAs($author)->post("/control-plan-revisions/{$draft->id}/download/pdf", ['logo' => $image])->assertOk();
        $this->actingAs($author)->post("/control-plan-revisions/{$draft->id}/download/docx", ['logo' => $image])->assertOk();
        $this->assertSame([$shared], Storage::disk('local')->allFiles());
        $this->assertSame($shared, ControlPlanSetting::current()->logo_path);

        $this->actingAs($author)->postJson($print, ['logo' => 'data:application/pdf;base64,JVBERi0='])->assertUnprocessable()->assertJsonValidationErrors('logo');
        $this->actingAs($author)->postJson($print, ['logo' => 'data:image/png;base64,bm90IGFuIGltYWdl'])->assertUnprocessable()->assertJsonValidationErrors('logo');
        // A draft stays hidden from someone who only views released plans.
        $this->actingAs($this->user(['control-plans.view']))->postJson($print, ['logo' => $image])->assertForbidden();
    }

    public function test_override_signs_for_others_and_reviews_its_own_submission_with_a_note(): void
    {
        $draft = $this->draftOf($this->sample());
        $author = $this->author();
        $manager = $this->user(['control-plans.view']);
        $admin = $this->user([...self::ALL, 'control-plans.override']);
        $doc = $this->document($draft);
        $doc['content']['signatures'] = [
            'prepared' => [['id' => 'a', 'user_id' => $author->id, 'name' => 'Budi Santoso', 'position' => '']],
            'approved' => [['id' => 'b', 'user_id' => $manager->id, 'name' => 'Hendra Gunawan', 'position' => ''], ['id' => 'c', 'user_id' => null, 'name' => 'Paper Signer', 'position' => '']],
        ];
        $this->actingAs($author)->putJson("/control-plan-revisions/{$draft->id}", $doc)->assertOk();

        // The admin signs the manager's box for them: it counts as the manager's, shows who signed, and is noted.
        $this->actingAs($admin)->postJson("/control-plan-revisions/{$draft->id}/signatures/b", ['image' => self::signatureImage()])->assertCreated();
        $this->actingAs($admin)->postJson("/control-plan-revisions/{$draft->id}/signatures/c", ['image' => self::signatureImage()])->assertUnprocessable();
        $signed = $draft->fresh()->signed('id');
        $this->assertSame($manager->name, $signed['b']['by']);
        $this->assertSame($admin->name, $signed['b']['proxy']);
        $this->assertSame('Signed for Hendra Gunawan.', $draft->comments()->reorder('id', 'desc')->value('body'));

        // A signature by the box's owner has no proxy; the admin can take it back, which is noted too.
        $this->actingAs($author)->postJson("/control-plan-revisions/{$draft->id}/signatures/a", ['image' => self::signatureImage()])->assertCreated();
        $this->assertNull($draft->fresh()->signed('id')['a']['proxy']);
        $this->actingAs($admin)->deleteJson("/control-plan-revisions/{$draft->id}/signatures/a")->assertOk();
        $this->assertSame('Removed the signature of Budi Santoso.', $draft->comments()->reorder('id', 'desc')->value('body'));

        // The admin submits, approves and releases on their own; the history says they were also the submitter.
        $this->actingAs($admin)->postJson("/control-plan-revisions/{$draft->id}/submit", ['history' => [['pages' => 'All', 'description' => 'Update']]])->assertOk();
        $this->actingAs($admin)->get('/control-plans')->assertInertia(fn (Assert $page) => $page->where('waiting.0.id', $draft->id));
        $this->actingAs($admin)->postJson("/control-plan-revisions/{$draft->id}/approve")->assertOk();
        $this->assertSame('Approved for release (also the submitter).', $draft->comments()->reorder('id', 'desc')->value('body'));
        $this->actingAs($admin)->postJson("/control-plan-revisions/{$draft->id}/release")->assertOk();
        $this->assertSame(ControlPlanRevision::RELEASED, $draft->fresh()->status);
        $this->assertStringEndsWith('(also the submitter).', $draft->comments()->reorder('id', 'desc')->value('body'));
    }

    public function test_the_admin_role_gets_the_override_permission(): void
    {
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);
        $this->assertTrue(\Spatie\Permission\Models\Role::findByName('admin')->hasPermissionTo('control-plans.override'));
        $this->assertFalse(\Spatie\Permission\Models\Role::findByName('approver')->hasPermissionTo('control-plans.override'));
    }
}
