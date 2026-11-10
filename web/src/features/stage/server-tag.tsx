import { type MouseEvent, useCallback } from "react";
import { NEW, TAG_STATE, type Tag } from "./model";

function tagName(tag: Tag) {
	if (tag.mode === "new") {
		return "Your new machine";
	}
	return tag.host === NEW ? "Server being assigned" : tag.host;
}
function TagContent({
	name,
	gpus,
	state,
	extra,
}: {
	name: string;
	gpus: string;
	state: string;
	extra: string;
}) {
	return (
		<>
			<i aria-hidden="true" className="ytag-arrow" />
			<i aria-hidden="true" className="ytag-dot" />
			<span className="ytag-name">{name}</span>
			<span className="ytag-sub">
				{gpus}, {state}
				{extra}
			</span>
		</>
	);
}

export function ServerTag({ tag }: { tag: Tag }) {
	const name = tagName(tag);
	const count = tag.mode === "new" ? tag.adding : tag.gpus;
	const gpus = `${count} of 8 GPUs`;
	const extra =
		tag.mode !== "new" && tag.adding > 0 ? `, +${tag.adding} new` : "";
	const className = `ytag ${tag.mode}${tag.focus ? " focus" : ""}`;
	const select = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			event.stopPropagation();
			const [machine] = tag.names;
			if (machine) {
				window.dispatchEvent(
					new CustomEvent("stage-focus", { detail: machine })
				);
			}
		},
		[tag.names]
	);
	if (tag.mode === "new" || tag.focus) {
		return (
			<span className={className} data-shown="false" data-tag={tag.host}>
				<TagContent
					extra={extra}
					gpus={gpus}
					name={name}
					state={TAG_STATE[tag.mode]}
				/>
			</span>
		);
	}
	return (
		<button
			aria-label={`${name}: ${gpus}, ${TAG_STATE[tag.mode]}${extra}. Show it`}
			className={className}
			data-shown="false"
			data-tag={tag.host}
			onClick={select}
			type="button"
		>
			<TagContent
				extra={extra}
				gpus={gpus}
				name={name}
				state={TAG_STATE[tag.mode]}
			/>
		</button>
	);
}
