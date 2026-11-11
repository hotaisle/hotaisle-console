import {
	type ReactNode,
	type RefObject,
	type ToggleEvent,
	useCallback,
	useId,
	useLayoutEffect,
	useRef,
} from "react";
import { createPortal } from "react-dom";
import { useShortcut } from "../../hooks/use-shortcut";
import { KeyboardScope } from "./keyboard-scope";

/** Non-modal actions near their invoker, with native light dismissal where supported. */
export function AnchoredPopover(props: Parameters<typeof PopoverBody>[0]) {
	return (
		<KeyboardScope>
			<PopoverBody {...props} />
		</KeyboardScope>
	);
}

function PopoverBody({
	anchor,
	anchorName,
	id,
	title,
	onClose,
	children,
}: {
	anchor: RefObject<HTMLButtonElement | null>;
	anchorName: string;
	id: string;
	title: string;
	onClose: () => void;
	children: ReactNode;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	useShortcut("Escape", onClose, {
		enabled: !Object.hasOwn(HTMLElement.prototype, "popover"),
		target: ref,
	});
	const toggled = useCallback(
		(event: ToggleEvent<HTMLDialogElement>) => {
			if (event.target === event.currentTarget && event.newState === "closed") {
				onClose();
			}
		},
		[onClose]
	);
	useLayoutEffect(() => {
		const popup = ref.current;
		const trigger = anchor.current;
		if (!(popup && trigger)) {
			return;
		}
		const native = Object.hasOwn(HTMLElement.prototype, "popover");
		if (native) {
			popup.showPopover({ source: trigger });
		} else {
			popup.show();
		}
		popup.querySelector<HTMLButtonElement>("button")?.focus();
		return () => {
			if (native) {
				popup.hidePopover();
			} else {
				popup.close();
			}
		};
	}, [anchor]);
	useLayoutEffect(() => {
		const popup = ref.current;
		const trigger = anchor.current;
		if (!(popup && trigger)) {
			return;
		}
		const native = Object.hasOwn(HTMLElement.prototype, "popover");
		const anchored =
			typeof CSS !== "undefined" && CSS.supports("position-area: block-start");
		const place = () => {
			if (anchored && native) {
				return;
			}
			const bounds = trigger.getBoundingClientRect();
			const gap = 8;
			const margin = 12;
			const width = popup.offsetWidth;
			const height = popup.offsetHeight;
			const above = bounds.top - gap - height;
			const below = bounds.bottom + gap;
			const top = above >= margin ? above : below;
			popup.dataset.positioned = "true";
			popup.style.setProperty(
				"--popup-left",
				`${Math.max(margin, Math.min(bounds.right - width, window.innerWidth - width - margin))}px`
			);
			popup.style.setProperty(
				"--popup-top",
				`${Math.max(margin, Math.min(top, window.innerHeight - height - margin))}px`
			);
		};
		const outside = (event: PointerEvent) => {
			if (
				!native &&
				event.target instanceof Node &&
				!popup.contains(event.target) &&
				!trigger.contains(event.target)
			) {
				onClose();
			}
		};
		place();
		const observer =
			typeof ResizeObserver === "undefined"
				? undefined
				: new ResizeObserver(place);
		observer?.observe(popup);
		observer?.observe(trigger);
		window.addEventListener("resize", place);
		document.addEventListener("scroll", place, true);
		document.addEventListener("pointerdown", outside);
		return () => {
			observer?.disconnect();
			window.removeEventListener("resize", place);
			document.removeEventListener("scroll", place, true);
			document.removeEventListener("pointerdown", outside);
		};
	}, [anchor, onClose]);
	return createPortal(
		<dialog
			aria-labelledby={titleId}
			className="action-popover"
			id={id}
			onToggle={toggled}
			popover="auto"
			ref={ref}
			style={{ positionAnchor: anchorName }}
		>
			<div className="action-popover-heading">
				<h2 id={titleId}>{title}</h2>
				<button
					aria-label="Close"
					className="btn ghost sm"
					onClick={onClose}
					type="button"
				>
					Close
				</button>
			</div>
			{children}
		</dialog>,
		document.body
	);
}
