import { Button } from '@/components/ui/button';
import { fmt } from '@/lib/reeds';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeftIcon, PrinterIcon } from 'lucide-react';

interface LabelReed {
    id: number;
    serial_no: string;
    spec: { code: string; dents_per_10cm: number; width_mm: number } | null;
    received_on: string | null;
    /** Server-rendered QR code (holds the serial only). */
    qr_svg: string;
}

/**
 * QR labels to stick on reed frames, 3 per row on A4. The QR encodes only the serial, so the
 * Scan button and USB scanners on the Reed Inventory page resolve it directly.
 */
export default function ReedLabels({ reeds }: { reeds: LabelReed[] }) {
    return (
        <>
            <Head title={`Reed labels (${reeds.length})`} />
            <style>{`@page { size: A4; margin: 10mm; } @media print { .no-print { display: none !important; } body { background: white; } }`}</style>
            <div className="mx-auto max-w-[190mm] p-4 print:p-0">
                <div className="no-print mb-4 flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/reeds">
                            <ArrowLeftIcon />
                            Reed Inventory
                        </Link>
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        {reeds.length} labels · 3 per row on A4
                    </span>
                    <Button
                        size="sm"
                        className="ml-auto"
                        onClick={() => window.print()}
                        disabled={reeds.length === 0}
                    >
                        <PrinterIcon />
                        Print
                    </Button>
                </div>

                {reeds.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No reeds selected. Tick reeds on the inventory page,
                        then print their labels.
                    </p>
                ) : (
                    <div className="grid grid-cols-3 gap-[4mm]">
                        {reeds.map((r) => (
                            <div
                                key={r.id}
                                className="flex break-inside-avoid items-center gap-[3mm] rounded border border-black/40 bg-white p-[3mm] text-black"
                            >
                                <div
                                    className="size-[24mm] shrink-0 [&>svg]:size-full"
                                    dangerouslySetInnerHTML={{
                                        __html: r.qr_svg,
                                    }}
                                />
                                <div className="min-w-0">
                                    <div className="font-mono text-[13pt] leading-tight font-bold">
                                        {r.serial_no}
                                    </div>
                                    {r.spec && (
                                        <div className="text-[8pt] leading-snug">
                                            {r.spec.code}
                                            <br />
                                            {fmt(r.spec.dents_per_10cm, 1)}{' '}
                                            dents/10 cm · {fmt(r.spec.width_mm)}{' '}
                                            mm
                                        </div>
                                    )}
                                    {r.received_on && (
                                        <div className="text-[7pt] text-black/60">
                                            Rcvd {r.received_on}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
