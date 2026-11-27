import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { renderWithQuery } from "../../../test/render";
import { ToastHost } from "../../components/ui/toast";
import { DefaultMachineSettings } from "./defaults";

const PREFS_KEY = "hotaisle-ui:prefs";
const CLOUD_INIT_LINK = /Cloud-init link/u;

function renderDefaults() {
	return renderWithQuery(
		<ToastHost>
			<DefaultMachineSettings />
		</ToastHost>
	);
}

afterEach(() => {
	localStorage.removeItem(PREFS_KEY);
	act(() => {
		window.dispatchEvent(new StorageEvent("storage", { key: PREFS_KEY }));
	});
});

test("only activates the custom default image after saving it", async () => {
	const user = userEvent.setup();
	const view = renderDefaults();
	const select = screen.getByRole("combobox", { name: "Image" });
	const option = screen.getByRole("option", { name: "Custom cloud-init" });
	const write = vi
		.spyOn(Storage.prototype, "setItem")
		.mockImplementationOnce(() => {
			throw new DOMException("Storage is full", "QuotaExceededError");
		});
	try {
		await user.selectOptions(select, option);
	} finally {
		write.mockRestore();
	}

	expect(select).toHaveDisplayValue("Standard image");
	expect(select).toHaveAccessibleDescription("Default image not saved.");
	expect(screen.queryByLabelText(CLOUD_INIT_LINK)).not.toBeInTheDocument();
	expect(
		screen.getByText("Couldn't save the default image to browser storage.")
	).toBeVisible();

	await user.selectOptions(select, option);
	expect(select).toHaveDisplayValue("Custom cloud-init");
	expect(
		screen.getByText("Default image saved: Custom cloud-init.")
	).toBeInTheDocument();
	expect(screen.getByLabelText(CLOUD_INIT_LINK)).toBeVisible();
	view.unmount();
	act(() => {
		window.dispatchEvent(new StorageEvent("storage", { key: PREFS_KEY }));
	});
	renderDefaults();
	expect(screen.getByRole("combobox", { name: "Image" })).toHaveDisplayValue(
		"Custom cloud-init"
	);
});
