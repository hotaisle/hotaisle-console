import {
	createMemoryHistory,
	RouterProvider,
	useLocation,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCallback } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TestProvider } from "../../test/render";
import { useNavigation } from "../features/console/use-navigation";
import { useOrder } from "../features/launch/use-order";
import { APIError, api, type Team } from "../lib/api";
import { createAppRouter } from "./router";

function ConsoleProbe({ team }: { team: Team }) {
	const navigation = useNavigation(team.handle);
	const { order } = useOrder();
	const location = useLocation();
	const settings = useCallback(
		() => navigation.push("settings"),
		[navigation.push]
	);
	return (
		<main>
			<h1>{navigation.view}</h1>
			<p data-testid="team">{team.handle}</p>
			<p data-testid="machine">{navigation.focus}</p>
			<p data-testid="run">{navigation.runName}</p>
			<p data-testid="order">
				{order.count}:{order.image}
			</p>
			<p data-testid="url">{location.href}</p>
			<button onClick={settings} type="button">
				Settings
			</button>
			<button onClick={navigation.back} type="button">
				Back
			</button>
		</main>
	);
}
vi.mock("../features/console/console", () => ({ Console: ConsoleProbe }));
const TEAM: Team = {
	effective_roles: ["owner"],
	handle: "lab",
	name: "Lab",
	roles: ["owner"],
};
const USER = {
	created: "2026-01-01",
	email: "fixture@example.com",
	email_auth_enabled: true,
	name: "Fixture",
};
beforeEach(() => {
	vi.spyOn(api, "status").mockResolvedValue({
		email_login: true,
		key_stored: false,
		passkeys: false,
		signed_in: true,
		version: "test",
	});
	vi.spyOn(api, "user").mockResolvedValue({ teams: [TEAM], user: USER });
	localStorage.clear();
});
async function open(path: string) {
	const history = createMemoryHistory({ initialEntries: [path] });
	const router = createAppRouter(history);
	render(
		<TestProvider>
			<RouterProvider router={router} />
		</TestProvider>
	);
	await router.load();
	return { history, router };
}
describe("console URLs", () => {
	it("offers a password-manager compatible field when unlocking the browser vault", async () => {
		vi.spyOn(api, "status").mockResolvedValue({
			email_login: true,
			key_stored: true,
			passkeys: false,
			signed_in: false,
			version: "test",
		});
		await open("/unlock");
		const passphrase = await screen.findByLabelText("Unlock passphrase");
		expect(passphrase).toHaveAttribute("autocomplete", "current-password");
		expect(passphrase).toHaveAttribute("id", "current-password");
		expect(
			passphrase
				.closest("form")
				?.querySelector('input[autocomplete="username"]')
		).toHaveValue("Hot Aisle API key");
	});
	it("redirects old SSH-key URLs to Settings without losing launch choices", async () => {
		const { router } = await open("/teams/lab/keys?gpus=2&image=vllm");
		await screen.findByRole("heading", { name: "settings" });
		expect(router.state.location.pathname).toBe("/teams/lab/settings");
		expect(router.state.location.hash).toBe("ssh-keys");
		expect(screen.getByTestId("order")).toHaveTextContent("2:vllm");
	});
	it("loads a bookmarked settings page for its named team", async () => {
		await open("/teams/lab/settings");
		expect(
			await screen.findByRole("heading", { name: "settings" })
		).toBeInTheDocument();
		expect(screen.getByTestId("team")).toHaveTextContent("lab");
	});
	it("restores machine focus and launch choices from a deep link", async () => {
		await open("/teams/lab/machines/vm-42?gpus=4&image=vllm");
		expect(await screen.findByTestId("machine")).toHaveTextContent("vm-42");
		expect(screen.getByTestId("order")).toHaveTextContent("4:vllm");
	});
	it("updates the address and supports browser back navigation", async () => {
		const { router } = await open("/teams/lab/launch?gpus=2");
		await screen.findByRole("heading", { name: "order" });
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "Settings" }));
		await waitFor(() =>
			expect(router.state.location.pathname).toBe("/teams/lab/settings")
		);
		expect(screen.getByTestId("order")).toHaveTextContent("2:standard");
		await user.click(screen.getByRole("button", { name: "Back" }));
		await screen.findByRole("heading", { name: "order" });
		expect(router.state.location.pathname).toBe("/teams/lab/launch");
	});
	it("keeps the requested destination when sign-in is required", async () => {
		vi.spyOn(api, "status").mockResolvedValue({
			email_login: true,
			key_stored: false,
			passkeys: false,
			signed_in: false,
			version: "test",
		});
		const { router } = await open("/teams/lab/settings");
		await screen.findByRole("heading", { name: "Sign in" });
		expect(router.state.location.pathname).toBe("/sign-in");
		expect(router.state.location.search.returnTo).toBe("/teams/lab/settings");
	});
	it("restores an earlier run from its URL", async () => {
		await open("/teams/lab/history/vm-old");
		expect(await screen.findByTestId("run")).toHaveTextContent("vm-old");
		expect(screen.getByRole("heading", { name: "run" })).toBeInTheDocument();
	});
	it("moves a signed-in account without teams from email approval to team setup", async () => {
		vi.spyOn(api, "user").mockResolvedValue({ teams: [], user: USER });
		const { router } = await open("/sign-in/check-email");
		expect(
			await screen.findByRole("heading", { name: "Create a team" })
		).toBeInTheDocument();
		expect(router.state.location.pathname).toBe("/teams");
		expect(screen.getByLabelText("Team name")).toBeInTheDocument();
	});
	it("keeps the create-team page reachable for an existing member", async () => {
		const { router } = await open("/teams/new");
		await screen.findByRole("heading", { name: "Create a team" });
		expect(router.state.location.pathname).toBe("/teams/new");
	});
	it("creates a team through the API and opens the returned team", async () => {
		vi.spyOn(api, "user").mockResolvedValue({ teams: [], user: USER });
		const create = vi.spyOn(api, "createTeam").mockResolvedValue(TEAM);
		const { router } = await open("/teams");
		const user = userEvent.setup();
		await user.type(await screen.findByLabelText("Team name"), " Lab ");
		await user.type(screen.getByLabelText("Team handle"), "lab");
		await user.click(screen.getByRole("button", { name: "Create team" }));
		await screen.findByTestId("team");
		expect(create).toHaveBeenCalledWith({ handle: "lab", name: "Lab" });
		expect(router.state.location.pathname).toBe("/teams/lab/machines");
	});
	it("shows pending invitations and opens the team only after acceptance succeeds", async () => {
		vi.spyOn(api, "user").mockResolvedValue({
			teams: [{ ...TEAM, invitation: true }],
			user: USER,
		});
		const accept = vi
			.spyOn(api, "acceptTeamInvitation")
			.mockResolvedValue(TEAM);
		const { router } = await open("/teams");
		const user = userEvent.setup();
		await user.click(
			await screen.findByRole("button", { name: "Accept invitation to Lab" })
		);
		await screen.findByTestId("team");
		expect(accept).toHaveBeenCalledWith("lab");
		expect(router.state.location.pathname).toBe("/teams/lab/machines");
	});
	it("retains a failed invitation and does not enter the team", async () => {
		vi.spyOn(api, "user").mockResolvedValue({
			teams: [{ ...TEAM, invitation: true }],
			user: USER,
		});
		vi.spyOn(api, "acceptTeamInvitation").mockRejectedValue(
			new APIError(403, "Forbidden")
		);
		const { router } = await open("/teams");
		await userEvent
			.setup()
			.click(
				await screen.findByRole("button", { name: "Accept invitation to Lab" })
			);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"cannot accept invitations"
		);
		expect(router.state.location.pathname).toBe("/teams");
		expect(
			screen.getByRole("button", { name: "Accept invitation to Lab" })
		).toBeEnabled();
	});
});
