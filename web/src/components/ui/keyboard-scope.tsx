import { HotkeysProvider } from "@tanstack/react-hotkeys";
import type { ReactNode } from "react";
import { useId } from "react";

export function KeyboardScope({ children }: { children: ReactNode }) {
	const scope = useId();
	return (
		<HotkeysProvider exclusive={{ allow: ["shortcut-help"] }} scope={scope}>
			{children}
		</HotkeysProvider>
	);
}
