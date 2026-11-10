import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import { PreferenceToggle } from "../../components/ui/preference-toggle";
import {
	SegmentedControl,
	type SegmentOption,
} from "../../components/ui/segmented-control";
import { type StatusMotion, type Theme, usePrefs } from "../../lib/prefs";

const THEMES: readonly SegmentOption<Theme>[] = [
	{ label: "System", value: "system" },
	{ label: "Light", value: "light" },
	{ label: "Dark", value: "dark" },
];
const STATUS_MOTION: readonly SegmentOption<StatusMotion>[] = [
	{ label: "System", value: "system" },
	{ label: "On", value: "on" },
	{ label: "Off", value: "off" },
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
				<span className="field-l">Status animation</span>
				<SegmentedControl
					label="Status animation"
					onChange={motion}
					options={STATUS_MOTION}
					value={prefs.statusMotion}
				/>
			</div>
			<p className="hint">
				System follows your reduced-motion preference. On enables status
				animations even when reduced motion is enabled.
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
			{notify.error ? (
				<p className="error" role="alert">
					{notify.error.message}
				</p>
			) : null}
			{notify.data === false && !prefs.notify ? (
				<p className="hint">Desktop notifications are off.</p>
			) : null}
		</section>
	);
}
