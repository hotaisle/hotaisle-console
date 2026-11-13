import { describe, expect, it } from "vitest";
import { checkoutURL } from "./checkout-window";

describe("checkout destinations", () => {
	it.each([undefined, null, 123, {}, ["https://checkout.stripe.com/test"]])(
		"rejects non-string response values: %j",
		(value) => {
			expect(() => checkoutURL(value)).toThrow("invalid Stripe checkout link");
		}
	);
	it.each([
		[
			"https://checkout.stripe.com/c/pay/cs_test_fixture#checkout-state",
			"https://checkout.stripe.com/c/pay/cs_test_fixture#checkout-state",
		],
		[
			"https://checkout.stripe.com/c/setup/cs_test_fixture",
			"https://checkout.stripe.com/c/setup/cs_test_fixture",
		],
		[
			"https://checkout.stripe.com:443/c/pay/cs_test_fixture",
			"https://checkout.stripe.com/c/pay/cs_test_fixture",
		],
		[
			"https://admin.hotaisle.app/r/checkout-fixture",
			"https://admin.hotaisle.app/r/checkout-fixture",
		],
		[
			"https://ADMIN.HOTAISLE.APP:443/r/SETUP_FIXTURE",
			"https://admin.hotaisle.app/r/SETUP_FIXTURE",
		],
	])(
		"accepts and normalizes the supported checkout destination %s",
		(value, expected) => {
			expect(checkoutURL(value)).toBe(expected);
		}
	);

	it.each([
		"",
		"not a URL",
		"/r/checkout-fixture",
		"//checkout.stripe.com/c/pay/cs_test_fixture",
		"javascript:alert(1)",
		"data:text/html,checkout",
		"http://checkout.stripe.com/c/pay/cs_test_fixture",
		"https://checkout.stripe.com:8443/c/pay/cs_test_fixture",
		"https://checkout.stripe.com.evil.test/c/pay/cs_test_fixture",
		"https://checkout.stripe.com@evil.test/checkout",
		"https://user:password@checkout.stripe.com/c/pay/cs_test_fixture",
		"http://admin.hotaisle.app/r/checkout-fixture",
		"https://admin.hotaisle.app:8443/r/checkout-fixture",
		"https://admin.hotaisle.app.evil.test/r/checkout-fixture",
		"https://user:password@admin.hotaisle.app/r/checkout-fixture",
		"https://console.hotaisle.app/r/checkout-fixture",
		"https://admin.hotaisle.app/",
		"https://admin.hotaisle.app/api/teams/",
		"https://admin.hotaisle.app/r/",
		"https://admin.hotaisle.app/r/checkout-fixture/other",
		"https://admin.hotaisle.app/r/checkout%2Ffixture",
		"https://admin.hotaisle.app/r/checkout-fixture?url=https://evil.test",
		"https://admin.hotaisle.app/r/checkout-fixture#fragment",
	])("rejects an unsupported checkout destination %s", (value) => {
		expect(() => checkoutURL(value)).toThrow("invalid Stripe checkout link");
	});
});
