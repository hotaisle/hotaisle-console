import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "../../../test/render";
import type { Team, TeamMember } from "../../lib/api";
import { APIError, api } from "../../lib/api";
import { TeamMembers } from "./team-members";

const MEMBER: TeamMember = {
	created: "2026-01-01",
	email: "dana@example.invalid",
	name: "Dana",
	roles: ["user", "operator"],
};
const OWNER: TeamMember = {
	...MEMBER,
	email: "owner@example.invalid",
	name: "Owner",
	roles: ["owner"],
};
const TEAM: Team = {
	effective_roles: ["owner"],
	handle: "lab",
	members: [MEMBER, OWNER],
	name: "Lab",
	roles: ["owner"],
};

describe("inline member permissions", () => {
	it("keeps saves disabled until permissions change and cancels only that member's draft", async () => {
		const update = vi.spyOn(api, "updateTeamMember");
		const user = userEvent.setup();
		renderWithQuery(<TeamMembers onUpdated={vi.fn()} team={TEAM} />);
		const form = within(
			screen.getByRole("form", { name: `Permissions for ${MEMBER.email}` })
		);
		const save = form.getByRole("button", { name: "Save" });
		expect(save).toBeDisabled();
		await user.click(form.getByRole("checkbox", { name: "User" }));
		expect(save).toBeEnabled();
		await user.click(form.getByRole("checkbox", { name: "User" }));
		expect(save).toBeDisabled();
		await user.click(form.getByRole("checkbox", { name: "Purchaser" }));
		await user.click(form.getByRole("button", { name: "Cancel" }));
		expect(form.getByRole("checkbox", { name: "Purchaser" })).not.toBeChecked();
		expect(save).toBeDisabled();
		expect(update).not.toHaveBeenCalled();
	});
	it("keeps rejected edits, prevents duplicate saves, and uses the returned permissions", async () => {
		let finish: ((member: TeamMember) => void) | undefined;
		const pending = new Promise<TeamMember>((resolve) => {
			finish = resolve;
		});
		const update = vi
			.spyOn(api, "updateTeamMember")
			.mockRejectedValueOnce(new APIError(403, "Permission denied"))
			.mockReturnValueOnce(pending);
		const refreshed = vi.fn();
		const user = userEvent.setup();
		renderWithQuery(<TeamMembers onUpdated={refreshed} team={TEAM} />);
		const form = within(
			screen.getByRole("form", { name: `Permissions for ${MEMBER.email}` })
		);
		await user.click(form.getByRole("checkbox", { name: "Purchaser" }));
		await user.click(form.getByRole("button", { name: "Save" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Permission denied"
		);
		expect(form.getByRole("checkbox", { name: "Purchaser" })).toBeChecked();
		expect(refreshed).not.toHaveBeenCalled();
		await user.click(form.getByRole("button", { name: "Save" }));
		expect(form.getByRole("button", { name: "Saving…" })).toBeDisabled();
		expect(
			form.getByRole("checkbox", { name: "User" }).closest("[inert]")
		).not.toBeNull();
		await act(async () =>
			finish?.({ ...MEMBER, roles: ["user", "purchaser"] })
		);
		expect(update).toHaveBeenLastCalledWith("lab", MEMBER.email, [
			"user",
			"operator",
			"purchaser",
		]);
		expect(form.getByRole("checkbox", { name: "Operator" })).not.toBeChecked();
		expect(form.getByRole("button", { name: "Saved" })).toBeDisabled();
		expect(refreshed).toHaveBeenCalledOnce();
	});
	it("preserves an unsaved draft during member refresh and cancels to the latest server roles", async () => {
		const user = userEvent.setup();
		const view = renderWithQuery(
			<TeamMembers onUpdated={vi.fn()} team={TEAM} />
		);
		const form = within(
			screen.getByRole("form", { name: `Permissions for ${MEMBER.email}` })
		);
		await user.click(form.getByRole("checkbox", { name: "Purchaser" }));
		view.rerender(
			<TeamMembers
				onUpdated={vi.fn()}
				team={{ ...TEAM, members: [{ ...MEMBER, roles: ["user"] }, OWNER] }}
			/>
		);
		expect(form.getByRole("checkbox", { name: "Purchaser" })).toBeChecked();
		await user.click(form.getByRole("button", { name: "Cancel" }));
		expect(form.getByRole("checkbox", { name: "Purchaser" })).not.toBeChecked();
		expect(form.getByRole("checkbox", { name: "Operator" })).not.toBeChecked();
		expect(form.getByRole("button", { name: "Save" })).toBeDisabled();
	});
	it("does not remove the last current owner or clear every permission", async () => {
		const update = vi.spyOn(api, "updateTeamMember");
		const user = userEvent.setup();
		renderWithQuery(<TeamMembers onUpdated={vi.fn()} team={TEAM} />);
		const form = within(
			screen.getByRole("form", { name: `Permissions for ${OWNER.email}` })
		);
		await user.click(form.getByRole("checkbox", { name: "Owner" }));
		await user.click(form.getByRole("button", { name: "Save" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Keep at least one permission"
		);
		await user.click(form.getByRole("checkbox", { name: "User" }));
		await user.click(form.getByRole("button", { name: "Save" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Assign another current member as an owner"
		);
		expect(update).not.toHaveBeenCalled();
	});
	it("shows non-owner and pending memberships read-only", () => {
		const view = renderWithQuery(
			<TeamMembers
				onUpdated={vi.fn()}
				team={{ ...TEAM, effective_roles: ["user"] }}
			/>
		);
		expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
		view.rerender(
			<TeamMembers
				onUpdated={vi.fn()}
				team={{ ...TEAM, members: [{ ...MEMBER, invitation: true }] }}
			/>
		);
		expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
		expect(screen.getByText("Pending invitation")).toBeVisible();
	});
});
