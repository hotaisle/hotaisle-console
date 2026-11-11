import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { machineKey } from "../../../../shared/machine-identity";
import { KeyboardControls } from "../../components/keyboard-controls";
import { ToastHost } from "../../components/ui/toast";
import type { VM } from "../../lib/api";
import { useMachineShortcuts } from "./use-machine-shortcuts";

const SELECTED: VM = {
	cpu_cores: 1,
	deployment_id: "selected",
	disk_capacity: 1,
	gpus: [],
	ip_address: "",
	name: "same",
	ram_capacity: 1,
	ssh_access: {
		dns_name: "selected.invalid",
		ip_address: "192.0.2.1",
		port: 22,
	},
	status: "ready",
};
function Probe({ home, running }: { home: boolean; running: boolean }) {
	useMachineShortcuts("lab", home, SELECTED, {
		[machineKey("lab", SELECTED)]: {
			host: "server",
			state: running ? "running" : "off",
		},
	});
	return null;
}
function copyKey() {
	fireEvent.keyDown(document, { code: "KeyC", key: "c" });
	fireEvent.keyUp(document, { code: "KeyC", key: "c" });
}
describe("selected machine shortcuts", () => {
	it("copies only the selected ready machine in its machine view", () => {
		const copy = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText: copy },
		});
		const rendered = render(
			<KeyboardControls>
				<ToastHost>
					<Probe home running />
				</ToastHost>
			</KeyboardControls>
		);
		copyKey();
		expect(copy).toHaveBeenCalledWith("ssh hotaisle@selected.invalid");
		copy.mockClear();
		rendered.rerender(
			<KeyboardControls>
				<ToastHost>
					<Probe home running={false} />
				</ToastHost>
			</KeyboardControls>
		);
		copyKey();
		rendered.rerender(
			<KeyboardControls>
				<ToastHost>
					<Probe home={false} running />
				</ToastHost>
			</KeyboardControls>
		);
		copyKey();
		expect(copy).not.toHaveBeenCalled();
	});
});
