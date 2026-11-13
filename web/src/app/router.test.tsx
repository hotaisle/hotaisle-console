import { focusManager } from "@tanstack/react-query";
import {
	createMemoryHistory,
	RouterProvider,
	useLocation,
} from "@tanstack/react-router";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCallback } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { machineKey } from "../../../shared/machine-identity";
import { TestProvider, testClient } from "../../test/render";
import { useNavigation } from "../features/console/use-navigation";
import { useOrder } from "../features/launch/use-order";
import { ACCOUNT_KEY, STATUS_KEY } from "../hooks/use-session";
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
afterEach(() => {
	vi.useRealTimers();
	focusManager.setFocused(undefined);
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
	it.each(["virtual_machines", "bare_metal"])(
		"restores the API resource kind in canonical %s URLs",
		async (kind) => {
			await open(`/teams/lab/machines/${kind}/same-name`);
			expect(await screen.findByTestId("machine")).toHaveTextContent(
				machineKey("lab", { metal: kind === "bare_metal", name: "same-name" })
			);
		}
	);
	it("rejects an unknown API collection instead of treating it as a VM", async () => {
		await open("/teams/lab/machines/unknown/same-name");
		expect(
			await screen.findByRole("heading", { name: "Page not found" })
		).toBeInTheDocument();
		expect(screen.queryByTestId("machine")).not.toBeInTheDocument();
	});
	it("does not apply an old account's delayed team creation to a new sign-in", async () => {
		let finishCreate: ((team: Team) => void) | undefined;
		vi.spyOn(api, "createTeam").mockImplementation(
			() =>
				new Promise<Team>((resolve) => {
					finishCreate = resolve;
				})
		);
		vi.spyOn(api, "signOut").mockResolvedValue({ ok: true });
		const { router } = await open("/teams/new");
		const user = userEvent.setup();
		await user.type(await screen.findByLabelText("Team name"), "Old team");
		await user.type(screen.getByLabelText("Team handle"), "old-team");
		await user.click(screen.getByRole("button", { name: "Create team" }));
		await waitFor(() => expect(api.createTeam).toHaveBeenCalledOnce());
		await user.click(screen.getByRole("button", { name: "Sign out" }));
		await waitFor(() =>
			expect(
				testClient.getQueryData<{ signed_in: boolean }>(STATUS_KEY)?.signed_in
			).toBe(false)
		);
		const other = {
			created: "2026-02-01",
			email: "other@example.invalid",
			email_auth_enabled: true,
			name: "Other",
		};
		vi.mocked(api.user).mockResolvedValue({ teams: [TEAM], user: other });
		act(() => {
			testClient.setQueryData(ACCOUNT_KEY, { teams: [TEAM], user: other });
			testClient.setQueryData(STATUS_KEY, {
				email_login: true,
				key_stored: false,
				passkeys: false,
				signed_in: true,
				version: "test",
			});
		});
		await act(async () => {
			finishCreate?.({ ...TEAM, handle: "old-team", name: "Old team" });
			await Promise.resolve();
		});
		expect(
			testClient.getQueryData<{ teams: Team[] }>(ACCOUNT_KEY)?.teams
		).toEqual([TEAM]);
		expect(router.state.location.pathname).not.toContain("old-team");
	});
	it("opens the team editor from the chooser", async () => {
		vi.spyOn(api, "team").mockResolvedValue(TEAM);
		const { router } = await open("/teams");
		await userEvent
			.setup()
			.click(await screen.findByRole("link", { name: "Manage team Lab" }));
		expect(await screen.findByLabelText("Team name")).toHaveValue("Lab");
		expect(router.state.location.pathname).toBe("/teams/lab/details");
	});
	it("deep-links to team details and updates the chooser from a successful save", async () => {
		vi.spyOn(api, "team").mockResolvedValue(TEAM);
		vi.spyOn(api, "updateTeam").mockResolvedValue({
			...TEAM,
			description: "GPU research",
			name: "Renamed Lab",
		});
		const { router } = await open("/teams/lab/details");
		const user = userEvent.setup();
		await user.clear(await screen.findByLabelText("Team name"));
		await user.type(screen.getByLabelText("Team name"), "Renamed Lab");
		await user.type(screen.getByLabelText("Description"), "GPU research");
		await user.click(screen.getByRole("button", { name: "Save changes" }));
		await screen.findByText("Team details saved.");
		expect(router.state.location.pathname).toBe("/teams/lab/details");
		await user.click(screen.getByRole("link", { name: "Back to your teams" }));
		expect(
			await screen.findByRole("link", { name: "Open team Renamed Lab" })
		).toBeInTheDocument();
	});
	it("shows a direct team-details URL read-only without owner access", async () => {
		vi.spyOn(api, "team").mockResolvedValue({
			...TEAM,
			effective_roles: ["user"],
		});
		await open("/teams/lab/details");
		expect(
			await screen.findByText("A team owner can edit these details.")
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Save changes" })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Send email invitation" })
		).not.toBeInTheDocument();
	});
	it("invites from a deep-linked team page and reloads authoritative pending members", async () => {
		const owner = {
			created: "2026-01-01",
			email: "fixture@example.com",
			name: "Fixture",
			roles: ["owner" as const],
		};
		const pending = {
			created: "2026-02-01",
			email: "dana@example.com",
			invitation: true,
			name: "Dana Doe",
			roles: ["user" as const],
		};
		const getTeam = vi
			.spyOn(api, "team")
			.mockResolvedValue({ ...TEAM, members: [owner] });
		const invite = vi.spyOn(api, "inviteTeamMember").mockImplementation(() => {
			getTeam.mockResolvedValue({ ...TEAM, members: [owner, pending] });
			return Promise.resolve();
		});
		const { router } = await open("/teams/lab/details");
		const user = userEvent.setup();
		const form = within(
			await screen.findByRole("form", { name: "Invite someone" })
		);
		await user.type(form.getByRole("textbox", { name: "Name" }), pending.name);
		await user.type(form.getByLabelText("Email address"), pending.email);
		await user.click(
			form.getByRole("button", { name: "Send email invitation" })
		);
		expect(await screen.findByRole("status")).toHaveTextContent(
			"Invitation sent to dana@example.com."
		);
		await screen.findByRole("cell", { name: "Pending" });
		const members = screen.getByRole("table", {
			name: "Team members and invitations",
		});
		expect(
			within(members).getByRole("rowheader", { name: "Dana Doe" })
		).toBeInTheDocument();
		expect(invite).toHaveBeenCalledWith("lab", {
			email: pending.email,
			name: pending.name,
			roles: ["user"],
		});
		expect(
			testClient.getQueryData<Team>(["resource", "team-details", "lab"])
				?.members
		).toEqual([owner, pending]);
		expect(router.state.location.pathname).toBe("/teams/lab/details");
	});
	it("automatically moves an accepted invitation into current members", async () => {
		vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
		focusManager.setFocused(true);
		const member = {
			created: "2026-01-01",
			email: "dana@example.com",
			name: "Dana",
			roles: ["user" as const],
		};
		const getTeam = vi.spyOn(api, "team").mockResolvedValue({
			...TEAM,
			members: [{ ...member, invitation: true }],
		});
		await open("/teams/lab/details");
		await screen.findByRole("cell", { name: "Pending" });
		getTeam.mockResolvedValue({ ...TEAM, members: [member] });
		await act(async () => vi.advanceTimersByTime(10_000));
		expect(
			await screen.findByRole("cell", { name: "Current" })
		).toBeInTheDocument();
		expect(
			screen.queryByRole("cell", { name: "Pending" })
		).not.toBeInTheDocument();
	});
	it("refreshes the team chooser automatically, pauses in background, and stops polling while creating a team", async () => {
		vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
		focusManager.setFocused(true);
		const { router } = await open("/teams");
		await screen.findByRole("link", { name: "Open team Lab" });
		const getAccount = vi.mocked(api.user);
		getAccount.mockClear();
		getAccount.mockResolvedValue({
			teams: [
				TEAM,
				{
					...TEAM,
					handle: "new-invite",
					invitation: true,
					name: "New invitation",
				},
			],
			user: USER,
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(30_000);
		});
		expect(getAccount).toHaveBeenCalledOnce();
		expect(
			await screen.findByRole("button", {
				name: "Accept invitation to New invitation",
			})
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Refresh teams" })
		).not.toBeInTheDocument();
		focusManager.setFocused(false);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(30_000);
		});
		expect(getAccount).toHaveBeenCalledOnce();
		await act(async () => {
			focusManager.setFocused(true);
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(getAccount).toHaveBeenCalledTimes(2);
		await act(async () => {
			await router.navigate({ to: "/teams/new" });
		});
		const before = getAccount.mock.calls.length;
		await act(async () => {
			await vi.advanceTimersByTimeAsync(30_000);
		});
		expect(getAccount).toHaveBeenCalledTimes(before);
	});
	it("keeps the team list visible after a background update fails and offers a retry beside it", async () => {
		await open("/teams");
		await screen.findByRole("link", { name: "Open team Lab" });
		vi.mocked(api.user).mockRejectedValueOnce(
			new APIError(503, "Temporarily unavailable")
		);
		await act(async () => {
			await testClient.refetchQueries({ queryKey: ["auth", "account"] });
		});
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Your current list is still shown"
		);
		expect(
			screen.getByRole("link", { name: "Open team Lab" })
		).toBeInTheDocument();
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: "Retry update" }));
		await waitFor(() =>
			expect(screen.queryByRole("alert")).not.toBeInTheDocument()
		);
	});
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
	it("restores the email comparison code from the pending session after reload", async () => {
		vi.mocked(api.status).mockResolvedValue({
			email_login: true,
			key_stored: false,
			passkeys: false,
			signed_in: false,
			version: "test",
			waiting_for_email: {
				email: "fixture@example.test",
				expires_at: "2030-01-01",
				request_code: "Q9W1-DFWF",
			},
		});
		vi.spyOn(api, "emailWait").mockResolvedValue({ done: false });
		const { router } = await open("/sign-in/check-email");
		expect(await screen.findByText("Q9W1-DFWF")).toBeVisible();
		expect(router.state.location.pathname).toBe("/sign-in/check-email");
	});
	it.each(["virtual_machines", "bare_metal"])(
		"restores the API resource kind in canonical %s URLs",
		async (kind) => {
			await open(`/teams/lab/machines/${kind}/same-name`);
			expect(await screen.findByTestId("machine")).toHaveTextContent(
				machineKey("lab", { metal: kind === "bare_metal", name: "same-name" })
			);
		}
	);
});
