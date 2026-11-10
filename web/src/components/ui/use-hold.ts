import { useCallback, useEffect, useRef, useState } from "react";
import { sound } from "../../lib/sound";
import { createHoldController, type HoldPhase } from "./hold-controller";

const INPUT_CONTROL_PATTERN = /^(?:INPUT|TEXTAREA|SELECT)$/u;
function typing(target: EventTarget | null) {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable || INPUT_CONTROL_PATTERN.test(target.tagName))
	);
}
export function useHold({
	ms,
	disabled,
	busy,
	hotkey,
	onConfirm,
	onProgress,
	tone,
}: {
	ms: number;
	disabled?: boolean;
	busy?: boolean;
	hotkey?: string;
	onConfirm: () => void;
	onProgress?: (level: number) => void;
	tone: "heat" | "danger";
}) {
	const button = useRef<HTMLButtonElement>(null);
	const controller = useRef<ReturnType<typeof createHoldController> | null>(
		null
	);
	const current = useRef({ busy, disabled, onConfirm, onProgress, tone });
	current.current = { busy, disabled, onConfirm, onProgress, tone };
	const [phase, setPhase] = useState<HoldPhase>("idle");
	useEffect(() => {
		const hold = createHoldController(ms, {
			confirm() {
				if (navigator.vibrate) {
					navigator.vibrate(12);
				}
				if (current.current.tone === "danger") {
					sound.drop();
				} else {
					sound.thunk();
				}
				current.current.onConfirm();
			},
			phase: setPhase,
			progress(level) {
				button.current?.style.setProperty("--p", level.toFixed(4));
				current.current.onProgress?.(level);
			},
			tick: sound.tick,
		});
		controller.current = hold;
		return () => {
			hold.dispose();
			controller.current = null;
		};
	}, [ms]);
	const begin = useCallback(() => {
		if (!(current.current.disabled || current.current.busy)) {
			controller.current?.start();
		}
	}, []);
	const stop = useCallback(() => controller.current?.stop(), []);
	useEffect(() => {
		if (disabled || busy) {
			stop();
		}
	}, [disabled, busy, stop]);
	useEffect(() => {
		if (!hotkey) {
			return;
		}
		function down(event: KeyboardEvent) {
			if (
				event.key.toLowerCase() !== hotkey ||
				event.repeat ||
				event.metaKey ||
				event.ctrlKey ||
				event.altKey ||
				typing(event.target) ||
				document.querySelector("dialog[open]")
			) {
				return;
			}
			event.preventDefault();
			begin();
		}
		function up(event: KeyboardEvent) {
			if (event.key.toLowerCase() === hotkey) {
				stop();
			}
		}
		window.addEventListener("keydown", down);
		window.addEventListener("keyup", up);
		window.addEventListener("blur", stop);
		return () => {
			window.removeEventListener("keydown", down);
			window.removeEventListener("keyup", up);
			window.removeEventListener("blur", stop);
		};
	}, [hotkey, begin, stop]);
	return { begin, button, phase, stop };
}
