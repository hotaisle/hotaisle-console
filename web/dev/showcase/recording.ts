export function recordingType() {
	return [
		"video/webm;codecs=vp9,opus",
		"video/webm;codecs=vp8,opus",
		"video/webm",
	].find((type) => MediaRecorder.isTypeSupported(type));
}
export async function capture(audio?: MediaStreamTrack) {
	let screen: MediaStream;
	try {
		screen = await navigator.mediaDevices.getDisplayMedia({
			audio: false,
			video: { frameRate: 30 },
		});
	} catch (reason) {
		if (reason instanceof DOMException && reason.name === "InvalidStateError") {
			throw new Error(
				"Select this Chrome tab, then click Record video directly. Chrome requires the recording tab to have focus.",
				{ cause: reason }
			);
		}
		throw reason;
	}
	try {
		if (
			screen.getVideoTracks()[0]?.getSettings().displaySurface !== "browser"
		) {
			throw new Error(
				"Choose only the Showcase studio Chrome tab, not a window or entire screen."
			);
		}
		const tracks = [...screen.getVideoTracks(), ...(audio ? [audio] : [])];
		const type = recordingType();
		if (!type) {
			throw new Error("This Chrome cannot record WebM video.");
		}
		const recorder = new MediaRecorder(new MediaStream(tracks), {
			mimeType: type,
			videoBitsPerSecond: 8_000_000,
		});
		const chunks: Blob[] = [];
		let started = false;
		recorder.addEventListener("dataavailable", (event) => {
			if (event.data.size) {
				chunks.push(event.data);
			}
		});
		const result = new Promise<Blob>((resolve, reject) => {
			recorder.addEventListener(
				"stop",
				() => resolve(new Blob(chunks, { type })),
				{ once: true }
			);
			recorder.addEventListener(
				"error",
				() => reject(new Error("Video recording failed.")),
				{ once: true }
			);
		});
		return {
			onEnded: (callback: () => void) =>
				screen
					.getVideoTracks()[0]
					?.addEventListener("ended", callback, { once: true }),
			start: () => {
				recorder.start(1000);
				started = true;
			},
			stop: async () => {
				if (recorder.state !== "inactive") {
					recorder.stop();
				}
				for (const track of screen.getTracks()) {
					track.stop();
				}
				return started ? await result : new Blob([], { type });
			},
		};
	} catch (error) {
		for (const track of screen.getTracks()) {
			track.stop();
		}
		throw error;
	}
}
export function download(value: Blob, filename: string) {
	const url = URL.createObjectURL(value);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
