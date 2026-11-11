import { specs } from "./machines";

const json = (data: unknown, status = 200) =>
	Response.json(data, { headers: { "Cache-Control": "no-store" }, status });
const fail = (status: number, message: string) => json({ message }, status);

/** Memory-only hardware fixture. This never opens a real console or contacts a BMC. */
export class BareMetalPreview {
	readonly deployment_id = "preview-metal-deployment";
	readonly name = "preview-bare-metal";
	private releasedAt?: number;
	private power = "On";
	private installingSince?: number;
	private readonly now: () => number;
	private readonly assignedAt: number;
	constructor(now: () => number) {
		this.now = now;
		this.assignedAt = now() - 38 * 60_000;
	}
	get assigned() {
		return this.releasedAt === undefined;
	}
	private details() {
		const machine = specs(8);
		return {
			...machine,
			cpus: [machine.cpus],
			deployment_id: this.deployment_id,
			name: this.name,
			os_status: {
				os_install_status:
					this.installingSince !== undefined &&
					this.now() - this.installingSince < 8000
						? "installing_os"
						: "installed",
			},
			ssh_access: {
				dns_name: `${this.name}.invalid`,
				ip_address: "192.0.2.80",
				port: 22,
			},
		};
	}
	request(request: Request, url: URL, parts: string[]) {
		const [, name, area, action] = parts;
		if (request.method === "GET") {
			return this.read(name, area);
		}
		if ((name !== this.name && name !== this.deployment_id) || !this.assigned) {
			return fail(404, "This preview server no longer exists.");
		}
		if (request.method === "DELETE" && !area) {
			if (
				this.now() - this.assignedAt < 8 * 3_600_000 &&
				url.searchParams.get("force") !== "true"
			) {
				return fail(
					409,
					"This preview server is inside its eight-hour minimum reservation."
				);
			}
			this.releasedAt = this.now();
			return new Response(null, { status: 204 });
		}
		if (request.method !== "POST") {
			return fail(405, "Method not allowed");
		}
		if (area === "console") {
			return json({
				url: new URL("/__preview/console.html", url.origin).href,
			});
		}
		if (area === "reinstall") {
			this.installingSince = this.now();
			this.power = "On";
			return json(this.details());
		}
		if (area !== "power") {
			return fail(501, "This server action is not simulated.");
		}
		return this.powerRequest(action);
	}
	private read(name?: string, area?: string) {
		if (!name) {
			return json(this.assigned ? [this.details()] : []);
		}
		if (name === "available") {
			return json([]);
		}
		if ((name !== this.name && name !== this.deployment_id) || !this.assigned) {
			return fail(404, "This preview server no longer exists.");
		}
		if (area === "power") {
			return json({ state: this.power });
		}
		return area
			? fail(501, "This endpoint is not simulated.")
			: json(this.details());
	}
	private powerRequest(action: string) {
		if (action === "ac_reset" && this.power !== "Off") {
			return fail(409, "Power off the server first.");
		}
		if (action === "graceful_shutdown" || action === "force_shutdown") {
			this.power = "Off";
		} else if (
			action === "power_on" ||
			action === "warm_reboot" ||
			action === "cold_reboot"
		) {
			this.power = "On";
		} else if (action !== "ac_reset") {
			return fail(501, "This power action is not simulated.");
		}
		return new Response(null, { status: 204 });
	}
}
