import { useCallback } from "react";
import { api } from "../../lib/api";

import type { TripContext } from "./use-trip";
export function TripActions({ context }: { context: TripContext }) {
	const {
		team,
		vm,
		record,
		server,
		panel,
		setPanel,
		menu,
		setMenu,
		setForce,
		busy,
		phase,
		menuRef,
		act,
		copy,
		ssh,
		host,
	} = context;

	const handleOnClick2 = useCallback(
		() =>
			act(
				"Powering on",
				() => api.power(team.handle, vm.name, "start"),
				`${vm.name} is powering on.`
			),
		[act, team, vm]
	);
	const handleOnClick3 = useCallback(() => setMenu((m) => !m), [setMenu]);
	const handleOnClick4 = useCallback(() => {
		if (!ssh) {
			return;
		}
		copy(
			`Host ${vm.name}\n  HostName ${host}\n  Port ${ssh.port}\n  User hotaisle\n`,
			"the SSH config entry"
		);
	}, [copy, vm, host, ssh]);
	const handleOnClick5 = useCallback(() => {
		if (!ssh) {
			return;
		}
		copy(
			`ssh -N -L 8000:127.0.0.1:8000 -p ${ssh.port} hotaisle@${host}`,
			"the vLLM port forward"
		);
	}, [copy, ssh, host]);
	const handleOnClick7 = useCallback(
		() =>
			act(
				"Restarting",
				() => api.power(team.handle, vm.name, "reboot"),
				`${vm.name} is restarting.`
			),
		[act, team, vm]
	);
	const handleOnClick8 = useCallback(
		() =>
			act(
				"Shutting down",
				() => api.power(team.handle, vm.name, "shutdown"),
				`${vm.name} is shutting down. It stays yours, and billed, until you end it.`
			),
		[act, team, vm]
	);
	const handleOnClick9 = useCallback(() => {
		setMenu(false);
		setPanel("rebuild");
	}, [setMenu, setPanel]);
	const handleOnClick0 = useCallback(() => {
		setPanel(panel === "end" ? null : "end");
		setForce(false);
	}, [setPanel, panel, setForce]);

	return (
		<div className="card-foot">
			<span className="card-name">
				<span
					className="mono"
					title={server ? `Runs on server ${server}` : undefined}
				>
					{vm.name}
				</span>
			</span>
			{phase === "off" && (
				<button
					className="btn"
					disabled={!!busy}
					onClick={handleOnClick2}
					type="button"
				>
					Power on
				</button>
			)}
			<div className="menu-wrap" ref={menuRef}>
				<button
					aria-expanded={menu}
					aria-haspopup="menu"
					className="btn"
					onClick={handleOnClick3}
					type="button"
				>
					More
				</button>
				{!!menu && (
					<div className="menu" role="menu">
						{!!ssh && (
							<button onClick={handleOnClick4} role="menuitem" type="button">
								Copy SSH config entry
							</button>
						)}
						{ssh && record?.image === "vllm" && (
							<button onClick={handleOnClick5} role="menuitem" type="button">
								Copy vLLM port forward
							</button>
						)}
						<span className="menu-sep" />
						{phase !== "off" && (
							<>
								<button
									disabled={phase === "building"}
									onClick={handleOnClick7}
									role="menuitem"
									type="button"
								>
									Restart
								</button>
								<button
									disabled={phase === "building"}
									onClick={handleOnClick8}
									role="menuitem"
									type="button"
								>
									Shut down
								</button>
							</>
						)}
						<button
							className="danger"
							onClick={handleOnClick9}
							role="menuitem"
							type="button"
						>
							{vm.metal ? "Reinstall from scratch…" : "Rebuild from scratch…"}
						</button>
					</div>
				)}
			</div>
			<button
				className="btn end"
				disabled={!!busy}
				onClick={handleOnClick0}
				type="button"
			>
				End
			</button>
		</div>
	);
}
