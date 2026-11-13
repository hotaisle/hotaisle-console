import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "../../../test/render";
import { api } from "../../lib/api";
import { ApiKeySignIn } from "./api-key-sign-in";
import { EmailSignIn } from "./email-sign-in";

describe("sign-in components", () => {
	it("counts passphrase characters and confirms only matching passphrases of sufficient length", async () => {
		const user = userEvent.setup();
		renderWithQuery(<ApiKeySignIn onConnected={vi.fn()} />);
		const passphrase = screen.getByLabelText("Local unlock passphrase");
		const confirmation = screen.getByLabelText("Repeat passphrase");
		const feedback = screen.getByText("0 characters · Minimum 12.");
		expect(passphrase).toHaveAccessibleDescription(feedback.textContent ?? "");
		expect(confirmation).toHaveAccessibleDescription(
			feedback.textContent ?? ""
		);
		await user.type(passphrase, "short");
		await user.type(confirmation, "short");
		expect(feedback).toHaveTextContent("5 characters · Minimum 12.");
		expect(feedback).toHaveAttribute("data-matched", "false");
		await user.type(passphrase, " passphrase");
		expect(feedback).toHaveTextContent("16 characters · Minimum 12.");
		expect(feedback).toHaveAttribute("data-matched", "false");
		await user.type(confirmation, " passphrase");
		expect(feedback).toHaveTextContent("Passphrases match.");
		expect(feedback).toHaveAttribute("data-matched", "true");
		await user.type(passphrase, "!");
		expect(feedback).not.toHaveTextContent("Passphrases match.");
		expect(feedback).toHaveAttribute("data-matched", "false");
	});
	it("keeps the API key out of the password-manager form and still requires it", async () => {
		const request = vi.spyOn(api, "signInWithKey");
		renderWithQuery(<ApiKeySignIn onConnected={vi.fn()} />);
		expect(screen.getByLabelText("API key").closest("form")).toBeNull();
		const passwordForm = screen
			.getByLabelText("Local unlock passphrase")
			.closest("form");
		expect(
			passwordForm?.querySelector('input[autocomplete="username"]')
		).toHaveValue("Hot Aisle API key");
		const user = userEvent.setup();
		await user.type(
			screen.getByLabelText("Local unlock passphrase"),
			"fixture passphrase"
		);
		await user.type(
			screen.getByLabelText("Repeat passphrase"),
			"fixture passphrase"
		);
		await user.click(
			screen.getByRole("button", { name: "Save key and connect" })
		);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Enter your API key"
		);
		expect(request).not.toHaveBeenCalled();
	});
	it("disables submission while sending and restores the button after failure", async () => {
		let reject: (reason: Error) => void = () => {
			throw new Error("Request not initialized");
		};
		const request = new Promise<{
			email: string;
			expires_at: string;
			request_code: string;
		}>((_resolve, rejectRequest) => {
			reject = rejectRequest;
		});
		const start = vi.spyOn(api, "emailStart").mockReturnValue(request);
		const user = userEvent.setup();
		renderWithQuery(<EmailSignIn onSent={vi.fn()} />);
		await user.type(
			screen.getByLabelText("Email address"),
			"fixture@example.test"
		);
		await user.click(screen.getByRole("button", { name: "Email me a link" }));
		expect(
			await screen.findByRole("button", { name: "Sending" })
		).toBeDisabled();
		await user.click(screen.getByRole("button", { name: "Sending" }));
		expect(start).toHaveBeenCalledOnce();
		reject(new Error("Please try again"));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Please try again"
		);
		expect(
			screen.getByRole("button", { name: "Email me a link" })
		).toBeEnabled();
	});
	it("validates email before requesting a link and uses the normalized response", async () => {
		const user = userEvent.setup();
		const start = vi.spyOn(api, "emailStart").mockResolvedValue({
			email: "alice@example.com",
			expires_at: "2030-01-01",
			request_code: "Q9W1-DFWF",
		});
		const sent = vi.fn();
		renderWithQuery(<EmailSignIn onSent={sent} />);
		await user.click(screen.getByRole("button", { name: "Email me a link" }));
		expect(start).not.toHaveBeenCalled();
		await user.type(
			screen.getByLabelText("Email address"),
			"Alice@example.com"
		);
		await user.click(screen.getByRole("button", { name: "Email me a link" }));
		await waitFor(() =>
			expect(sent).toHaveBeenCalledWith({
				email: "alice@example.com",
				expires_at: "2030-01-01",
				request_code: "Q9W1-DFWF",
			})
		);
	});
	it("shows a failed API-key sign-in without reporting a connection", async () => {
		const user = userEvent.setup();
		vi.spyOn(api, "signInWithKey").mockRejectedValue(new Error("Key rejected"));
		const connected = vi.fn();
		renderWithQuery(<ApiKeySignIn onConnected={connected} />);
		expect(screen.getByLabelText("Local unlock passphrase")).toHaveAttribute(
			"autocomplete",
			"new-password"
		);
		expect(screen.getByLabelText("Local unlock passphrase")).toHaveAttribute(
			"id",
			"new-password"
		);
		expect(screen.getByLabelText("Repeat passphrase")).toHaveAttribute(
			"autocomplete",
			"new-password"
		);
		await user.type(screen.getByLabelText("API key"), "invalid-key");
		await user.type(
			screen.getByLabelText("Local unlock passphrase"),
			"fixture passphrase"
		);
		await user.type(
			screen.getByLabelText("Repeat passphrase"),
			"fixture passphrase"
		);
		await user.click(
			screen.getByRole("button", { name: "Save key and connect" })
		);
		expect(await screen.findByRole("alert")).toHaveTextContent("Key rejected");
		expect(connected).not.toHaveBeenCalled();
	});
	it("validates matching passphrases through form state and clears secrets after success", async () => {
		const request = vi.spyOn(api, "signInWithKey").mockResolvedValue({
			teams: [],
			user: {
				created: "2026-01-01",
				email: "fixture@example.test",
				email_auth_enabled: true,
				name: "Fixture",
			},
		});
		const connected = vi.fn().mockResolvedValue(undefined);
		const user = userEvent.setup();
		renderWithQuery(<ApiKeySignIn onConnected={connected} />);
		await user.type(screen.getByLabelText("API key"), "fixture-key");
		await user.type(
			screen.getByLabelText("Local unlock passphrase"),
			"fixture passphrase"
		);
		await user.type(
			screen.getByLabelText("Repeat passphrase"),
			"different passphrase"
		);
		await user.click(
			screen.getByRole("button", { name: "Save key and connect" })
		);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"passphrases must match"
		);
		expect(request).not.toHaveBeenCalled();
		await user.clear(screen.getByLabelText("Repeat passphrase"));
		await user.type(
			screen.getByLabelText("Repeat passphrase"),
			"fixture passphrase"
		);
		await user.click(
			screen.getByRole("button", { name: "Save key and connect" })
		);
		await waitFor(() => expect(connected).toHaveBeenCalledOnce());
		expect(request).toHaveBeenCalledWith("fixture-key", "fixture passphrase");
		expect(screen.getByLabelText("API key")).toHaveValue("");
		expect(screen.getByLabelText("Local unlock passphrase")).toHaveValue("");
		expect(screen.getByLabelText("Repeat passphrase")).toHaveValue("");
	});
});
