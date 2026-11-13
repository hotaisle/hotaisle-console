import { afterEach, describe, expect, it, vi } from "vitest";
import { signal } from "../../lib/signal";
import type { Hall } from "./iso/hall";
import { layout, type StageState } from "./model";
import { startStageAnimation } from "./stage-animation";

const fans = vi.hoisted(() => ({
	available: true,
	draw: vi.fn(),
	pause: vi.fn(),
	resize: vi.fn(),
	setCamera: vi.fn(),
	setColors: vi.fn(),
	setFans: vi.fn(),
	setOffset: vi.fn(),
	setPower: vi.fn(),
}));

vi.mock("./iso/fan-gl", () => ({
	FanLayer: class {
		ok = fans.available;
		draw = fans.draw;
		pause = fans.pause;
		resize = fans.resize;
		setCamera = fans.setCamera;
		setColors = fans.setColors;
		setFans = fans.setFans;
		setOffset = fans.setOffset;
		setPower = fans.setPower;
	},
}));

afterEach(() => {
	fans.available = true;
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});

function animate(reducedMotion = false, fanMotion = true) {
	vi.stubGlobal("matchMedia", (media: string) =>
		Object.assign(new EventTarget(), {
			addListener: vi.fn(),
			matches: media === "(prefers-reduced-motion: reduce)" && reducedMotion,
			media,
			onchange: null,
			removeListener: vi.fn(),
		})
	);
	const queue = new Map<number, FrameRequestCallback>();
	let nextFrame = 0;
	let time = 0;
	vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
		nextFrame += 1;
		queue.set(nextFrame, callback);
		return nextFrame;
	});
	vi.stubGlobal("cancelAnimationFrame", (id: number) => queue.delete(id));
	vi.stubGlobal(
		"IntersectionObserver",
		class {
			observe = vi.fn();
			disconnect = vi.fn();
		}
	);
	vi.spyOn(document, "hidden", "get").mockReturnValue(false);
	vi.spyOn(performance, "now").mockReturnValue(0);
	const box = document.createElement("div");
	Object.defineProperties(box, {
		clientHeight: { value: 400 },
		clientWidth: { value: 400 },
	});
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	const front = svg.cloneNode() as SVGSVGElement;
	front.innerHTML =
		'<g data-tray="server"><g data-tray-surface="server" mask="url(#fan-holes)"/></g>';
	const drawerGuards = svg.cloneNode() as SVGSVGElement;
	drawerGuards.innerHTML = '<g data-tray-guards="server"/>';
	const tag = document.createElement("button");
	tag.dataset.tag = "server";
	tag.dataset.shown = "false";
	box.append(tag);
	const state: StageState = {
		focus: "vm",
		machines: [
			{ gpus: 1, host: "server", id: "vm", mode: "ready", name: "vm" },
		],
		readout: "",
		spec: [],
		specTitle: "",
	};
	const hall: Hall = {
		anchors: { server: [200, 200] },
		cages: ["server"],
		defs: "",
		drawerGuards: "",
		fans: [],
		frameOf: () => [0, 0, 400, 400],
		front: "",
		gpuAnchors: {},
		hosts: { server: [0, 0, 400, 400] },
		overview: [0, 0, 400, 400],
		perY: [1, 1],
		perZ: [0, -1],
		svg: "",
	};
	const live = {
		current: {
			fanMotion,
			lay: layout(state),
			st: state,
		},
	};
	const wake = { current: () => undefined };
	const stop = startStageAnimation({
		box: { current: box },
		camKept: { current: null },
		camSpring: { current: null },
		chip: { current: null },
		drawerFanCanvas: { current: document.createElement("canvas") },
		drawerFanLayer: { current: null },
		drawerGuards: { current: drawerGuards },
		fanCanvas: { current: document.createElement("canvas") },
		fanLayer: { current: null },
		first: { current: false },
		frameKept: { current: "" },
		front: { current: front },
		hall,
		hold: signal(0),
		inspBox: { current: null },
		kept: { current: new Map() },
		live,
		svg: { current: svg },
		tagSize: { current: new Map() },
		wake,
	});
	if (!stop) {
		throw new Error("The stage fixture must start its animation controller");
	}
	return {
		drawerGuards,
		frames(count: number) {
			for (let i = 0; i < count; i += 1) {
				time += 1000 / 60;
				const callbacks = [...queue.values()];
				queue.clear();
				for (const callback of callbacks) {
					callback(time);
				}
			}
		},
		front,
		live,
		stop,
		tag,
		wake,
	};
}

describe("drawer fan power", () => {
	it("spins fans with reduced motion and still supports manual pause", () => {
		const app = animate(true);
		try {
			app.frames(10);
			expect(fans.draw).toHaveBeenLastCalledWith(expect.any(Number), true);
			app.live.current.fanMotion = false;
			app.wake.current();
			app.frames(150);
			expect(fans.draw).toHaveBeenLastCalledWith(expect.any(Number), false);
			const draws = fans.draw.mock.calls.length;
			app.frames(10);
			expect(fans.draw).toHaveBeenCalledTimes(draws);
		} finally {
			app.stop();
		}
	});

	it.each([false, true])(
		"animates drawer opening and closing with reduced motion %s",
		(reducedMotion) => {
			const app = animate(reducedMotion);
			try {
				app.frames(1);
				expect(fans.setPower).toHaveBeenLastCalledWith(0, true);
				app.frames(60);
				expect(fans.setPower).toHaveBeenLastCalledWith(0, false);
				expect(
					app.front.querySelector("[data-tray]")?.getAttribute("transform")
				).not.toBe("translate(0.00 0.00)");
				app.frames(90);
				expect(
					app.front.querySelector("[data-tray]")?.getAttribute("transform")
				).toBe("translate(0.00 0.00)");
				expect(app.front.querySelector("[data-tray-surface]")).toHaveAttribute(
					"mask",
					"none"
				);
				expect(app.front.querySelector("[data-tray]")).toHaveAttribute(
					"data-drawer-open",
					"true"
				);
				expect(
					app.drawerGuards.querySelector("[data-tray-guards]")
				).toHaveAttribute("transform", "translate(0.00 0.00)");
				app.live.current.lay = { ...app.live.current.lay, out: [] };
				app.wake.current();
				app.frames(70);
				expect(fans.setPower).toHaveBeenLastCalledWith(0, true);
				expect(app.front.querySelector("[data-tray]")).toHaveAttribute(
					"data-drawer-open",
					"false"
				);
			} finally {
				app.stop();
			}
		}
	);

	it("slides the drawer out even when the fans are paused", () => {
		const app = animate(true, false);
		try {
			app.frames(60);
			expect(app.front.querySelector("[data-tray]")).not.toHaveAttribute(
				"transform",
				"translate(0.00 0.00)"
			);
			app.frames(90);
			expect(app.front.querySelector("[data-tray]")).toHaveAttribute(
				"transform",
				"translate(0.00 0.00)"
			);
			expect(fans.setPower).toHaveBeenLastCalledWith(0, false);
			expect(fans.draw).toHaveBeenLastCalledWith(expect.any(Number), false);
		} finally {
			app.stop();
		}
	});

	it("keeps the floor opaque when WebGL is unavailable", () => {
		fans.available = false;
		const app = animate(false);
		try {
			app.frames(1);
			expect(app.front.querySelector("[data-tray-surface]")).toHaveAttribute(
				"mask",
				"none"
			);
			expect(fans.draw).not.toHaveBeenCalled();
		} finally {
			app.stop();
		}
	});
});

describe("drawer labels", () => {
	it.each([false, true])(
		"waits for the tray before showing labels with reduced motion %s",
		(reducedMotion) => {
			const app = animate(reducedMotion);
			try {
				expect(app.tag).toHaveAttribute("data-shown", "false");
				app.frames(120);
				expect(app.tag).toHaveAttribute("data-shown", "false");
				app.frames(20);
				expect(app.tag).toHaveAttribute("data-shown", "true");

				app.live.current.lay = { ...app.live.current.lay, out: [] };
				app.wake.current();
				app.frames(1);
				expect(app.tag).toHaveAttribute("data-shown", "false");
				app.frames(70);

				app.live.current.lay = { ...app.live.current.lay, out: ["server"] };
				app.wake.current();
				app.frames(120);
				expect(app.tag).toHaveAttribute("data-shown", "false");
				app.frames(20);
				expect(app.tag).toHaveAttribute("data-shown", "true");
			} finally {
				app.stop();
			}
		}
	);
});
