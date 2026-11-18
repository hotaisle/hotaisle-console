import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockNativeDialogs } from "../../../test/native-dialog";
import { renderWithQuery } from "../../../test/render";
import { ToastHost } from "../../components/ui/toast";
import { api, type Team, type VM } from "../../lib/api";
import { Trip } from "./trip";
import type { TripProps } from "./use-trip";

function ConfirmButton({
	label,
	onConfirm,
}: {
	label: string;
	onConfirm: () => void;
}) {
	return (
		<button onClick={onConfirm} type="button">
			{label}
		</button>
	);
}
vi.mock("../../components/ui/hold-button", () => ({
	HoldButton: ConfirmButton,
}));
const TEAM: Team = {
	effective_roles: ["owner"],
	handle: "lab",
	name: "Lab",
	roles: ["owner"],
};
const MACHINE: VM = {
	cpu_cores: 16,
	deployment_id: "fixture-deployment",
	disk_capacity: 100,
	gpus: [{ count: 1, manufacturer: "AMD", model: "MI300X" }],
	ip_address: "192.0.2.1",
	name: "vm-fixture",
	ram_capacity: 64,
	status: "ready",
};
const RELEASE_ERROR = /Couldn't end it/u;
mockNativeDialogs();
function props(): TripProps {
	return {
		expanded: true,
		morph: false,
		onChanged: vi.fn(),
		onEnded: vi.fn(),
		onFocus: vi.fn(),
		record: {
			launched_at: new Date(Date.now() - 60_000).toISOString(),
			name: MACHINE.name,
			team: TEAM.handle,
		},
		state: { host: "server-fixture", state: "running" },
		team: TEAM,
		vm: {
			...MACHINE,
			reservation: {
				hourly_rate_cents: 300,
				minimum_reservation_minutes: 30,
				started_at: new Date(Date.now() - 60_000).toISOString(),
			},
		},
	};
}
describe("API reservation counters", () => {
	it.each([false, true])(
		"shows reservation duration and minimum-inclusive cost without browser history (metal=%s)",
		async (metal) => {
			vi.useFakeTimers();
			const input = props();
			const resource = {
				...MACHINE,
				reservation: {
					hourly_rate_cents: 2712,
					minimum_reservation_minutes: metal ? 480 : 30,
					started_at: new Date(Date.now() - 3_600_000).toISOString(),
				},
			};
			vi.stubGlobal(
				"fetch",
				vi
					.fn()
					.mockResolvedValueOnce(Response.json(metal ? [] : [resource]))
					.mockResolvedValueOnce(Response.json(metal ? [resource] : []))
			);
			try {
				[input.vm] = await api.vms("lab");
			} finally {
				vi.unstubAllGlobals();
			}
			input.record = undefined;
			const view = renderWithQuery(
				<ToastHost>
					<Trip {...input} />
				</ToastHost>
			);
			expect(
				screen.getByRole("img", { name: "reserved for 1 hour" })
			).toBeInTheDocument();
			expect(
				screen.getByRole("img", {
					name: `estimated cost ${metal ? "$216.96" : "$27.12"}, including the minimum reservation`,
				})
			).toBeInTheDocument();
			view.rerender(
				<ToastHost>
					<Trip {...input} state={{ host: "server-fixture", state: "off" }} />
				</ToastHost>
			);
			act(() => vi.advanceTimersByTime(60_000));
			expect(
				screen.getByRole("img", { name: "reserved for 1 hour 1 minute" })
			).toBeInTheDocument();
			expect(
				screen.getByRole("img", {
					name: `estimated cost ${metal ? "$216.96" : "$27.57"}, including the minimum reservation`,
				})
			).toBeInTheDocument();
		}
	);
	it("does not substitute saved history when API timing and pricing are unknown", () => {
		const input = props();
		input.vm = { ...MACHINE };
		input.record = {
			...input.record,
			name: MACHINE.name,
			price_cents: 999,
			team: TEAM.handle,
		};
		renderWithQuery(
			<ToastHost>
				<Trip {...input} />
			</ToastHost>
		);
		expect(
			screen.getByRole("img", {
				name: "Reservation start unavailable from the API",
			})
		).toBeInTheDocument();
		expect(
			screen.getByRole("img", { name: "cost unknown" })
		).toBeInTheDocument();
	});
	it("uses refreshed API facts, preserves a zero price, and clamps a future start", () => {
		const input = props();
		input.vm = {
			...MACHINE,
			reservation: {
				hourly_rate_cents: 0,
				minimum_reservation_minutes: 480,
				started_at: new Date(Date.now() + 60_000).toISOString(),
			},
		};
		const view = renderWithQuery(
			<ToastHost>
				<Trip {...input} />
			</ToastHost>
		);
		expect(
			screen.getByRole("img", { name: "reserved for no time" })
		).toBeInTheDocument();
		expect(
			screen.getByRole("img", {
				name: "estimated cost $0.00, including the minimum reservation",
			})
		).toBeInTheDocument();
		view.rerender(
			<ToastHost>
				<Trip
					{...input}
					vm={{
						...input.vm,
						reservation: {
							hourly_rate_cents: 300,
							minimum_reservation_minutes: 30,
							started_at: new Date(Date.now() - 60_000).toISOString(),
						},
					}}
				/>
			</ToastHost>
		);
		expect(
			screen.getByRole("img", { name: "reserved for 1 minute" })
		).toBeInTheDocument();
		expect(
			screen.getByRole("img", {
				name: "estimated cost $1.50, including the minimum reservation",
			})
		).toBeInTheDocument();
	});
});
afterEach(() => {
	vi.useRealTimers();
});
describe("machine startup status", () => {
	it.each([
		{
			image: "standard",
			label: "Assigned",
			status: "ready",
			step: "Step 1 of 2: Assigned",
		},
		{
			image: "vllm",
			label: "Booting",
			status: "rebuilding",
			step: "Step 2 of 3: Booting",
		},
		{
			image: "custom",
			label: "Booting",
			status: "ready",
			step: "Step 2 of 3: Booting",
		},
	] as const)(
		"uses the API readiness for $image without inventing setup phases",
		({ image, status, label, step }) => {
			const input = props();
			input.record = {
				...input.record,
				image,
				name: MACHINE.name,
				team: TEAM.handle,
			};
			input.vm = { ...input.vm, status };
			input.state = { host: "server-fixture", state: "starting" };
			const view = renderWithQuery(
				<ToastHost>
					<Trip {...input} />
				</ToastHost>
			);
			expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
			expect(screen.getByRole("list", { name: step })).toBeInTheDocument();
			expect(screen.queryByText("Setting up")).not.toBeInTheDocument();
			view.rerender(
				<ToastHost>
					<Trip
						{...input}
						state={{ host: "server-fixture", state: "running" }}
						vm={{ ...input.vm, status: "ready" }}
					/>
				</ToastHost>
			);
			expect(
				screen.getByRole("heading", { name: "Ready" })
			).toBeInTheDocument();
			expect(screen.queryByRole("list")).not.toBeInTheDocument();
		}
	);
	it.each([false, true])(
		"uses machine-specific operations (metal=%s)",
		(metal) => {
			const input = props();
			input.vm = { ...input.vm, metal };
			const view = renderWithQuery(
				<ToastHost>
					<Trip {...input} />
				</ToastHost>
			);
			fireEvent.click(screen.getByRole("button", { name: "More" }));
			expect(
				screen.queryAllByRole("button", { name: "Graceful shutdown" })
			).toHaveLength(metal ? 1 : 0);
			expect(
				screen.queryAllByRole("button", { name: "Warm reboot" })
			).toHaveLength(metal ? 1 : 0);
			act(() => (screen.getByRole("dialog") as HTMLDialogElement).close());
			view.rerender(
				<ToastHost>
					<Trip {...input} state={{ host: "server-fixture", state: "off" }} />
				</ToastHost>
			);
			expect(
				screen.getByRole("heading", { name: "Powered off" })
			).toBeInTheDocument();
			expect(
				screen.queryAllByRole("heading", { name: "Unavailable" })
			).toHaveLength(0);
			expect(screen.getByRole("button", { name: "End" })).toBeInTheDocument();
		}
	);
	it.each(["off", "stopped", "shutoff", "paused", "failed"])(
		"hides startup progress for %s machines and restores it when starting",
		(state) => {
			const input = props();
			input.state = { host: "server-fixture", state };
			input.vm = {
				...input.vm,
				ssh_access: {
					dns_name: "machine.example.invalid",
					ip_address: "192.0.2.42",
					port: 22,
				},
			};
			const view = renderWithQuery(
				<ToastHost>
					<Trip {...input} />
				</ToastHost>
			);
			expect(screen.queryByRole("list")).not.toBeInTheDocument();
			expect(screen.queryByText("Booting")).not.toBeInTheDocument();
			expect(screen.getByText("Reserved")).toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: "Copy" })
			).not.toBeInTheDocument();
			expect(
				screen.queryByText("ssh hotaisle@machine.example.invalid")
			).not.toBeInTheDocument();
			fireEvent.click(screen.getByRole("button", { name: "More" }));
			expect(
				screen.queryByRole("button", { name: "Copy SSH config" })
			).not.toBeInTheDocument();
			act(() => (screen.getByRole("dialog") as HTMLDialogElement).close());
			view.rerender(
				<ToastHost>
					<Trip
						{...input}
						state={{ host: "server-fixture", state: "starting" }}
					/>
				</ToastHost>
			);
			expect(
				screen.getByRole("list", { name: "Step 1 of 2: Assigned" })
			).toBeInTheDocument();
		}
	);
});
describe("machine release", () => {
	it("shows usage billing after a 1-GPU VM's one-minute minimum", () => {
		const input = props();
		input.vm = {
			...input.vm,
			reservation: {
				hourly_rate_cents: 300,
				minimum_reservation_minutes: 1,
				started_at: new Date(Date.now() - 120_000).toISOString(),
			},
		};
		renderWithQuery(
			<ToastHost>
				<Trip {...input} />
			</ToastHost>
		);
		fireEvent.click(screen.getByRole("button", { name: "End" }));
		const confirmation = screen.getByRole("dialog", {
			name: "End this machine",
		});
		expect(confirmation).toHaveTextContent("billing stops");
		expect(confirmation).not.toHaveTextContent("billed for at least");
	});
	it("shows the complete connection command and restores details after cancelling an end", () => {
		const input = props();
		input.vm = { ...input.vm, description: "An existing upstream description" };
		input.vm = {
			...input.vm,
			ssh_access: {
				dns_name: "a-long-machine-name.example.invalid",
				ip_address: "192.0.2.42",
				port: 2222,
			},
		};
		renderWithQuery(
			<ToastHost>
				<Trip {...input} />
			</ToastHost>
		);
		expect(
			screen.getByText(
				"ssh -p 2222 hotaisle@a-long-machine-name.example.invalid"
			)
		).toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: "Open in Terminal" })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("textbox", { name: "Notes" })
		).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "End" }));
		expect(
			screen.getByRole("button", { name: "Keep it running" })
		).toHaveFocus();
		expect(
			screen.queryByText(
				"ssh -p 2222 hotaisle@a-long-machine-name.example.invalid"
			)
		).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Keep it running" }));
		expect(
			screen.getByText(
				"ssh -p 2222 hotaisle@a-long-machine-name.example.invalid"
			)
		).toBeInTheDocument();
	});
	it("keeps a failed release visible and never emits a successful receipt", async () => {
		vi.spyOn(api, "release").mockRejectedValue(new Error("Release refused"));
		const input = props();
		renderWithQuery(
			<ToastHost>
				<Trip {...input} />
			</ToastHost>
		);
		fireEvent.click(screen.getByRole("button", { name: "End" }));
		expect(
			screen.getByRole("dialog", { name: "End this machine" })
		).toHaveTextContent("deletes");
		fireEvent.click(screen.getByRole("button", { name: "Hold to end" }));
		expect(await screen.findByText(RELEASE_ERROR)).toHaveTextContent(
			"Release refused"
		);
		expect(input.onEnded).not.toHaveBeenCalled();
		expect(screen.getByRole("article")).toHaveAccessibleName(
			"vm-fixture: Ready"
		);
	});
	it("releases rather than powering off and estimates the minimum charge only after success", async () => {
		vi.useFakeTimers();
		const release = vi.spyOn(api, "release").mockResolvedValue(undefined);
		const power = vi.spyOn(api, "power");
		const input = props();
		input.vm = { ...input.vm, description: "Existing upstream description" };
		input.record = {
			launched_at: new Date(Date.now() - 9 * 3_600_000).toISOString(),
			name: MACHINE.name,
			price_cents: 999,
			team: TEAM.handle,
		};
		renderWithQuery(
			<ToastHost>
				<Trip {...input} />
			</ToastHost>
		);
		fireEvent.click(screen.getByRole("button", { name: "End" }));
		fireEvent.click(screen.getByRole("button", { name: "Hold to end" }));
		await act(async () => {
			await Promise.resolve();
		});
		expect(release).toHaveBeenCalledWith(
			"lab",
			expect.objectContaining({ name: "vm-fixture" }),
			true
		);
		expect(power).not.toHaveBeenCalled();
		expect(input.onEnded).not.toHaveBeenCalled();
		act(() => {
			vi.advanceTimersByTime(300);
		});
		expect(input.onEnded).toHaveBeenCalledWith(
			expect.objectContaining({
				cents: 150,
				minimum_applied: true,
				name: "vm-fixture",
				started_at: input.vm.reservation?.started_at,
			})
		);
		expect(input.onEnded).not.toHaveBeenCalledWith(
			expect.objectContaining({ note: expect.anything() })
		);
	});
});
