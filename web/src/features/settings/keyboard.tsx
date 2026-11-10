export function KeyboardSettings() {
	return (
		<section className="group">
			<h2 className="group-h section-heading">Keyboard</h2>
			<dl className="keys-list">
				<dt>
					<kbd>1</kbd> <kbd>2</kbd> <kbd>4</kbd> <kbd>8</kbd>
				</dt>
				<dd>Pick a size</dd>
				<dt>
					hold <kbd>L</kbd>
				</dt>
				<dd>Launch</dd>
				<dt>
					<kbd>C</kbd>
				</dt>
				<dd>Copy the SSH command of your newest machine</dd>
				<dt>
					<kbd>Esc</kbd>
				</dt>
				<dd>Go back</dd>
			</dl>
		</section>
	);
}
