import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { queryWrapper } from "../../test/render";
import { usePoll } from "./use-resource";

describe("resource cache", () => {
	it("keeps an optimistic update when an older request finishes late", async () => {
		let resolve: (value: string[]) => void = () => {
			throw new Error("Request did not start");
		};
		const request = () =>
			new Promise<string[]>((done) => {
				resolve = done;
			});
		const { Wrapper } = queryWrapper();
		const { result } = renderHook(
			() => usePoll(request, null, "machines:lab"),
			{ wrapper: Wrapper }
		);
		await act(async () => {
			await result.current.setData(["new-machine"]);
			resolve(["old-machine"]);
		});
		await waitFor(() => expect(result.current.data).toEqual(["new-machine"]));
	});
	it("scopes cached results to the selected team", async () => {
		const { Wrapper } = queryWrapper();
		const { result, rerender } = renderHook(
			({ team }) =>
				usePoll(() => Promise.resolve([team]), null, `machines:${team}`),
			{ initialProps: { team: "alice" }, wrapper: Wrapper }
		);
		await waitFor(() => expect(result.current.data).toEqual(["alice"]));
		rerender({ team: "bob" });
		expect(result.current.data).not.toEqual(["alice"]);
		await waitFor(() => expect(result.current.data).toEqual(["bob"]));
	});
});
