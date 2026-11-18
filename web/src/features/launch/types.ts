import type { Image } from "../../lib/prefs";

export interface Order {
	count: number;
	customURL: string;
	image: Image;
	offer?: string;
}

export interface LaunchMeta {
	image: Image;
	price?: number;
	user_data_url?: string;
}
