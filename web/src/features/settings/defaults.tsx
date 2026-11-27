import type { ChangeEvent } from "react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { FormError } from "../../components/forms/form-error";
import { SavingSelect } from "../../components/ui/saving-select";
import { cloudInitVault } from "../../lib/cloud-init-vault";
import type { Image } from "../../lib/prefs";
import { IMAGES, savePrefs, usePrefs } from "../../lib/prefs";

const IMAGE_OPTIONS = (Object.keys(IMAGES) as Image[]).map((value) => ({
	label: IMAGES[value].name,
	value,
}));

function saveImage(image: Image): undefined {
	savePrefs({ image });
}

export function DefaultMachineSettings() {
	const [prefs] = usePrefs();
	const cloudInit = useSyncExternalStore(
		cloudInitVault.subscribe,
		cloudInitVault.getSnapshot
	);
	const [urlValue, setURLValue] = useState(cloudInit.value);
	useEffect(() => setURLValue(cloudInit.value), [cloudInit.value]);
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
				<SavingSelect
					errorMessage="Couldn't save the default image to browser storage."
					id="def-image"
					label="Default image"
					onSave={saveImage}
					options={IMAGE_OPTIONS}
					value={prefs.image}
				/>
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
