import {
	type HotkeyChord,
	useDefaultHotkeysOptions,
	useHotkey,
	useHotkeyScopesState,
	useHotkeys,
} from "@tanstack/react-hotkeys";
import { useCallback, useEffect, useRef, useState } from "react";
import { useShortcut } from "../../hooks/use-shortcut";
import { sound } from "../../lib/sound";
import { createHoldController, type HoldPhase } from "./hold-controller";

export function useHold({
	ms,
	disabled,
	busy,
	hotkey,
	label,
	onConfirm,
	onProgress,
	tone,
}: {
	ms: number;
	disabled?: boolean;
	busy?: boolean;
	hotkey?: HotkeyChord;
	label: string;
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

	const defaults = useDefaultHotkeysOptions();
	const scopes = useHotkeyScopesState();
	const scope = defaults.hotkey?.scope ?? "global";
	useEffect(() => {
		if (scopes.suspended.includes(scope)) {
			stop();
		}
	}, [scopes, scope, stop]);
	useShortcut(hotkey, begin, {
		enabled: !(disabled || busy),
		meta: {
			description: "Hold until confirmed; release to cancel.",
			name: label,
		},
	});
	useHotkey(hotkey, stop, {
		eventType: "keyup",
		ignoreInputs: false,
		preventDefault: false,
	});
	useHotkeys(
		(["Enter", "Space"] as const).flatMap((key) => [
			{
				callback: begin,
				hotkey: key,
				options: { meta: { name: label }, requireReset: true },
			},
			{ callback: stop, hotkey: key, options: { eventType: "keyup" as const } },
		]),
		{ enabled: !(disabled || busy), ignoreInputs: false, target: button }
	);
	useEffect(() => {
		window.addEventListener("blur", stop);
		return () => window.removeEventListener("blur", stop);
	}, [stop]);
	return { begin, button, phase, stop };
}
