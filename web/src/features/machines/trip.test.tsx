import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
function props(): TripProps {
	return {
		expanded: true,
		minimumMin: 30,
		morph: false,
		onChanged: vi.fn(),
		onEnded: vi.fn(),
		onFocus: vi.fn(),
		price: 300,
		record: {
			launched_at: new Date(Date.now() - 60_000).toISOString(),
			name: MACHINE.name,
			team: TEAM.handle,
		},
		state: { host: "server-fixture", state: "running" },
		team: TEAM,
		vm: MACHINE,
	};
}
afterEach(() => {
	vi.useRealTimers();
});
describe("machine release", () => {
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
		expect(release).toHaveBeenCalledWith("lab", "vm-fixture", true);
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
			})
		);
		expect(input.onEnded).not.toHaveBeenCalledWith(
			expect.objectContaining({ note: expect.anything() })
		);
	});
});
