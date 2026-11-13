import {
	act,
	fireEvent,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_NOW } from "../../../../test/clock";
import { mockNativeDialogs } from "../../../test/native-dialog";
import { renderWithQuery } from "../../../test/render";
import { ToastHost } from "../../components/ui/toast";
import { api } from "../../lib/api";
import { Trip } from "./trip";
import type { TripProps } from "./use-trip";

mockNativeDialogs();
beforeEach(() => {
	vi.spyOn(api, "bareMetalConsole").mockRejectedValue(
		new Error("Console unavailable")
	);
});
afterEach(() => vi.useRealTimers());
const VM_UNSUPPORTED = /console|shutdown|get VM state/iu;
const CONSOLE_LINK = /Console ↗/u;
function props(metal = false): TripProps {
	return {
		expanded: true,
		minimumMin: metal ? 480 : 1,
		morph: false,
		onChanged: vi.fn(),
		onEnded: vi.fn(),
		onFocus: vi.fn(),
		state: { host: "fixture-host", state: "running" },
		team: {
			effective_roles: ["operator"],
			handle: "lab",
			name: "Lab",
			roles: ["operator"],
		},
		vm: {
			cpu_cores: 13,
			deployment_id: "fixture-id",
			disk_capacity: 100,
			gpus: [{ count: metal ? 8 : 1, model: "MI300X" }],
			ip_address: "192.0.2.42",
			metal,
			name: "fixture",
			ram_capacity: 64,
			status: "ready",
		},
	};
}
function open(input = props()) {
	renderWithQuery(
		<ToastHost>
			<Trip {...input} />
		</ToastHost>
	);
	fireEvent.click(screen.getByRole("button", { name: "More" }));
	return screen.getByRole("dialog", {
		name: input.vm.metal ? "Server operations" : "VM operations",
	});
}
describe("machine operations", () => {
	it("updates visible actions as polling changes a VM's state", () => {
		const input = props();
		const view = renderWithQuery(
			<ToastHost>
				<Trip {...input} />
			</ToastHost>
		);
		fireEvent.click(screen.getByRole("button", { name: "More" }));
		expect(
			screen.queryByRole("button", { name: "Start VM" })
		).not.toBeInTheDocument();
		view.rerender(
			<ToastHost>
				<Trip {...input} state={{ host: "fixture-host", state: "off" }} />
			</ToastHost>
		);
		expect(
			screen.getByRole("button", { name: "Start VM" })
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Graceful reboot" })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Hard reset" })
		).not.toBeInTheDocument();
		view.rerender(
			<ToastHost>
				<Trip
					{...input}
					state={{ host: "fixture-host", state: "starting" }}
					vm={{ ...input.vm, status: "rebuilding" }}
				/>
			</ToastHost>
		);
		expect(
			screen.queryByRole("button", { name: "Start VM" })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Rebuild VM" })
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Delete VM" })
		).toBeInTheDocument();
	});
	it("shows exactly the copied SSH config and port-forward command in notifications", async () => {
		const user = userEvent.setup();
		const write = vi
			.spyOn(navigator.clipboard, "writeText")
			.mockResolvedValue();
		const input = props();
		input.vm.ssh_access = {
			dns_name: "fixture.invalid",
			ip_address: "192.0.2.42",
			port: 22,
		};
		input.record = { image: "vllm", name: "fixture", team: "lab" };
		const popup = within(open(input));
		await user.click(popup.getByRole("button", { name: "Copy SSH config" }));
		const copied = await screen.findByRole("textbox", {
			name: "Clipboard contents",
		});
		expect(copied).toHaveValue(write.mock.calls[0][0]);
		await user.click(
			popup.getByRole("button", { name: "Copy vLLM port forward" })
		);
		const notifications = await screen.findAllByRole("textbox", {
			name: "Clipboard contents",
		});
		expect(notifications).toHaveLength(2);
		expect(notifications[1]).toHaveValue(write.mock.calls[1][0]);
	});
	it("opens More as a non-modal popup and dismisses it without an action", async () => {
		const popup = open();
		expect(popup).toHaveAttribute("popover", "auto");
		expect(popup).not.toHaveAttribute("aria-modal");
		await userEvent.setup().keyboard("{Escape}");
		expect(
			screen.queryByRole("dialog", { name: "VM operations" })
		).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "More" })).toHaveAttribute(
			"aria-expanded",
			"false"
		);
	});
	it("shows HotManager's VM actions without shutdown or console", () => {
		const dialog = within(open());
		expect(
			dialog.queryByRole("button", { name: "Start VM" })
		).not.toBeInTheDocument();
		expect(
			dialog.getByRole("button", { name: "Graceful reboot" })
		).toBeInTheDocument();
		expect(
			dialog.getByRole("button", { name: "Hard reset" })
		).toBeInTheDocument();
		expect(
			dialog.getByRole("button", { name: "Rebuild VM" })
		).toBeInTheDocument();
		expect(
			dialog.getByRole("button", { name: "Delete VM" })
		).toBeInTheDocument();
		expect(
			dialog.queryByRole("button", { name: VM_UNSUPPORTED })
		).not.toBeInTheDocument();
	});
	it.each([false, true])(
		"hides operations for non-operators (metal=%s)",
		(metal) => {
			const input = props(metal);
			input.team.effective_roles = ["member"];
			renderWithQuery(
				<ToastHost>
					<Trip {...input} />
				</ToastHost>
			);
			expect(
				screen.queryByRole("button", { name: "More" })
			).not.toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: "End" })
			).not.toBeInTheDocument();
		}
	);
	it("shows separate bare-metal actions and requires confirmation for a reset", async () => {
		const power = vi
			.spyOn(api, "power")
			.mockRejectedValue(new Error("Reset refused"));
		const input = props(true);
		const dialog = within(open(input));
		for (const name of [
			"Graceful shutdown",
			"Force shutdown",
			"Warm reboot",
			"Cold reboot",
			"Wipe and reinstall",
			"Release server",
		]) {
			expect(dialog.getByRole("button", { name })).toBeInTheDocument();
		}
		expect(
			dialog.queryByRole("button", { name: "AC reset" })
		).not.toBeInTheDocument();
		expect(
			dialog.queryByRole("button", { name: "Power on" })
		).not.toBeInTheDocument();
		fireEvent.click(dialog.getByRole("button", { name: "Cold reboot" }));
		const confirmation = within(
			screen.getByRole("region", { name: "Cold reboot?" })
		);
		expect(confirmation.getByRole("button", { name: "Cancel" })).toHaveFocus();
		expect(power).not.toHaveBeenCalled();
		const hold = confirmation.getByRole("button", {
			name: "Hold to cold reboot",
		});
		vi.useFakeTimers();
		fireEvent.keyDown(hold, { key: "Enter" });
		await act(async () => {
			await vi.advanceTimersByTimeAsync(32);
		});
		fireEvent.keyUp(hold, { key: "Enter" });
		await act(async () => {
			await vi.advanceTimersByTimeAsync(400);
		});
		expect(power).not.toHaveBeenCalled();
		fireEvent.keyDown(hold, { key: "Enter" });
		await act(async () => {
			await vi.advanceTimersByTimeAsync(800);
		});
		fireEvent.keyUp(hold, { key: "Enter" });
		vi.useRealTimers();
		vi.setSystemTime(TEST_NOW);
		expect(await confirmation.findByRole("alert")).toHaveTextContent(
			"Reset refused"
		);
		expect(input.onChanged).not.toHaveBeenCalled();
		fireEvent.click(
			confirmation.getByRole("button", { name: "Dismiss error" })
		);
		await waitFor(() =>
			expect(confirmation.queryByRole("alert")).not.toBeInTheDocument()
		);
		expect(confirmation.getByRole("button", { name: "Cancel" })).toHaveFocus();
		expect(input.onChanged).not.toHaveBeenCalled();
	});
	it("rechecks AC power before reset so stale off state cannot trigger it", async () => {
		const inspect = vi
			.spyOn(api, "bareMetalPowerState")
			.mockResolvedValue({ state: "On" });
		const power = vi.spyOn(api, "power");
		const input = props(true);
		input.state = { host: "fixture-host", state: "off" };
		const dialog = within(open(input));
		fireEvent.click(dialog.getByRole("button", { name: "AC reset" }));
		const confirmation = within(
			screen.getByRole("region", { name: "AC reset?" })
		);
		const hold = confirmation.getByRole("button", { name: "Hold to ac reset" });
		vi.useFakeTimers();
		fireEvent.keyDown(hold, { key: "Enter" });
		await act(async () => {
			await vi.advanceTimersByTimeAsync(800);
		});
		fireEvent.keyUp(hold, { key: "Enter" });
		vi.useRealTimers();
		vi.setSystemTime(TEST_NOW);
		expect(await confirmation.findByRole("alert")).toHaveTextContent(
			"Power off the server before an AC reset."
		);
		expect(inspect).toHaveBeenCalledWith("lab", "fixture-id");
		expect(power).not.toHaveBeenCalled();
	});
	it("keeps a generated bare-metal console URL out of storage", async () => {
		vi.spyOn(api, "bareMetalConsole").mockResolvedValue({
			url: "https://console.example.invalid/session",
		});
		const saved = localStorage.length;
		const dialog = within(open(props(true)));
		const link = await dialog.findByRole("link", { name: CONSOLE_LINK });
		expect(link).toHaveAttribute(
			"href",
			"https://console.example.invalid/session"
		);
		expect(link).toHaveAttribute("target", "_blank");
		expect(link).toHaveAttribute("rel", "noopener noreferrer");
		expect(
			dialog.queryByRole("button", { name: "Console" })
		).not.toBeInTheDocument();
		expect(localStorage.length).toBe(saved);
		fireEvent.click(link);
		expect(
			screen.queryByRole("dialog", { name: "Server operations" })
		).not.toBeInTheDocument();
	});
});
