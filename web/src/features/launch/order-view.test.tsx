import {
	createBrowserHistory,
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterContextProvider,
	RouterProvider,
	useRouterState,
} from "@tanstack/react-router";
import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { validateSearch } from "../../app/route-state";
import { createAppRouter } from "../../app/router";
import { ToastHost } from "../../components/ui/toast";
import type { Offer } from "../../lib/api";
import { api } from "../../lib/api";
import { signal } from "../../lib/signal";
import { offerKey } from "./offers";
import { OrderView } from "./order-view";
import { useOrder } from "./use-order";

const OFFER: Offer = {
	MinimumReservationMinutes: 30,
	OnDemandPrice: 300,
	Quantity: 2,
	Specs: {
		cpu_cores: 16,
		disk_capacity: 100,
		gpus: [{ count: 1, model: "MI300X" }],
		ram_capacity: 64,
	},
};
function makeProps(overrides: Partial<ComponentProps<typeof OrderView>> = {}) {
	const props: ComponentProps<typeof OrderView> = {
		balance: {
			available_balance: 50_000,
			bare_metal_server_count: 0,
			hourly_rate: 0,
			virtual_machine_count: 0,
		},
		hold: signal(0),
		keys: [
			{
				fingerprint: "fixture",
				public_key: "ssh-ed25519 fixture",
				type: "ssh-ed25519",
			},
		],
		offers: [OFFER],
		onAddCredits: vi.fn(),
		onImage: vi.fn(),
		onLaunched: vi.fn(),
		onRefreshOffers: vi.fn().mockResolvedValue(undefined),
		order: { count: 1, customURL: "", image: "standard" },
		setOrder: vi.fn(),
		team: {
			effective_roles: ["owner"],
			handle: "lab",
			name: "Lab",
			roles: ["owner"],
		},
		vmCount: 0,
		...overrides,
	};
	return props;
}
function open(overrides: Partial<ComponentProps<typeof OrderView>> = {}) {
	const props = makeProps(overrides);
	render(
		<RouterContextProvider
			router={createAppRouter(
				createMemoryHistory({ initialEntries: ["/teams/lab/launch"] })
			)}
		>
			<ToastHost>
				<OrderView {...props} />
			</ToastHost>
		</RouterContextProvider>
	);
	return props;
}
function RoutedOrderView({ offers }: { offers?: () => Offer[] }) {
	useRouterState();
	const { order, setOrder } = useOrder();
	// Query updates can deliver new offer arrays while a fallback navigation is pending.
	const props = makeProps({
		offers: offers?.() ?? [
			{ ...OFFER, Specs: { ...OFFER.Specs, gpus: [{ count: 2 }] } },
		],
		order,
		setOrder,
	});
	return <OrderView {...props} />;
}
function openRouted(path: string, browser = false, offers?: () => Offer[]) {
	const root = createRootRoute({ component: Outlet, validateSearch });
	const route = createRoute({
		component: () => <RoutedOrderView offers={offers} />,
		getParentRoute: () => root,
		path: "/teams/$team/launch",
	});
	if (browser) {
		window.history.replaceState(null, "", path);
	}
	const router = createRouter({
		history: browser
			? createBrowserHistory()
			: createMemoryHistory({ initialEntries: [path] }),
		routeTree: root.addChildren([route]),
	});
	const navigate = router.navigate.bind(router);
	vi.spyOn(router, "navigate").mockImplementation((options) => {
		if (vi.mocked(router.navigate).mock.calls.length > 20) {
			throw new Error("Launch kept navigating.");
		}
		return navigate(options);
	});
	render(
		<ToastHost>
			<RouterProvider router={router} />
		</ToastHost>
	);
	return router;
}
const HOLD = /Hold to launch/u;
const HOLD_TWO = /Hold to launch 2×/u;
const CORES_64 = /64 cores/u;
const CORES_104 = /104 cores/u;
const HOLD_METAL = /Hold to reserve/u;
const HOLD_ANY = /Hold to (?:reserve|launch)/u;
describe("rental availability and credits", () => {
	it("selects and reserves one exact bare-metal class across URL navigation and inventory refreshes", async () => {
		const classes = [64, 104].map(
			(cores, index): Offer => ({
				...OFFER,
				MinimumReservationMinutes: 480,
				metal: true,
				OnDemandPrice: 2700 + index * 100,
				rawSpecs: { cpu_cores: cores, gpus: [{ count: 8, model: "MI300X" }] },
				Specs: {
					...OFFER.Specs,
					cpu_cores: cores,
					gpus: [{ count: 8, model: "MI300X" }],
				},
			})
		);
		let inventory = classes;
		const router = openRouted(
			"/teams/lab/launch?gpus=8",
			false,
			() => inventory
		);
		const user = userEvent.setup();
		const first = await screen.findByRole("radio", { name: CORES_64 });
		const second = screen.getByRole("radio", { name: CORES_104 });
		expect(first).toBeChecked();
		expect(second).not.toBeChecked();
		await user.click(second);
		await waitFor(() =>
			expect(router.state.location.search.offer).toBe(offerKey(classes[1]))
		);
		expect(first).not.toBeChecked();
		expect(second).toBeChecked();
		expect(
			within(screen.getByRole("region", { name: "Estimate" })).getByText(
				"$28.00"
			)
		).toBeInTheDocument();

		inventory = [
			{ ...classes[1], OnDemandPrice: 2900, Quantity: 1 },
			classes[0],
		];
		await act(async () => {
			await router.navigate({
				search: { ...router.state.location.search, image: "vllm" },
				to: "/teams/lab/launch",
			});
		});
		expect(screen.getByRole("radio", { name: CORES_104 })).toBeChecked();
		expect(screen.getByRole("radio", { name: CORES_64 })).not.toBeChecked();
		const savedSearch = { ...router.state.location.search };
		await user.click(screen.getByRole("radio", { name: CORES_64 }));
		await act(async () => {
			await router.navigate({ search: savedSearch, to: "/teams/lab/launch" });
		});
		expect(screen.getByRole("radio", { name: CORES_104 })).toBeChecked();

		const reserve = vi
			.spyOn(api, "reserve")
			.mockReturnValue(new Promise(() => undefined));
		vi.useFakeTimers();
		try {
			const button = screen.getByRole("button", { name: HOLD_METAL });
			button.focus();
			fireEvent.keyDown(button, { code: "Enter", key: "Enter" });
			await act(async () => {
				await vi.advanceTimersByTimeAsync(850);
			});
			expect(reserve).toHaveBeenCalledExactlyOnceWith("lab", inventory[0]);
			fireEvent.keyUp(button, { code: "Enter", key: "Enter" });
		} finally {
			vi.useRealTimers();
		}
	});
	it.each([false, true])(
		"does not substitute another class when the selected class is unavailable (removed: %s)",
		(removed) => {
			const chosen = { ...OFFER, metal: true };
			const other = {
				...OFFER,
				metal: true,
				Specs: { ...OFFER.Specs, cpu_cores: 104 },
			};
			open({
				offers: removed ? [other] : [{ ...chosen, Quantity: 0 }, other],
				order: {
					count: 1,
					customURL: "",
					image: "standard",
					offer: offerKey(chosen),
				},
			});
			expect(
				screen
					.getAllByRole("radio")
					.filter((radio) => (radio as HTMLInputElement).checked)
			).toHaveLength(removed ? 0 : 1);
			expect(screen.getByRole("radio", { name: CORES_104 })).not.toBeChecked();
			expect(screen.getByRole("button", { name: HOLD_ANY })).toBeDisabled();
		}
	);
	it("settles the automatic size fallback when offers are freshly derived during navigation", async () => {
		const router = openRouted("/teams/lab/launch?gpus=1");
		await screen.findByRole("button", { name: HOLD_TWO });
		expect(router.state.location.search.gpus).toBe(2);
		expect(router.navigate).toHaveBeenCalledOnce();
		await act(async () => {
			await router.navigate({ search: { gpus: 8 }, to: "/teams/lab/launch" });
		});
		await waitFor(() => expect(router.state.location.search.gpus).toBe(2));
		expect(router.navigate).toHaveBeenCalledTimes(3);
	});
	it.each([
		{ gpus: 2, maxNavigations: 1 },
		{ gpus: 1, maxNavigations: 3 },
	])(
		"settles legacy cloud-init cleanup with the browser history adapter for $gpus GPUs",
		async ({ gpus, maxNavigations }) => {
			const previousURL = window.location.href;
			const previousState = window.history.state;
			const router = openRouted(
				`/teams/lab/launch?gpus=${gpus}&cloudInit=https%3A%2F%2Fexample.invalid%2Finit.yaml`,
				true
			);
			try {
				await screen.findByRole("button", { name: HOLD_TWO });
				await waitFor(() => expect(window.location.search).toBe("?gpus=2"));
				expect(vi.mocked(router.navigate).mock.calls.length).toBeGreaterThan(0);
				expect(
					vi.mocked(router.navigate).mock.calls.length
				).toBeLessThanOrEqual(maxNavigations);
			} finally {
				router.history.destroy();
				window.history.replaceState(previousState, "", previousURL);
			}
		}
	);
	it("shows an empty inventory and a working credits option without fake sizes", async () => {
		const provision = vi.spyOn(api, "provision");
		const input = open({
			balance: {
				available_balance: 0,
				bare_metal_server_count: 0,
				hourly_rate: 0,
				virtual_machine_count: 0,
			},
			children: <a href="/teams/lab/history">Machine history</a>,
			keys: [],
			offers: [],
		});
		expect(
			within(
				screen.getByRole("region", { name: "Launch a machine" })
			).getByRole("status")
		).toHaveTextContent("No machines are available");
		expect(
			within(
				screen.getByRole("region", { name: "Launch a machine" })
			).getByRole("status")
		).toHaveClass("availability-empty");
		expect(screen.queryByRole("radio")).not.toBeInTheDocument();
		expect(screen.queryByText("Loading prices")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: HOLD })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("combobox", { name: "Image" })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("region", { name: "Estimate" })
		).not.toBeInTheDocument();
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: "Add credits" }));
		expect(input.onAddCredits).toHaveBeenCalledOnce();
		expect(
			screen.queryByRole("button", { name: "Refresh availability" })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: "Add an SSH key in Settings" })
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Machine history" })
		).toHaveAttribute("href", "/teams/lab/history");
		expect(provision).not.toHaveBeenCalled();
	});
	it("treats an inventory with zero available quantities as empty", () => {
		open({ offers: [{ ...OFFER, Quantity: 0 }] });
		expect(
			within(
				screen.getByRole("region", { name: "Launch a machine" })
			).getByRole("status")
		).toHaveClass("availability-empty");
		expect(
			screen.queryByRole("button", { name: HOLD })
		).not.toBeInTheDocument();
		expect(screen.queryByRole("radio")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("combobox", { name: "Image" })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("region", { name: "Estimate" })
		).not.toBeInTheDocument();
	});
	it("only presents loading while the availability request is pending", () => {
		open({ offers: undefined });
		expect(
			within(
				screen.getByRole("region", { name: "Launch a machine" })
			).getByRole("status")
		).toHaveTextContent("Loading available sizes and prices");
		expect(screen.getAllByRole("radio")).toHaveLength(4);
		expect(screen.getByRole("button", { name: HOLD })).toBeDisabled();
	});
	it("shows API failures with retry instead of an endless loading label", () => {
		open({
			offers: undefined,
			offersError: new Error("Inventory unavailable"),
		});
		expect(screen.getByRole("alert")).toHaveTextContent(
			"Inventory unavailable"
		);
		expect(
			screen.getByRole("button", { name: "Refresh availability" })
		).toBeEnabled();
		expect(screen.queryByRole("radio")).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: HOLD })).toBeDisabled();
	});
	it("offers credits when a nonzero balance cannot cover the minimum charge", () => {
		open({
			balance: {
				available_balance: 100,
				bare_metal_server_count: 0,
				hourly_rate: 0,
				virtual_machine_count: 0,
			},
		});
		expect(screen.getByRole("button", { name: "Add credits" })).toBeEnabled();
		expect(screen.getByRole("button", { name: HOLD })).toBeDisabled();
	});
	it("directs users without purchase permission to a team owner", () => {
		open({
			balance: {
				available_balance: 0,
				bare_metal_server_count: 0,
				hourly_rate: 0,
				virtual_machine_count: 0,
			},
			team: {
				effective_roles: ["operator"],
				handle: "lab",
				name: "Lab",
				roles: ["operator"],
			},
		});
		expect(
			screen.getByText(
				"Ask a team owner or purchaser to add credits before renting a machine."
			)
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Add credits" })
		).not.toBeInTheDocument();
	});
	it("uses actual pricing and permits launch only for a funded available machine", () => {
		open();
		expect(
			screen.queryByRole("link", { name: "Add an SSH key in Settings" })
		).not.toBeInTheDocument();
		expect(
			within(screen.getByRole("region", { name: "Estimate" })).getByText(
				"$3.00"
			)
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: HOLD })).toBeEnabled();
		expect(
			screen.queryByRole("button", { name: "Add credits" })
		).not.toBeInTheDocument();
	});
});
