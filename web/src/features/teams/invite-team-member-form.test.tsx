import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "../../../test/render";
import { APIError, api, type Team } from "../../lib/api";
import { InviteTeamMemberForm } from "./invite-team-member-form";

const TEAM: Team = {
	effective_roles: ["owner"],
	handle: "lab",
	name: "Lab",
	roles: ["owner"],
};

async function fillInvitation(name = "Dana Doe", email = "dana@example.com") {
	const user = userEvent.setup();
	await user.type(screen.getByRole("textbox", { name: "Name" }), name);
	await user.type(screen.getByLabelText("Email address"), email);
	return user;
}

describe("invite a team member", () => {
	it("defaults to SSH access, prevents duplicate submits, and confirms only after the API succeeds", async () => {
		let complete: (() => void) | undefined;
		const invite = vi.spyOn(api, "inviteTeamMember").mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					complete = resolve;
				})
		);
		const refresh = vi.fn().mockResolvedValue(undefined);
		renderWithQuery(<InviteTeamMemberForm onInvited={refresh} team={TEAM} />);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		expect(screen.getByRole("checkbox", { name: "User" })).toBeChecked();
		expect(screen.getByRole("checkbox", { name: "Owner" })).not.toBeChecked();
		const user = await fillInvitation("  Dana Doe  ");
		await user.click(
			screen.getByRole("button", { name: "Send email invitation" })
		);
		await waitFor(() =>
			expect(invite).toHaveBeenCalledWith("lab", {
				email: "dana@example.com",
				name: "Dana Doe",
				roles: ["user"],
			})
		);
		const pending = screen.getByRole("button", {
			name: "Sending email invitation…",
		});
		expect(pending).toBeDisabled();
		await user.click(pending);
		expect(invite).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
		await act(async () => complete?.());
		expect(await screen.findByRole("status")).toHaveTextContent(
			"Invitation sent to dana@example.com."
		);
		expect(refresh).toHaveBeenCalledOnce();
		expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("");
	});
	it.each([403, 409])(
		"keeps the recipient and permissions after a %s response",
		async (status) => {
			const invite = vi
				.spyOn(api, "inviteTeamMember")
				.mockRejectedValue(new APIError(status, "Invitation was rejected."));
			const refresh = vi.fn();
			renderWithQuery(<InviteTeamMemberForm onInvited={refresh} team={TEAM} />);
			const user = await fillInvitation();
			await user.click(screen.getByRole("checkbox", { name: "Operator" }));
			await user.click(
				screen.getByRole("button", { name: "Send email invitation" })
			);
			expect(await screen.findByRole("alert")).toHaveTextContent(
				"Invitation was rejected."
			);
			expect(screen.getByLabelText("Email address")).toHaveValue(
				"dana@example.com"
			);
			expect(screen.getByRole("checkbox", { name: "Operator" })).toBeChecked();
			expect(invite).toHaveBeenCalledWith(
				"lab",
				expect.objectContaining({ roles: ["user", "operator"] })
			);
			expect(screen.queryByRole("status")).not.toBeInTheDocument();
			expect(refresh).not.toHaveBeenCalled();
		}
	);
	it.each([
		{ emptyRoles: false, message: "Enter their name.", name: "   " },
		{
			emptyRoles: false,
			message: "Use a name of 100 bytes or fewer.",
			name: "界".repeat(34),
		},
		{
			emptyRoles: true,
			message: "Choose at least one permission.",
			name: "Dana",
		},
	])(
		"rejects invalid form data: $message",
		async ({ name, message, emptyRoles }) => {
			const invite = vi.spyOn(api, "inviteTeamMember");
			renderWithQuery(<InviteTeamMemberForm onInvited={vi.fn()} team={TEAM} />);
			const user = await fillInvitation(name);
			if (emptyRoles) {
				await user.click(screen.getByRole("checkbox", { name: "User" }));
			}
			await user.click(
				screen.getByRole("button", { name: "Send email invitation" })
			);
			expect(await screen.findByRole("alert")).toHaveTextContent(message);
			expect(
				emptyRoles
					? screen.getByRole("checkbox", { name: "User" })
					: screen.getByRole("textbox", { name: "Name" })
			).toHaveFocus();
			expect(invite).not.toHaveBeenCalled();
		}
	);
	it("uses native email validation without showing premature errors", async () => {
		const invite = vi.spyOn(api, "inviteTeamMember");
		renderWithQuery(<InviteTeamMemberForm onInvited={vi.fn()} team={TEAM} />);
		const user = await fillInvitation("Dana", "not-an-email");
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		await user.click(
			screen.getByRole("button", { name: "Send email invitation" })
		);
		expect(screen.getByLabelText("Email address")).toBeInvalid();
		expect(invite).not.toHaveBeenCalled();
	});
	it("keeps a successful invitation successful when refreshing members fails", async () => {
		const invite = vi
			.spyOn(api, "inviteTeamMember")
			.mockResolvedValue(undefined);
		const refresh = vi.fn().mockRejectedValue(new Error("Offline"));
		renderWithQuery(<InviteTeamMemberForm onInvited={refresh} team={TEAM} />);
		const user = await fillInvitation();
		await user.click(
			screen.getByRole("button", { name: "Send email invitation" })
		);
		expect(await screen.findByRole("status")).toHaveTextContent(
			"Invitation sent"
		);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"member list could not be refreshed"
		);
		expect(invite).toHaveBeenCalledOnce();
	});
});
