import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryWrapper } from "../../../test/render";
import { api, type Offer } from "../../lib/api";
import { useAvailability } from "./use-availability";

const AVAILABLE: Offer[] = [
	{
		MinimumReservationMinutes: 30,
		OnDemandPrice: 600,
		Quantity: 1,
		Specs: {
			cpu_cores: 32,
			disk_capacity: 100,
			gpus: [{ count: 2, model: "MI300X" }],
			ram_capacity: 128,
		},
	},
];
afterEach(() => vi.useRealTimers());
describe("browser availability polling", () => {
	it("refreshes automatically without any socket or server-side channel", async () => {
		vi.useFakeTimers();
		const request = vi.spyOn(api, "offers").mockResolvedValue([]);
		const socket = vi.fn();
		vi.stubGlobal("WebSocket", socket);
		const { Wrapper } = queryWrapper();
		const { result } = renderHook(() => useAvailability("lab"), {
			wrapper: Wrapper,
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1);
		});
		expect(result.current.data).toEqual([]);
		request.mockResolvedValue(AVAILABLE);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(10_000);
		});
		expect(request).toHaveBeenCalledTimes(2);
		expect(result.current.data).toEqual(AVAILABLE);
		expect(socket).not.toHaveBeenCalled();
	});
	it("scopes results to the selected team", async () => {
		vi.spyOn(api, "offers").mockImplementation((team) =>
			Promise.resolve(team === "lab" ? AVAILABLE : [])
		);
		const { Wrapper } = queryWrapper();
		const { result, rerender } = renderHook(
			({ team }) => useAvailability(team),
			{ initialProps: { team: "lab" }, wrapper: Wrapper }
		);
		await waitFor(() => expect(result.current.data).toEqual(AVAILABLE));
		rerender({ team: "other" });
		expect(result.current.data).not.toEqual(AVAILABLE);
		await waitFor(() => expect(result.current.data).toEqual([]));
	});
});
