import { GizmoHelper, GizmoViewcube, GizmoViewport, OrbitControls, Text } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Loader2 } from 'lucide-react';
import { Suspense, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

// ── types ─────────────────────────────────────────────────────────────────────

export type SideName = 'AI' | 'AO' | 'BI' | 'BO';
export type RowName  = 'A' | 'B' | 'C' | 'D' | 'E';

export interface BatchPosition { side: SideName; column: number; row: RowName; }

interface BatchItem {
    batch: string; net_weight: number; creel_side: string;
    creel_from: string; creel_to: string; count: number;
    material: string | null; positions: BatchPosition[];
}

interface FinishedPosition {
    side: string; column: number; row: string; meters: number;
}

interface HoverInfo {
    batch: string; net_weight: number; material: string | null;
    creel_side: string; creel_from: string; creel_to: string; count: number;
    posIdx: number; totalPos: number;
    posSide: SideName; posCol: number; posRow: RowName;
    isFinishedEarlier: boolean; finishedMeters?: number;
    screenX: number; screenY: number;
}

export interface ClickInfo {
    pos: BatchPosition;
    currentBatch: string | null;
    screenX: number;
    screenY: number;
}

// ── layout ────────────────────────────────────────────────────────────────────
//
//  From the actual photo: two long parallel racks facing each other, aisle between.
//  Each rack has one face toward the aisle (inner) and one facing outward (outer).
//
//  Looking from aisle end toward the racks:
//    [AO outer]─[■ Rack A frame ■]─[AI inner]   AISLE   [BI inner]─[■ Rack B frame ■]─[BO outer]
//
//  z-axis: aisle at z=0, Rack A toward -z (right when viewed from +X), Rack B toward +z

const COLS  = 100;
const ROWS: RowName[] = ['A', 'B', 'C', 'D', 'E'];
const SIDES: SideName[] = ['AO', 'AI', 'BI', 'BO'];

// Spacing between adjacent bobbins
const COL_PITCH = 1.0;   // x spacing per column
const ROW_PITCH = 1.25;  // y spacing per row

// Vertical row positions (E at bottom, A at top)
const ROW_Y: Record<RowName, number> = {
    A: ROW_PITCH * 4, B: ROW_PITCH * 3, C: ROW_PITCH * 2, D: ROW_PITCH * 1, E: 0,
};

// Column → world-space x. Reversed so column 1 is at the right end and column 100 at the left.
const colX = (col: number) => (COLS + 1 - col) * COL_PITCH;

// Rack centre z-positions — Rack A at -z (right when viewed from +X), Rack B at +z
const RACK_A_Z = -4.5;
const RACK_B_Z = +4.5;

// Bobbin face z positions (sticking out from each rack face).
// Rack A is at -z so its outer face is further -z and inner face is closer to 0.
// Rack B is at +z so its outer face is further +z and inner face is closer to 0.
const SIDE_Z: Record<SideName, number> = {
    AO: RACK_A_Z - 1.8,   // outer face of Rack A  (-6.3)
    AI: RACK_A_Z + 1.8,   // inner face of Rack A  (-2.7)  (toward aisle)
    BI: RACK_B_Z - 1.8,   // inner face of Rack B  (+2.7)  (toward aisle)
    BO: RACK_B_Z + 1.8,   // outer face of Rack B  (+6.3)
};

// Bobbin geometry sizes (large, realistic yarn packages)
const BOB_R  = 0.42;   // radius of main yarn body
const BOB_H  = 0.70;   // length along peg axis (z)
const FLG_R  = 0.48;   // flange (end-cap) radius — slightly larger for visible edge
const FLG_H  = 0.07;   // flange thickness
const PEG_R  = 0.045;  // spindle peg radius
const PEG_H  = 2.8;    // peg total length (extends well beyond bobbin)

const HALF_BOB = BOB_H / 2;
const HALF_FLG = FLG_H / 2;
const FLG_OFFSET = HALF_BOB + HALF_FLG;

// Base flange z-offset per side: toward the rack frame (not outward).
// AO at z=-6.3, rack at z=-4.5 → +z toward rack.
// AI at z=-2.7, rack at z=-4.5 → -z toward rack.
// BI at z=+2.7, rack at z=+4.5 → +z toward rack.
// BO at z=+6.3, rack at z=+4.5 → -z toward rack.
const BASE_FLG_ZOFF: Record<SideName, number> = {
    AO: +FLG_OFFSET, AI: -FLG_OFFSET, BI: +FLG_OFFSET, BO: -FLG_OFFSET,
};

const TOTAL_POSITIONS = COLS * ROWS.length * SIDES.length; // 2000

// ── palette ───────────────────────────────────────────────────────────────────

export const PALETTE_HEX = [
    '#e11d48','#2563eb','#16a34a','#d97706','#7c3aed',
    '#db2777','#0891b2','#ca8a04','#ea580c','#059669',
    '#9333ea','#dc2626','#0284c7','#65a30d','#c2410c',
    '#1d4ed8','#15803d','#b91c1c','#0369a1','#a16207',
    '#6d28d9','#be185d','#0f766e','#92400e','#166534',
    '#9d174d','#1e40af','#7e22ce','#b45309','#0c4a6e',
];
const EMPTY_HEX          = '#e2e8f0';  // near-white yarn for unloaded positions
const FLANGE_COLOR       = '#c05621';  // orange-brown — matches real bobbin flanges
const PEG_COLOR          = '#374151';  // dark metal grey
const FINISHED_RING_HEX  = '#f59e0b';  // amber — finish-earlier indicator ring
const OVERLAP_RING_HEX   = '#ffffff';  // white glow — position claimed by multiple batches
const SELECT_GLOW_HEX    = '#facc15';  // bright yellow — multi-select highlight

// ── geometry instances helpers ─────────────────────────────────────────────────

/** Build the 2000 canonical positions once. */
const ALL_POSITIONS: Array<{ side: SideName; col: number; row: RowName }> = [];
for (const side of SIDES) {
    for (let col = 1; col <= COLS; col++) {
        for (const row of ROWS) {
            ALL_POSITIONS.push({ side, col, row });
        }
    }
}

function placeBobbinMatrix(out: THREE.Object3D, col: number, row: RowName, side: SideName, zOffset = 0) {
    out.position.set(colX(col), ROW_Y[row], SIDE_Z[side] + zOffset);
    out.rotation.set(Math.PI / 2, 0, 0); // align cylinder axis with Z
    out.updateMatrix();
}

// ── AllBobbinFixtures — pegs + flanges for every position ─────────────────────
// These are the same for every position (colour doesn't change), so one draw call each.

function AllBobbinFixtures({ visibleSides }: { visibleSides: SideName[] }) {
    const pegRef = useRef<THREE.InstancedMesh>(null!);
    const flgRef = useRef<THREE.InstancedMesh>(null!);

    const positions = useMemo(
        () => ALL_POSITIONS.filter(({ side }) => visibleSides.includes(side)),
        [visibleSides],
    );

    useEffect(() => {
        if (!pegRef.current || !flgRef.current) return;
        pegRef.current.count = positions.length;
        flgRef.current.count = positions.length;
        const dummy = new THREE.Object3D();
        positions.forEach(({ side, col, row }, i) => {
            placeBobbinMatrix(dummy, col, row, side);
            pegRef.current.setMatrixAt(i, dummy.matrix);
            placeBobbinMatrix(dummy, col, row, side, BASE_FLG_ZOFF[side]);
            flgRef.current.setMatrixAt(i, dummy.matrix);
        });
        pegRef.current.instanceMatrix.needsUpdate = true;
        flgRef.current.instanceMatrix.needsUpdate = true;
    }, [positions]);

    const flangeGeo = useMemo(() => new THREE.CylinderGeometry(FLG_R, FLG_R, FLG_H, 20), []);
    const pegGeo    = useMemo(() => new THREE.CylinderGeometry(PEG_R, PEG_R, PEG_H, 8),  []);

    return (
        <>
            <instancedMesh ref={pegRef} args={[pegGeo, undefined, TOTAL_POSITIONS]} frustumCulled={false}>
                <meshStandardMaterial color={PEG_COLOR} metalness={0.8} roughness={0.3} />
            </instancedMesh>
            <instancedMesh ref={flgRef} args={[flangeGeo, undefined, TOTAL_POSITIONS]} frustumCulled={false}>
                <meshStandardMaterial color={FLANGE_COLOR} metalness={0.2} roughness={0.5} />
            </instancedMesh>
        </>
    );
}

// ── EmptyBobbins ──────────────────────────────────────────────────────────────

function EmptyBobbins({ occupiedKeys, visibleSides, onAssignHover, onEmptyHover }: {
    occupiedKeys: Set<string>;
    visibleSides: SideName[];
    onAssignHover?: (info: ClickInfo | null) => void;
    onEmptyHover?: (info: ClickInfo | null) => void;
}) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const geo     = useMemo(() => new THREE.CylinderGeometry(BOB_R, BOB_R, BOB_H, 20), []);
    const { camera, gl } = useThree();

    const empties = useMemo(
        () => ALL_POSITIONS.filter(
            ({ side, col, row }) =>
                visibleSides.includes(side) &&
                !occupiedKeys.has(`${side}:${col}:${row}`)
        ),
        [occupiedKeys, visibleSides],
    );

    useEffect(() => {
        if (!meshRef.current) return;
        meshRef.current.count = empties.length;
        const dummy = new THREE.Object3D();
        empties.forEach(({ side, col, row }, i) => {
            placeBobbinMatrix(dummy, col, row, side);
            meshRef.current.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [empties]);

    const handlePointerMove = useCallback(
        (e: { stopPropagation?: () => void; instanceId?: number }) => {
            e.stopPropagation?.();
            if (!onAssignHover && !onEmptyHover) return;
            const id = e.instanceId;
            if (id === undefined || id >= empties.length) {
                onAssignHover?.(null);
                onEmptyHover?.(null);
                return;
            }
            const { side, col, row } = empties[id];
            const mat = new THREE.Matrix4();
            meshRef.current.getMatrixAt(id, mat);
            const wp   = new THREE.Vector3().setFromMatrixPosition(mat).project(camera);
            const rect = gl.domElement.getBoundingClientRect();
            const info: ClickInfo = {
                pos: { side, column: col, row },
                currentBatch: null,
                screenX: ((wp.x + 1) / 2) * rect.width  + rect.left,
                screenY: ((-wp.y + 1) / 2) * rect.height + rect.top,
            };
            onAssignHover?.(info);
            onEmptyHover?.(info);
        },
        [onAssignHover, onEmptyHover, empties, camera, gl.domElement],
    );

    const handlePointerLeave = useCallback(() => {
        onAssignHover?.(null);
        onEmptyHover?.(null);
    }, [onAssignHover, onEmptyHover]);

    return (
        <instancedMesh
            ref={meshRef}
            args={[geo, undefined, TOTAL_POSITIONS]}
            frustumCulled={false}
            onPointerMove={(onAssignHover || onEmptyHover) ? handlePointerMove : undefined}
            onPointerLeave={(onAssignHover || onEmptyHover) ? handlePointerLeave : undefined}
        >
            <meshStandardMaterial color={EMPTY_HEX} roughness={0.8} metalness={0.0} />
        </instancedMesh>
    );
}

// ── FinishedEarlierRings — amber torus rings on finished-earlier positions ────
// Rendered AFTER the batch bobbins so they appear on top.

function FinishedEarlierRings({ finishedPositions }: { finishedPositions: FinishedPosition[] }) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);

    // TorusGeometry: ring radius = BOB_R + 0.06 (just outside bobbin body),
    // tube radius = 0.07, giving a clearly visible amber band around each bobbin.
    const geo = useMemo(() => new THREE.TorusGeometry(BOB_R + 0.06, 0.07, 8, 24), []);

    const validPositions = useMemo(
        () => finishedPositions.filter(
            (p) => SIDES.includes(p.side as SideName) && ROWS.includes(p.row as RowName),
        ),
        [finishedPositions],
    );

    useEffect(() => {
        if (!meshRef.current || validPositions.length === 0) return;
        const dummy = new THREE.Object3D();
        validPositions.forEach((p, i) => {
            // TorusGeometry lies in the XY plane by default; we need it in the XZ plane
            // (around the bobbin cylinder axis), so rotate 90° around X just like the bobbin.
            dummy.position.set(colX(p.column), ROW_Y[p.row as RowName], SIDE_Z[p.side as SideName]);
            dummy.rotation.set(Math.PI / 2, 0, 0);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [validPositions]);

    if (validPositions.length === 0) return null;

    return (
        <instancedMesh ref={meshRef} args={[geo, undefined, validPositions.length]} frustumCulled={false}>
            <meshStandardMaterial color={FINISHED_RING_HEX} emissive={FINISHED_RING_HEX} emissiveIntensity={0.4} roughness={0.3} metalness={0.1} />
        </instancedMesh>
    );
}

// ── OverlapMarkers — white glow ring on positions claimed by >1 batch ─────────

function OverlapMarkers({ overlapKeys }: { overlapKeys: Set<string> }) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    // Slightly larger ring than FinishedEarlierRings, thinner tube — sits outside both
    const geo = useMemo(() => new THREE.TorusGeometry(BOB_R + 0.14, 0.04, 8, 24), []);

    const positions = useMemo(
        () => ALL_POSITIONS.filter(({ side, col, row }) => overlapKeys.has(`${side}:${col}:${row}`)),
        [overlapKeys],
    );

    useEffect(() => {
        if (!meshRef.current || positions.length === 0) return;
        const dummy = new THREE.Object3D();
        positions.forEach((p, i) => {
            dummy.position.set(colX(p.col), ROW_Y[p.row], SIDE_Z[p.side]);
            dummy.rotation.set(Math.PI / 2, 0, 0);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [positions]);

    if (positions.length === 0) return null;

    return (
        <instancedMesh ref={meshRef} args={[geo, undefined, positions.length]} frustumCulled={false}>
            <meshStandardMaterial
                color={OVERLAP_RING_HEX}
                emissive={OVERLAP_RING_HEX}
                emissiveIntensity={0.7}
                roughness={0.2}
                metalness={0.1}
            />
        </instancedMesh>
    );
}

// ── SelectedBobbins — bright yellow glow on manually selected positions ───────

function SelectedBobbins({ selectedPositions, visibleSides }: {
    selectedPositions: Set<string>;
    visibleSides: SideName[];
}) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const geo = useMemo(() => new THREE.CylinderGeometry(BOB_R * 1.04, BOB_R * 1.04, BOB_H * 1.06, 20), []);

    const positions = useMemo(
        () => ALL_POSITIONS.filter(
            ({ side, col, row }) =>
                visibleSides.includes(side) &&
                selectedPositions.has(`${side}:${col}:${row}`)
        ),
        [selectedPositions, visibleSides],
    );

    useEffect(() => {
        if (!meshRef.current) return;
        meshRef.current.count = positions.length;
        if (positions.length === 0) return;
        const dummy = new THREE.Object3D();
        positions.forEach(({ side, col, row }, i) => {
            placeBobbinMatrix(dummy, col, row, side);
            meshRef.current.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [positions]);

    if (selectedPositions.size === 0) return null;

    return (
        <instancedMesh ref={meshRef} args={[geo, undefined, TOTAL_POSITIONS]} frustumCulled={false}>
            <meshStandardMaterial
                color={SELECT_GLOW_HEX}
                emissive={SELECT_GLOW_HEX}
                emissiveIntensity={1.5}
                roughness={0.2}
                metalness={0.0}
                transparent
                opacity={0.85}
            />
        </instancedMesh>
    );
}

// ── BatchBobbins — one instanced mesh per batch, own colour ──────────────────

interface BatchBobbinsProps {
    batch:            BatchItem;
    displayPositions: BatchPosition[];
    colorHex:         string;
    finishedKeys:     Set<string>;
    isSelected:       boolean;
    hasSelection:     boolean;
    visibleSides:     SideName[];
    onHover:          (info: HoverInfo | null) => void;
    onAssignHover?:   (info: ClickInfo | null) => void;
    camera:           THREE.Camera;
    domElement:       HTMLCanvasElement;
}

function BatchBobbins({ batch, displayPositions, colorHex, finishedKeys, isSelected, hasSelection, visibleSides, onHover, onAssignHover, camera, domElement }: BatchBobbinsProps) {
    const meshRef  = useRef<THREE.InstancedMesh>(null!);
    const geo      = useMemo(() => new THREE.CylinderGeometry(BOB_R, BOB_R, BOB_H, 20), []);

    const rawPositions = isSelected ? batch.positions : displayPositions;
    const positions    = rawPositions.filter(p => visibleSides.includes(p.side));
    const count        = positions.length;
    const maxCount     = rawPositions.length; // capacity = unfiltered (may be > visible count)

    const matColor       = hasSelection && !isSelected ? '#1e293b' : colorHex;
    const emissiveColor  = isSelected ? colorHex : '#000000';
    const emissiveIntens = isSelected ? 0.4 : 0;

    useEffect(() => {
        if (!meshRef.current) return;
        meshRef.current.count = count; // visible instance count (may be < maxCount)
        if (count === 0) { meshRef.current.instanceMatrix.needsUpdate = true; return; }
        const dummy = new THREE.Object3D();
        positions.forEach((pos, i) => {
            placeBobbinMatrix(dummy, pos.column, pos.row, pos.side);
            meshRef.current.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [positions, count]);

    const handlePointerMove = useCallback(
        (e: { stopPropagation?: () => void; instanceId?: number }) => {
            e.stopPropagation?.();
            const id = e.instanceId;
            if (id === undefined || id >= count) return;
            const pos = positions[id];
            const mat = new THREE.Matrix4();
            meshRef.current.getMatrixAt(id, mat);
            const wp = new THREE.Vector3().setFromMatrixPosition(mat).project(camera);
            const rect = domElement.getBoundingClientRect();
            const sx = ((wp.x + 1) / 2) * rect.width  + rect.left;
            const sy = ((-wp.y + 1) / 2) * rect.height + rect.top;
            const key = `${pos.side}:${pos.column}:${pos.row}`;
            onHover({
                batch: batch.batch, net_weight: batch.net_weight,
                material: batch.material, creel_side: batch.creel_side,
                creel_from: batch.creel_from, creel_to: batch.creel_to,
                count: batch.count,
                posIdx: id + 1, totalPos: count,
                posSide: pos.side, posCol: pos.column, posRow: pos.row,
                isFinishedEarlier: finishedKeys.has(key),
                screenX: sx, screenY: sy,
            });
            onAssignHover?.({ pos: { side: pos.side, column: pos.column, row: pos.row }, currentBatch: batch.batch, screenX: sx, screenY: sy });
        },
        [batch, positions, count, camera, domElement, onHover, onAssignHover, finishedKeys],
    );

    if (maxCount === 0) return null;

    return (
        <instancedMesh
            ref={meshRef}
            args={[geo, undefined, Math.max(1, maxCount)]}
            frustumCulled={false}
            onPointerMove={handlePointerMove}
            onPointerLeave={() => { onHover(null); onAssignHover?.(null); }}
        >
            <meshStandardMaterial
                color={matColor}
                emissive={emissiveColor}
                emissiveIntensity={emissiveIntens}
                roughness={0.65}
                metalness={0.05}
                polygonOffset={isSelected}
                polygonOffsetFactor={isSelected ? -1 : 0}
                polygonOffsetUnits={isSelected ? -1 : 0}
            />
        </instancedMesh>
    );
}

// ── CreelRackFrame — open green metal scaffold (posts + rails) ────────────────

function CreelRackFrame({ frameZ }: { frameZ: number }) {
    const postColor = '#2d5a27';   // industrial green
    const railColor = '#3a7a33';

    // 11 vertical posts along the 100 columns
    const postXs = [1, 11, 21, 31, 41, 51, 61, 71, 81, 91, 100].map(c => c * COL_PITCH);
    const rackH  = ROW_Y['A'] + ROW_PITCH;
    const rackHC = rackH / 2 - ROW_PITCH * 0.5;

    // 6 horizontal rails: above A, between each pair, below E
    const railYs = [
        ROW_Y['A'] + ROW_PITCH * 0.55,
        (ROW_Y['A'] + ROW_Y['B']) / 2,
        (ROW_Y['B'] + ROW_Y['C']) / 2,
        (ROW_Y['C'] + ROW_Y['D']) / 2,
        (ROW_Y['D'] + ROW_Y['E']) / 2,
        -ROW_PITCH * 0.55,
    ];

    return (
        <group>
            {/* Vertical posts */}
            {postXs.map((x) => (
                <mesh key={x} position={[x, rackHC, frameZ]}>
                    <boxGeometry args={[0.12, rackH + 0.3, 0.12]} />
                    <meshStandardMaterial color={postColor} metalness={0.4} roughness={0.6} />
                </mesh>
            ))}
            {/* Horizontal rails */}
            {railYs.map((y, ri) => (
                <mesh key={ri} position={[COLS * COL_PITCH * 0.5 + COL_PITCH * 0.5, y, frameZ]}>
                    <boxGeometry args={[COLS * COL_PITCH + COL_PITCH, 0.09, 0.09]} />
                    <meshStandardMaterial color={railColor} metalness={0.3} roughness={0.7} />
                </mesh>
            ))}
            {/* Top beam */}
            <mesh position={[COLS * COL_PITCH * 0.5 + COL_PITCH * 0.5, rackHC + rackH / 2 + 0.2, frameZ]}>
                <boxGeometry args={[COLS * COL_PITCH + COL_PITCH, 0.18, 0.18]} />
                <meshStandardMaterial color={postColor} metalness={0.4} roughness={0.5} />
            </mesh>
        </group>
    );
}

// ── Labels ────────────────────────────────────────────────────────────────────

function useSceneLabelColors() {
    // Default = light text for dark 3D backgrounds.
    // If the app is in light mode (high-lightness --background), switch to dark text.
    const [c, setC] = useState({ main: '#e2e8f0', sub: '#94a3b8', dim: '#64748b' });
    useEffect(() => {
        const bg = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
        const lightness = parseFloat(bg.split(' ')[2] ?? '10');
        if (lightness >= 50) {
            setC({ main: '#0f172a', sub: '#334155', dim: '#64748b' });
        }
    }, []);
    return c;
}

function SceneLabels() {
    const labelY  = ROW_Y['A'] + ROW_PITCH * 1.2;
    const cx      = COLS * COL_PITCH * 0.5;
    const lc      = useSceneLabelColors();

    return (
        <>
            {/* Rack labels — XY plane, face +Z toward camera */}
            <Text position={[cx, labelY + 0.8, RACK_A_Z]} fontSize={1.4} color={lc.main} anchorX="center" anchorY="bottom" fontWeight="bold">Rack A</Text>
            <Text position={[cx, labelY + 0.8, RACK_B_Z]} fontSize={1.4} color={lc.main} anchorX="center" anchorY="bottom" fontWeight="bold">Rack B</Text>

            {/* Side labels — XY plane, face +Z toward camera */}
            {([['AO', SIDE_Z.AO], ['AI', SIDE_Z.AI], ['BI', SIDE_Z.BI], ['BO', SIDE_Z.BO]] as [string, number][]).map(
                ([lbl, z]) => (
                    <Text key={lbl} position={[cx, labelY, z]} fontSize={0.85} color={lc.sub} anchorX="center" anchorY="bottom">
                        {lbl}
                    </Text>
                ),
            )}

            {/* Column markers — above the rack, facing camera, every 10 columns */}
            {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((c) => (
                <Text key={c} position={[colX(c), labelY, SIDE_Z['AI']]} fontSize={0.5} color={lc.dim} anchorX="center" anchorY="bottom">
                    {c}
                </Text>
            ))}

            {/* Row letters — at x+ end */}
            {ROWS.map((row) => (
                <Text key={row} position={[colX(1) + 0.4, ROW_Y[row], SIDE_Z['AI'] - 0.5]} fontSize={0.55} color={lc.main} anchorX="left" anchorY="middle">
                    {row}
                </Text>
            ))}

            {/* Aisle label */}
            <Text position={[cx, -ROW_PITCH * 0.8, 0]} fontSize={0.6} color={lc.dim} anchorX="center" anchorY="top">
                ← AISLE →
            </Text>
        </>
    );
}

// ── Scene ─────────────────────────────────────────────────────────────────────

function CreelScene({ batches, finishedPositions, onHover, camera, domElement, selectedBatch, visibleSides, selectedPositions, onAssignHover, onEmptyHover }: {
    batches: BatchItem[]; finishedPositions: FinishedPosition[];
    onHover: (info: HoverInfo | null) => void;
    camera: THREE.Camera; domElement: HTMLCanvasElement;
    selectedBatch: string | null;
    visibleSides: SideName[];
    selectedPositions: Set<string>;
    onAssignHover?: (info: ClickInfo | null) => void;
    onEmptyHover?: (info: ClickInfo | null) => void;
}) {
    // First batch to claim a position wins; later (older carry-over) batches only
    // fill positions not already taken — prevents z-fighting on overlapping data.
    const dedupedBatches = useMemo(() => {
        const claimed = new Set<string>();
        return batches.map((b) => ({
            ...b,
            positions: b.positions.filter((p) => {
                const key = `${p.side}:${p.column}:${p.row}`;
                if (claimed.has(key)) return false;
                claimed.add(key);
                return true;
            }),
        }));
    }, [batches]);

    const occupiedKeys = useMemo(() => {
        const s = new Set<string>();
        batches.forEach((b) => b.positions.forEach((p) => s.add(`${p.side}:${p.column}:${p.row}`)));
        return s;
    }, [batches]);

    const finishedKeys = useMemo(() => {
        const s = new Set<string>();
        finishedPositions.forEach((p) => s.add(`${p.side}:${p.column}:${p.row}`));
        return s;
    }, [finishedPositions]);

    const overlapKeys = useMemo(() => {
        const counts = new Map<string, number>();
        batches.forEach((b) =>
            b.positions.forEach((p) => {
                const key = `${p.side}:${p.column}:${p.row}`;
                counts.set(key, (counts.get(key) ?? 0) + 1);
            }),
        );
        const s = new Set<string>();
        counts.forEach((n, key) => { if (n > 1) s.add(key); });
        return s;
    }, [batches]);

    // Camera target: middle of the creel lengthwise, vertically centred
    const cx = (COLS * COL_PITCH) / 2;
    const cy = ROW_Y['C']; // middle row

    return (
        <>
            {/* Lighting — simulates the industrial overhead lights in the photo */}
            <ambientLight intensity={0.55} />
            {/* Main overhead key light */}
            <directionalLight position={[cx, 30, 0]}  intensity={1.0} />
            {/* Fill from front (aisle end) */}
            <directionalLight position={[cx, 10, 40]} intensity={0.7} />
            {/* Fill from back */}
            <directionalLight position={[cx, 10, -40]} intensity={0.4} />
            {/* Slight side fill */}
            <directionalLight position={[-20, 15, 0]} intensity={0.3} />

            <OrbitControls
                makeDefault
                target={[cx, cy, 0]}
                enableDamping
                dampingFactor={0.07}
                minDistance={0.5}
                maxDistance={300}
            />

            {/* Green metal rack frames */}
            <CreelRackFrame frameZ={RACK_A_Z} />
            <CreelRackFrame frameZ={RACK_B_Z} />

            {/* Pegs + flanges (filtered by visibleSides) */}
            <AllBobbinFixtures visibleSides={visibleSides} />

            {/* Bobbin bodies — empty positions */}
            <EmptyBobbins occupiedKeys={occupiedKeys} visibleSides={visibleSides} onAssignHover={onAssignHover} onEmptyHover={onEmptyHover} />

            {/* Bobbin bodies — one coloured mesh per batch.
                Normal display: deduped positions (first batch wins each position).
                Selected display: full stored positions so the entire batch extent
                is visible, even where it overlaps higher-priority batches.
                Key includes position count so InstancedMesh capacity grows on assign. */}
            {dedupedBatches.map((b, i) => (
                <BatchBobbins
                    key={`${b.batch}-${batches[i].positions.length}`}
                    batch={batches[i]}
                    displayPositions={b.positions}
                    colorHex={PALETTE_HEX[i % PALETTE_HEX.length]}
                    finishedKeys={finishedKeys}
                    isSelected={selectedBatch === b.batch}
                    hasSelection={selectedBatch !== null}
                    visibleSides={visibleSides}
                    onHover={onHover}
                    onAssignHover={onAssignHover}
                    camera={camera}
                    domElement={domElement}
                />
            ))}

            {/* White rings on positions claimed by more than one batch */}
            <OverlapMarkers overlapKeys={overlapKeys} />

            {/* Yellow glow on user-selected bobbins (for assignment) */}
            <SelectedBobbins selectedPositions={selectedPositions} visibleSides={visibleSides} />

            {/* Amber rings on finished-earlier positions — rendered last so always visible */}
            <FinishedEarlierRings finishedPositions={finishedPositions} />

            <SceneLabels />

            {/* View cube — click any face to jump to that orthographic view */}
            <GizmoHelper alignment="top-left" margin={[80, 80]}>
                <GizmoViewcube
                    color="#1e293b"
                    strokeColor="#475569"
                    textColor="#f1f5f9"
                    hoverColor="#3b82f6"
                    opacity={0.9}
                    faces={['+X', '-X', '+Y', '-Y', '+Z', '-Z']}
                />
            </GizmoHelper>

            {/* Cartesian axis indicator */}
            <GizmoHelper alignment="bottom-left" margin={[80, 80]}>
                <GizmoViewport
                    axisColors={['#ef4444', '#22c55e', '#3b82f6']}
                    labelColor="white"
                    labels={['+X', '+Y', '+Z']}
                />
            </GizmoHelper>
        </>
    );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend({ batches, selectedBatch, onSelectBatch }: {
    batches: BatchItem[];
    selectedBatch: string | null;
    onSelectBatch: (batchId: string) => void;
}) {
    return (
        <div className="absolute right-3 top-3 max-h-[580px] w-52 overflow-y-auto rounded-lg border border-border bg-background/95 p-3 shadow-md backdrop-blur-sm" onPointerDown={(e) => e.stopPropagation()}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Batch Legend
                {selectedBatch && (
                    <button
                        onClick={() => onSelectBatch(selectedBatch)}
                        className="ml-2 rounded px-1 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                    >
                        clear
                    </button>
                )}
            </p>
            <div className="flex flex-col gap-0.5">
                {batches.map((b, i) => {
                    const active = selectedBatch === b.batch;
                    return (
                        <button
                            key={b.batch}
                            onClick={() => onSelectBatch(b.batch)}
                            className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left transition-colors ${
                                active
                                    ? 'bg-accent ring-1 ring-border'
                                    : selectedBatch
                                      ? 'opacity-40 hover:opacity-70'
                                      : 'hover:bg-accent'
                            }`}
                            title={`Click to highlight ${b.batch}`}
                        >
                            <span
                                className="h-3.5 w-3.5 shrink-0 rounded-sm border border-black/10"
                                style={{ backgroundColor: PALETTE_HEX[i % PALETTE_HEX.length] }}
                            />
                            <span className="truncate font-mono text-xs text-foreground">{b.batch}</span>
                            <span className="ml-auto shrink-0 text-xs text-muted-foreground">{b.net_weight.toFixed(0)} kg</span>
                        </button>
                    );
                })}
                <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
                    <span className="h-3.5 w-3.5 shrink-0 rounded-sm border border-border" style={{ backgroundColor: EMPTY_HEX }} />
                    <span className="text-xs text-muted-foreground">Unloaded</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                        <span className="h-2 w-2 rounded-full border-2" style={{ borderColor: FINISHED_RING_HEX }} />
                    </span>
                    <span className="text-xs font-medium" style={{ color: '#b45309' }}>Finished Earlier</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                        <span className="h-2 w-2 rounded-full border-2 border-foreground/30 shadow-[0_0_4px_rgba(0,0,0,0.5)]" />
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">Overlap</span>
                </div>
            </div>
        </div>
    );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function Tooltip({ info }: { info: HoverInfo }) {
    return (
        <div
            className="pointer-events-none fixed z-50 rounded-lg border border-border bg-popover/95 p-3 text-xs shadow-lg backdrop-blur-sm"
            style={{ left: info.screenX + 14, top: info.screenY - 10 }}
        >
            <p className="mb-1.5 font-mono font-bold text-popover-foreground">{info.batch}</p>
            <div className="space-y-0.5 text-muted-foreground">
                <p>
                    Bobbin:&nbsp;
                    <span className="font-mono font-medium text-popover-foreground">
                        {info.posSide}&nbsp;Col&nbsp;{info.posCol}&nbsp;Row&nbsp;{info.posRow}
                    </span>
                    <span className="ml-1.5 text-muted-foreground/60">#{info.posIdx}/{info.totalPos}</span>
                </p>
                <p>Range: <span className="font-medium text-popover-foreground">{info.creel_side}&nbsp;{info.creel_from}→{info.creel_to}</span></p>
                <p>Material: <span className="font-medium text-popover-foreground">{info.material ?? '—'}</span></p>
                <p>Weight: <span className="font-medium text-popover-foreground">{info.net_weight.toFixed(1)} kg</span></p>
                <p>Bobbins: <span className="font-medium text-popover-foreground">{info.count}</span></p>
                {info.isFinishedEarlier && (
                    <p className="mt-1 rounded bg-amber-500/15 px-1.5 py-0.5 font-semibold text-amber-600 dark:text-amber-400">
                        ⚠ Finished Earlier
                    </p>
                )}
            </div>
        </div>
    );
}

function EmptyTooltip({ info }: { info: ClickInfo }) {
    return (
        <div
            className="pointer-events-none fixed z-50 rounded-lg border border-border bg-popover/95 px-2.5 py-2 text-xs shadow-lg backdrop-blur-sm"
            style={{ left: info.screenX + 14, top: info.screenY - 10 }}
        >
            <p className="font-mono font-semibold text-popover-foreground">
                {info.pos.side}&nbsp;·&nbsp;Col&nbsp;{info.pos.column}&nbsp;·&nbsp;Row&nbsp;{info.pos.row}
            </p>
            <p className="mt-0.5 text-muted-foreground">Unloaded</p>
        </div>
    );
}

// ── Root ──────────────────────────────────────────────────────────────────────

// memo prevents tooltip-state re-renders (setHovered / setEmptyHover) from cascading
// into the R3F Canvas and triggering scene reconciliation during a click.
const SceneWrapper = memo(function SceneWrapper({ batches, finishedPositions, onHover, selectedBatch, visibleSides, selectedPositions, onReady, onAssignHover, onEmptyHover }: {
    batches: BatchItem[]; finishedPositions: FinishedPosition[];
    onHover: (info: HoverInfo | null) => void;
    selectedBatch: string | null;
    visibleSides: SideName[];
    selectedPositions: Set<string>;
    onReady?: () => void;
    onAssignHover?: (info: ClickInfo | null) => void;
    onEmptyHover?: (info: ClickInfo | null) => void;
}) {
    const cameraRef    = useRef<THREE.Camera | null>(null);
    const domElemRef   = useRef<HTMLCanvasElement | null>(null);
    const [ready, setReady] = useState(false);

    // Default camera: standing at the aisle entry, slightly elevated, looking down the aisle
    const cx = (COLS * COL_PITCH) / 2;

    return (
        <Canvas
            camera={{ position: [cx, 22, 80], fov: 52, near: 0.01, far: 2000 }}
            gl={{ antialias: true, alpha: true }}
            style={{ background: '#475569' }}
            onCreated={({ camera, gl }) => {
                cameraRef.current  = camera;
                domElemRef.current = gl.domElement;
                setReady(true);
                setTimeout(() => onReady?.(), 200);
            }}
        >
            <Suspense fallback={null}>
                {ready && cameraRef.current && domElemRef.current && (
                    <CreelScene
                        batches={batches}
                        finishedPositions={finishedPositions}
                        onHover={onHover}
                        camera={cameraRef.current}
                        domElement={domElemRef.current}
                        selectedBatch={selectedBatch}
                        visibleSides={visibleSides}
                        selectedPositions={selectedPositions}
                        onAssignHover={onAssignHover}
                        onEmptyHover={onEmptyHover}
                    />
                )}
            </Suspense>
        </Canvas>
    );
});

export function Creel3DViewer({
    batches,
    finishedPositions = [],
    visibleSides = ['AI', 'AO', 'BI', 'BO'],
    selectedPositions = new Set(),
    onPositionToggle,
}: {
    batches: BatchItem[];
    finishedPositions?: FinishedPosition[];
    visibleSides?: SideName[];
    selectedPositions?: Set<string>;
    onPositionToggle?: (pos: BatchPosition) => void;
}) {
    const [hovered, setHovered]             = useState<HoverInfo | null>(null);
    const [emptyHover, setEmptyHover]       = useState<ClickInfo | null>(null);
    const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
    const [sceneReady, setSceneReady]       = useState(false);

    // assignHoverRef: current bobbin under cursor (null when cursor leaves the mesh).
    // lastHoverRef:   last known valid hover — never cleared on leave, only updated on move.
    //
    // Why two refs? R3F's native canvas event handlers run synchronously BEFORE React's
    // synthetic events bubble. So when the user clicks a bobbin:
    //   1. Native pointerdown on canvas → R3F fires onPointerLeave on the mesh
    //      → assignHoverRef = null
    //   2. React synthetic onPointerDown bubbles to the outer div
    //      → by now assignHoverRef is already null
    //
    // lastHoverRef is only set, never cleared, so it survives step 1.
    // In handleDivPointerUp we fall back to lastHoverRef and verify spatially
    // (click must be within 80px of the bobbin's projected screen center) to
    // avoid toggling a stale bobbin when the user clicks empty canvas far away.
    const assignHoverRef = useRef<ClickInfo | null>(null);
    const lastHoverRef   = useRef<ClickInfo | null>(null);

    const handleSceneReady = useCallback(() => setSceneReady(true), []);

    // Pure click-tracking — no state mutations so R3F re-renders never break the click path.
    const handleAssignHover = useCallback((info: ClickInfo | null) => {
        assignHoverRef.current = info;
        if (info !== null) lastHoverRef.current = info;
    }, []);

    // Separate path for the empty-bobbin tooltip — state update is intentionally isolated
    // from handleAssignHover so it cannot interfere with click detection.
    const handleEmptyHover = useCallback((info: ClickInfo | null) => {
        setEmptyHover(info);
    }, []);

    const handleSelectBatch = (batchId: string) =>
        setSelectedBatch((prev) => (prev === batchId ? null : batchId));

    const pointerDownRef = useRef<{ x: number; y: number; time: number } | null>(null);

    const handleDivPointerDown = useCallback((e: React.PointerEvent) => {
        if (e.button !== 0) return;
        pointerDownRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    }, []);

    // Fire toggle only on a short, non-dragging click.
    const handleDivPointerUp = useCallback((e: React.PointerEvent) => {
        if (e.button !== 0 || !pointerDownRef.current) return;
        const dx   = e.clientX - pointerDownRef.current.x;
        const dy   = e.clientY - pointerDownRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const dt   = Date.now() - pointerDownRef.current.time;
        pointerDownRef.current = null;
        if (dist > 5 || dt > 500) return; // orbit drag / long-press → not a select

        // Primary: current hover (may be null — cleared by R3F's pointerLeave during click).
        // Fallback: last known hover, accepted only if click is spatially close to that bobbin.
        let clickInfo = assignHoverRef.current;
        if (!clickInfo && lastHoverRef.current) {
            const last = lastHoverRef.current;
            const nearDist = Math.sqrt((e.clientX - last.screenX) ** 2 + (e.clientY - last.screenY) ** 2);
            if (nearDist < 80) clickInfo = last;
        }

        if (clickInfo) onPositionToggle?.(clickInfo.pos);
    }, [onPositionToggle]);

    return (
        <div
            className="relative h-full w-full"
            onPointerDown={onPositionToggle ? handleDivPointerDown : undefined}
            onPointerUp={onPositionToggle ? handleDivPointerUp : undefined}
            style={onPositionToggle ? { cursor: 'crosshair' } : undefined}
        >
            {/* Loading overlay — shown until Three.js scene fires its first frame */}
            {!sceneReady && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background">
                    <Loader2 className="mb-3 h-10 w-10 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading creel visualization…</p>
                </div>
            )}

            <SceneWrapper
                batches={batches}
                finishedPositions={finishedPositions}
                onHover={setHovered}
                selectedBatch={selectedBatch}
                visibleSides={visibleSides}
                selectedPositions={selectedPositions}
                onReady={handleSceneReady}
                onAssignHover={handleAssignHover}
                onEmptyHover={handleEmptyHover}
            />
            <Legend batches={batches} selectedBatch={selectedBatch} onSelectBatch={handleSelectBatch} />
            {hovered && <Tooltip info={hovered} />}
            {!hovered && emptyHover && <EmptyTooltip info={emptyHover} />}
            <div
                className="absolute bottom-3 left-3 rounded-md border border-border/30 bg-background/60 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm"
                onPointerDown={(e) => e.stopPropagation()}
            >
                {onPositionToggle
                    ? `Click to select · ${selectedPositions.size > 0 ? `${selectedPositions.size} selected · ` : ''}Drag to rotate · Scroll to zoom`
                    : 'Drag to rotate · Scroll to zoom · Right-drag to pan'}
            </div>
        </div>
    );
}
