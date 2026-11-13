import type { RefObject } from "react";
import { requireValue } from "../../../../shared/require-value";
import { bezier, type View } from "../../lib/camera";
import type { Signal } from "../../lib/signal";
import { gpuAppearance } from "./gpu-appearance";
import { FanLayer } from "./iso/fan-gl";
import { type Hall, PULL } from "./iso/hall";
import { framing, type Glide, type layout, type StageState } from "./model";
import { tagAnchor } from "./tag-anchor";

function avoidOverlaps(
	position: { x: number; y: number },
	tw: number,
	th: number,
	W: number,
	M: number,
	ins: number[] | null,
	placed: number[][],
	clampY: (value: number) => number
) {
	const hits = (b: number[], pad: number) =>
		position.x < b[0] + b[2] + pad &&
		position.x + tw > b[0] - pad &&
		position.y < b[1] + b[3] + pad &&
		position.y + th > b[1] - pad;
	if (ins && hits(ins, 10)) {
		if (ins[0] + ins[2] + 10 + tw <= W - M) {
			position.x = ins[0] + ins[2] + 10;
		} else {
			position.y = clampY(ins[1] + ins[3] + 10);
		}
	}
	for (const b of placed) {
		if (hits(b, 6)) {
			position.y = clampY(b[1] + b[3] + 6);
		}
	}
	return position;
}

interface Spring {
	v: number;
	x: number;
}
export interface DrawerMotion {
	glide: Glide | null;
	pull: Spring;
	to: number;
}
export interface CameraSpring {
	aspect: number;
	cx: Spring;
	cy: Spring;
	lw: Spring;
}
interface AnimationContext {
	box: RefObject<HTMLDivElement | null>;
	camKept: RefObject<number[] | null>;
	camSpring: RefObject<CameraSpring | null>;
	chip: RefObject<SVGSVGElement | null>;
	drawerFanCanvas: RefObject<HTMLCanvasElement | null>;
	drawerFanLayer: RefObject<FanLayer | null>;
	drawerGuards: RefObject<SVGSVGElement | null>;
	fanCanvas: RefObject<HTMLCanvasElement | null>;
	fanLayer: RefObject<FanLayer | null>;
	first: RefObject<boolean>;
	frameKept: RefObject<string>;
	front: RefObject<SVGSVGElement | null>;
	hall: Hall | undefined;
	hold: Signal<number>;
	inspBox: RefObject<number[] | null>;
	kept: RefObject<Map<string, DrawerMotion>>;
	live: RefObject<{
		fanMotion: boolean;
		lay: ReturnType<typeof layout>;
		st: StageState;
	}>;
	svg: RefObject<SVGSVGElement | null>;
	tagSize: RefObject<Map<string, [number, number]>>;
	wake: RefObject<() => void>;
}
export function startStageAnimation({
	hall,
	hold,
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
	inspBox,
	kept,
	live,
	svg,
	tagSize,
	wake,
}: AnimationContext) {
	const root = svg.current;
	const fr = front.current;
	const canvas = fanCanvas.current;
	const drawerCanvas = drawerFanCanvas.current;
	const guards = drawerGuards.current;
	const plate = box.current;
	if (!(hall && root && fr && canvas && drawerCanvas && guards && plate)) {
		return;
	}
	const scene = hall;
	const surface = plate;
	// The row's rotors sit behind the opaque trays; the open drawer's rotors sit above its floor.
	function ensureFans(
		layer: RefObject<FanLayer | null>,
		target: HTMLCanvasElement
	) {
		if (layer.current) {
			return;
		}
		try {
			layer.current = new FanLayer(target);
		} catch (e) {
			// without WebGL 2 the fans are drawn still, by the drawing itself
			console.warn("Fan layer unavailable:", (e as Error).message);
			layer.current = null;
		}
	}
	ensureFans(fanLayer, canvas);
	ensureFans(drawerFanLayer, drawerCanvas);
	const available = fanLayer.current?.ok && drawerFanLayer.current?.ok;
	const fl = available ? fanLayer.current : null;
	const drawerFans = available ? drawerFanLayer.current : null;
	surface.classList.toggle("gl", !!fl);
	fl?.resize(surface.clientWidth, surface.clientHeight);
	drawerFans?.resize(surface.clientWidth, surface.clientHeight);
	fl?.setColors(surface);
	drawerFans?.setColors(surface);
	const cageIndex = new Map(scene.cages.map((h, i) => [h, i]));
	let frontCage: number | undefined;
	function orderFans(out: string[]) {
		const selected = cageIndex.get(out[0]) ?? -1;
		if (selected === frontCage) {
			return;
		}
		frontCage = selected;
		fl?.setFans(
			scene.fans.filter((fan) => fan.cage !== selected || selected < 0)
		);
		drawerFans?.setFans(
			scene.fans.filter((fan) => fan.cage === selected && selected >= 0)
		);
	}
	orderFans(live.current.lay.out);
	const W = surface.clientWidth;
	const H = surface.clientHeight;
	// follow the theme
	const recolor = () => {
		fl?.setColors(surface);
		drawerFans?.setColors(surface);
		wake.current();
	};
	const scheme = window.matchMedia("(prefers-color-scheme: dark)");
	scheme.addEventListener("change", recolor);
	const themeWatch = new MutationObserver(() => requestAnimationFrame(recolor));
	themeWatch.observe(document.documentElement, {
		attributeFilter: ["data-theme", "class", "style"],
		attributes: true,
	});
	// only spin while the drawing is on screen
	let onScreen = true;
	const seen = new IntersectionObserver(([e]) => {
		onScreen = e.isIntersecting;
		if (onScreen) {
			wake.current();
		}
	});
	seen.observe(surface);
	const still = window.matchMedia("(prefers-reduced-motion: reduce)");
	const gpus = new Map<string, SVGGElement>();
	for (const g of fr.querySelectorAll<SVGGElement>("[data-gpu]")) {
		if (g.dataset.gpu) {
			gpus.set(g.dataset.gpu, g);
		}
	}
	const heat = new Map<
		string,
		{
			x: number;
			v: number;
		}
	>();
	for (const [id, _] of gpus.entries()) {
		heat.set(id, {
			v: 0,
			x: 0,
		});
	}
	// Each of your servers' drawers (fan wall in front, GPU tray behind) glides out and back on a timed curve.
	// Its motion is kept outside the drawing, so a rebuild mid-glide doesn't restart it.
	const servers = Object.keys(scene.hosts).map((host) => {
		const m = kept.current.get(host) ?? {
			glide: null,
			pull: {
				v: 0,
				x: 0,
			},
			to: -1,
		};
		kept.current.set(host, m);
		return Object.assign(m, {
			fanMask:
				fr
					.querySelector(`[data-tray-surface="${host}"]`)
					?.getAttribute("mask") ?? "none",
			guards: guards.querySelector<SVGGElement>(`[data-tray-guards="${host}"]`),
			host,
			surface: fr.querySelector<SVGGElement>(`[data-tray-surface="${host}"]`),
			tray: fr.querySelector<SVGGElement>(`[data-tray="${host}"]`),
		});
	});
	const drawerOut = bezier(0.32, 0, 0.28, 1); // a gentle start and a slow glide to a stop
	const drawerIn = bezier(0.45, 0, 0.2, 1);
	const idleds = [...root.querySelectorAll<SVGCircleElement>("[data-idled]")];
	const xcds = [
		...(chip.current?.querySelectorAll<SVGGElement>("[data-xcd]") ?? []),
	];
	const hbms = [
		...(chip.current?.querySelectorAll<SVGGElement>("[data-hbm]") ?? []),
	];
	// Arriving, the camera starts on the whole row and travels in to your servers; the drawers come out as it lands.
	const target0: View = framing(scene, live.current.lay.frame);
	const arriving = first.current && !still.matches;
	// after a resize the old view box means nothing, so start from the new frame; otherwise keep the camera where it is
	const sameScale =
		camKept.current &&
		Math.abs(
			camKept.current[2] / camKept.current[3] - target0[2] / target0[3]
		) < 0.01;
	function resolveCam() {
		if (arriving) {
			return scene?.overview ?? target0;
		}
		return (sameScale ? camKept.current : undefined) ?? target0;
	}
	const cam = resolveCam().map((v) => ({
		v: 0,
		x: v,
	}));
	first.current = false;
	let last = 0;
	let frame = 0;
	let lastTarget: View = target0;
	// The camera frames your servers, and moves only when that set changes (a machine on a new server, the
	// last one on a server gone, the order opened or closed). It rides critically damped springs on its
	// centre and on the log of its width: zoom changes at an even perceived rate, nothing overshoots, and
	// when the target changes mid-move (the API naming a new machine's server, say) it bends toward the new
	// one without stopping first.
	const aspectOf = target0[3] / target0[2];
	const lens = (v: number[]) => ({
		cx: {
			v: 0,
			x: v[0] + v[2] / 2,
		},
		cy: {
			v: 0,
			x: v[1] + v[3] / 2,
		},
		lw: {
			v: 0,
			x: Math.log(v[2]),
		},
	});
	// the camera's springs outlive a rebuild of the drawing, speed and all, unless the surface changed shape
	const keptCam = camSpring.current;
	const camS =
		keptCam && !arriving && Math.abs(keptCam.aspect - aspectOf) < 0.01
			? keptCam
			: {
					...lens(cam.map((c) => c.x)),
					aspect: aspectOf,
				};
	camSpring.current = camS;
	const arriveAt = arriving ? performance.now() + 160 : 0;
	// A critically damped spring: no overshoot, no wobble, and it keeps its speed when the target moves.
	// It reports whether it is still moving; close enough, it lands exactly, so the loop can rest.
	const settle = (
		s: {
			x: number;
			v: number;
		},
		target: number,
		dt: number,
		seconds: number,
		eps = 1e-3
	) => {
		if (
			still.matches ||
			(Math.abs(target - s.x) < eps && Math.abs(s.v) < eps * 4)
		) {
			const was = s.x !== target;
			s.x = target;
			s.v = 0;
			return was;
		}
		const w = 1 / seconds;
		for (let i = 0; i < 4; i += 1) {
			s.v += (w * w * (target - s.x) - 2 * w * s.v) * (dt / 4);
			s.x += s.v * (dt / 4);
		}
		return true;
	};
	// Only touch the drawing when a value really changes: every write repaints the whole figure.
	const written = new WeakMap<Element, Map<string, string>>();
	const put = (el: Element | null, name: string, value: string) => {
		if (!el) {
			return;
		}
		let m = written.get(el);
		if (!m) {
			m = new Map();
			written.set(el, m);
		}
		if (m.get(name) === value) {
			return;
		}
		m.set(name, value);
		if (name.startsWith("--")) {
			(el as SVGElement).style.setProperty(name, value);
		} else if (name.startsWith("style:")) {
			(el as HTMLElement).style.setProperty(name.slice(6), value);
		} else {
			el.setAttribute(name, value);
		}
	};
	// The loop: while something moves, it moves the drawing; while the fans turn, it draws them. With
	// neither (reduced motion, or the drawing scrolled away), it stops until something wakes it.
	let sleeping = false;
	let active = true;
	let restFrames = 0;
	wake.current = () => {
		active = true;
		restFrames = 0;
		if (!sleeping) {
			return;
		}
		sleeping = false;
		last = 0;
		frame = requestAnimationFrame(tick);
	};
	const unhold = hold.sub(() => wake.current());
	const visibilityChanged = () => wake.current();
	document.addEventListener("visibilitychange", visibilityChanged);
	let spinning = false;
	function drawFans(now: number, activeFrame: boolean) {
		const spin = !!fl && live.current.fanMotion && onScreen && !document.hidden;
		if (fl && (spin || activeFrame || spinning !== spin)) {
			fl.draw(now / 1000, spin);
			drawerFans?.draw(now / 1000, spin);
		}
		spinning = spin;
		return spin;
	}
	const tick = (now: number) => {
		if (!onScreen || document.hidden) {
			fl?.pause();
			drawerFans?.pause();
			spinning = false;
			sleeping = true;
			return;
		}
		const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
		last = now;
		if (active) {
			restFrames = step(now, dt) ? 0 : restFrames + 1;
			if (restFrames > 2) {
				active = false;
			}
		}
		const spin = drawFans(now, active);
		if (!(active || spin)) {
			sleeping = true;
			return;
		}
		frame = requestAnimationFrame(tick);
	};
	function updateCamera(
		now: number,
		dt: number,
		layLocal: ReturnType<typeof layout>
	) {
		let moving = false;
		// Between a new server appearing and the drawing being rebuilt with it, this drawing doesn't know
		// it: hold the camera's course rather than aim at the whole row for a frame.
		const known = layLocal.frame.every((h) => h in scene.hosts);
		const t = known ? framing(scene, layLocal.frame) : lastTarget;
		lastTarget = t;
		frameKept.current = layLocal.frame.join("|");
		const T = lens(t);
		const w = Math.exp(camS.lw.x);
		// arriving, a beat of stillness, then a slower, longer move in from the whole row
		const tau = arriveAt && now < arriveAt + 1700 ? 0.42 : 0.3;
		if (now >= arriveAt) {
			if (settle(camS.cx, T.cx.x, dt, tau, w * 1e-4)) {
				moving = true;
			}
			if (settle(camS.cy, T.cy.x, dt, tau, w * 1e-4)) {
				moving = true;
			}
			if (settle(camS.lw, T.lw.x, dt, tau, 1e-4)) {
				moving = true;
			}
		} else {
			moving = true;
		}
		const cw = Math.exp(camS.lw.x);
		const ch = cw * aspectOf;
		const view = [camS.cx.x - cw / 2, camS.cy.x - ch / 2, cw, ch];
		for (const [i, c] of cam.entries()) {
			c.x = view[i];
		}
		// the drawers come out as the camera arrives, not while it is still far off
		const settled =
			Math.abs(camS.lw.x - T.lw.x) < 0.25 &&
			Math.hypot(camS.cx.x - T.cx.x, camS.cy.x - T.cy.x) < cw * 0.2;
		const vb = cam.map((c) => c.x.toFixed(2)).join(" ");
		put(root, "viewBox", vb);
		put(fr, "viewBox", vb);
		put(guards, "viewBox", vb);
		fl?.setCamera(cam.map((c) => c.x));
		drawerFans?.setCamera(cam.map((c) => c.x));
		camKept.current = cam.map((c) => c.x);

		return { moving, settled, view };
	}
	function startDrawer(
		s: (typeof servers)[number],
		target: number,
		now: number,
		delay: number
	) {
		const goingOut = target > s.pull.x;
		const dist = Math.abs(target - s.pull.x) / PULL;
		s.glide = {
			dur: (goingOut ? 2200 : 1100) * Math.max(0.45, Math.sqrt(dist)),
			ease: goingOut ? drawerOut : drawerIn,
			from: s.pull.x,
			start: now + (goingOut ? delay * 90 : 0),
			to: target,
		};

		s.to = target;
	}
	function animateDrawer(
		s: (typeof servers)[number],
		target: number,
		now: number,
		delay: number
	) {
		let moving = false;
		if (target !== s.to) {
			startDrawer(s, target, now, delay);
		}
		if (s.glide) {
			const g = s.glide;
			const k = Math.min(1, Math.max(0, (now - g.start) / g.dur));
			s.pull.x = g.from + (g.to - g.from) * g.ease(k);
			moving = true;
			if (k >= 1) {
				s.glide = null;
			}
		}
		paintDrawer(s);
		return moving;
	}
	function paintDrawer(s: (typeof servers)[number]) {
		const [yx, yy] = scene.perY;
		const off = s.pull.x - PULL;
		const selected = cageIndex.get(s.host) === frontCage;
		put(s.surface, "mask", fl && !selected ? s.fanMask : "none");
		put(s.guards, "visibility", selected && fl ? "visible" : "hidden");
		put(s.tray, "data-drawer-open", String(s.pull.x > 0.25));
		put(s.guards, "data-drawer-open", String(s.pull.x > 0.25));
		if (s.tray) {
			const transform = `translate(${(yx * off).toFixed(2)} ${(yy * off).toFixed(2)})`;
			put(s.tray, "transform", transform);
			put(s.guards, "transform", transform);
		}
		fl?.setOffset(cageIndex.get(s.host) ?? -1, yx * s.pull.x, yy * s.pull.x);
		drawerFans?.setOffset(
			cageIndex.get(s.host) ?? -1,
			yx * s.pull.x,
			yy * s.pull.x
		);
		// Disconnect power as the drawer leaves its seated position; reconnect only once it closes.
		fl?.setPower(cageIndex.get(s.host) ?? -1, s.pull.x <= 0.25);
		drawerFans?.setPower(cageIndex.get(s.host) ?? -1, s.pull.x <= 0.25);
	}
	function updateDrawers(
		now: number,
		layLocal: ReturnType<typeof layout>,
		settled: boolean
	) {
		let moving = false;
		orderFans(layLocal.out);
		// the drawers: out for your servers, in for the rest. Several starting together go out one after another.
		// A drawer comes out once the camera has arrived, and once moving out it carries on even if the
		// camera is sent somewhere close by: only leaving the drawing's focus sends it back in.
		const outNow = new Set(layLocal.out);
		let started = 0;
		for (const server of servers) {
			const target =
				outNow.has(server.host) && (settled || server.to === PULL) ? PULL : 0;
			const starting = target !== server.to && target > server.pull.x;
			if (animateDrawer(server, target, now, started)) {
				moving = true;
			}
			if (starting) {
				started += 1;
			}
		}

		return moving;
	}
	function positionTags(view: number[]) {
		const [yx, yy] = scene.perY;
		// The tags ride on their servers' drawers. One whose server is out of view waits at the edge of the
		// surface, pointing toward it; tags never cover the inspector or each other.
		const sc = Math.min(W / view[2], H / view[3]);
		const ox = (W - view[2] * sc) / 2 - view[0] * sc;
		const oy = (H - view[3] * sc) / 2 - view[1] * sc;
		const ins = inspBox.current;
		const placed: number[][] = [];
		function positionTag(el: HTMLElement) {
			const host = el.dataset.tag;
			if (!host) {
				return;
			}
			const a = tagAnchor(scene, live.current.lay, host);
			if (!a) {
				return;
			}
			// The tag floats above the assigned heatsinks and follows the drawer in the same frame.
			const drawer = kept.current.get(host);
			const pull = drawer?.pull.x ?? 0;
			const px = (a[0] + yx * pull) * sc + ox;
			const py = (a[1] + yy * pull) * sc + oy;
			const [tw, th] = tagSize.current.get(host) ?? [160, 44];
			const M = 14;
			const x = px - tw / 2;
			const y = py - 14 - th;
			const clampX = (v: number) => Math.min(W - M - tw, Math.max(M, v));
			const clampY = (v: number) => Math.min(H - 40 - th, Math.max(M, v));
			let cx = clampX(x);
			let cy = clampY(y);
			const position = avoidOverlaps(
				{ x: cx, y: cy },
				tw,
				th,
				W,
				M,
				ins,
				placed,
				clampY
			);
			cx = position.x;
			cy = position.y;
			placed.push([cx, cy, tw, th]);
			const off = Math.abs(cx - x) > 2 || Math.abs(cy - y) > 2;
			// Placed by fractions of a pixel, always: snapped to whole pixels it would shimmy as x and y stepped
			// on different frames, and hop when it came to rest. Not on its own GPU layer, so its text is
			// drawn sharp wherever it lands.
			const at = (v: number) => v.toFixed(2);
			put(el, "style:transform", `translate(${at(cx)}px, ${at(cy)}px)`);
			put(el, "data-off", String(off));
			if (off) {
				put(
					el,
					"--a",
					`${Math.atan2(py - (cy + th / 2), px - (cx + tw / 2)).toFixed(2)}rad`
				);
			}
			// Reveal the label from the completed drawer pose, including when motion is skipped.
			const open =
				drawer?.to === PULL && drawer.pull.x === PULL && !drawer.glide;
			put(el, "data-shown", String(open));
		}
		for (const el of surface.querySelectorAll<HTMLElement>("[data-tag]")) {
			positionTag(el);
		}
	}
	function updateGpu(
		id: string,
		el: SVGGElement,
		st: StageState,
		layLocal: ReturnType<typeof layout>,
		p: number,
		dt: number
	) {
		let moving = false;

		const host = id.slice(0, id.lastIndexOf("/"));
		const slot = Number(id.slice(id.lastIndexOf("/") + 1));
		const own = layLocal.owned.get(id);
		const pv =
			host === layLocal.focusHost ? layLocal.previewSlots.indexOf(slot) : -1;
		const m = own?.machine;
		const liveLocal = !!m && m.mode !== "ended";
		const { target: initialTarget, led } = gpuAppearance(own);
		let target = initialTarget;
		const claimed =
			pv >= 0 && p > (pv + 0.5) / Math.max(1, layLocal.previewSlots.length);
		if (claimed) {
			target = 0.22;
		}
		const h = requireValue(
			heat.get(id),
			"Every rendered GPU must have a heat state"
		);
		function resolveStep2() {
			if (m?.mode === "ended" || m?.mode === "off") {
				return 1.4;
			}
			if (claimed) {
				return 0.1;
			}
			return 0.8;
		}
		if (settle(h, target, dt, resolveStep2())) {
			moving = true;
		}
		put(el, "--h", h.x.toFixed(2));
		function resolveWho() {
			if (liveLocal) {
				if (m && m.id === st.focus) {
					return "focus";
				}
				return "mine";
			}
			if (pv >= 0) {
				return "preview";
			}
			return "";
		}
		const who = resolveWho();
		if (el.dataset.who !== who) {
			el.dataset.who = who;
		}
		if (el.dataset.led !== led) {
			el.dataset.led = led;
		}

		return moving;
	}
	function updateIndicators(
		st: StageState,
		layLocal: ReturnType<typeof layout>
	) {
		let moving = false;
		const running = new Set(
			st.machines.filter((m) => m.mode !== "ended" && m.host).map((m) => m.host)
		);
		for (const c of idleds) {
			const on = String(running.has(c.dataset.idled ?? ""));
			if (c.dataset.on !== on) {
				c.dataset.on = on;
			}
		}
		// the chip close-up: compute dies come up as the machine boots, memory once it is ready
		const fm = layLocal.focusMachine;
		function resolveProg() {
			if (fm) {
				if (fm.mode === "ready") {
					return 1;
				}
				if (fm.mode === "booting") {
					return (
						1 - Math.exp(-((Date.now() - (fm.since ?? Date.now())) / 1000) / 16)
					);
				}
				return 0;
			}
			return 0;
		}
		const prog = resolveProg();
		const litX = Math.round(prog * 8);
		for (const [i, g] of xcds.entries()) {
			const on = String(i < litX);
			if (g.dataset.on !== on) {
				g.dataset.on = on;
			}
		}
		for (const g of hbms) {
			const on = String(fm?.mode === "ready");
			if (g.dataset.on !== on) {
				g.dataset.on = on;
			}
		}
		// a booting machine warms on a clock, so it keeps the loop awake
		if (
			fm?.mode === "booting" ||
			st.machines.some((m) => m.mode === "booting" || m.mode === "claimed")
		) {
			moving = true;
		}
		return moving;
	}
	const step = (now: number, dt: number) => {
		const { st, lay: currentLayout } = live.current;
		const camera = updateCamera(now, dt, currentLayout);
		const drawersMoving = updateDrawers(now, currentLayout, camera.settled);
		positionTags(camera.view);
		let gpuMoving = false;
		for (const [id, element] of gpus) {
			if (updateGpu(id, element, st, currentLayout, hold.get(), dt)) {
				gpuMoving = true;
			}
		}
		const indicatorsMoving = updateIndicators(st, currentLayout);
		return camera.moving || drawersMoving || gpuMoving || indicatorsMoving;
	};
	// Apply the closed pose before the first paint so the fully extended source SVG never flashes.
	const mountedAt = performance.now();
	step(mountedAt, 0);
	drawFans(mountedAt, true);
	frame = requestAnimationFrame(tick);
	return () => {
		cancelAnimationFrame(frame);
		unhold();
		seen.disconnect();
		document.removeEventListener("visibilitychange", visibilityChanged);
		themeWatch.disconnect();
		scheme.removeEventListener("change", recolor);
		wake.current = () => undefined;
	};
}
