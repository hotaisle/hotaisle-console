import "./build-date.css";

const builtAt = import.meta.env.VITE_BUILD_DATE;
const format = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "long",
});

export function BuildDate() {
	if (!builtAt) {
		return null;
	}
	return (
		<p className="build-date">
			Built{" "}
			<time dateTime={builtAt} title={`Build time (UTC): ${builtAt}`}>
				{format.format(new Date(builtAt))}
			</time>
		</p>
	);
}
