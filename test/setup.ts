import { afterEach, beforeEach, vi } from "vitest";
import { TEST_NOW } from "./clock";

/** Freeze dates without stalling async rendering; timer behavior uses explicit fake-timer advancement. */
export function mockTime() {
	vi.setSystemTime(TEST_NOW);
}

beforeEach(mockTime);
afterEach(() => vi.useRealTimers());
