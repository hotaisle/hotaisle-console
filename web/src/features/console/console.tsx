import type { View } from "../../app/route-state";
import { Stage } from "../stage/stage";
import { ConsoleHeader } from "./console-header";
import { ConsolePanel } from "./console-panel";
import { useConsole } from "./use-console";
export function Console(props: Parameters<typeof useConsole>[0]) {
	const context = useConsole(props);
	const titles: Record<View, string> = {
		credits: "Add credits",
		history: "Machine history",
		home: context.rootIsOrder ? "Rent MI300x compute" : "Your machines",
		image: "Your cloud-init file",
		order: "New machine",
		run: context.run?.name ?? "Earlier run",
		settings: "Settings",
	};
	return (
		<div className={`app ${context.entering ? "entering" : ""}`}>
			<ConsoleHeader balance={context.b} team={context.team} titles={titles} />
			<div className="panes">
				<ConsolePanel context={context} />
				<Stage
					entrance={context.entering}
					hold={context.hold}
					state={context.stage}
				/>
			</div>
		</div>
	);
}
