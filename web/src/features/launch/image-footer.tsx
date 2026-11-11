import { type Image, VLLM_URL } from "../../lib/prefs";

export function ImageFooter({
	image,
	onChange,
}: {
	image: Image;
	onChange: () => void;
}) {
	if (image === "custom") {
		return (
			<button className="btn-text" onClick={onChange} type="button">
				Change cloud-init link
			</button>
		);
	}
	if (image === "vllm") {
		return (
			<a
				className="btn-text"
				href={VLLM_URL}
				rel="noopener noreferrer"
				target="_blank"
			>
				View vLLM cloud-init template <span aria-hidden="true">↗</span>
			</a>
		);
	}
	return null;
}
