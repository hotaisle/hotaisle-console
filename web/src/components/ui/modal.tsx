import { type ReactNode, useEffect, useId, useRef } from "react";

export function Modal({
	title,
	onClose,
	children,
}: {
	title: string;
	onClose: () => void;
	children: ReactNode;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) {
			return;
		}
		dialog.showModal();
		return () => dialog.close();
	}, []);
	return (
		<dialog
			aria-labelledby={titleId}
			className="scrim"
			onCancel={onClose}
			ref={ref}
		>
			<div className="modal">
				<div className="modal-h">
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
			</div>
		</dialog>
	);
}
