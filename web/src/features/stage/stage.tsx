import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { requireValue } from "../../../../shared/require-value";
import type { Signal } from "../../lib/signal";
import { buildChip } from "./iso/chip";
import type { FanLayer } from "./iso/fan-gl";
import { buildHall, SLOT_ORDER, type Slot } from "./iso/hall";
import {
	framing,
	type Glide,
	layout,
	NEW,
	PARTS,
	type StageState,
} from "./model";
import { ServerTag } from "./server-tag";
import { startStageAnimation } from "./stage-animation";
import { StageCaption } from "./stage-caption";
import { MachineSpecs, StageSpecs } from "./stage-specs";
import { SvgMarkup } from "./svg-markup";
import { useFanMotion } from "./use-fan-motion";
export function Stage({
	state,
	hold,
	entrance,
}: {
	state: StageState;
	hold: Signal<number>;
	entrance: boolean;
}) {
	const fans = useFanMotion();
	const box = useRef<HTMLDivElement>(null);
	const svg = useRef<SVGSVGElement>(null);
	const front = useRef<SVGSVGElement>(null);
	const drawerGuards = useRef<SVGSVGElement>(null);
	const fanCanvas = useRef<HTMLCanvasElement>(null);
	const fanLayer = useRef<FanLayer | null>(null);
	const drawerFanCanvas = useRef<HTMLCanvasElement>(null);
	const drawerFanLayer = useRef<FanLayer | null>(null);
	const chip = useRef<SVGSVGElement>(null);
	const insp = useRef<HTMLDivElement>(null);
	const inspIn = useRef<HTMLDivElement>(null);
	const inspBox = useRef<number[] | null>(null);
	const tagSize = useRef(new Map<string, [number, number]>());
	const [size, setSize] = useState({ compact: true, h: 0, w: 0 });
	const [hover, setHover] = useState("");
	const lay = layout(state);
	useLayoutEffect(() => {
		const el = box.current;
		if (!el) {
			return;
		}
		const measure = () => {
			const compact =
				!insp.current || getComputedStyle(insp.current).display === "none";
			setSize((s) =>
				Math.abs(s.w - el.clientWidth) < 1 &&
				Math.abs(s.h - el.clientHeight) < 1 &&
				s.compact === compact
					? s
					: {
							compact,
							h: el.clientHeight,
							w: el.clientWidth,
						}
			);
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	// Tray and fan-wall positions survive a rebuild (window resized, a server added), so nothing snaps.
	const kept = useRef(
		new Map<
			string,
			{
				pull: {
					x: number;
					v: number;
				};
				glide: Glide | null;
				to: number;
			}
		>()
	);
	// Each server keeps the place it was first given, so nothing jumps between racks as machines come and go.
	// The next available server (NEW) holds the available place nearest yours. When the API names a server new to the
	// drawing (a machine you just launched, or your machines' servers as the page loads), that server takes
	// over NEW's place, drawer and all, and NEW moves to the next available place: the machine stays where you
	// watched it go, and nothing slides out twice.
	const slots = useRef(new Map<string, number>());
	const hostKey = JSON.stringify(lay.hosts);
	const trays = useMemo(() => {
		const hosts = JSON.parse(hostKey) as string[];
		const map = slots.current;
		for (const h of [...map.keys()]) {
			if (!hosts.includes(h)) {
				map.delete(h);
			}
		}
		const availableSlot = () => {
			const used = new Set(map.values());
			const i = SLOT_ORDER.findIndex((_, j) => !used.has(j));
			return i < 0 ? map.size % SLOT_ORDER.length : i;
		};
		for (const h of hosts) {
			if (h === NEW || map.has(h)) {
				continue;
			}
			if (map.has(NEW)) {
				map.set(h, requireValue(map.get(NEW), "The preview must have a slot"));
				map.delete(NEW);
				// a copy: the drawing being replaced may still run a frame with the old drawer's motion
				transferPreviewMotion(kept.current, h);
				kept.current.delete(NEW);
			} else {
				map.set(h, availableSlot());
			}
		}
		if (hosts.includes(NEW) && !map.has(NEW)) {
			map.set(NEW, availableSlot());
		}
		return hosts.map((h) => ({
			host: h,
			slot: SLOT_ORDER[
				requireValue(map.get(h), "Each server must have a slot")
			] as Slot,
		}));
	}, [hostKey]);
	const { compact } = size;
	const hall = useMemo(() => {
		if (size.w < 100 || size.h < 100) {
			return;
		}
		const inset = compact
			? {
					bottom: 76,
					left: 16,
					right: 16,
					top: Math.min(48, size.h * 0.12),
				}
			: {
					bottom: 56,
					left: 408,
					right: 28,
					top: Math.min(240, size.h * 0.3),
				};
		return buildHall(size.w, size.h, inset, trays);
	}, [size, trays, compact]);
	const chipSvg = useMemo(() => buildChip(260, 112), []);

	// each tag's size, for keeping it inside the plate; measured only when what it says changes
	const measurementKey = JSON.stringify({
		compact,
		tags: lay.tags,
		width: size.w,
	});
	const measuredTags = useRef("");
	useLayoutEffect(() => {
		if (measuredTags.current === measurementKey) {
			return;
		}
		measuredTags.current = measurementKey;
		for (const element of box.current?.querySelectorAll<HTMLElement>(
			"[data-tag]"
		) ?? []) {
			const host = element.dataset.tag;
			if (host) {
				tagSize.current.set(host, [element.offsetWidth, element.offsetHeight]);
			}
		}
	}, [measurementKey]);
	// Measure the visible card before the animation controller places the GPU tags.
	useLayoutEffect(() => {
		if (compact) {
			inspBox.current = null;
			return;
		}
		const outer = insp.current;
		const inner = inspIn.current;
		if (!(outer && inner)) {
			return;
		}
		const measureInspector = () => {
			inspBox.current = [
				outer.offsetLeft,
				outer.offsetTop,
				outer.offsetWidth,
				outer.clientHeight,
			];
		};
		measureInspector();
		const ro = new ResizeObserver(measureInspector);
		ro.observe(inner);
		ro.observe(outer);
		return () => {
			ro.disconnect();
			inspBox.current = null;
		};
	}, [compact]);
	const live = useRef({
		fanMotion: fans.moving,
		lay,
		st: state,
	});
	live.current = {
		fanMotion: fans.moving,
		lay,
		st: state,
	};
	// The drawing's loop sleeps when nothing is moving, and every change of state wakes it.
	const wake = useRef(() => undefined);
	useLayoutEffect(() => wake.current());
	const first = useRef(entrance);
	const camSpring = useRef<{
		cx: {
			x: number;
			v: number;
		};
		cy: {
			x: number;
			v: number;
		};
		lw: {
			x: number;
			v: number;
		};
		aspect: number;
	} | null>(null);
	const camKept = useRef<number[] | null>(null);
	const frameKept = useRef("");
	const startCam = useMemo(() => {
		if (!hall) {
			return [0, 0, 1, 1];
		}
		const target = framing(hall, live.current.lay.frame);
		if (first.current) {
			return hall.overview;
		}
		const keptLocal = camKept.current;
		return keptLocal &&
			Math.abs(keptLocal[2] / keptLocal[3] - target[2] / target[3]) < 0.01
			? keptLocal
			: target;
	}, [hall]);
	useLayoutEffect(
		() =>
			startStageAnimation({
				box,
				camKept,
				camSpring,
				chip,
				drawerFanCanvas,
				drawerFanLayer,
				drawerGuards,
				fanCanvas,
				fanLayer,
				first,
				frameKept,
				front,
				hall,
				hold,
				inspBox,
				kept,
				live,
				svg,
				tagSize,
				wake,
			}),
		[hall, hold]
	);
	useEffect(
		() => () => {
			fanLayer.current?.dispose();
			fanLayer.current = null;
			drawerFanLayer.current?.dispose();
			drawerFanLayer.current = null;
		},
		[]
	);
	const onMove = useCallback(
		(e: React.PointerEvent) => {
			const el = (e.target as Element).closest<SVGElement>("[data-part]");
			const part = el?.dataset.part ?? "";
			let text = part ? (PARTS[part] ?? "") : "";
			if (part === "gpu" && el) {
				text = describeGpu(el, lay.owned);
			}

			if (part === "server-yours" && el) {
				const host = el.dataset.host ?? "";
				const ms = state.machines
					.filter((m) => (m.host ?? NEW) === host && m.mode !== "ended")
					.map((m) => m.name);
				function resolveOnMove2() {
					if (host === NEW) {
						return "The next server with room, where a new machine would go";
					}
					return `Server ${host}, running ${ms.join(" and ") || "nothing of yours now"}${host === lay.focusHost ? "" : ". Click to show it"}`;
				}
				text = resolveOnMove2();
			}
			for (const node of box.current?.querySelectorAll("[data-hover]") ?? []) {
				if (node !== el) {
					node.removeAttribute("data-hover");
				}
			}
			if (el && part === "gpu") {
				el.setAttribute("data-hover", "");
			}
			setHover(text);
		},
		[lay, state]
	);
	const onLeave = useCallback(() => {
		for (const node of box.current?.querySelectorAll("[data-hover]") ?? []) {
			node.removeAttribute("data-hover");
		}
		setHover("");
	}, []);

	return (
		<section
			aria-label="Drawing of the servers"
			className={`stage ${entrance ? "entering" : ""}`}
		>
			<div
				className="plate"
				onPointerLeave={onLeave}
				onPointerMove={onMove}
				ref={box}
			>
				{hall && (
					<>
						<SvgMarkup
							aria-label={`A row of Dell PowerEdge XE9680 servers seen from the Hot Aisle, with a GPU tray pulled out. ${state.readout}`}
							className="iso-svg fig"
							elementRef={svg}
							markup={`<defs>${hall.defs}</defs>${hall.svg}`}
							role="img"
							viewBox={startCam.join(" ")}
						/>
						<div aria-hidden="true">
							<canvas className="fans" ref={fanCanvas} />
						</div>
						<SvgMarkup
							aria-hidden="true"
							className="iso-svg fig front"
							elementRef={front}
							markup={hall.front}
							viewBox={startCam.join(" ")}
						/>
						<div aria-hidden="true">
							<canvas className="fans drawer-fans" ref={drawerFanCanvas} />
						</div>
						<SvgMarkup
							aria-hidden="true"
							className="iso-svg fig front drawer-fan-guards"
							elementRef={drawerGuards}
							markup={hall.drawerGuards}
							viewBox={startCam.join(" ")}
						/>
					</>
				)}
				<div className="inspector" ref={insp}>
					<div className="insp-in" ref={inspIn}>
						<SvgMarkup
							aria-hidden="true"
							className="iso-svg chip"
							elementRef={chip}
							markup={chipSvg}
							viewBox="0 0 260 112"
						/>
						<p className="spec-t">{state.specTitle}</p>
						<MachineSpecs specs={state.spec} />
					</div>
				</div>
				<div className="tags">
					{lay.tags.map((tag) => (
						<ServerTag key={tag.host} tag={tag} />
					))}
				</div>
				<button
					aria-label={
						fans.moving ? "Pause fan animation" : "Play fan animation"
					}
					className="fan-motion-control"
					onClick={fans.toggle}
					title={fans.moving ? "Pause fans" : "Play fans"}
					type="button"
				>
					<svg aria-hidden="true" height="14" viewBox="0 0 16 16" width="14">
						{fans.moving ? (
							<path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor" />
						) : (
							<path d="m4 2 9 6-9 6Z" fill="currentColor" />
						)}
					</svg>
				</button>
				<StageCaption text={hover || state.readout} />
			</div>
			{state.spec.length > 0 && (
				<StageSpecs specs={state.spec} title={state.specTitle} />
			)}
		</section>
	);
}

function transferPreviewMotion(
	positions: Map<string, import("./stage-animation").DrawerMotion>,
	host: string
) {
	const motion = positions.get(NEW);
	if (motion && !positions.has(host)) {
		positions.set(host, {
			glide: motion.glide && {
				...motion.glide,
			},
			pull: {
				...motion.pull,
			},
			to: motion.to,
		});
	}
}

function describeGpu(
	el: SVGElement,
	owners: ReturnType<typeof layout>["owned"]
) {
	const own = owners.get(el.dataset.gpu ?? "");
	if (own && own.machine.mode !== "ended") {
		const n = own.machine.gpus;
		function resolveOnMove() {
			if (n > 1) {
				return ` Linked to your other ${n - 1} GPU${n > 2 ? "s" : ""} over Infinity Fabric, 128 GB/s each pair`;
			}
			return "";
		}
		return `GPU ${own.index} of ${own.machine.name}. MI300X, 192 GB HBM3 at 5.3 TB/s.${resolveOnMove()}`;
	}
	if (el.dataset.who === "preview") {
		return `Would be one of your GPUs once you launch. ${PARTS.gpu}`;
	}
	return "MI300X. Not yours: another customer's, or available";
}
