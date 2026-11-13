import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "../../../test/render";
import { api } from "../../lib/api";
import { EmailApproval } from "./email-approval";

describe("email approval matching code", () => {
	it("shows the exact comparison code with instructions before approval", async () => {
		vi.spyOn(api, "emailWait").mockResolvedValue({ done: false });
		renderWithQuery(
			<EmailApproval
				email="fixture@example.test"
				onConnected={vi.fn()}
				requestCode="Q9W1-DFWF"
			/>
		);
		expect(screen.getByText("Q9W1-DFWF")).toBeVisible();
		expect(
			screen.getByRole("region", { name: "Sign-in code" })
		).toHaveTextContent("Q9W1-DFWF");
		expect(screen.getByText("Only approve if both codes match.")).toBeVisible();
		expect(await screen.findByRole("status")).toHaveTextContent(
			"Waiting for your approval"
		);
	});
});
