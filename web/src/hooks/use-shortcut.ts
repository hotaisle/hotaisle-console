import {
	type HotkeyChord,
	type UseHotkeyChordOptions,
	type UseHotkeyDefinition,
	useHotkey,
	useHotkeys,
} from "@tanstack/react-hotkeys";
import { usePrefs } from "../lib/prefs";

/** Also guards ARIA editors and descendants of contenteditable regions. */
export function enteringText(event: KeyboardEvent) {
	const target = event.composedPath()[0] ?? event.target;
	return (
		event.isComposing ||
		(target instanceof Element &&
			!!target.closest(
				'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="searchbox"],[role="combobox"]'
			))
	);
}

export function useShortcuts(definitions: UseHotkeyDefinition[]) {
	const [prefs] = usePrefs();
	useHotkeys(
		definitions.map((definition) => ({
			...definition,
			options: {
				...definition.options,
				enabled: prefs.shortcuts && definition.options?.enabled !== false,
			},
		})),
		{ ignoreDefaultPrevented: true, ignoreInputs: true, requireReset: true }
	);
}

export function useShortcut(
	key: HotkeyChord | null | undefined,
	action: (event: KeyboardEvent) => void,
	options: UseHotkeyChordOptions = {}
) {
	const [prefs] = usePrefs();
	useHotkey(
		key,
		(event) => {
			if (!enteringText(event)) {
				action(event);
			}
		},
		{
			ignoreDefaultPrevented: true,
			ignoreInputs: true,
			requireReset: true,
			...options,
			enabled: prefs.shortcuts && options.enabled !== false,
		}
	);
}
