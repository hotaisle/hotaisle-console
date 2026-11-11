import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useRef } from "react";
import { HoldButton } from "../../components/ui/hold-button";
import { api } from "../../lib/api";
import type { PowerOperation } from "./power-actions";
import type { TripContext } from "./use-trip";

export function PowerActionConfirmation({
	context,
	operation,
}: {
	context: TripContext;
	operation: PowerOperation;
}) {
	const cancel = useRef<HTMLButtonElement>(null);
	const titleId = useId();
	const close = useCallback(() => context.setPanel(null), [context.setPanel]);
	useEffect(() => {
		cancel.current?.focus();
	}, []);
	const action = useMutation({
		mutationFn: async () => {
			if (operation.action === "ac-reset") {
				const power = await api.bareMetalPowerState(
					context.team.handle,
					context.vm.name
				);
				if (power.state.toLowerCase() !== "off") {
					throw new Error("Power off the server before an AC reset.");
				}
			}
			await api.power(context.team.handle, context.vm, operation.action);
		},
		onSuccess: () => {
			context.toast(
				`${operation.label} requested. Checking the server's status.`
			);
			context.onChanged();
			close();
		},
	});
	const confirm = useCallback(() => action.mutate(), [action.mutate]);
	const dismissError = useCallback(() => {
		action.reset();
		cancel.current?.focus();
	}, [action.reset]);
	return (
		<section aria-labelledby={titleId} className="sheet">
			<p className="sheet-t" id={titleId}>
				{operation.label}?
			</p>
			<p className="muted small">{operation.warning}</p>
			{action.error ? (
				<div className="error action-error" role="alert">
					<span>{action.error.message}</span>
					<button
						aria-label="Dismiss error"
						className="btn-text"
						onClick={dismissError}
						type="button"
					>
						×
					</button>
				</div>
			) : null}
			{action.isPending ? (
				<p className="muted" role="status">
					Sending the request. Please wait…
				</p>
			) : null}
			<HoldButton
				busy={action.isPending}
				busyLabel="Sending"
				label={`Hold to ${operation.label.toLowerCase()}`}
				onConfirm={confirm}
				tone="danger"
			/>
			<button
				className="btn-text sheet-x"
				disabled={action.isPending}
				onClick={close}
				ref={cancel}
				type="button"
			>
				Cancel
			</button>
		</section>
	);
}
