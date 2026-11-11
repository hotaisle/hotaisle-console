/** Distinguishes absent values from valid zero, false and empty-string values. */
export function isPresent<T>(value: T | null | undefined): value is T {
	return value !== null && value !== undefined;
}
