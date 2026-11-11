import type { ReactNode } from "react";
import { useFormContext } from "./form-context";

const submitting = (state: { isSubmitting: boolean }) => state.isSubmitting;

export function SubmitButton({
	children,
	pendingText,
	className = "btn primary",
	disabled = false,
}: {
	children: ReactNode;
	pendingText: string;
	className?: string;
	disabled?: boolean;
}) {
	const form = useFormContext();
	return (
		<form.Subscribe selector={submitting}>
			{(pending) => (
				<button
					aria-busy={pending}
					className={className}
					disabled={disabled || pending}
					type="submit"
				>
					<span className="submit-labels">
						<span aria-hidden={pending}>{children}</span>
						<span aria-hidden={!pending}>{pendingText}</span>
					</span>
				</button>
			)}
		</form.Subscribe>
	);
}
