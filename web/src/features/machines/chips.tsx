import type { StageMode } from "../stage/model";

export function Chips({ n, mode }: { n: number; mode: StageMode | "none" }) {
	return (
		<span aria-hidden="true" className={`chips c-${mode}`}>
			{["gpu-0", "gpu-1", "gpu-2", "gpu-3", "gpu-4", "gpu-5", "gpu-6", "gpu-7"]
				.slice(0, Math.max(1, Math.min(8, n)))
				.map((id, index) => (
					<i key={id} style={{ ["--i" as string]: index }} />
				))}
		</span>
	);
}
