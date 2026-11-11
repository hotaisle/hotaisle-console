import { describe, expect, it, vi } from "vitest";
import { machineKey } from "../../shared/machine-identity";
import { api } from "../src/lib/api";
import { PreviewAPI } from "./api";

function setup(scenario: "bare-metal" | "same-name" = "bare-metal") {
	let now = Date.parse("2026-11-10T12:00:00Z");
	const preview = new PreviewAPI(scenario, () => now);
	vi.stubGlobal("fetch", (path: string, init?: RequestInit) =>
		preview.fetch(
			new Request(new URL(path, "http://preview.localhost:8787"), init)
		)
	);
	return {
		advance: (ms: number) => {
			now += ms;
		},
		preview,
	};
}

describe("bare-metal preview through the console API", () => {
	it("keeps same-name VM and bare-metal operations independent", async () => {
		const { preview } = setup("same-name");
		const machines = await api.vms("preview");
		expect(machines).toHaveLength(2);
		const vm = machines.find((item) => !item.metal);
		const metal = machines.find((item) => item.metal);
		if (!(vm && metal)) {
			throw new Error("Expected both resource kinds");
		}
		expect(vm.name).toBe(metal.name);
		expect(Object.keys(preview.initialRecords().machines)).toHaveLength(2);
		await api.power("preview", metal, "shutdown");
		expect((await api.vmState("preview", metal)).state).toBe("off");
		expect((await api.vmState("preview", vm)).state).toBe("running");
		await api.release("preview", vm, true);
		expect(await api.vms("preview")).toEqual([metal]);
	});
	it("shows an assigned eight-GPU server with SSH and a matching balance", async () => {
		const { preview } = setup();
		const machines = await api.vms("preview");
		expect(machines).toHaveLength(1);
		const [server] = machines;
		expect(server).toMatchObject({
			gpus: [{ count: 8, manufacturer: "AMD", model: "MI300X" }],
			metal: true,
			name: "preview-bare-metal",
			ssh_access: { dns_name: "preview-bare-metal.invalid", port: 22 },
		});
		expect(await api.vmState("preview", server)).toMatchObject({
			host: server.name,
			state: "running",
		});
		expect(await api.balance("preview")).toMatchObject({
			bare_metal_server_count: 1,
			hourly_rate: 2392,
			virtual_machine_count: 0,
		});
		expect(
			preview.initialRecords().machines[machineKey("preview", server)]
		).toMatchObject({
			image: "standard",
			metal: true,
			price_cents: 2392,
		});
	});
	it("simulates power, reinstall and a local console URL", async () => {
		const { advance } = setup();
		const [server] = await api.vms("preview");
		await expect(api.power("preview", server, "ac-reset")).rejects.toThrow(
			"Power off the server first."
		);
		await api.power("preview", server, "shutdown");
		expect((await api.vmState("preview", server)).state).toBe("off");
		await api.power("preview", server, "ac-reset");
		await api.power("preview", server, "start");
		expect((await api.vmState("preview", server)).state).toBe("running");
		await api.rebuild("preview", server);
		expect((await api.vmState("preview", server)).state).toBe("installing");
		advance(8000);
		expect((await api.vmState("preview", server)).state).toBe("running");
		expect(await api.bareMetalConsole("preview", server.name)).toEqual({
			url: "http://preview.localhost:8787/__preview/console.html",
		});
	});
	it.each([false, true])(
		"releases with the minimum satisfied or confirmed: %s",
		async (force) => {
			const { advance } = setup();
			const [server] = await api.vms("preview");
			await expect(api.release("preview", server)).rejects.toThrow(
				"eight-hour minimum"
			);
			if (!force) {
				advance(8 * 3_600_000);
			}
			await api.release("preview", server, force);
			expect(await api.vms("preview")).toEqual([]);
			expect(await api.balance("preview")).toMatchObject({
				bare_metal_server_count: 0,
				hourly_rate: 0,
			});
		}
	);
});
