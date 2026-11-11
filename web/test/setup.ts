import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { historyVault } from "../src/lib/history-vault";
import { testClient } from "./render";

// jsdom has no layout engine; scroll restoration is verified in the browser.
beforeEach(() => {
	vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
	// jsdom does not implement media queries; individual tests can change matches.
	vi.stubGlobal(
		"matchMedia",
		vi.fn((media: string) =>
			Object.assign(new EventTarget(), {
				addListener: vi.fn(),
				matches: false,
				media,
				onchange: null,
				removeListener: vi.fn(),
			})
		)
	);
});
afterEach(() => {
	cleanup();
	historyVault.lock();
	testClient.clear();
	vi.unstubAllGlobals();
});
