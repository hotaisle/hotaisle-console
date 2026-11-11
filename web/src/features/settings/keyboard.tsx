import { useCallback } from "react";
import { KeyboardHelpButton } from "../../components/keyboard-controls";
import { PreferenceToggle } from "../../components/ui/preference-toggle";
import { usePrefs } from "../../lib/prefs";

export function KeyboardSettings() {
	const [prefs, setPrefs] = usePrefs();
	const toggle = useCallback(
		(enabled: boolean) => setPrefs({ shortcuts: enabled }),
		[setPrefs]
	);
	return (
		<section className="group">
			<h2 className="group-h section-heading">Keyboard</h2>
			<PreferenceToggle
				checked={prefs.shortcuts}
				label="Enable keyboard shortcuts"
				onChange={toggle}
			/>
			<p className="muted small">
				Press <kbd>?</kbd> outside text fields to see controls for the current
				page or section.
			</p>
			<KeyboardHelpButton />
		</section>
	);
}
