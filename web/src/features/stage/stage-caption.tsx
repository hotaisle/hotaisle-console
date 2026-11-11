import "./stage-caption.css";

export function StageCaption({ text }: { text: string }) {
	return <p className="stage-caption">{text}</p>;
}
