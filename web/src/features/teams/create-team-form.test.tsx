import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "../../../test/render";
import { APIError, api } from "../../lib/api";
import { CreateTeamForm } from "./create-team-form";

describe("create-team form", () => {
	it("blocks invalid handles and blank names without contacting the API", async () => {
		const create = vi.spyOn(api, "createTeam");
		const user = userEvent.setup();
		renderWithQuery(<CreateTeamForm onCreated={vi.fn()} />);
		await user.type(screen.getByLabelText("Team name"), "Lab");
		await user.type(screen.getByLabelText("Team handle"), "Invalid handle");
		await user.click(screen.getByRole("button", { name: "Create team" }));
		expect(screen.getByLabelText("Team handle")).toBeInvalid();
		expect(create).not.toHaveBeenCalled();
		await user.clear(screen.getByLabelText("Team handle"));
		await user.type(screen.getByLabelText("Team handle"), "lab_team-1");
		expect(screen.getByLabelText("Team handle")).toBeValid();
		await user.clear(screen.getByLabelText("Team name"));
		await user.type(screen.getByLabelText("Team name"), "   ");
		await user.click(screen.getByRole("button", { name: "Create team" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Enter a team name"
		);
		expect(create).not.toHaveBeenCalled();
	});
	it("retains entered values after a conflict and permits a corrected retry", async () => {
		const team = {
			effective_roles: ["owner"],
			handle: "lab-new",
			name: "Lab",
			roles: ["owner"],
		};
		const create = vi
			.spyOn(api, "createTeam")
			.mockRejectedValueOnce(new APIError(409, "Team handle already in use"))
			.mockResolvedValueOnce(team);
		const available = vi.fn();
		const user = userEvent.setup();
		renderWithQuery(<CreateTeamForm onCreated={available} />);
		await user.type(screen.getByLabelText("Team name"), "Lab");
		await user.type(screen.getByLabelText("Team handle"), "lab");
		await user.click(screen.getByRole("button", { name: "Create team" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Team handle already in use"
		);
		expect(screen.getByLabelText("Team name")).toHaveValue("Lab");
		expect(available).not.toHaveBeenCalled();
		await user.type(screen.getByLabelText("Team handle"), "-new");
		await user.click(screen.getByRole("button", { name: "Create team" }));
		await waitFor(() => expect(available).toHaveBeenCalledWith(team));
		expect(create).toHaveBeenLastCalledWith({ handle: "lab-new", name: "Lab" });
	});
});
