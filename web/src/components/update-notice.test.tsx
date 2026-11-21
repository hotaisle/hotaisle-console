import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "../../test/render";
import { UpdateNotice } from "./update-notice";

const CURRENT = "2026-11-20T00:00:00.000Z";
const NEWER = "2026-11-21T00:00:00.000Z";
const PR = "https://github.com/hotaisle/hotaisle-console/pull/27";

beforeEach(() => {
	vi.useFakeTimers();
	vi.stubEnv("VITE_BUILD_DATE", CURRENT);
	vi.stubEnv("VITE_BUILD_PR_URL", PR);
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
});

async function settle() {
	await act(() => vi.advanceTimersByTimeAsync(1));
}

describe("application update notice", () => {
	it("offers the new release PR without reloading and dismisses only that build", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(Response.json({ builtAt: NEWER, prURL: PR }));
		vi.stubGlobal("fetch", fetcher);
		renderWithQuery(<UpdateNotice />);
		await settle();
		expect(screen.getByRole("button", { name: "Reload" })).toBeVisible();
		expect(screen.getByRole("link", { name: "What’s new ↗" })).toHaveAttribute(
			"href",
			PR
		);
		expect(fetcher).toHaveBeenCalledWith(
			"/version.json",
			expect.objectContaining({ cache: "no-store", credentials: "omit" })
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Dismiss update suggestion" })
		);
		expect(
			screen.queryByRole("button", { name: "Reload" })
		).not.toBeInTheDocument();
		fetcher.mockResolvedValue(
			Response.json({ builtAt: "2026-11-22T00:00:00.000Z", prURL: PR })
		);
		await act(() => vi.advanceTimersByTimeAsync(5 * 60_000));
		await settle();
		expect(screen.getByRole("button", { name: "Reload" })).toBeVisible();
	});
	it.each([
		{ builtAt: CURRENT, prURL: PR },
		{ builtAt: "2026-11-19T00:00:00.000Z", prURL: PR },
		{ builtAt: "invalid", prURL: PR },
		{ builtAt: NEWER, prURL: "https://example.invalid/pull/27" },
	])("ignores current, older, or invalid metadata: %j", async (metadata) => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(metadata)));
		renderWithQuery(<UpdateNotice />);
		await settle();
		expect(
			screen.queryByRole("button", { name: "Reload" })
		).not.toBeInTheDocument();
	});
	it("keeps failed background checks quiet", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Offline")));
		renderWithQuery(<UpdateNotice />);
		await settle();
		expect(
			screen.getByRole("complementary", { name: "Application updates" })
		).toBeEmptyDOMElement();
	});
	it("does not check releases in local development or preview", async () => {
		vi.stubEnv("VITE_BUILD_PR_URL", "");
		const fetcher = vi.fn();
		vi.stubGlobal("fetch", fetcher);
		renderWithQuery(<UpdateNotice />);
		await settle();
		expect(fetcher).not.toHaveBeenCalled();
	});
});
