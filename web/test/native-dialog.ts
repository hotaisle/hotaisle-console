import { afterAll, beforeAll } from "vitest";

/** jsdom has no native dialog implementation; browser verification covers real focus/dismissal. */
export function mockNativeDialogs() {
	const showModal = Object.getOwnPropertyDescriptor(
		HTMLDialogElement.prototype,
		"showModal"
	);
	const close = Object.getOwnPropertyDescriptor(
		HTMLDialogElement.prototype,
		"close"
	);
	const show = Object.getOwnPropertyDescriptor(
		HTMLDialogElement.prototype,
		"show"
	);
	const submit = (event: Event) => {
		if (
			event.target instanceof HTMLFormElement &&
			event.target.method === "dialog"
		) {
			event.preventDefault();
			event.target.closest("dialog")?.close();
		}
	};
	beforeAll(() => {
		Object.defineProperties(HTMLDialogElement.prototype, {
			close: {
				configurable: true,
				value(this: HTMLDialogElement) {
					this.open = false;
					this.dispatchEvent(new Event("close"));
				},
			},
			show: {
				configurable: true,
				value(this: HTMLDialogElement) {
					this.open = true;
				},
			},
			showModal: {
				configurable: true,
				value(this: HTMLDialogElement) {
					this.open = true;
				},
			},
		});
		document.addEventListener("submit", submit);
	});
	afterAll(() => {
		document.removeEventListener("submit", submit);
		for (const [name, descriptor] of [
			["showModal", showModal],
			["show", show],
			["close", close],
		] as const) {
			if (descriptor) {
				Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
			} else {
				Reflect.deleteProperty(HTMLDialogElement.prototype, name);
			}
		}
	});
}
