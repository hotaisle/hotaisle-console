import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery, testClient } from "../../../test/render";
import { api } from "../../lib/api";
import { ConsoleLink, consoleURL } from "./console-link";

afterEach(() => vi.unstubAllEnvs());

describe("bare-metal console link", () => {
	it("permits the mock console only in an isolated preview build", () => {
		const page = new URL("http://preview.localhost:8787/__preview/");
		const mock = "http://preview.localhost:8787/__preview/console.html";
		vi.stubEnv("MODE", "preview");
		expect(consoleURL(mock, page)).toBe(mock);
		expect(() =>
			consoleURL("http://example.invalid/__preview/console.html", page)
		).toThrow();
		expect(() =>
			consoleURL("http://preview.localhost:8787/other", page)
		).toThrow();
		expect(() => consoleURL(mock, new URL("http://localhost:8787"))).toThrow();
		vi.stubEnv("MODE", "production");
		expect(() => consoleURL(mock, page)).toThrow();
	});
	it.each([
		"http://console.example.invalid/session",
		"javascript:alert(1)",
		"https://user:password@console.example.invalid/session",
		"not a URL",
	])(
		"hides a console entry when the API returns an unsafe URL: %s",
		async (url) => {
			vi.spyOn(api, "bareMetalConsole").mockResolvedValue({ url });
			renderWithQuery(
				<ConsoleLink onOpen={vi.fn()} server="server" team="lab" />
			);
			await waitFor(() => expect(testClient.isFetching()).toBe(0));
			expect(screen.queryByRole("link")).not.toBeInTheDocument();
			expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		}
	);
	it("hides unavailable access without displaying a failed preview action", async () => {
		const read = vi
			.spyOn(api, "bareMetalConsole")
			.mockRejectedValue(
				new Error("The preview cannot open a real server console.")
			);
		renderWithQuery(
			<ConsoleLink onOpen={vi.fn()} server="server" team="lab" />
		);
		await waitFor(() => expect(testClient.isFetching()).toBe(0));
		expect(read).toHaveBeenCalledWith("lab", "server");
		expect(screen.queryByRole("link")).not.toBeInTheDocument();
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});
});
