import {
	type KeyboardEvent,
	type MouseEvent,
	type PointerEvent,
	useCallback,
} from "react";
import { useHold } from "./use-hold";

export interface HoldButtonProps {
	busy?: boolean;
	busyLabel?: string;
	disabled?: boolean;
	hint?: string;
	hotkey?: string;
	id?: string;
	label: string;
	ms?: number;
	onConfirm: () => void;
	onProgress?: (level: number) => void;
	tone?: "heat" | "danger";
	trailing?: string;
}
export function HoldButton({
	label,
	busyLabel,
	ms = 700,
	tone = "heat",
	disabled,
	busy,
	hint,
	id,
	hotkey,
	trailing,
	onConfirm,
	onProgress,
}: HoldButtonProps) {
	const { button, phase, begin, stop } = useHold({
		busy,
		disabled,
		hotkey,
		ms,
		onConfirm,
		onProgress,
		tone,
	});
	const context = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => event.preventDefault(),
		[]
	);
	const keyDown = useCallback(
		(event: KeyboardEvent<HTMLButtonElement>) => {
			if ((event.key === " " || event.key === "Enter") && !event.repeat) {
				event.preventDefault();
				begin();
			}
		},
		[begin]
	);
	const keyUp = useCallback(
		(event: KeyboardEvent<HTMLButtonElement>) => {
			if (event.key === " " || event.key === "Enter") {
				stop();
			}
		},
		[stop]
	);
	const pointerDown = useCallback(
		(event: PointerEvent<HTMLButtonElement>) => {
			if (event.button !== 0) {
				return;
			}
			event.currentTarget.setPointerCapture?.(event.pointerId);
			begin();
		},
		[begin]
	);
	return (
		<button
			aria-busy={busy}
			aria-description={hint ?? "Press and hold to confirm"}
			className={`hold ${tone} ${phase} ${busy ? "busy" : ""}`}
			disabled={disabled || busy}
			id={id}
			onBlur={stop}
			onContextMenu={context}
			onKeyDown={keyDown}
			onKeyUp={keyUp}
			onPointerCancel={stop}
			onPointerDown={pointerDown}
			onPointerLeave={stop}
			onPointerUp={stop}
			ref={button}
			type="button"
		>
			<span aria-hidden="true" className="hold-fill" />
			<span aria-hidden="true" className="hold-flash" />
			<span className="hold-label">
				<span data-on={!busy && phase === "idle"}>{label}</span>
				<span
					aria-hidden={busy || phase === "idle"}
					data-on={!busy && phase !== "idle"}
				>
					{phase === "done" ? (busyLabel ?? "Working") : "Keep holding"}
				</span>
				<span aria-hidden={!busy} data-on={Boolean(busy)}>
					{busyLabel ?? "Working"}
				</span>
			</span>
			{trailing ? <span className="hold-trail">{trailing}</span> : null}
		</button>
	);
}
