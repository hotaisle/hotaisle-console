import "./build-date.css";

const builtAt = import.meta.env.VITE_BUILD_DATE;
const candidatePRURL = import.meta.env.VITE_BUILD_PR_URL;
const prURL =
	typeof candidatePRURL === "string" &&
	/^https:\/\/github\.com\/hotaisle\/hotaisle-console\/pull\/[1-9]\d*$/u.test(
		candidatePRURL
	)
		? candidatePRURL
		: undefined;
const format = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "long",
});

export function BuildDate() {
	if (!builtAt) {
		return null;
	}
	const date = format.format(new Date(builtAt));
	const label = (
		<>
			Built{" "}
			<time dateTime={builtAt} title={`Build time (UTC): ${builtAt}`}>
				{date}
			</time>
		</>
	);
	return (
		<p className="build-date">
			{prURL ? (
				<a
					aria-label={`Built ${date}. View pull request on GitHub`}
					href={prURL}
					rel="noopener noreferrer"
					target="_blank"
				>
					{label}
				</a>
			) : (
				label
			)}
		</p>
	);
}
