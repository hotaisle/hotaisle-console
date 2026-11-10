import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "../../../../test/render";
import { ToastHost } from "../../../components/ui/toast";
import { APIError, api } from "../../../lib/api";
import { SshKeys } from "./ssh-keys";

describe("SSH keys in Settings", () => {
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
