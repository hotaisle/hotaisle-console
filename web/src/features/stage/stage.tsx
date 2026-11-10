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
import { SvgMarkup } from "./svg-markup";
export function Stage({
	state,
	hold,
	entrance,
}: {
	state: StageState;
	hold: Signal<number>;
	entrance: boolean;
}) {
	const box = useRef<HTMLDivElement>(null);
	const svg = useRef<SVGSVGElement>(null);
	const front = useRef<SVGSVGElement>(null);
	const fanCanvas = useRef<HTMLCanvasElement>(null);
	const fanLayer = useRef<FanLayer | null>(null);
	const chip = useRef<SVGSVGElement>(null);
	const insp = useRef<HTMLDivElement>(null);
	const inspIn = useRef<HTMLDivElement>(null);
	const inspBox = useRef<number[] | null>(null);
	const tagSize = useRef(new Map<string, [number, number]>());
	const [size, setSize] = useState({ h: 0, w: 0 });
	const [hover, setHover] = useState("");
	const lay = layout(state);
	useLayoutEffect(() => {
		const el = box.current;
		if (!el) {
			return;
		}
		const measure = () =>
			setSize((s) =>
				Math.abs(s.w - el.clientWidth) < 1 &&
				Math.abs(s.h - el.clientHeight) < 1
					? s
					: {
							h: el.clientHeight,
							w: el.clientWidth,
						}
			);
		measure();
		const ro = new ResizeObserver(() => requestAnimationFrame(measure));
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
	// The next free server (NEW) holds the free place nearest yours. When the API names a server new to the
	// drawing (a machine you just launched, or your machines' servers as the page loads), that server takes
	// over NEW's place, drawer and all, and NEW moves to the next free place: the machine stays where you
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
		const free = () => {
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
				map.set(h, free());
			}
		}
		if (hosts.includes(NEW) && !map.has(NEW)) {
			map.set(NEW, free());
		}
		return hosts.map((h) => ({
			host: h,
			slot: SLOT_ORDER[
				requireValue(map.get(h), "Each server must have a slot")
			] as Slot,
		}));
	}, [hostKey]);
	const narrow = size.w < 720;
	const hall = useMemo(() => {
		if (size.w < 100 || size.h < 100) {
			return;
		}
		const inset = narrow
			? {
					bottom: 40,
					left: 12,
					right: 12,
					top: 12,
				}
			: {
					bottom: 56,
					left: 336,
					right: 28,
					top: 28,
				};
		return buildHall(size.w, size.h, inset, trays);
	}, [size, trays, narrow]);
	const chipSvg = useMemo(() => buildChip(260, 112), []);

	// each tag's size, for keeping it inside the plate; measured only when what it says changes
	const measurementKey = JSON.stringify({ narrow, tags: lay.tags });
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
	const live = useRef({
		lay,
		st: state,
	});
	live.current = {
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
	const arrived = useRef(false); // the camera has reached your servers once; the tags come up then
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
	useEffect(
		() =>
			startStageAnimation({
				arrived,
				box,
				camKept,
				camSpring,
				chip,
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

	// The inspector's length follows what it describes; it glides there instead of snapping.
	useLayoutEffect(() => {
		if (narrow) {
			return;
		}
		const outer = insp.current;
		const inner = inspIn.current;
		if (!(outer && inner)) {
			return;
		}
		const measureInspector = () => {
			outer.style.height = `${inner.offsetHeight}px`;
			inspBox.current = [
				outer.offsetLeft,
				outer.offsetTop,
				outer.offsetWidth,
				inner.offsetHeight,
			];
		};
		measureInspector();
		const ro = new ResizeObserver(measureInspector);
		ro.observe(inner);
		return () => ro.disconnect();
	}, [narrow]);
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
							aria-label={`A row of Dell PowerEdge XE9680 servers seen from the hot aisle, with a GPU tray pulled out. ${state.readout}`}
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
					</>
				)}
				{!narrow && (
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
							<dl>
								{state.spec.map(([k, v]) => (
									<div key={k}>
										<dt>{k}</dt>
										<dd>{v}</dd>
									</div>
								))}
							</dl>
						</div>
					</div>
				)}
				<div className="tags">
					{lay.tags.map((tag) => (
						<ServerTag key={tag.host} tag={tag} />
					))}
				</div>
				<StageCaption text={hover || state.readout} />
			</div>
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
	return "MI300X. Not yours: another customer's, or free";
}
