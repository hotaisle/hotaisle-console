/** A rotor's accumulated turns clock, independent of the drawing's frame rate and pause state. */
export class FanClock {
	time = 0;
	speed = 1;
	private target = 1;
	private acceleration = 0;
	private remaining = 0;

	setPower(on: boolean) {
		const target = on ? 1 : 0;
		if (target === this.target) {
			return;
		}
		this.target = target;
		this.remaining = on ? 0.8 : 4.5;
		this.acceleration = (target - this.speed) / this.remaining;
	}

	advance(seconds: number) {
		if (!Number.isFinite(seconds) || seconds <= 0) {
			return;
		}
		const changing = Math.min(seconds, this.remaining);
		this.time +=
			this.speed * changing + (this.acceleration * changing * changing) / 2;
		this.speed += this.acceleration * changing;
		this.remaining -= changing;
		if (this.remaining <= 1e-9) {
			this.speed = this.target;
			this.remaining = 0;
		}
		this.time += (seconds - changing) * this.speed;
	}
}
