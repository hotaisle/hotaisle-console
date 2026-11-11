import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "../../../test/render";
import { APIError, api, type Team } from "../../lib/api";
import { EditTeamForm } from "./edit-team-form";

const TEAM: Team = {
	description: "Original description",
	effective_roles: ["owner"],
	handle: "lab",
	name: "Lab",
	roles: ["owner"],
};
describe("edit team details", () => {
	it("saves only changed fields and retains entered values after a rejected save", async () => {
		const save = vi
			.spyOn(api, "updateTeam")
			.mockRejectedValueOnce(new APIError(409, "Team name already in use"))
			.mockResolvedValueOnce({ ...TEAM, name: "New Lab" });
		const saved = vi.fn();
		const user = userEvent.setup();
		renderWithQuery(<EditTeamForm onSaved={saved} team={TEAM} />);
		await user.clear(screen.getByLabelText("Team name"));
		await user.type(screen.getByLabelText("Team name"), "New Lab");
		await user.click(screen.getByRole("button", { name: "Save changes" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Team name already in use"
		);
		expect(screen.getByLabelText("Team name")).toHaveValue("New Lab");
		expect(saved).not.toHaveBeenCalled();
		await user.click(screen.getByRole("button", { name: "Save changes" }));
		await waitFor(() =>
			expect(saved).toHaveBeenCalledWith({ ...TEAM, name: "New Lab" })
		);
		expect(save).toHaveBeenLastCalledWith("lab", { name: "New Lab" });
		expect(screen.getByRole("status")).toHaveTextContent("Team details saved.");
	});
	it("does not resend the unchanged name when only the description changes", async () => {
		const save = vi
			.spyOn(api, "updateTeam")
			.mockResolvedValue({ ...TEAM, description: "New description" });
		const user = userEvent.setup();
		renderWithQuery(<EditTeamForm onSaved={vi.fn()} team={TEAM} />);
		await user.clear(screen.getByLabelText("Description"));
		await user.type(screen.getByLabelText("Description"), "New description");
		await user.click(screen.getByRole("button", { name: "Save changes" }));
		await waitFor(() =>
			expect(save).toHaveBeenCalledWith("lab", {
				description: "New description",
			})
		);
	});
	it("rejects a blank name without writing to the API", async () => {
		const save = vi.spyOn(api, "updateTeam");
		const user = userEvent.setup();
		renderWithQuery(<EditTeamForm onSaved={vi.fn()} team={TEAM} />);
		await user.clear(screen.getByLabelText("Team name"));
		await user.type(screen.getByLabelText("Team name"), "   ");
		await user.click(screen.getByRole("button", { name: "Save changes" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Enter a team name."
		);
		expect(screen.getByLabelText("Team name")).toHaveFocus();
		expect(save).not.toHaveBeenCalled();
	});
});
