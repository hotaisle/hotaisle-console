import { webcrypto } from "node:crypto";
import { act, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "../../../test/render";
import { api } from "../../lib/api";
import { type HistoryKey, historyVault } from "../../lib/history-vault";
import { useSessionRecords } from "../console/use-session-records";
import { HistoryAccess } from "./history-access";

function HistoryProbe() {
	const { history } = useSessionRecords("lab");
	return <p>{history.map((entry) => entry.name).join(",") || "No runs"}</p>;
}
const key = (): HistoryKey => ({
	key: btoa("a".repeat(32)),
	scope: btoa("b".repeat(32)),
	version: 1,
});
beforeEach(() => {
	vi.stubGlobal("crypto", webcrypto);
	localStorage.clear();
});
describe("automatic history unlock", () => {
	it("waits for authentication-gated key release, then restores history after remount", async () => {
		vi.spyOn(api, "historyKey").mockImplementation(async () => key());
		const { unmount } = renderWithQuery(
			<HistoryAccess>
				<HistoryProbe />
			</HistoryAccess>
		);
		await screen.findByText("No runs");
		await act(async () => {
			historyVault.rememberEnd({
				ended_at: new Date().toISOString(),
				gpus: "2× MI300X",
				name: "saved-run",
				team: "lab",
			});
			await historyVault.flush();
		});
		expect(screen.getByText("saved-run")).toBeVisible();
		const saved = localStorage.length;
		unmount();
		expect(historyVault.getSnapshot().records.history).toEqual([]);
		expect(localStorage.length).toBe(saved);
		renderWithQuery(
			<HistoryAccess>
				<HistoryProbe />
			</HistoryAccess>
		);
		await screen.findByText("saved-run");
	});
	it("warns when the key cannot be obtained, without writing or deleting storage", async () => {
		localStorage.setItem("existing-encrypted-data", "preserve");
		vi.spyOn(api, "historyKey").mockRejectedValue(new Error("Unavailable"));
		renderWithQuery(
			<HistoryAccess>
				<HistoryProbe />
			</HistoryAccess>
		);
		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent(
				"have not been changed"
			)
		);
		expect(localStorage.getItem("existing-encrypted-data")).toBe("preserve");
		expect(localStorage.length).toBe(1);
	});
});
