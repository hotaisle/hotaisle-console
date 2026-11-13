export interface CanvasImage {
	height: number;
	width: number;
}
export interface CanvasTools {
	createCanvas: (
		width: number,
		height: number
	) => {
		getContext: (kind: "2d") => {
			beginPath: () => void;
			drawImage: (
				image: CanvasImage,
				x: number,
				y: number,
				width: number,
				height: number
			) => void;
			fill: () => void;
			fillRect: (x: number, y: number, width: number, height: number) => void;
			fillStyle: string;
			fillText: (text: string, x: number, y: number, maxWidth?: number) => void;
			font: string;
			globalAlpha: number;
			measureText: (text: string) => { width: number };
			roundRect: (
				x: number,
				y: number,
				width: number,
				height: number,
				radius: number
			) => void;
			scale: (x: number, y: number) => void;
			textAlign: "center" | "left";
			textBaseline: "middle" | "alphabetic";
		};
		toBuffer: (kind: "image/png" | "image/jpeg") => Buffer;
	};
	loadImage: (path: string | Buffer) => Promise<CanvasImage>;
}
