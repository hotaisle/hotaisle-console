import { runTitle } from "../machines/formatting";
import { Stage } from "../stage/stage";
import { ConsoleHeader } from "./console-header";
import { ConsolePanel } from "./console-panel";
import { useConsole } from "./use-console";
export function Console(props: Parameters<typeof useConsole>[0]) {
	const context = useConsole(props);
	const titles = {
		history: "Machine history",
		image: "Custom cloud-init file",
		order: "New machine",
		run: runTitle(context.run),
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
