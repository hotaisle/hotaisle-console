import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "../../../../test/render";
import { ToastHost } from "../../../components/ui/toast";
import { APIError, api } from "../../../lib/api";
import { SshKeys } from "./ssh-keys";

// jsdom lacks native dialog methods. Chrome verifies Escape, focus containment and native form dismissal.
const nativeShow = Object.getOwnPropertyDescriptor(
	HTMLDialogElement.prototype,
	"showModal"
);
const nativeClose = Object.getOwnPropertyDescriptor(
	HTMLDialogElement.prototype,
	"close"
);
beforeAll(() => {
	Object.defineProperties(HTMLDialogElement.prototype, {
		close: {
			configurable: true,
			value(this: HTMLDialogElement) {
				this.open = false;
				this.dispatchEvent(new Event("close"));
			},
		},
		showModal: {
			configurable: true,
			value(this: HTMLDialogElement) {
				this.open = true;
			},
		},
	});
});
afterAll(() => {
	for (const [method, descriptor] of [
		["showModal", nativeShow],
		["close", nativeClose],
	] as const) {
		if (descriptor) {
			Object.defineProperty(HTMLDialogElement.prototype, method, descriptor);
		} else {
			Reflect.deleteProperty(HTMLDialogElement.prototype, method);
		}
	}
});
const KEY = {
	comment: "Laptop",
	fingerprint: "SHA256:fixture-full-fingerprint",
	public_key: "ssh-ed25519 fixture",
	type: "ssh-ed25519",
};
function renderKeys(refresh = vi.fn().mockResolvedValue(undefined)) {
	renderWithQuery(
		<ToastHost>
			<SshKeys keys={[KEY]} refresh={refresh} />
		</ToastHost>
	);
	return refresh;
}

describe("SSH keys in Settings", () => {
	it("opens a key-specific modal, focuses the safe choice and never removes on dismissal", async () => {
		const remove = vi.spyOn(api, "removeKey");
		renderKeys();
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: "Remove Laptop" }));
		const dialog = screen.getByRole("dialog", { name: "Remove SSH key?" });
		expect(within(dialog).getByText(KEY.fingerprint)).toBeInTheDocument();
		expect(
			within(dialog).getByRole("button", { name: "Keep key" })
		).toHaveFocus();
		expect(remove).not.toHaveBeenCalled();
		act(() => (dialog as HTMLDialogElement).close());
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(remove).not.toHaveBeenCalled();
	});
	it("requires explicit confirmation, blocks duplicate submissions and closes after success", async () => {
		let finish: (() => void) | undefined;
		const remove = vi.spyOn(api, "removeKey").mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = () => resolve(undefined);
				})
		);
		const refresh = renderKeys();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "Remove Laptop" }));
		await user.dblClick(screen.getByRole("button", { name: "Remove key" }));
		expect(remove).toHaveBeenCalledExactlyOnceWith(KEY.fingerprint);
		const dialog = screen.getByRole("dialog");
		expect(
			within(dialog).getByRole("button", { name: "Keep key" })
		).toBeDisabled();
		const cancel = new Event("cancel", { cancelable: true });
		act(() => {
			dialog.dispatchEvent(cancel);
		});
		expect(cancel.defaultPrevented).toBe(true);
		act(() => {
			finish?.();
		});
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		);
		expect(refresh).toHaveBeenCalledOnce();
	});
	it("keeps API failures inside the dialog and supports a successful retry", async () => {
		const remove = vi
			.spyOn(api, "removeKey")
			.mockRejectedValueOnce(new APIError(503, "Try again shortly"))
			.mockResolvedValueOnce(undefined);
		const refresh = renderKeys();
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "Remove Laptop" }));
		await user.click(screen.getByRole("button", { name: "Remove key" }));
		const dialog = screen.getByRole("dialog");
		expect(await within(dialog).findByRole("alert")).toHaveTextContent(
			"Try again shortly"
		);
		expect(refresh).not.toHaveBeenCalled();
		await user.click(
			within(dialog).getByRole("button", { name: "Remove key" })
		);
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
		);
		expect(remove).toHaveBeenCalledTimes(2);
		expect(refresh).toHaveBeenCalledOnce();
	});
	it("refreshes after a global key conflict without claiming the current account owns it", async () => {
		vi.spyOn(api, "addKey").mockRejectedValue(
			new APIError(409, "Public key already registered")
		);
		const refresh = vi.fn().mockResolvedValue(undefined);
		renderWithQuery(
			<ToastHost>
				<SshKeys keys={[]} refresh={refresh} />
			</ToastHost>
		);
		const user = userEvent.setup();
		await user.type(screen.getByLabelText("Public key"), "ssh-ed25519 fixture");
		await user.click(screen.getByRole("button", { name: "Add" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"already registered with Hot Aisle"
		);
		expect(screen.getByRole("alert")).toHaveTextContent("account that owns it");
		expect(
			screen.queryByText("That key is already on your account.")
		).not.toBeInTheDocument();
		expect(refresh).toHaveBeenCalledOnce();
		expect(screen.getByLabelText("Public key")).toHaveValue(
			"ssh-ed25519 fixture"
		);
	});
	it("shows instructions only when the loaded account has no keys", () => {
		renderWithQuery(
			<ToastHost>
				<SshKeys keys={[]} refresh={vi.fn()} />
			</ToastHost>
		);
		expect(
			screen.getByRole("region", { name: "SSH key instructions" })
		).toBeInTheDocument();
		expect(
			screen.getByText("public key", { selector: "strong" })
		).toBeInTheDocument();
	});
	it("lists existing keys and keeps the add form without introductory instructions", () => {
		renderWithQuery(
			<ToastHost>
				<SshKeys
					keys={[
						{
							comment: "Laptop",
							fingerprint: "SHA256:fixture",
							public_key: "ssh-ed25519 fixture",
							type: "ssh-ed25519",
						},
					]}
					refresh={vi.fn()}
				/>
			</ToastHost>
		);
		expect(screen.getByText("Laptop")).toBeInTheDocument();
		expect(screen.getByLabelText("Public key")).toBeInTheDocument();
		expect(
			screen.queryByRole("region", { name: "SSH key instructions" })
		).not.toBeInTheDocument();
	});
	it("adds a public key and refreshes the account list", async () => {
		const add = vi.spyOn(api, "addKey").mockResolvedValue({
			fingerprint: "fixture",
			public_key: "ssh-ed25519 fixture laptop",
			type: "ssh-ed25519",
		});
		const refresh = vi.fn().mockResolvedValue(undefined);
		renderWithQuery(
			<ToastHost>
				<SshKeys keys={[]} refresh={refresh} />
			</ToastHost>
		);
		const user = userEvent.setup();
		await user.type(
			screen.getByLabelText("Public key"),
			"ssh-ed25519 fixture laptop"
		);
		await user.click(screen.getByRole("button", { name: "Add" }));
		expect(await screen.findByText("Added your key.")).toBeInTheDocument();
		expect(add).toHaveBeenCalledWith(
			"ssh-ed25519 fixture laptop",
			expect.anything()
		);
		expect(refresh).toHaveBeenCalledOnce();
		expect(screen.getByLabelText("Public key")).toHaveValue("");
	});
});
