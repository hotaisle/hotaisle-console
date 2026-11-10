import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VLLM_URL } from "../../lib/prefs";
import { CloudInitLink } from "./cloud-init-link";

describe("cloud-init template links", () => {
	it.each([
		["vllm", undefined, VLLM_URL],
		[
			"custom",
			"https://example.invalid/template.yaml?version=2",
			"https://example.invalid/template.yaml?version=2",
		],
	])(
		"links %s to its launch template in a separate tab",
		(image, url, expected) => {
			render(
				<CloudInitLink
					record={{ image, name: "vm", team: "lab", user_data_url: url }}
				>
					cloud-init file
				</CloudInitLink>
			);
			const link = screen.getByRole("link", { name: "cloud-init file" });
			expect(link).toHaveAttribute("href", expected);
			expect(link).toHaveAttribute("target", "_blank");
			expect(link).toHaveAttribute("rel", "noopener noreferrer");
		}
	);
	it.each([
		undefined,
		"javascript:alert(1)",
		"https://user:password@example.invalid/config.yaml",
	])("keeps an unknown or unsafe custom URL as plain text: %s", (url) => {
		render(
			<CloudInitLink
				record={{
					image: "custom",
					name: "vm",
					team: "lab",
					user_data_url: url,
				}}
			>
				cloud-init file
			</CloudInitLink>
		);
		expect(screen.getByText("cloud-init file")).toBeInTheDocument();
		expect(screen.queryByRole("link")).not.toBeInTheDocument();
	});
});
