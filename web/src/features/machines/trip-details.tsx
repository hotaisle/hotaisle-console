import { CopyButton } from "../../components/ui/copy-button";
import { sshCommand } from "../../lib/format";
import { IMAGES } from "../../lib/prefs";
import { Facts } from "./facts";
import { machineLine } from "./formatting";
import { Timeline } from "./timeline";
import type { TripContext } from "./use-trip";

export function TripDetails({ context }: { context: TripContext }) {
	const { ssh, ready, now, launched, vm, server, host, record } = context;
	let serverLabel = "Being assigned";
	if (server) {
		serverLabel = vm.metal ? `${server}, the whole server` : server;
	}
	return (
		<>
			<div className="connection">
				<div className={`ssh lcd-panel ${ready ? "ready" : ""}`}>
					{ssh ? (
						<code>{sshCommand(ssh)}</code>
					) : (
						<span className="ssh-wait">The login command appears here.</span>
					)}
					{ssh ? <CopyButton text={sshCommand(ssh)} /> : null}
				</div>
				{ssh ? (
					<p className="small muted">
						Paste this command in your terminal to connect.
					</p>
				) : null}
			</div>
			<div className="run">
				{launched ? null : (
					<p className="small muted">
						Launch time is unavailable in this browser session.
					</p>
				)}
				<Timeline endLabel="Until you end it" now={now} start={launched} />
				<Facts
					rows={[
						["Server", serverLabel],
						[
							"Address",
							ssh ? `${host}, port ${ssh.port}` : "Once it is assigned",
						],
						[
							"Image",
							IMAGES[(record?.image ?? "standard") as keyof typeof IMAGES]
								?.name ??
								(record?.image || "Standard image"),
						],
						[
							"Machine",
							machineLine(vm.cpu_cores, vm.ram_capacity, vm.disk_capacity),
						],
					]}
				/>
			</div>
		</>
	);
}
