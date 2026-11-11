import { useCallback, useEffect, useRef } from "react";
import { HoldButton } from "../../components/ui/hold-button";
import { KeyboardScope } from "../../components/ui/keyboard-scope";
import { useShortcut } from "../../hooks/use-shortcut";
import { api } from "../../lib/api";
import { hoursOr } from "../../lib/format";
import { PowerActionConfirmation } from "./power-action-confirmation";

import type { TripContext } from "./use-trip";
export function TripConfirmation({ context }: { context: TripContext }) {
	if (context.panel && typeof context.panel === "object") {
		return (
			<KeyboardScope>
				<PowerActionConfirmation context={context} operation={context.panel} />
			</KeyboardScope>
		);
	}
	return (
		<KeyboardScope>
			<EndOrRebuildConfirmation context={context} />
		</KeyboardScope>
	);
}

function EndOrRebuildConfirmation({ context }: { context: TripContext }) {
	const cancel = useRef<HTMLButtonElement>(null);
	const {
		team,
		vm,
		minimumMin,
		panel,
		setPanel,
		force,
		busy,
		underMin,
		minCost,
		act,
		end,
	} = context;

	const handleOnConfirm = useCallback(
		() => end(force || underMin),
		[end, force, underMin]
	);
	const handleOnConfirm2 = useCallback(() => {
		setPanel(null);
		act(
			"Rebuilding",
			() => api.rebuild(team.handle, vm),
			`${vm.name} is rebuilding.`
		);
	}, [setPanel, act, team, vm]);
	const handleOnClick = useCallback(() => setPanel(null), [setPanel]);
	useEffect(() => {
		cancel.current?.focus({ preventScroll: true });
	}, []);
	useShortcut("Escape", handleOnClick, {
		enabled: !busy,
		meta: { name: panel === "end" ? "Keep it running" : "Cancel rebuild" },
	});
	function resolveValue() {
		if (force || underMin) {
			return `This deletes the ${vm.metal ? "server" : "machine"} and everything on its ${vm.metal ? "disks" : "disk"}. ${vm.metal ? "A server is" : "Machines are"} billed for at least ${hoursOr(minimumMin)}, so ending now costs ${minCost ? `${minCost} in total` : `the full ${hoursOr(minimumMin)}`}.`;
		}
		return `This deletes the ${vm.metal ? "server" : "machine"} and everything on its ${vm.metal ? "disks" : "disk"}, and billing stops.`;
	}
	return (
		<>
			{" "}
			{!!panel && (
				<dialog
					aria-label={panel === "end" ? "End this machine" : "Rebuild"}
					className="sheet"
					key={typeof panel === "string" ? panel : undefined}
					open
				>
					{panel === "end" && (
						<>
							<p className="sheet-t">End {vm.name}?</p>
							<p className="muted small">{resolveValue()}</p>
							<HoldButton
								busy={busy === "End"}
								busyLabel="Ending"
								label={force ? "Hold to end anyway" : "Hold to end"}
								onConfirm={handleOnConfirm}
								tone="danger"
							/>
						</>
					)}
					{panel === "rebuild" && (
						<>
							<p className="sheet-t">
								{vm.metal
									? "Reinstall the operating system?"
									: "Rebuild from a fresh image?"}
							</p>
							<p className="muted small">
								Everything on its {vm.metal ? "disks" : "disk"} is deleted. You
								keep the {vm.metal ? "server" : "machine"} and its address.
							</p>
							<HoldButton
								busy={busy === "Rebuilding"}
								busyLabel="Rebuilding"
								label="Hold to rebuild"
								onConfirm={handleOnConfirm2}
								tone="danger"
							/>
						</>
					)}
					<button
						className="btn-text sheet-x"
						disabled={!!busy}
						onClick={handleOnClick}
						ref={cancel}
						type="button"
					>
						{panel === "end" ? "Keep it running" : "Cancel"}
					</button>
				</dialog>
			)}
		</>
	);
}
