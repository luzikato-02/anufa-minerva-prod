import { Field, NativeSelect } from '@/components/reeds/reed-status';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { reedApi, specLabel, type Reed, type ReedOptions } from '@/lib/reeds';
import { useState, type FormEvent } from 'react';

/** A goods receipt: N new reeds of one spec, numbered automatically or from the serials typed in. */
export function ReedReceiveDialog({
    options,
    onClose,
    onDone,
}: {
    options: ReedOptions | null;
    onClose: () => void;
    onDone: (reeds: Reed[]) => void;
}) {
    const [specId, setSpecId] = useState('');
    const [mode, setMode] = useState<'auto' | 'serials'>('auto');
    const [quantity, setQuantity] = useState('1');
    const [serials, setSerials] = useState('');
    const [locationId, setLocationId] = useState('');
    const [supplier, setSupplier] = useState('');
    const [poNo, setPoNo] = useState('');
    const [receivedOn, setReceivedOn] = useState(
        new Date().toISOString().slice(0, 10),
    );
    const [unitCost, setUnitCost] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const serialList = serials
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!specId) return setError('Pick the reed spec.');
        if (mode === 'auto' && !(Number(quantity) >= 1))
            return setError('Enter how many reeds arrived.');
        if (mode === 'serials' && serialList.length === 0)
            return setError('Enter at least one serial number.');
        setBusy(true);
        setError(null);
        try {
            const reeds = await reedApi.receive({
                reed_spec_id: Number(specId),
                ...(mode === 'auto'
                    ? { quantity: Number(quantity) }
                    : { serials: serialList }),
                location_id: locationId ? Number(locationId) : null,
                supplier: supplier.trim() || null,
                po_no: poNo.trim() || null,
                received_on: receivedOn || null,
                unit_cost: unitCost.trim() === '' ? null : Number(unitCost),
            });
            onDone(reeds);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const specs = options?.specs ?? [];

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <form onSubmit={submit} className="grid gap-4">
                    <DialogHeader>
                        <DialogTitle>Receive reeds</DialogTitle>
                        <DialogDescription>
                            Each reed gets its own record and a label to print.
                        </DialogDescription>
                    </DialogHeader>
                    {error && (
                        <Alert variant="destructive" role="alert">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    <Field
                        label="Reed spec"
                        htmlFor="rr-spec"
                        hint={
                            specs.length === 0
                                ? 'Add a spec in Reed Settings first.'
                                : undefined
                        }
                    >
                        <NativeSelect
                            id="rr-spec"
                            value={specId}
                            onChange={setSpecId}
                        >
                            <option value="">Pick a spec</option>
                            {specs.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {specLabel(s)}
                                </option>
                            ))}
                        </NativeSelect>
                    </Field>

                    <fieldset className="space-y-2">
                        <legend className="text-xs font-medium">
                            Serial numbers
                        </legend>
                        <div className="flex gap-4 text-sm">
                            <label className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="rr-mode"
                                    checked={mode === 'auto'}
                                    onChange={() => setMode('auto')}
                                />
                                Number them for me
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="rr-mode"
                                    checked={mode === 'serials'}
                                    onChange={() => setMode('serials')}
                                />
                                Use the maker's serials
                            </label>
                        </div>
                        {mode === 'auto' ? (
                            <Input
                                aria-label="Quantity"
                                inputMode="numeric"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                className="w-28"
                            />
                        ) : (
                            <>
                                <Textarea
                                    aria-label="Serials"
                                    rows={4}
                                    value={serials}
                                    placeholder="One per line"
                                    onChange={(e) => setSerials(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {serialList.length} serials
                                </p>
                            </>
                        )}
                    </fieldset>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Store in" htmlFor="rr-location">
                            <NativeSelect
                                id="rr-location"
                                value={locationId}
                                onChange={setLocationId}
                            >
                                <option value="">— none —</option>
                                {(options?.locations ?? []).map((l) => (
                                    <option key={l.id} value={l.id}>
                                        {l.code}
                                    </option>
                                ))}
                            </NativeSelect>
                        </Field>
                        <Field label="Received on" htmlFor="rr-date">
                            <Input
                                id="rr-date"
                                type="date"
                                value={receivedOn}
                                onChange={(e) => setReceivedOn(e.target.value)}
                            />
                        </Field>
                        <Field label="Supplier" htmlFor="rr-supplier">
                            <Input
                                id="rr-supplier"
                                value={supplier}
                                onChange={(e) => setSupplier(e.target.value)}
                            />
                        </Field>
                        <Field label="PO number" htmlFor="rr-po">
                            <Input
                                id="rr-po"
                                value={poNo}
                                onChange={(e) => setPoNo(e.target.value)}
                            />
                        </Field>
                        <Field label="Unit cost (Rp)" htmlFor="rr-cost">
                            <Input
                                id="rr-cost"
                                inputMode="decimal"
                                value={unitCost}
                                onChange={(e) => setUnitCost(e.target.value)}
                            />
                        </Field>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={busy}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={busy}>
                            {busy
                                ? 'Saving…'
                                : `Receive ${mode === 'auto' ? Number(quantity) || '' : serialList.length || ''} reeds`.replace(
                                      '  ',
                                      ' ',
                                  )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
