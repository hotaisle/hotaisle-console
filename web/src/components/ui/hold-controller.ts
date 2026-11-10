export type HoldPhase = "idle" | "holding" | "done";
export interface HoldCallbacks {
	confirm: () => void;
	phase: (phase: HoldPhase) => void;
	progress: (level: number) => void;
	tick: () => void;
}

/** Animation state stays outside React; releasing early never confirms an action. */
export function createHoldController(
	duration: number,
	callbacks: HoldCallbacks
) {
	let holding = false;
	let done = false;
	let level = 0;
	let last = 0;
	let ticks = 0;
	let frame = 0;
	let resetTimer: ReturnType<typeof setTimeout> | undefined;
	function reset() {
		done = false;
		level = 0;
		last = 0;
		callbacks.progress(0);
		callbacks.phase("idle");
	}
	function confirm() {
		holding = false;
		done = true;
		callbacks.phase("done");
		callbacks.confirm();
		resetTimer = setTimeout(reset, 520);
	}
	function step(now: number) {
		const elapsed = last ? Math.min(50, now - last) : 0;
		last = now;
		const change = holding ? elapsed / duration : -elapsed / (duration * 0.45);
		level = Math.max(0, Math.min(1, level + change));
		callbacks.progress(level);
		const nextTicks = Math.floor(level * 3);
		if (holding && nextTicks > ticks && nextTicks < 3) {
			callbacks.tick();
		}
		ticks = nextTicks;
		if (level >= 1 && holding) {
			confirm();
			return;
		}
		if (!holding && level <= 0) {
			reset();
			return;
		}
		frame = requestAnimationFrame(step);
	}
	return {
		dispose() {
			callbacks.progress(0);
			cancelAnimationFrame(frame);
			clearTimeout(resetTimer);
		},
		start() {
			if (holding || done) {
				return;
			}
			holding = true;
			callbacks.phase("holding");
			if (!last) {
				cancelAnimationFrame(frame);
				frame = requestAnimationFrame(step);
			}
		},
		stop() {
			holding = false;
		},
	};
}
