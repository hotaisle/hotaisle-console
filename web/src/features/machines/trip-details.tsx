import { IMAGES } from "../../lib/prefs";
import { CloudInitLink } from "./cloud-init-link";
import { Facts } from "./facts";
import { machineLine } from "./formatting";
import { Timeline } from "./timeline";
import { TripConnection } from "./trip-connection";
import type { TripContext } from "./use-trip";

export function TripDetails({ context }: { context: TripContext }) {
	const { ssh, now, launched, vm, server, host, record } = context;
	let serverLabel = "Being assigned";
	if (server) {
		serverLabel = vm.metal ? `${server}, the whole server` : server;
	}
	return (
		<>
			<TripConnection context={context} />
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
							ssh
								? `${host}${ssh.port === 22 ? "" : `, port ${ssh.port}`}`
								: "Once it is assigned",
						],
						[
							"Image",
							<CloudInitLink key="image" record={record}>
								{IMAGES[(record?.image ?? "standard") as keyof typeof IMAGES]
									?.name ??
									(record?.image || "Standard image")}
							</CloudInitLink>,
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
