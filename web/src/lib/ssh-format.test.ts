import { describe, expect, it } from "vitest";
import { sshCommand, sshHost, validSSHName, validSSHPort } from "./format";

describe("copied SSH instructions", () => {
	it("keeps normal host and port instructions", () => {
		expect(sshCommand({ ip_address: "192.0.2.8", port: 22 })).toBe(
			"ssh hotaisle@192.0.2.8"
		);
		expect(
			sshCommand({ dns_name: "vm.example.invalid", ip_address: "", port: 2202 })
		).toBe("ssh -p 2202 hotaisle@vm.example.invalid");
	});
	it("rejects shell and SSH-config delimiters from API metadata", () => {
		expect(
			sshHost({ ip_address: "vm.example.invalid;echo injected", port: 22 })
		).toBe("");
		expect(
			sshCommand({
				ip_address: "vm.example.invalid\nProxyCommand foo",
				port: 22,
			})
		).toBe("");
		expect(validSSHPort(Number.NaN)).toBe(false);
		expect(validSSHPort(0)).toBe(false);
		expect(validSSHName("vm\nProxyCommand foo")).toBe(false);
	});
});
