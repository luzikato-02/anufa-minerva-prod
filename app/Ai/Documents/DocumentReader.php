<?php

namespace App\Ai\Documents;

use App\Ai\Llm\LlmClient;
use App\Ai\Llm\LlmException;
use Illuminate\Http\UploadedFile;

/**
 * Reads PDFs and images with a vision model on the AI provider (OCTA): a page-by-page Markdown transcription,
 * or a JSON object pulled out of a form. Images go as image_url parts and PDFs as file parts, both data URLs.
 */
class DocumentReader
{
    public const PAGE_BREAK = '<<<PAGE BREAK>>>';

    public function __construct(private readonly LlmClient $llm) {}

    /**
     * Transcribe the document to Markdown, one entry per page.
     *
     * @return array{pages: list<array{index: int, markdown: string}>, model: string, usage: array<string, mixed>}
     */
    public function transcribe(UploadedFile $file, string $model): array
    {
        $prompt = 'Transcribe every page of this document to Markdown, exactly as written: keep the original '
            .'language, wording, numbers and reading order. Use Markdown headings for titles, GitHub tables for '
            .'tables (keep every row and column, leave empty cells empty) and lists for lists. Write illegible '
            .'text as [illegible]. Do not summarise, translate, correct or comment, and do not wrap the output '
            .'in a code block. Put a line containing only '.self::PAGE_BREAK.' between pages.';

        $response = $this->ask($model, $file, $prompt);
        $text = self::unfence($this->content($response));

        $pages = [];
        foreach (explode(self::PAGE_BREAK, $text) as $page) {
            if (trim($page) !== '') {
                $pages[] = ['index' => count($pages), 'markdown' => trim($page)];
            }
        }

        return ['pages' => $pages ?: [['index' => 0, 'markdown' => '']], 'model' => $model, 'usage' => $response['usage'] ?? []];
    }

    /**
     * Ask for a JSON object about the document. The prompt describes the shape.
     *
     * @return array<string, mixed>
     *
     * @throws LlmException when the reply isn't a JSON object
     */
    public function extractJson(UploadedFile $file, string $model, string $prompt): array
    {
        $text = self::unfence($this->content($this->ask($model, $file, $prompt)));
        // Tolerate a sentence around the object.
        $start = strpos($text, '{');
        $end = strrpos($text, '}');
        $json = $start !== false && $end !== false ? json_decode(substr($text, $start, $end - $start + 1), true) : null;
        if (! is_array($json)) {
            throw new LlmException('The model did not return valid JSON: '.mb_substr($text, 0, 200));
        }

        return $json;
    }

    private function ask(string $model, UploadedFile $file, string $prompt): array
    {
        $mime = $file->getMimeType() ?: 'application/octet-stream';
        $dataUrl = 'data:'.$mime.';base64,'.base64_encode((string) file_get_contents($file->getPathname()));
        $document = str_contains($mime, 'pdf')
            ? ['type' => 'file', 'file' => ['filename' => $file->getClientOriginalName() ?: 'document.pdf', 'file_data' => $dataUrl]]
            : ['type' => 'image_url', 'image_url' => ['url' => $dataUrl]];

        return $this->llm->chat($model, [
            ['role' => 'user', 'content' => [['type' => 'text', 'text' => $prompt], $document]],
        ], timeout: (int) config('ai.ocr.timeout'));
    }

    private function content(array $response): string
    {
        $content = $response['choices'][0]['message']['content'] ?? null;
        if (! is_string($content)) {
            throw new LlmException('The model returned no text.');
        }

        return $content;
    }

    /** Drop a ```markdown / ```json fence the model wrapped its whole reply in. */
    private static function unfence(string $text): string
    {
        $text = trim($text);
        if (preg_match('/^```[a-z]*\s*\n(.*)\n```$/si', $text, $m)) {
            return trim($m[1]);
        }

        return $text;
    }
}
