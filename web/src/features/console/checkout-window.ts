const INVALID_CHECKOUT_LINK =
	"Hot Aisle returned an invalid Stripe checkout link.";
const PAYMENT_REDIRECT_PATH = /^\/r\/[A-Za-z0-9_-]+$/u;

/** Reserve a tab during the user's click, before the API request consumes activation. */
export function prepareCheckoutWindow() {
	const tab = window.open("about:blank", "_blank");
	if (tab) {
		tab.opener = null;
	}
	return tab;
}

export function checkoutURL(value: unknown) {
	if (typeof value !== "string") {
		throw new Error(INVALID_CHECKOUT_LINK);
	}
	let url: URL;
	try {
		url = new URL(value);
	} catch (cause) {
		throw new Error(INVALID_CHECKOUT_LINK, { cause });
	}
	const stripeCheckout = url.origin === "https://checkout.stripe.com";
	// Credit purchases and rebill setup can return the API's short checkout link.
	const hotAisleCheckout =
		url.origin === "https://admin.hotaisle.app" &&
		PAYMENT_REDIRECT_PATH.test(url.pathname) &&
		!url.search &&
		!url.hash;
	if (!(stripeCheckout || hotAisleCheckout) || url.username || url.password) {
		throw new Error(INVALID_CHECKOUT_LINK);
	}
	return url.href;
}
