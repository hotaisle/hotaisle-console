import { useCallback, useEffect, useRef, useState } from "react";
import {
	applyStatusMotion,
	applyTheme,
	getPrefs,
	setPrefs,
} from "../../src/lib/prefs";
import type { PreviewAPI } from "../api";
import { createCamera } from "./camera";
import { music } from "./music";
import { capture, download } from "./recording";
import { type Cue, find, pause, play, subtitles } from "./runner";
import { STORYBOARD } from "./storyboard";
import { clips, createVoice } from "./voice";

export function Studio({ api }: { api: PreviewAPI }) {
	const approve = useCallback(() => api.approveEmail(), [api]);
	const [running, setRunning] = useState(false);
	const [caption, setCaption] = useState("");
	const [chapter, setChapter] = useState(0);
	const [error, setError] = useState("");
	const [video, setVideo] = useState<Blob>();
	const [cues, setCues] = useState<Cue[]>([]);
	const [finished, setFinished] = useState(false);
	const [motion, setMotion] = useState(
		!matchMedia("(prefers-reduced-motion: reduce)").matches
	);
	const startedAt = useRef(0);
	const controller = useRef<AbortController | null>(null);
	const stop = useCallback(
		() =>
			controller.current?.abort(
				new DOMException("Walkthrough stopped", "AbortError")
			),
		[]
	);
	useEffect(() => {
		window.addEventListener("pagehide", stop);
		return () => {
			window.removeEventListener("pagehide", stop);
			stop();
		};
	}, [stop]);
	const run = useCallback(
		async (shouldRecord: boolean) => {
			if (controller.current) {
				return;
			}
			const control = new AbortController();
			controller.current = control;
			const previous = { ...getPrefs() };
			const voice = createVoice(true);
			const camera = createCamera(motion);
			let recording: Awaited<ReturnType<typeof capture>> | undefined;
			setError("");
			try {
				await voice.resume();
				if (shouldRecord) {
					recording = await capture(voice.track);
					recording.onEnded(stop);
				}
				setPrefs({
					image: "standard",
					notify: false,
					sound: false,
					statusMotion: "on",
					theme: "dark",
				});
				applyTheme("dark");
				applyStatusMotion("on");
				setRunning(true);
				document.body.classList.add("showcase-playing");
				document.body.dataset.cameraMotion = String(motion);
				await pause(1000, control.signal);
				recording?.start();
				startedAt.current = Date.now();
				const timeline = await play(STORYBOARD, {
					approve,
					grid: music,
					point: camera.point,
					scene(scene, index) {
						setCaption(scene.narration);
						setChapter(index + 1);
						camera.focus();
						const target = scene.focus ?? {
							selector: ":is(.auth-content, .panel)",
						};
						if (target) {
							find(target, control.signal)
								.then(camera.focus)
								.catch(() => {
									// Playback actions report missing controls; camera focus is optional.
								});
						}
					},
					signal: control.signal,
					voice: voice.play,
				});
				setCues(timeline);
				setFinished(true);
			} catch (reason) {
				setError(
					reason instanceof Error ? reason.message : "The walkthrough failed."
				);
			} finally {
				if (recording) {
					try {
						setVideo(await recording.stop());
					} catch (reason) {
						setError(
							reason instanceof Error ? reason.message : "Video export failed."
						);
					}
				}
				await voice.close();
				camera.reset();
				setPrefs(previous);
				applyTheme(previous.theme);
				applyStatusMotion(previous.statusMotion);
				document.body.classList.remove("showcase-playing");
				delete document.body.dataset.cameraMotion;
				setRunning(false);
				controller.current = null;
			}
		},
		[approve, stop, motion]
	);
	const rehearse = useCallback(() => {
		run(false).catch(() => setError("Could not start playback."));
	}, [run]);
	const record = useCallback(() => {
		run(true).catch(() => setError("Could not start recording."));
	}, [run]);
	const saveVideo = useCallback(() => {
		if (video) {
			download(video, "hotaisle-console-showcase.webm");
		}
	}, [video]);
	const reset = useCallback(() => location.reload(), []);
	const saveCaptions = useCallback(
		() =>
			download(
				new Blob([subtitles(cues)], { type: "text/plain" }),
				"hotaisle-console-showcase.srt"
			),
		[cues]
	);
	const saveTimeline = useCallback(
		() =>
			download(
				new Blob(
					[JSON.stringify({ cues, startedAt: startedAt.current }, null, 2)],
					{ type: "application/json" }
				),
				"hotaisle-console-showcase.json"
			),
		[cues]
	);
	const toggleMotion = useCallback(() => setMotion((enabled) => !enabled), []);
	return (
		<>
			<div aria-hidden="true" className="showcase-pointer" />
			<div className="showcase-label">Simulated data · no real charges</div>
			{running ? (
				<footer className="showcase-captions">
					<span className="showcase-chapter">
						{String(chapter).padStart(2, "0")} / {STORYBOARD.length}
					</span>
					<p aria-live="polite">{caption}</p>
					<button className="showcase-stop" onClick={stop} type="button">
						Stop
					</button>
				</footer>
			) : (
				<section aria-label="Showcase studio" className="showcase-controls">
					<div>
						<strong>
							{finished ? "Walkthrough complete" : "Console showcase studio"}
						</strong>
						<p>
							Use a 1920 × 1080 Chrome viewport. Record only this tab.{" "}
							{Object.keys(clips).length
								? "Voiceover ready."
								: "Captions only; run bun run showcase:prepare for voiceover."}
						</p>
						{music ? (
							<p>
								Beat timing: {music.bpm} BPM · {music.title}
							</p>
						) : null}
					</div>
					{finished || error ? (
						<button onClick={reset} type="button">
							Reset walkthrough
						</button>
					) : (
						<>
							<button onClick={rehearse} type="button">
								Play walkthrough
							</button>
							<button onClick={record} type="button">
								Record video
							</button>
							<button
								aria-pressed={motion}
								onClick={toggleMotion}
								type="button"
							>
								Camera movement: {motion ? "on" : "off"}
							</button>
						</>
					)}
					{video ? (
						<button onClick={saveVideo} type="button">
							Save video
						</button>
					) : null}
					{cues.length ? (
						<>
							<button onClick={saveCaptions} type="button">
								Save captions
							</button>
							<button onClick={saveTimeline} type="button">
								Save timing
							</button>
							<details className="showcase-timing">
								<summary>Timing JSON</summary>
								<pre id="showcase-timing">
									{JSON.stringify(
										{ cues, startedAt: startedAt.current },
										null,
										2
									)}
								</pre>
							</details>
						</>
					) : null}
					{error ? <p role="alert">{error}</p> : null}
				</section>
			)}
		</>
	);
}
