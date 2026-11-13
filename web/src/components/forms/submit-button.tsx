import type { ReactNode } from "react";
import { ButtonLabels } from "../ui/button-labels";
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
					<ButtonLabels active={pending} alternate={pendingText}>
						{children}
					</ButtonLabels>
				</button>
			)}
		</form.Subscribe>
	);
}
