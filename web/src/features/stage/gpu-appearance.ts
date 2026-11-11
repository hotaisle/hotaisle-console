import { type Owned, WARM } from "./model";
export function gpuAppearance(owner?: Owned) {
	if (!owner) {
		return { led: "off", target: 0 };
	}
	const { machine } = owner;
	switch (machine.mode) {
		case "booting": {
			const age = machine.since ? (Date.now() - machine.since) / 1000 : 0;
			return {
				led: "blink",
				target:
					0.14 +
					(WARM - 0.14) *
						(1 - Math.exp(-Math.max(0, age - owner.index * 0.5) / 24)),
			};
		}
		case "claimed":
			return { led: "blink", target: 0.22 };
		case "ready":
			return { led: "on", target: WARM };
		default:
			return { led: "off", target: 0 };
	}
}
