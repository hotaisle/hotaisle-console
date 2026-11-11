import {
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useId,
	useRef,
} from "react";
import { KeyboardScope } from "./keyboard-scope";

export function Modal({
	title,
	onClose,
	children,
	busy = false,
	initialFocus,
	descriptionId,
}: {
	title: string;
	onClose: () => void;
	children: ReactNode;
	busy?: boolean;
	initialFocus?: RefObject<HTMLElement | null>;
	descriptionId?: string;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	const cancel = useCallback(
		(event: React.SyntheticEvent<HTMLDialogElement>) => {
			if (busy) {
				event.preventDefault();
			}
		},
		[busy]
	);
	const closed = useCallback(
		(event: React.SyntheticEvent<HTMLDialogElement>) => {
			if (!event.currentTarget.open) {
				onClose();
			}
		},
		[onClose]
	);
	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) {
			return;
		}
		dialog.showModal();
		initialFocus?.current?.focus();
		return () => dialog.close();
	}, [initialFocus]);
	return (
		<KeyboardScope>
			<dialog
				aria-describedby={descriptionId}
				aria-labelledby={titleId}
				className="scrim"
				{...{ closedby: busy ? "none" : "closerequest" }}
				onCancel={cancel}
				onClose={closed}
				ref={ref}
			>
				<div className="modal">
					<div className="modal-h">
						<h2 id={titleId}>{title}</h2>
						<form method="dialog">
							<button
								aria-label="Close"
								className="btn ghost sm"
								disabled={busy}
								type="submit"
							>
								Close
							</button>
						</form>
					</div>
					{children}
				</div>
			</dialog>
		</KeyboardScope>
	);
}
