import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import { FormError } from "../../components/forms/form-error";
import { PreferenceToggle } from "../../components/ui/preference-toggle";
import type { SegmentOption } from "../../components/ui/segmented-control";
import { SegmentedControl } from "../../components/ui/segmented-control";
import type { StatusMotion, Theme } from "../../lib/prefs";
import { usePrefs } from "../../lib/prefs";

const THEMES: readonly SegmentOption<Theme>[] = [
	{ label: "System", value: "system" },
	{ label: "Light", value: "light" },
	{ label: "Dark", value: "dark" },
];
const STATUS_MOTION: readonly SegmentOption<StatusMotion>[] = [
	{ label: "On", value: "on" },
	{ label: "Off", value: "off" },
	{ label: "System", value: "system" },
];
async function enableNotifications(enabled: boolean) {
	if (!enabled) {
		return false;
	}
	if (!("Notification" in window)) {
		throw new Error("This browser does not support desktop notifications.");
	}
	if (Notification.permission === "granted") {
		return true;
	}
	return (await Notification.requestPermission()) === "granted";
}
export function AppearanceSettings() {
	const [prefs, set] = usePrefs();
	const notify = useMutation({
		mutationFn: enableNotifications,
		onSuccess: (enabled) => set({ notify: enabled }),
	});
	const theme = useCallback((value: Theme) => set({ theme: value }), [set]);
	const sound = useCallback((value: boolean) => set({ sound: value }), [set]);
	const motion = useCallback(
		(value: StatusMotion) => set({ statusMotion: value }),
		[set]
	);
	return (
		<section className="group">
			<h2 className="group-h section-heading">Look and sound</h2>
			<div className="field">
				<span className="field-l">Theme</span>
				<SegmentedControl
					label="Theme"
					onChange={theme}
					options={THEMES}
					value={prefs.theme}
				/>
			</div>
			<div className="field">
				<span className="field-l">Interface animation</span>
				<SegmentedControl
					label="Interface animation"
					onChange={motion}
					options={STATUS_MOTION}
					value={prefs.statusMotion}
				/>
			</div>
			<p className="hint">
				On is the default for this browser. System follows your device's motion
				preference. Fan rotation has its own pause button.
			</p>
			<PreferenceToggle
				checked={prefs.sound}
				label="Key sounds, and a chime when a machine is ready"
				onChange={sound}
			/>
			<PreferenceToggle
				checked={prefs.notify}
				label="Desktop notification when a machine is ready"
				onChange={notify.mutate}
			/>
			{notify.error ? <FormError message={notify.error.message} /> : null}
			{notify.data === false && !prefs.notify ? (
				<p className="hint">Desktop notifications are off.</p>
			) : null}
		</section>
	);
}
