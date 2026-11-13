import {
	type ChangeEvent,
	useCallback,
	useEffect,
	useState,
	useSyncExternalStore,
} from "react";
import { FormError } from "../../components/forms/form-error";
import { cloudInitVault } from "../../lib/cloud-init-vault";
import { IMAGES, type Image, usePrefs } from "../../lib/prefs";

const IMAGE_OPTIONS = Object.keys(IMAGES) as Image[];
export function DefaultMachineSettings() {
	const [prefs, set] = usePrefs();
	const cloudInit = useSyncExternalStore(
		cloudInitVault.subscribe,
		cloudInitVault.getSnapshot
	);
	const [urlValue, setURLValue] = useState(cloudInit.value);
	useEffect(() => setURLValue(cloudInit.value), [cloudInit.value]);
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
			setURLValue(event.currentTarget.value),
		[]
	);
	const saveURL = useCallback(() => {
		cloudInitVault.save(urlValue).catch(() => {
			// The vault displays a warning and preserves any existing ciphertext.
		});
	}, [urlValue]);
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
						onBlur={saveURL}
						onChange={url}
						placeholder="https://…"
						type="url"
						value={urlValue}
					/>
					{cloudInit.error ? <FormError message={cloudInit.error} /> : null}
				</div>
			) : null}
		</section>
	);
}
