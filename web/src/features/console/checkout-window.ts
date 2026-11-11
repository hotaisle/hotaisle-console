/** Reserve a tab during the user's click, before the API request consumes activation. */
export function prepareCheckoutWindow() {
	const tab = window.open("about:blank", "_blank");
	if (tab) {
		tab.opener = null;
	}
	return tab;
}

export function checkoutURL(value: string) {
	const url = new URL(value);
	if (
		url.protocol !== "https:" ||
		url.hostname !== "checkout.stripe.com" ||
		url.username ||
		url.password
	) {
		throw new Error("Hot Aisle returned an invalid Stripe checkout link.");
	}
	return url.href;
}
