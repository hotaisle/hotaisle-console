import { type ChangeEvent, useCallback } from "react";
import { IMAGES, type Image, usePrefs } from "../../lib/prefs";

const IMAGE_OPTIONS = Object.keys(IMAGES) as Image[];
export function DefaultMachineSettings() {
	const [prefs, set] = usePrefs();
	const image = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			const { value } = event.currentTarget;
			if (Object.hasOwn(IMAGES, value)) {
				set({ image: value as Image });
			}
		},
		[set]
	);
	const url = useCallback(
		(event: ChangeEvent<HTMLInputElement>) =>
			set({ customURL: event.currentTarget.value }),
		[set]
	);
	return (
		<section className="group">
			<h2 className="group-h section-heading">Default image</h2>
			<div className="field">
				<label className="field-l" htmlFor="def-image">
					Image
				</label>
				<select id="def-image" onChange={image} value={prefs.image}>
					{IMAGE_OPTIONS.map((value) => (
						<option key={value} value={value}>
							{IMAGES[value].name}
						</option>
					))}
				</select>
			</div>
			{prefs.image === "custom" ? (
				<div className="field">
					<label className="field-l" htmlFor="def-url">
						Cloud-init link
					</label>
					<input
						id="def-url"
						onChange={url}
						placeholder="https://…"
						type="url"
						value={prefs.customURL}
					/>
				</div>
			) : null}
		</section>
	);
}
