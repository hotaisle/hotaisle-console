import { focusManager } from "@tanstack/react-query";
import {
	createMemoryHistory,
	RouterProvider,
	useLocation,
} from "@tanstack/react-router";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCallback } from "react";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
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
const nativeDialogMethods = new Map(
	["showModal", "close"].map((method) => [
		method,
		Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, method),
	])
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
afterAll(() => {
	for (const [method, descriptor] of nativeDialogMethods) {
		if (descriptor) {
			Object.defineProperty(HTMLDialogElement.prototype, method, descriptor);
		} else {
			Reflect.deleteProperty(HTMLDialogElement.prototype, method);
		}
	}
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
const API_TOKEN_LABEL = /^API token:/u;

describe("console URLs", () => {
	it("opens a team's token list from its card and creates grants only for that team", async () => {
		vi.mocked(api.status).mockResolvedValue({
			email_login: true,
			key_stored: false,
			kind: "email",
			passkeys: false,
			signed_in: true,
			version: "test",
		});
		vi.mocked(api.user).mockResolvedValue({
			teams: [TEAM, { ...TEAM, handle: "research", name: "Research" }],
			user: USER,
		});
		const existing = [
			{
				label: "Lab CLI",
				prefix: "lab-prefix",
				teams: [{ handle: "lab", name: "Lab", roles: ["owner" as const] }],
				user_role: "user" as const,
			},
			{
				label: "Research CLI",
				prefix: "research-prefix",
				teams: [
					{ handle: "research", name: "Research", roles: ["owner" as const] },
				],
				user_role: "user" as const,
			},
		];
		const list = vi.spyOn(api, "apiTokens").mockResolvedValue(existing);
		const details = {
			...existing[0],
			label: "Lab automation",
			prefix: "new-team-prefix",
		};
		const create = vi.spyOn(api, "createAPIToken").mockImplementation(() => {
			list.mockResolvedValue([...existing, details]);
			return Promise.resolve({ ...details, token: "scoped-fixture-secret" });
		});
		const { router } = await open("/teams");
		const user = userEvent.setup();
		expect(
			screen.queryByText(
				"Open an existing team, accept an invitation, or create a new team."
			)
		).not.toBeInTheDocument();
		await user.click(
			await screen.findByRole("link", { name: "API tokens for Lab" })
		);
		expect(router.state.location.search.tokenTeam).toBe("lab");
		expect(await screen.findByText("Lab CLI")).toBeVisible();
		expect(screen.queryByText("Research CLI")).not.toBeInTheDocument();
		expect(
			screen.queryByText("Manage access for your applications and scripts.")
		).not.toBeInTheDocument();
		await user.click(screen.getByRole("link", { name: "Create API token" }));
		expect(await screen.findByRole("group", { name: "Lab lab" })).toBeVisible();
		expect(
			screen.queryByRole("group", { name: "Research research" })
		).not.toBeInTheDocument();
		await user.type(screen.getByLabelText("Label"), "Lab automation");
		await user.click(screen.getByRole("button", { name: "Create token" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Choose at least one permission for this team."
		);
		expect(create).not.toHaveBeenCalled();
		await user.click(screen.getByRole("checkbox", { name: "Owner" }));
		await user.click(screen.getByRole("button", { name: "Create token" }));
		expect(await screen.findByLabelText(API_TOKEN_LABEL)).toHaveValue(
			"scoped-fixture-secret"
		);
		expect(create).toHaveBeenCalledWith({
			label: "Lab automation",
			teams: [{ roles: ["owner"], team: "lab" }],
			user_role: "user",
		});
		expect(router.state.location.search.tokenTeam).toBe("lab");
		await act(() =>
			router.navigate({
				search: { tokenTeam: "research" },
				to: "/account/api-tokens",
			})
		);
		expect(await screen.findByText("Research CLI")).toBeVisible();
		expect(
			screen.queryByDisplayValue("scoped-fixture-secret")
		).not.toBeInTheDocument();
		await act(() =>
			router.navigate({
				search: { tokenTeam: "lab" },
				to: "/account/api-tokens",
			})
		);
		expect(
			screen.queryByDisplayValue("scoped-fixture-secret")
		).not.toBeInTheDocument();
	});
	it("does not substitute another team or token for an inaccessible team scope", async () => {
		vi.spyOn(api, "apiTokens").mockResolvedValue([
			{
				label: "Private automation",
				prefix: "fixture-prefix",
				teams: [],
				user_role: "user",
			},
		]);
		await open("/account/api-tokens?tokenTeam=unknown");
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"not a member of this team"
		);
		expect(screen.queryByText("Private automation")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: "Team console" })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: "Create API token" })
		).not.toBeInTheDocument();
	});
	it("does not open another team's token through a scoped edit URL", async () => {
		vi.spyOn(api, "apiTokens").mockResolvedValue([
			{
				label: "Research CLI",
				prefix: "other-prefix",
				teams: [{ handle: "research", name: "Research", roles: ["user"] }],
				user_role: "user",
			},
		]);
		await open("/account/api-tokens/other-prefix?tokenTeam=lab");
		expect(await screen.findByRole("alert")).toHaveTextContent("not found");
		expect(screen.queryByLabelText("Label")).not.toBeInTheDocument();
	});
	it("signs out after explicitly revoking the token used for the current sign-in", async () => {
		vi.mocked(api.status).mockResolvedValue({
			email_login: true,
			key_stored: false,
			kind: "key",
			passkeys: false,
			signed_in: true,
			version: "test",
		});
		vi.spyOn(api, "activeTokenPrefix").mockReturnValue("current-prefix");
		vi.spyOn(api, "apiTokens").mockResolvedValue([
			{
				label: "Current token",
				prefix: "current-prefix",
				teams: [],
				user_role: "owner",
			},
		]);
		vi.spyOn(api, "revokeAPIToken").mockResolvedValue(undefined);
		const signOut = vi.spyOn(api, "signOut").mockResolvedValue({ ok: true });
		await open("/account/api-tokens");
		const user = userEvent.setup();
		await user.click(await screen.findByRole("button", { name: "Revoke" }));
		expect(
			screen.getByText(
				"This is the token you are signed in with. Revoking it will sign you out."
			)
		).toBeVisible();
		expect(
			within(screen.getByRole("dialog")).queryByRole("button", {
				name: "Close",
			})
		).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Revoke token" }));
		await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
		expect(
			await screen.findByRole("heading", { name: "Sign in" })
		).toBeVisible();
	});
	it("does not expose a late-created token after the account changes", async () => {
		vi.mocked(api.status).mockResolvedValue({
			email_login: true,
			key_stored: false,
			kind: "email",
			passkeys: false,
			signed_in: true,
			version: "test",
		});
		vi.spyOn(api, "apiTokens").mockResolvedValue([]);
		const details = {
			label: "Old account",
			prefix: "old-account-prefix",
			teams: [],
			user_role: "user" as const,
		};
		let resolve: (value: typeof details & { token: string }) => void = () =>
			undefined;
		const request = new Promise<typeof details & { token: string }>((done) => {
			resolve = done;
		});
		vi.spyOn(api, "createAPIToken").mockReturnValue(request);
		await open("/account/api-tokens/new");
		const user = userEvent.setup();
		await user.type(await screen.findByLabelText("Label"), "Old account");
		await user.click(screen.getByRole("button", { name: "Create token" }));
		const other = {
			teams: [TEAM],
			user: { ...USER, email: "other@example.test" },
		};
		vi.mocked(api.user).mockResolvedValue(other);
		act(() => {
			testClient.setQueryData(ACCOUNT_KEY, other);
		});
		await act(async () => {
			resolve({ ...details, token: "late-fixture-secret" });
			await request;
		});
		expect(
			screen.queryByDisplayValue("late-fixture-secret")
		).not.toBeInTheDocument();
		expect(JSON.stringify(testClient.getQueriesData({}))).not.toContain(
			"old-account-prefix"
		);
	});
	it("opens account-wide API tokens without requiring a team and preserves the sign-in destination", async () => {
		vi.mocked(api.status).mockResolvedValue({
			email_login: true,
			key_stored: false,
			passkeys: false,
			signed_in: false,
			version: "test",
		});
		const { router } = await open("/account/api-tokens/new");
		await screen.findByRole("heading", { name: "Sign in" });
		expect(router.state.location.search.returnTo).toBe(
			"/account/api-tokens/new"
		);
	});
	it("lists tokens for an account with no teams and hides mutation controls for read-only sign-ins", async () => {
		vi.mocked(api.user).mockResolvedValue({ teams: [], user: USER });
		vi.spyOn(api, "apiTokens").mockResolvedValue([
			{
				label: "Automation",
				prefix: "fixture-prefix",
				teams: [],
				user_role: "user",
			},
		]);
		await open("/account/api-tokens");
		expect(await screen.findByText("Automation")).toBeVisible();
		expect(
			screen.queryByRole("link", { name: "Create API token" })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Revoke" })
		).not.toBeInTheDocument();
	});
	it("offers all accepted team memberships when creating a token from one team's settings", async () => {
		vi.mocked(api.status).mockResolvedValue({
			email_login: true,
			key_stored: false,
			kind: "email",
			passkeys: false,
			signed_in: true,
			version: "test",
		});
		vi.mocked(api.user).mockResolvedValue({
			teams: [
				TEAM,
				{ ...TEAM, handle: "research", name: "Research", roles: ["operator"] },
				{ ...TEAM, handle: "pending", invitation: true, name: "Pending team" },
			],
			user: USER,
		});
		vi.spyOn(api, "apiTokens").mockResolvedValue([]);
		const { router } = await open(
			"/account/api-tokens/new?returnTo=%2Fteams%2Flab%2Fsettings"
		);
		const breadcrumbs = within(
			await screen.findByRole("navigation", { name: "Breadcrumbs" })
		);
		expect(
			breadcrumbs.getByRole("link", { name: "Create token" })
		).toHaveAttribute("aria-current", "page");
		expect(
			breadcrumbs.getByRole("link", { name: "Your teams" })
		).toHaveAttribute("href", "/teams");
		expect(screen.getByRole("link", { name: "Team console" })).toHaveAttribute(
			"href",
			"/teams/lab/machines"
		);
		expect(await screen.findByRole("group", { name: "Lab lab" })).toBeVisible();
		const research = within(
			screen.getByRole("group", { name: "Research research" })
		);
		expect(research.getByRole("checkbox", { name: "Operator" })).toBeVisible();
		expect(
			research.queryByRole("checkbox", { name: "Owner" })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("group", { name: "Pending team pending" })
		).not.toBeInTheDocument();
		await userEvent
			.setup()
			.click(breadcrumbs.getByRole("link", { name: "API tokens" }));
		expect(router.state.location.pathname).toBe("/account/api-tokens");
		expect(router.state.location.search.returnTo).toBe("/teams/lab/settings");
		expect(screen.getByRole("link", { name: "API tokens" })).toHaveAttribute(
			"aria-current",
			"page"
		);
	});
	it("creates a token, shows its value once, and never caches or stores the secret", async () => {
		vi.mocked(api.status).mockResolvedValue({
			email_login: true,
			key_stored: false,
			kind: "email",
			passkeys: false,
			signed_in: true,
			version: "test",
		});
		const details = {
			label: "Deployment",
			prefix: "new-prefix",
			teams: [],
			user_role: "user" as const,
		};
		const list = vi.spyOn(api, "apiTokens").mockResolvedValue([]);
		vi.spyOn(api, "createAPIToken").mockImplementation(() => {
			list.mockResolvedValue([details]);
			return Promise.resolve({ ...details, token: "one-time-fixture-secret" });
		});
		const { router } = await open("/account/api-tokens/new");
		const user = userEvent.setup();
		await user.type(await screen.findByLabelText("Label"), "Deployment");
		await user.click(screen.getByRole("button", { name: "Create token" }));
		expect(await screen.findByLabelText(API_TOKEN_LABEL)).toHaveValue(
			"one-time-fixture-secret"
		);
		await waitFor(() =>
			expect(router.state.location.pathname).toBe("/account/api-tokens")
		);
		expect(JSON.stringify(testClient.getQueriesData({}))).not.toContain(
			"one-time-fixture-secret"
		);
		expect(
			JSON.stringify(testClient.getMutationCache().getAll())
		).not.toContain("one-time-fixture-secret");
		expect(JSON.stringify(localStorage)).not.toContain(
			"one-time-fixture-secret"
		);
		await user.click(screen.getByRole("button", { name: "I saved it" }));
		expect(screen.queryByLabelText(API_TOKEN_LABEL)).not.toBeInTheDocument();
		await user.click(screen.getByRole("link", { name: "Edit" }));
		expect(router.state.location.pathname).toBe(
			"/account/api-tokens/new-prefix"
		);
		expect(
			screen.queryByDisplayValue("one-time-fixture-secret")
		).not.toBeInTheDocument();
	});
	it("requires confirmation for revocation and keeps rejected revocations visible", async () => {
		vi.mocked(api.status).mockResolvedValue({
			email_login: true,
			key_stored: false,
			kind: "email",
			passkeys: false,
			signed_in: true,
			version: "test",
		});
		vi.spyOn(api, "apiTokens").mockResolvedValue([
			{
				label: "Automation",
				prefix: "fixture-prefix",
				teams: [],
				user_role: "user",
			},
		]);
		const revoke = vi
			.spyOn(api, "revokeAPIToken")
			.mockRejectedValue(new Error("Revocation rejected"));
		await open("/account/api-tokens");
		const user = userEvent.setup();
		await user.click(await screen.findByRole("button", { name: "Revoke" }));
		expect(revoke).not.toHaveBeenCalled();
		expect(
			screen.getByRole("dialog", { name: "Revoke API token?" })
		).toBeVisible();
		await user.click(screen.getByRole("button", { name: "Revoke token" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Revocation rejected"
		);
		expect(screen.getByRole("dialog")).toBeVisible();
		expect(
			within(screen.getByRole("list", { name: "Your API tokens" })).getByText(
				"Automation"
			)
		).toBeVisible();
	});
	it("does not show an unrelated token for an unknown token URL", async () => {
		vi.spyOn(api, "apiTokens").mockResolvedValue([]);
		await open("/account/api-tokens/unknown-prefix");
		expect(await screen.findByRole("alert")).toHaveTextContent("not found");
		expect(screen.queryByLabelText("Label")).not.toBeInTheDocument();
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
});
