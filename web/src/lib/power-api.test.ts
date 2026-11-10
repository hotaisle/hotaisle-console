import { afterEach, describe, expect, it, vi } from "vitest";
import { api, type PowerAction } from "./api";

afterEach(() => vi.unstubAllGlobals());
describe("bare-metal power API", () => {
	it.each(["start", "reboot", "hard-reset"] as const)(
		"routes VM %s to the matching VM endpoint",
		async (action) => {
			const fetcher = vi
				.fn()
				.mockResolvedValue(new Response(null, { status: 204 }));
			vi.stubGlobal("fetch", fetcher);
			await api.power("lab", "vm-fixture", action);
			expect(fetcher).toHaveBeenCalledWith(
				`/api/teams/lab/virtual_machines/vm-fixture/${action}/`,
				expect.objectContaining({ method: "POST" })
			);
		}
	);
	it("rejects VM power actions without sending legacy endpoint requests", async () => {
		const fetcher = vi.fn();
		vi.stubGlobal("fetch", fetcher);
		await expect(api.power("lab", "vm-fixture", "shutdown")).rejects.toThrow(
			"This power operation is not available for virtual machines."
		);
		expect(fetcher).not.toHaveBeenCalled();
	});
	it("keeps the bare-metal power endpoint", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(Response.json([]))
			.mockResolvedValueOnce(
				Response.json([{ gpus: [], name: "power-test-server" }])
			)
			.mockResolvedValueOnce(new Response(null, { status: 204 }));
		vi.stubGlobal("fetch", fetcher);
		await api.vms("lab");
		await api.power("lab", "power-test-server", "shutdown");
		expect(fetcher).toHaveBeenLastCalledWith(
			"/api/teams/lab/bare_metal/power-test-server/power/graceful_shutdown/",
			expect.objectContaining({ method: "POST" })
		);
	});
	it.each([
		["start", "power_on"],
		["shutdown", "graceful_shutdown"],
		["stop", "force_shutdown"],
		["reboot", "warm_reboot"],
		["hard-reset", "cold_reboot"],
		["ac-reset", "ac_reset"],
	] satisfies [PowerAction, string][])(
		"routes bare-metal %s to %s",
		async (action, endpoint) => {
			const fetcher = vi
				.fn()
				.mockResolvedValueOnce(Response.json([]))
				.mockResolvedValueOnce(
					Response.json([{ gpus: [], name: "power-mapping-server" }])
				)
				.mockResolvedValueOnce(new Response(null, { status: 204 }));
			vi.stubGlobal("fetch", fetcher);
			await api.vms("lab");
			await api.power("lab", "power-mapping-server", action);
			expect(fetcher).toHaveBeenLastCalledWith(
				`/api/teams/lab/bare_metal/power-mapping-server/power/${endpoint}/`,
				expect.objectContaining({ method: "POST" })
			);
		}
	);
	it("does not report ready when the BMC power state cannot be read", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValueOnce(Response.json([]))
				.mockResolvedValueOnce(
					Response.json([{ gpus: [], name: "power-unknown-server" }])
				)
				.mockResolvedValueOnce(
					Response.json({ os_status: { os_install_status: "installed" } })
				)
				.mockResolvedValueOnce(new Response("BMC unavailable", { status: 503 }))
		);
		await api.vms("lab");
		expect((await api.vmState("lab", "power-unknown-server")).state).toBe(
			"unknown"
		);
	});
});
