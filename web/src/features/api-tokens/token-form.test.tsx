import {
	act,
	fireEvent,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "../../../test/render";
import { type APIToken, api, type Team } from "../../lib/api";
import { TokenForm } from "./token-form";

const TEAM: Team = {
	effective_roles: ["owner"],
	handle: "lab",
	name: "Lab",
	roles: ["owner", "operator", "user"],
};
const TOKEN: APIToken = {
	label: "Automation",
	prefix: "fixture-prefix",
	teams: [{ handle: "lab", name: "Lab", roles: ["operator"] }],
	user_role: "user",
};

describe("API token form", () => {
	it("requires a nonblank label before enabling token creation", async () => {
		const create = vi.spyOn(api, "createAPIToken");
		renderWithQuery(<TokenForm onSaved={vi.fn()} teams={[TEAM]} />);
		const button = screen.getByRole("button", { name: "Create token" });
		const label = screen.getByLabelText("Label");
		const user = userEvent.setup();
		expect(button).toBeDisabled();
		await user.type(label, "   ");
		expect(button).toBeDisabled();
		await user.type(label, "Automation");
		expect(button).toBeEnabled();
		await user.clear(label);
		expect(button).toBeDisabled();
		expect(create).not.toHaveBeenCalled();
	});
	it("enables Save only for changed values and prevents unchanged submissions", async () => {
		const update = vi.spyOn(api, "updateAPIToken");
		renderWithQuery(
			<TokenForm onSaved={vi.fn()} teams={[TEAM]} token={TOKEN} />
		);
		const save = screen.getByRole("button", { name: "Save token" });
		const label = screen.getByLabelText("Label");
		const user = userEvent.setup();
		expect(save).toBeDisabled();
		expect(
			screen.queryByRole("heading", { name: "Edit token" })
		).not.toBeInTheDocument();
		await act(() => {
			fireEvent.submit(screen.getByRole("form", { name: "Edit token" }));
		});
		expect(update).not.toHaveBeenCalled();
		await user.type(label, " ");
		expect(save).toBeDisabled();
		await user.type(label, "new");
		expect(save).toBeEnabled();
		await user.clear(label);
		await user.type(label, TOKEN.label);
		expect(save).toBeDisabled();
		await user.click(screen.getByRole("radio", { name: "Owner" }));
		expect(save).toBeEnabled();
		await user.click(screen.getByRole("radio", { name: "User" }));
		expect(save).toBeDisabled();
		await user.click(screen.getByRole("checkbox", { name: "Operator" }));
		expect(save).toBeEnabled();
		await user.click(screen.getByRole("checkbox", { name: "Operator" }));
		expect(save).toBeDisabled();
		expect(update).not.toHaveBeenCalled();
	});
	it("treats restored grants as unchanged even when team and role order differs", async () => {
		const research = { ...TEAM, handle: "research", name: "Research" };
		const token: APIToken = {
			...TOKEN,
			teams: [
				{ handle: "lab", name: "Lab", roles: ["operator", "user"] },
				{ handle: "research", name: "Research", roles: ["user"] },
			],
		};
		renderWithQuery(
			<TokenForm onSaved={vi.fn()} teams={[TEAM, research]} token={token} />
		);
		const save = screen.getByRole("button", { name: "Save token" });
		const operator = within(
			screen.getByRole("group", { name: "Lab lab" })
		).getByRole("checkbox", { name: "Operator" });
		const user = userEvent.setup();
		await user.click(operator);
		expect(save).toBeEnabled();
		await user.click(operator);
		expect(save).toBeDisabled();
	});
	it("groups every membership and keeps grants independent between teams", async () => {
		const second: Team = {
			...TEAM,
			handle: "research",
			name: "Research",
			roles: ["operator"],
		};
		const create = vi.spyOn(api, "createAPIToken").mockResolvedValue({
			...TOKEN,
			token: "fixture-secret",
		});
		renderWithQuery(<TokenForm onSaved={vi.fn()} teams={[TEAM, second]} />);
		const lab = within(screen.getByRole("group", { name: "Lab lab" }));
		const research = within(
			screen.getByRole("group", { name: "Research research" })
		);
		expect(lab.getAllByRole("checkbox")).toHaveLength(3);
		expect(research.getAllByRole("checkbox")).toHaveLength(1);
		expect(
			research.queryByRole("checkbox", { name: "Owner" })
		).not.toBeInTheDocument();
		const user = userEvent.setup();
		await user.type(screen.getByLabelText("Label"), "Two teams");
		await user.click(lab.getByRole("checkbox", { name: "User" }));
		await user.click(research.getByRole("checkbox", { name: "Operator" }));
		expect(lab.getByRole("checkbox", { name: "Operator" })).not.toBeChecked();
		await user.click(screen.getByRole("button", { name: "Create token" }));
		await waitFor(() =>
			expect(create).toHaveBeenCalledWith({
				label: "Two teams",
				teams: [
					{ roles: ["user"], team: "lab" },
					{ roles: ["operator"], team: "research" },
				],
				user_role: "user",
			})
		);
	});
	it("defaults to read-only account access and no team access, and separates the one-time secret from metadata", async () => {
		const create = vi
			.spyOn(api, "createAPIToken")
			.mockResolvedValue({ ...TOKEN, token: "fixture-secret" });
		const saved = vi.fn().mockResolvedValue(undefined);
		const { client } = renderWithQuery(
			<TokenForm onSaved={saved} teams={[TEAM]} />
		);
		const user = userEvent.setup();
		expect(screen.getByRole("radio", { name: "User" })).toBeChecked();
		for (const checkbox of screen.getAllByRole("checkbox")) {
			expect(checkbox).not.toBeChecked();
		}
		await user.type(screen.getByLabelText("Label"), "Deployment");
		await user.click(screen.getByRole("button", { name: "Create token" }));
		await waitFor(() =>
			expect(create).toHaveBeenCalledWith({
				label: "Deployment",
				teams: [],
				user_role: "user",
			})
		);
		expect(saved).toHaveBeenCalledWith(TOKEN, "fixture-secret");
		expect(JSON.stringify(client.getMutationCache().getAll())).not.toContain(
			"fixture-secret"
		);
	});
	it("sends explicit team permissions and account owner access only when selected", async () => {
		const create = vi
			.spyOn(api, "createAPIToken")
			.mockResolvedValue({ ...TOKEN, token: "fixture-secret" });
		renderWithQuery(<TokenForm onSaved={vi.fn()} teams={[TEAM]} />);
		const user = userEvent.setup();
		await user.type(screen.getByLabelText("Label"), "Deploy");
		await user.click(
			screen.getByRole("radio", {
				name: "Owner",
			})
		);
		await user.click(screen.getByRole("checkbox", { name: "Operator" }));
		await user.click(screen.getByRole("button", { name: "Create token" }));
		await waitFor(() =>
			expect(create).toHaveBeenCalledWith({
				label: "Deploy",
				teams: [{ roles: ["operator"], team: "lab" }],
				user_role: "owner",
			})
		);
	});
	it("preserves permissions on label-only edits and keeps failed saves visible", async () => {
		const update = vi
			.spyOn(api, "updateAPIToken")
			.mockRejectedValue(new Error("Owner access required"));
		const saved = vi.fn();
		renderWithQuery(<TokenForm onSaved={saved} teams={[TEAM]} token={TOKEN} />);
		const user = userEvent.setup();
		await user.clear(screen.getByLabelText("Label"));
		await user.type(screen.getByLabelText("Label"), "Renamed");
		await user.click(screen.getByRole("button", { name: "Save token" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Owner access required"
		);
		expect(update).toHaveBeenCalledWith(TOKEN.prefix, {
			label: "Renamed",
			teams: undefined,
			user_role: "user",
		});
		expect(saved).not.toHaveBeenCalled();
		expect(screen.getByLabelText("Label")).toHaveValue("Renamed");
	});
});
