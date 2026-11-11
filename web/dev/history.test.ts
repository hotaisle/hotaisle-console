import { afterEach, describe, expect, it } from "vitest";
import { createPreviewHistory } from "./history";

afterEach(() => window.history.replaceState(null, "", "/"));
describe("preview route history", () => {
	it("keeps scenario selection outside route queries when restoring and navigating", () => {
		window.history.replaceState(
			null,
			"",
			"/__preview/?scenario=history#/teams/preview/history?q=Training+run+175&page=2"
		);
		const history = createPreviewHistory();
		try {
			expect(history.location.search).toBe("?q=Training+run+175&page=2");
			history.push("/teams/preview/history?q=another&page=3");
			history.flush();
			expect(window.location.search).toBe("?scenario=history");
			expect(window.location.hash).toBe(
				"#/teams/preview/history?q=another&page=3"
			);
			expect(history.location.search).toBe("?q=another&page=3");
		} finally {
			history.destroy();
		}
	});
});
