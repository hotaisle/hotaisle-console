export interface BeatGrid {
	bpm: number;
	offset: number;
}
export function beatDelay(
	elapsed: number,
	grid: BeatGrid,
	lead = 0,
	beats = 1
) {
	if (
		!(
			Number.isFinite(grid.bpm) &&
			grid.bpm >= 40 &&
			grid.bpm <= 240 &&
			Number.isFinite(grid.offset)
		)
	) {
		throw new Error(
			"Use a finite tempo between 40 and 240 BPM and a measured beat offset."
		);
	}
	const interval = (60 / grid.bpm) * beats;
	const target =
		grid.offset +
		Math.ceil((elapsed + lead - grid.offset) / interval) * interval;
	return Math.max(0, target - lead - elapsed);
}
