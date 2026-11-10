/** A value that changes many times a second (hold progress) without re-rendering React. */
export interface Signal<T> {
	get: () => T;
	set: (v: T) => void;
	sub: (f: (v: T) => void) => () => void;
}

export function signal<T>(initial: T): Signal<T> {
	let value = initial;
	const subs = new Set<(v: T) => void>();
	return {
		get: () => value,
		set(v) {
			if (v === value) {
				return;
			}
			value = v;
			for (const f of subs) {
				f(v);
			}
		},
		sub(f) {
			subs.add(f);
			return () => subs.delete(f);
		},
	};
}
