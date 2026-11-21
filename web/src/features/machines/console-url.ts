export function consoleURL(
	value: string,
	page = new URL(window.location.href)
) {
	const url = new URL(value);
	const localMock =
		import.meta.env.MODE === "preview" &&
		page.hostname === "preview.localhost" &&
		url.origin === page.origin &&
		url.pathname === "/__preview/console.html";
	if (
		(url.protocol !== "https:" && !localMock) ||
		url.username ||
		url.password
	) {
		throw new Error("The API returned an invalid console link.");
	}
	return url.href;
}
