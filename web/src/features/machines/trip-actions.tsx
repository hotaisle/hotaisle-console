import { useCallback, useId, useRef, useState } from "react";
import { MachineOperations } from "./machine-operations";
import type { TripContext } from "./use-trip";

export function TripActions({ context }: { context: TripContext }) {
	const [operations, setOperations] = useState(false);
	const trigger = useRef<HTMLButtonElement>(null);
	const operationsId = useId();
	const anchorName = `--machine-actions-${operationsId.replaceAll(":", "")}`;
	const canOperate = context.team.effective_roles.some(
		(role) => role === "operator" || role === "owner"
	);
	const openOperations = useCallback(() => setOperations((open) => !open), []);
	const closeOperations = useCallback(() => setOperations(false), []);
	const end = useCallback(() => {
		context.setForce(false);
		context.setPanel("end");
	}, [context.setForce, context.setPanel]);
	if (!canOperate) {
		return null;
	}
	return (
		<div className="card-foot">
			<div className="menu-wrap">
				<button
					aria-controls={operationsId}
					aria-expanded={operations}
					aria-haspopup="dialog"
					className="btn"
					onClick={openOperations}
					ref={trigger}
					style={{ anchorName }}
					type="button"
				>
					More
				</button>
			</div>
			{canOperate ? (
				<button
					className="btn end"
					disabled={!!context.busy}
					onClick={end}
					type="button"
				>
					End
				</button>
			) : null}
			{operations ? (
				<MachineOperations
					anchor={trigger}
					anchorName={anchorName}
					context={context}
					id={operationsId}
					onClose={closeOperations}
				/>
			) : null}
		</div>
	);
}
