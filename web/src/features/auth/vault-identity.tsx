/** A stable login identifier lets password managers pair save and unlock forms. */
export function VaultIdentity() {
	return (
		<input
			autoComplete="username"
			name="username"
			type="hidden"
			value="Hot Aisle API key"
		/>
	);
}
