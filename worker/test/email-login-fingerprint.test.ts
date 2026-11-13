import { describe, expect, it } from "vitest";
import { emailLoginFingerprint } from "../src/email-login-fingerprint";

describe("email approval comparison code", () => {
	it.each([
		["", "WERC-8GMR"],
		["abc", "Q9W1-DFWF"],
		["abc\n", "XQNA-ZWZH"],
		["a.b.c", "GHF3-0H48"],
		["a.b.d", "GWTV-5MH4"],
	])("matches the approval protocol vector for %j", async (ticket, code) => {
		expect(await emailLoginFingerprint(ticket)).toBe(code);
	});
});
