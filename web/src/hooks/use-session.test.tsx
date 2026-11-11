import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryWrapper } from "../../test/render";
import { api } from "../lib/api";
import { historyVault } from "../lib/history-vault";
import { keyVault } from "../lib/key-vault";
import {
	ACCOUNT_KEY,
	STATUS_KEY,
	useSessionActions,
	useSessionSync,
} from "./use-session";

class FixtureChannel {
	static readonly channels = new Set<FixtureChannel>();
	onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
	constructor() {
		FixtureChannel.channels.add(this);
	}
	close() {
		FixtureChannel.channels.delete(this);
	}
	postMessage(data: unknown) {
		for (const other of FixtureChannel.channels) {
			if (other !== this) {
				other.onmessage?.(new MessageEvent("message", { data }));
			}
		}
	}
}
beforeEach(() => {
	FixtureChannel.channels.clear();
	vi.stubGlobal("BroadcastChannel", FixtureChannel);
});
describe("history session lock signals", () => {
	it("ignores its own sign-in broadcast, and locks memory and private caches on another tab's signal", async () => {
		const { Wrapper, client } = queryWrapper();
		vi.spyOn(api, "status").mockResolvedValue({
			email_login: true,
			key_stored: false,
			passkeys: false,
			signed_in: true,
			version: "test",
		});
		const lock = vi.spyOn(keyVault, "lock");
		const { result } = renderHook(
			() => {
				useSessionSync();
				return useSessionActions();
			},
			{ wrapper: Wrapper }
		);
		client.setQueryData(STATUS_KEY, { signed_in: true });
		await act(async () => {
			await result.current.connected();
		});
		expect(lock).not.toHaveBeenCalled();
		expect(client.getQueryData(STATUS_KEY)).toMatchObject({ signed_in: true });
		client.setQueryData(ACCOUNT_KEY, { private: "account" });
		act(() => historyVault.record({ name: "private-machine", team: "lab" }));
		act(() => {
			const otherTab = new FixtureChannel();
			otherTab.postMessage({ sender: "another-tab", type: "lock" });
			otherTab.close();
		});
		expect(lock).toHaveBeenCalledOnce();
		expect(historyVault.getSnapshot().records.machines).toEqual({});
		expect(client.getQueryData(ACCOUNT_KEY)).toBeUndefined();
		expect(client.getQueryData(STATUS_KEY)).toMatchObject({ signed_in: false });
	});
	it("locks decrypted history immediately even if the signout request fails", async () => {
		vi.spyOn(api, "signOut").mockRejectedValue(new Error("Offline"));
		const { Wrapper } = queryWrapper();
		const { result } = renderHook(useSessionActions, { wrapper: Wrapper });
		historyVault.record({ name: "private-machine", team: "lab" });
		await act(async () => {
			await expect(result.current.logout.mutateAsync()).rejects.toThrow(
				"Offline"
			);
		});
		expect(historyVault.getSnapshot().records.machines).toEqual({});
	});
});
