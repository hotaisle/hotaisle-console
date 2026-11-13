/** A single controlled window: guard assertions must not race Miniflare's wall-clock rollover. */
export function rateLimitWindow(limit: number) {
	const counts = new Map<string, number>();
	const binding: RateLimit = {
		limit: ({ key, delta = 1 }) => {
			const count = counts.get(key) ?? 0;
			if (count >= limit) {
				return Promise.resolve({ success: false });
			}
			counts.set(key, count + delta);
			return Promise.resolve({ success: true });
		},
	};
	return { binding, nextWindow: () => counts.clear() };
}
