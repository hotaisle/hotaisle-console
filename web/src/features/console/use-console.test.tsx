import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
	useRouterState,
} from "@tanstack/react-router";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCallback } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { machineKey } from "../../../../shared/machine-identity";
import { TestProvider, testClient } from "../../../test/render";
import { validateSearch } from "../../app/route-state";
import { ToastHost } from "../../components/ui/toast";
import { api, type Ended, type VM as Machine, type Team } from "../../lib/api";
import { historyVault } from "../../lib/history-vault";
import { useConsole } from "./use-console";

const TEAM: Team = {
	effective_roles: ["owner"],
	handle: "lab",
	name: "Lab",
	roles: ["owner"],
};
const VM: Machine = {
	cpu_cores: 1,
	deployment_id: "vm-instance",
	disk_capacity: 1,
	gpus: [],
	ip_address: "",
	name: "shared",
	ram_capacity: 1,
	status: "ready",
};
const METAL: Machine = { ...VM, deployment_id: "metal-instance", metal: true };
const ENDED: Ended = {
	deployment_id: VM.deployment_id,
	ended_at: "2030-01-01",
	gpus: "1×",
	name: VM.name,
	team: "lab",
};
const noop = () => undefined;
let machines: Machine[];
function Probe() {
	useRouterState();
	const c = useConsole({
		onTeam: noop,
		status: {
			email_login: true,
			passkeys: false,
			signed_in: true,
			version: "test",
		},
		team: TEAM,
		teams: [TEAM],
	});
	const selectVM = useCallback(
		() => c.focusMachine(machineKey("lab", VM)),
		[c.focusMachine]
	);
	const selectMetal = useCallback(
		() => c.focusMachine(machineKey("lab", METAL)),
		[c.focusMachine]
	);
	const endVM = useCallback(async () => {
		await api.release("lab", VM);
		await c.onEnded(ENDED);
	}, [c.onEnded]);
	const launchVM = useCallback(
		() => c.onLaunched(VM, { image: "standard", price: 299 }),
		[c.onLaunched]
	);
	return (
		<main>
			<output data-testid="selection">{c.focusedKey ?? "none"}</output>
			<output data-testid="list">
				{c.list.map((vm) => machineKey("lab", vm)).join(";")}
			</output>
			<output data-testid="states">{JSON.stringify(c.states)}</output>
			<output data-testid="records">{JSON.stringify(c.recByIdentity)}</output>
			<output data-testid="history">{JSON.stringify(c.history)}</output>
			<output data-testid="run">
				{c.run ? machineKey("lab", c.run) : "none"}
			</output>
			<output data-testid="run-error">{c.runError?.message}</output>
			<output data-testid="error">{c.selectionError}</output>
			<button onClick={selectVM} type="button">
				Select VM
			</button>
			<button onClick={selectMetal} type="button">
				Select bare metal
			</button>
			<button onClick={endVM} type="button">
				End VM
			</button>
			<button onClick={launchVM} type="button">
				Launch VM
			</button>
		</main>
	);
}
async function open(path: string) {
	const root = createRootRoute({ component: Probe, validateSearch });
	const paths = [
		"/teams/$team/machines",
		"/teams/$team/machines/$machine",
		"/teams/$team/machines/$kind/$machine",
		"/teams/$team/history/$run",
		"/teams/$team/history/$kind/$run",
	] as const;
	const routeTree = root.addChildren(
		paths.map((routePath) =>
			createRoute({ getParentRoute: () => root, path: routePath })
		)
	);
	const history = createMemoryHistory({ initialEntries: [path] });
	const router = createRouter({ history, routeTree });
	const navigate = router.navigate.bind(router);
	vi.spyOn(router, "navigate").mockImplementation((options) => {
		if (vi.mocked(router.navigate).mock.calls.length > 20) {
			throw new Error("Machine selection kept navigating.");
		}
		return navigate(options);
	});
	const rendered = render(
		<TestProvider>
			<ToastHost>
				<RouterProvider router={router} />
			</ToastHost>
		</TestProvider>
	);
	await router.load();
	await waitFor(() =>
		expect(screen.getByTestId("list")).not.toBeEmptyDOMElement()
	);
	return { ...rendered, history, router };
}
beforeEach(() => {
	machines = [VM, METAL];
	vi.spyOn(api, "vms").mockImplementation(async () => [...machines]);
	vi.spyOn(api, "offers").mockResolvedValue([]);
	vi.spyOn(api, "balance").mockResolvedValue({
		available_balance: 0,
		bare_metal_server_count: 1,
		hourly_rate: 0,
		virtual_machine_count: 1,
	});
	vi.spyOn(api, "keys").mockResolvedValue([]);
	vi.spyOn(api, "vmState").mockImplementation(async (_team, vm) => ({
		host: vm.metal ? "metal-host" : "vm-host",
		state: vm.metal ? "off" : "running",
	}));
	vi.spyOn(api, "release").mockImplementation((_team, vm) => {
		machines = machines.filter(
			(item) => machineKey("lab", item) !== machineKey("lab", vm)
		);
		return Promise.resolve();
	});
});
describe("composite machine identity in the console", () => {
	it("selects and releases one of two same-name VMs by deployment ID", async () => {
		const other = { ...VM, deployment_id: "vm-second" };
		machines = [VM, other];
		await open("/teams/lab/machines/virtual_machines/vm-second");
		expect(screen.getByTestId("selection")).toHaveTextContent(
			machineKey("lab", other)
		);
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: "End VM" }));
		await waitFor(() =>
			expect(screen.getByTestId("list").textContent).toBe(
				machineKey("lab", other)
			)
		);
		expect(screen.getByTestId("selection")).toHaveTextContent(
			machineKey("lab", other)
		);
	});
	it("does not resolve a stale deployment URL to a newly rented machine with the same name", async () => {
		machines = [{ ...VM, deployment_id: "new-rental" }];
		await open("/teams/lab/machines/virtual_machines/vm-instance");
		expect(screen.getByTestId("selection")).toHaveTextContent("none");
		expect(screen.getByTestId("error")).toHaveTextContent("not available");
	});
	it("separates polling and URL selection and restores each kind through back and reload", async () => {
		const user = userEvent.setup();
		const first = await open("/teams/lab/machines/bare_metal/metal-instance");
		expect(screen.getByTestId("selection")).toHaveTextContent(
			machineKey("lab", METAL)
		);
		await waitFor(() =>
			expect(screen.getByTestId("states")).toHaveTextContent("vm-host")
		);
		expect(screen.getByTestId("states")).toHaveTextContent("metal-host");
		expect(
			testClient.getQueryData([
				"resource",
				"vm-state",
				"lab",
				false,
				"vm-instance",
			])
		).toMatchObject({ state: "running" });
		expect(
			testClient.getQueryData([
				"resource",
				"vm-state",
				"lab",
				true,
				"metal-instance",
			])
		).toMatchObject({ state: "off" });
		await user.click(screen.getByRole("button", { name: "Select VM" }));
		await waitFor(() =>
			expect(first.history.location.pathname).toBe(
				"/teams/lab/machines/virtual_machines/vm-instance"
			)
		);
		expect(screen.getByTestId("selection")).toHaveTextContent(
			machineKey("lab", VM)
		);
		await act(async () => first.history.back());
		await waitFor(() =>
			expect(screen.getByTestId("selection")).toHaveTextContent(
				machineKey("lab", METAL)
			)
		);
		const path = first.history.location.pathname;
		first.unmount();
		await open(path);
		expect(screen.getByTestId("selection")).toHaveTextContent(
			machineKey("lab", METAL)
		);
	});
	it("ends and relaunches a VM without removing its same-name bare-metal counterpart or launch record", async () => {
		historyVault.record({
			metal: true,
			name: "shared",
			price_cents: 2392,
			team: "lab",
		});
		const user = userEvent.setup();
		await open("/teams/lab/machines/virtual_machines/vm-instance");
		await user.click(screen.getByRole("button", { name: "End VM" }));
		await waitFor(() =>
			expect(screen.getByTestId("list").textContent).toBe(
				machineKey("lab", METAL)
			)
		);
		expect(api.release).toHaveBeenCalledWith("lab", VM);
		expect(screen.getByTestId("records")).toHaveTextContent("2392");
		machines = [METAL, VM];
		await user.click(screen.getByRole("button", { name: "Launch VM" }));
		await waitFor(() =>
			expect(screen.getByTestId("list")).toHaveTextContent(
				machineKey("lab", VM)
			)
		);
		expect(screen.getByTestId("list")).toHaveTextContent(
			machineKey("lab", METAL)
		);
		expect(screen.getByTestId("records")).toHaveTextContent("2392");
		expect(screen.getByTestId("records")).toHaveTextContent("299");
	});
	it("does not guess a kind for an ambiguous legacy link or select an unrelated missing resource", async () => {
		const rendered = await open("/teams/lab/machines/shared");
		expect(screen.getByTestId("selection")).toHaveTextContent("none");
		expect(screen.getByTestId("error")).toHaveTextContent(
			"more than one machine"
		);
		await act(async () =>
			rendered.router.navigate({ to: "/teams/lab/machines/bare_metal/missing" })
		);
		expect(screen.getByTestId("selection")).toHaveTextContent("none");
		expect(screen.getByTestId("error")).toHaveTextContent("not available");
	});
	it("upgrades an unambiguous legacy link to a canonical typed URL", async () => {
		machines = [METAL];
		const rendered = await open("/teams/lab/machines/shared");
		await waitFor(() =>
			expect(rendered.history.location.pathname).toBe(
				"/teams/lab/machines/bare_metal/metal-instance"
			)
		);
		expect(screen.getByTestId("selection")).toHaveTextContent(
			machineKey("lab", METAL)
		);
		expect(rendered.router.navigate).toHaveBeenCalledOnce();
	});
	it("keeps same-name history links distinct and rejects ambiguous legacy run links", async () => {
		historyVault.rememberEnd(ENDED);
		historyVault.rememberEnd({
			...ENDED,
			deployment_id: METAL.deployment_id,
			metal: true,
		});
		const rendered = await open("/teams/lab/history/bare_metal/metal-instance");
		expect(screen.getByTestId("run")).toHaveTextContent(
			machineKey("lab", METAL)
		);
		await act(async () =>
			rendered.router.navigate({
				to: "/teams/lab/history/virtual_machines/vm-instance",
			})
		);
		expect(screen.getByTestId("run")).toHaveTextContent(machineKey("lab", VM));
		await act(async () =>
			rendered.router.navigate({ to: "/teams/lab/history/shared" })
		);
		expect(screen.getByTestId("run")).toHaveTextContent("none");
		expect(screen.getByTestId("run-error")).toHaveTextContent(
			"more than one run"
		);
	});
	it("upgrades legacy history links when the resource kind is unambiguous", async () => {
		historyVault.rememberEnd({
			...ENDED,
			deployment_id: METAL.deployment_id,
			metal: true,
		});
		const rendered = await open("/teams/lab/history/shared");
		await waitFor(() =>
			expect(rendered.history.location.pathname).toBe(
				"/teams/lab/history/bare_metal/metal-instance"
			)
		);
		expect(screen.getByTestId("run")).toHaveTextContent(
			machineKey("lab", METAL)
		);
		expect(rendered.router.navigate).toHaveBeenCalledOnce();
	});
});
