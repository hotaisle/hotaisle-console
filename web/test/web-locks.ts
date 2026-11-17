// jsdom does not implement Web Locks. Keep callers queued like an exclusive
// same-origin browser lock; controlled promises determine when work completes.
export function installWebLocks() {
	let previous: Promise<unknown> = Promise.resolve();
	Object.defineProperty(navigator, "locks", {
		configurable: true,
		value: {
			request(_name: string, operation: () => Promise<unknown>) {
				const result = previous.then(operation);
				previous = result.catch(() => undefined);
				return result;
			},
		},
	});
}
