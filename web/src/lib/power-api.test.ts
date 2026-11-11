import { afterEach, describe, expect, it, vi } from "vitest";
import { api, type PowerAction } from "./api";

afterEach(() => vi.unstubAllGlobals());
describe("bare-metal power API", () => {
	it.each([false, true])(
		"uses the deployment ID for state, power, rebuild and release for metal=%s",
		async (metal) => {
			const fetcher = vi.fn().mockImplementation(() =>
				Promise.resolve(
					Response.json({
						os_status: { os_install_status: "installed" },
						state: "On",
					})
				)
			);
			vi.stubGlobal("fetch", fetcher);
			const vm = { deployment_id: "rental-id", metal, name: "display-name" };
			await api.vmState("lab", vm);
			await api.power("lab", vm, "reboot");
			await api.rebuild("lab", vm);
			await api.release("lab", vm);
			expect(fetcher.mock.calls.map(([path]) => path)).toEqual(
				metal
					? [
							"/api/teams/lab/bare_metal/rental-id/",
							"/api/teams/lab/bare_metal/rental-id/power/",
							"/api/teams/lab/bare_metal/rental-id/power/warm_reboot/",
							"/api/teams/lab/bare_metal/rental-id/reinstall/",
							"/api/teams/lab/bare_metal/rental-id/",
						]
					: [
							"/api/teams/lab/virtual_machines/rental-id/state/",
							"/api/teams/lab/virtual_machines/rental-id/reboot/",
							"/api/teams/lab/virtual_machines/rental-id/rebuild/",
							"/api/teams/lab/virtual_machines/rental-id/",
						]
			);
		}
	);
	it("keeps same-name VMs and bare-metal servers as distinct API resources", async () => {
		const machine = { gpus: [], name: "shared-name" };
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValueOnce(Response.json([machine]))
				.mockResolvedValueOnce(Response.json([machine]))
		);
		const list = await api.vms("lab");
		expect(list).toHaveLength(2);
		expect(list[0]).toMatchObject({ name: "shared-name" });
		expect(list[0].metal).toBeFalsy();
		expect(list[1]).toMatchObject({ metal: true, name: "shared-name" });
	});
	it.each(["start", "reboot", "hard-reset"] as const)(
		"routes VM %s to the matching VM endpoint",
		async (action) => {
			const fetcher = vi
				.fn()
				.mockResolvedValue(new Response(null, { status: 204 }));
			vi.stubGlobal("fetch", fetcher);
			await api.power("lab", { metal: false, name: "vm-fixture" }, action);
			expect(fetcher).toHaveBeenCalledWith(
				`/api/teams/lab/virtual_machines/vm-fixture/${action}/`,
				expect.objectContaining({ method: "POST" })
			);
		}
	);
	it("rejects VM power actions without sending legacy endpoint requests", async () => {
		const fetcher = vi.fn();
		vi.stubGlobal("fetch", fetcher);
		await expect(
			api.power("lab", { metal: false, name: "vm-fixture" }, "shutdown")
		).rejects.toThrow(
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
		await api.power(
			"lab",
			{ metal: true, name: "power-test-server" },
			"shutdown"
		);
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
			await api.power(
				"lab",
				{ metal: true, name: "power-mapping-server" },
				action
			);
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
		expect(
			(
				await api.vmState("lab", {
					metal: true,
					name: "power-unknown-server",
				})
			).state
		).toBe("unknown");
	});
	it("routes same-name resources by the selected machine kind", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(new Response(null, { status: 204 }));
		vi.stubGlobal("fetch", fetcher);
		const vm = { metal: false, name: "shared-name" };
		const server = { metal: true, name: "shared-name" };
		await api.release("lab", vm);
		await api.release("lab", server);
		expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
			"/api/teams/lab/virtual_machines/shared-name/",
			"/api/teams/lab/bare_metal/shared-name/",
		]);
	});
});
