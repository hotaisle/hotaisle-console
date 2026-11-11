import {
	createMemoryHistory,
	RouterContextProvider,
} from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { createAppRouter } from "../../app/router";
import { ToastHost } from "../../components/ui/toast";
import { api, type Offer } from "../../lib/api";
import { signal } from "../../lib/signal";
import { OrderView } from "./order-view";

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
function open(overrides: Partial<ComponentProps<typeof OrderView>> = {}) {
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
const HOLD = /Hold to launch/u;
describe("rental availability and credits", () => {
	it("shows an empty inventory and a working credits option without fake sizes", async () => {
		const provision = vi.spyOn(api, "provision");
		const input = open({
			balance: {
				available_balance: 0,
				bare_metal_server_count: 0,
				hourly_rate: 0,
				virtual_machine_count: 0,
			},
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
		expect(screen.getByRole("button", { name: HOLD })).toBeDisabled();
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: "Add credits" }));
		expect(input.onAddCredits).toHaveBeenCalledOnce();
		expect(
			screen.queryByRole("button", { name: "Refresh availability" })
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Add an SSH key in Settings" })
		).toHaveAttribute("href", "/teams/lab/settings#ssh-keys");
		expect(provision).not.toHaveBeenCalled();
	});
	it("treats an inventory with zero available quantities as empty", () => {
		open({ offers: [{ ...OFFER, Quantity: 0 }] });
		expect(
			within(
				screen.getByRole("region", { name: "Launch a machine" })
			).getByRole("status")
		).toHaveClass("availability-empty");
		expect(screen.getByRole("button", { name: HOLD })).toBeDisabled();
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
