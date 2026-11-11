import { type RefObject, useCallback, useId } from "react";
import { machineAddress } from "../../../../shared/machine-identity";
import { AnchoredPopover } from "../../components/ui/anchored-popover";
import { ConnectionActions } from "./connection-actions";
import { ConsoleLink } from "./console-link";
import {
	METAL_POWER_OPERATIONS,
	type PowerOperation,
	VM_POWER_OPERATIONS,
} from "./power-actions";
import type { TripContext } from "./use-trip";

function Operation({
	label,
	description,
	disabled = false,
	onClick,
}: {
	label: string;
	description: string;
	disabled?: boolean;
	onClick: () => void;
}) {
	const descriptionId = useId();
	return (
		<button
			aria-describedby={descriptionId}
			aria-label={label}
			className="operation"
			disabled={disabled}
			onClick={onClick}
			type="button"
		>
			<strong>{label}</strong>
			<span id={descriptionId}>{description}</span>
		</button>
	);
}

function PowerOperationButton({
	operation,
	onSelect,
}: {
	operation: PowerOperation;
	onSelect: (operation: PowerOperation) => void;
}) {
	const choose = useCallback(() => onSelect(operation), [onSelect, operation]);
	return (
		<Operation
			description={operation.description}
			label={operation.label}
			onClick={choose}
		/>
	);
}

export function MachineOperations({
	anchor,
	anchorName,
	id,
	context,
	onClose,
}: {
	anchor: RefObject<HTMLButtonElement | null>;
	anchorName: string;
	id: string;
	context: TripContext;
	onClose: () => void;
}) {
	const { vm, team, phase, setPanel, setForce } = context;
	const canOperate = team.effective_roles.some(
		(role) => role === "operator" || role === "owner"
	);
	const confirmRebuild = useCallback(() => {
		onClose();
		setPanel("rebuild");
	}, [onClose, setPanel]);
	const confirmRelease = useCallback(() => {
		onClose();
		setForce(false);
		setPanel("end");
	}, [onClose, setPanel, setForce]);
	const confirmPower = useCallback(
		(operation: PowerOperation) => {
			onClose();
			setPanel(operation);
		},
		[onClose, setPanel]
	);
	const operations = (
		vm.metal ? METAL_POWER_OPERATIONS : VM_POWER_OPERATIONS
	).filter((operation) =>
		operation.action === "start" || operation.action === "ac-reset"
			? phase === "off"
			: phase === "running"
	);
	return (
		<AnchoredPopover
			anchor={anchor}
			anchorName={anchorName}
			id={id}
			onClose={onClose}
			title={vm.metal ? "Server operations" : "VM operations"}
		>
			<div className="operations">
				{canOperate && (
					<>
						{vm.metal ? (
							<ConsoleLink
								onOpen={onClose}
								server={machineAddress(vm)}
								team={team.handle}
							/>
						) : null}
						{operations.map((operation) => (
							<PowerOperationButton
								key={operation.action}
								onSelect={confirmPower}
								operation={operation}
							/>
						))}
						{phase !== "building" && phase !== "releasing" ? (
							<Operation
								description="Deletes all data and reinstalls from a fresh image."
								label={vm.metal ? "Wipe and reinstall" : "Rebuild VM"}
								onClick={confirmRebuild}
							/>
						) : null}
						<Operation
							description="Permanently deletes its data and stops billing. Minimum charges still apply."
							label={vm.metal ? "Release server" : "Delete VM"}
							onClick={confirmRelease}
						/>
					</>
				)}
			</div>
			{canOperate && context.ready && context.ssh ? (
				<ConnectionActions context={context} />
			) : null}
		</AnchoredPopover>
	);
}
