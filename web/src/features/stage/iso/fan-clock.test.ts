import { describe, expect, it } from "vitest";
import { FanClock } from "./fan-clock";

describe("drawer fan coasting", () => {
	it("slows continuously, reaches a complete stop, and holds its final angle", () => {
		const clock = new FanClock();
		clock.setPower(false);
		const speeds: number[] = [];
		for (let i = 0; i < 9; i += 1) {
			clock.setPower(false);
			clock.advance(0.5);
			speeds.push(clock.speed);
		}
		expect(speeds[0]).toBeGreaterThan(0.8);
		expect(speeds[4]).toBeGreaterThan(0);
		expect(speeds.every((speed, i) => i === 0 || speed < speeds[i - 1])).toBe(
			true
		);
		expect(clock.speed).toBe(0);
		const stopped = clock.time;
		clock.advance(20);
		expect(clock.time).toBe(stopped);
	});

	it("produces the same final angle at different frame rates", () => {
		const slow = new FanClock();
		const fast = new FanClock();
		slow.setPower(false);
		fast.setPower(false);
		for (let i = 0; i < 150; i += 1) {
			slow.advance(1 / 30);
		}
		for (let i = 0; i < 720; i += 1) {
			fast.advance(1 / 144);
		}
		expect(slow.time).toBeCloseTo(fast.time, 8);
		expect(slow.speed).toBe(0);
		expect(fast.speed).toBe(0);
	});

	it("freezes when paused and resumes from the same speed without jumping", () => {
		const clock = new FanClock();
		clock.setPower(false);
		clock.advance(1);
		const { time, speed } = clock;
		clock.advance(0);
		expect(clock.time).toBe(time);
		expect(clock.speed).toBe(speed);
		clock.setPower(true);
		expect(clock.time).toBe(time);
		expect(clock.speed).toBe(speed);
		clock.advance(0.8);
		expect(clock.speed).toBe(1);
		const resumed = clock.time;
		clock.advance(1);
		expect(clock.time - resumed).toBeCloseTo(1);
	});
});
