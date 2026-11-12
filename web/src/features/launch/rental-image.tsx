import { Link } from "@tanstack/react-router";
import type { ConsoleSearch } from "../../app/route-state";
import { Picker } from "../../components/ui/picker";
import { IMAGES, type Image } from "../../lib/prefs";
import { ImageFooter } from "./image-footer";

const preserveSearch = (previous: ConsoleSearch) => previous;

export function RentalImage({
	image,
	metal,
	noKey,
	onChange,
	onEdit,
	team,
}: {
	image: Image;
	metal?: boolean;
	noKey: boolean;
	onChange: (image: Image) => void;
	onEdit: () => void;
	team: string;
}) {
	return (
		<div className="details">
			<Picker<Image>
				fixed={metal ? "Hot Aisle's standard image" : undefined}
				footer={metal ? null : <ImageFooter image={image} onChange={onEdit} />}
				label="Image"
				onChange={onChange}
				options={(Object.keys(IMAGES) as Image[]).map((k) => ({
					hint: IMAGES[k].note,
					label: IMAGES[k].name,
					value: k,
				}))}
				value={image}
			/>
			{noKey ? (
				<Link
					className="missing-ssh-key"
					hash="ssh-keys"
					hashScrollIntoView={{ block: "start" }}
					params={{ team }}
					search={preserveSearch}
					to="/teams/$team/settings"
				>
					Add an SSH key in Settings <span aria-hidden="true">→</span>
				</Link>
			) : null}
		</div>
	);
}
