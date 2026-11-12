import type { BeatGrid } from "./beats";

const plans = import.meta.glob<{
	default: BeatGrid & { title: string; source: string };
}>("./music.generated.ts", { eager: true });
export const music = Object.values(plans)[0]?.default;
