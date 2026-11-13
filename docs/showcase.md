# Console showcase

The local showcase uses the real sign-in, team, rental, machine, history, credits,
and settings components with a browser-only simulated API. It starts signed out,
approves a fixture email, creates a team with a simulated balance, previews Add credits and
opens automatic rebill to show its balance trigger, top-up amount, and monthly cap,
backs out without submitting either payment flow, launches two GPUs with vLLM cloud-init, releases the
machine, reviews its history, and changes appearance and the default image.
The browser walkthrough is about 69 seconds, beginning with sign-in and team creation.
The finished composition is about 83 seconds with the current music: it adds a logo card and URL typing before sign-in,
two extra seconds on Add credits, and a closing card with a reading pause.
Cloud-init startup is compressed to three seconds in this isolated showcase fixture.
No real email, payment, credential, or machine operation is used. Unknown requests
fail locally; there is no real API fallback. Simulated history remains in memory.

## Build and open

With the normal development process already running:

```sh
bun install --cwd tools/showcase --frozen-lockfile
bun run showcase
```

This generates narration locally with Kokoro's Bella female voice and FFmpeg, then
builds preview assets. It uses the fixed voice at its original pitch and speed.
The first run downloads the public 82M model into ignored `tools/showcase/.cache/`.
Speech runs on the CPU; narration is not sent to a speech service. Native media tools
have a separate dependency lockfile and are not installed for application builds.
It does **not** start or restart a development server. On systems without those
tools, `bun run preview` builds a caption-only version when no generated clips exist.
Open Chrome's Hot Aisle profile at:

```text
http://preview.localhost:8787/__preview/showcase.html
```

Use a 1920 × 1080 **content viewport**, excluding browser toolbars. Record its
original window position, size, zoom, and any emulation before changing them, and
restore them afterwards. Camera movement defaults to off so controls and text stay
in place during each interaction; the studio button can explicitly enable it. Status animation is enabled
temporarily during playback. Browser preferences are restored on completion,
cancellation, or failure. Reset reloads fixture state without deleting storage.

With camera movement enabled, a gentle 0.975–0.995 scale transition runs at the
start of each section and settles before its controls are used. The framing is
held throughout that section's actions. Scrolling also settles before a click,
so neither camera easing nor scroll animation moves text under the pointer.

## Record

Play walkthrough rehearses the story. Record video asks Chrome to share a tab;
select **only the Showcase studio tab**. Chrome requires a direct click while the
tab has focus. Monitor and window capture are rejected and stopped. Capture has
no microphone or system audio; generated narration routes directly into the video
without playing through desktop speakers. The recording includes captions, a
pointer, camera movement, and a visible simulated-data label.

After completion, save the WebM video, SRT captions, and JSON timing. Stop cancels
pending actions and releases capture/audio resources. A missing or disabled control
fails with a visible error rather than silently skipping an action. Use Reset
before each new take. A partial recording can be saved after interruption.

Convert a recording to a broadly playable 1080p MP4:

```sh
bun run showcase:export recording.webm recording.mp4
```

For background recording through the Chrome relay, use its tab-scoped CDP
`Page.startScreencast` with JPEG frames at 1920 × 1080. Read the event cursor before
starting; save each `Page.screencastFrame` with its `metadata.timestamp` and
acknowledge its `sessionId` promptly. Keep capturing throughout playback, then call
`Page.stopScreencast`. Save a `frames.json` array beside the frame files, containing
`{ "file": "frame-000001.jpg", "time": 1790000000.123 }` entries. Use the studio's
Save timing output to align narration and trim setup footage:

```sh
bun run showcase:compose frames.json timing.json showcase.mp4
```

This composition uses frame timestamps to preserve pacing and adds the generated
voice clips at each scene's actual start. It also redraws the caption strip from
the exact spoken script, including updated chapter counts. Both composition and
browser playback reject stale voice clips after their text changes; regenerate
them instead of exporting mismatched subtitles. Capture only this preview tab, and keep
Chrome in the background. Never use real account pages in the recording.

Composition opens on the fully visible logo and website card for about one second.
It is the very first encoded frame, so a player using frame one as its poster
shows the brand rather than a blank browser. The card then fades into a
4.8-second browser-title animation typing
`console.hotaisle.app`, then reveals the recorded sign-in screen. The greeting starts as URL typing begins,
using the same voice and exact text as its caption. This artwork
does not navigate a browser or record address-bar history. The page stays at its
final size and position as the toolbar reveals it, without stretching text. The Add credits page
holds for another 1.92 seconds; later footage, narration, and captions shift
together while the music continues. The closing card fades in with the final
spoken line and holds for another 1.92 seconds. These additions preserve the
125 BPM source beat grid. Composition can scale the complete edit to another tempo,
including the artwork, credits pause, footage, speech, and captions.
`worker/scripts/showcase-edit.ts` controls their timing.

The distributed video uses fixed app framing with the studio camera off. The
exporter does not add another scaling effect. Launch descriptions and estimates
reserve space in the showcase so changing a size or image does not push later
controls around. Sign-in mounts in dark mode before playback; the exporter also
excludes pre-playback setup frames from its opening still and footage.
The source walkthrough always uses its 125 BPM edit grid; composition retimes it
to the supplied music BPM.

For website delivery, keep a separate 1080p H.264 MP4 with fast-start metadata below
[Cloudflare’s 25 MiB static-asset limit](https://developers.cloudflare.com/workers/platform/limits/#static-assets).
Retain the full-quality master. Verify the delivery copy decodes fully, preserves its duration,
and copies the AAC audio unchanged before replacing the website asset.

The closing artwork reuses `web/public/favicon.svg`. Composition exports its
PNG and SVG beside the video; the SVG contains a clickable link to
<https://console.hotaisle.app>. The address is visible in the video. Edited SRT
captions and a timing sidecar are also saved alongside the MP4. Use the original
capture timing as composition input, so the added pauses are applied only once.

## Music and beat timing

Analyze a local music file before building the preview:

```sh
bun run showcase:music music.m4a "Track title" "https://example.com/source"
bun run preview
```

The analyzer measures a steady bass pulse over the opening section and writes an
ignored local beat grid. Review its tempo and offset before recording; variable
tempo material may need a manually measured grid. The current storyboard
uses fixed chapter times arranged around 125 BPM bars. Clicks and selections wait for the next beat, and
holds begin 700 ms early so confirmation lands on the beat. Asynchronous API status
updates still happen when their polls complete. Actual event times are included in
the timing JSON. With no generated grid the timed walkthrough still works. Change
the storyboard chapter times when using music with another tempo. If a scene runs
past its slot, playback reports the overrun instead of exporting a successful take.

Pass the same local audio excerpt to composition:

```sh
bun run showcase:compose frames.json timing.json showcase.mp4 music.m4a 118
```

The music fades in and out and is automatically lowered under narration by no more than 6 dB. Audio
stays outside source control and production assets. The current edit uses the
user-supplied Flavour Trip “Easy Morning Brunch House Music Mix” at 118 BPM.
The spoken introduction ends near 31.5 seconds; the excerpt begins
at 33.04 seconds. Trim the local source before composing. The optional final BPM
argument retimes the existing capture without changing the music's playback speed
or the voice's pitch. Omit it to retain the original edit speed. No publishing or
distribution is performed by these scripts.

## Edit the story

`web/dev/showcase/storyboard.ts` defines typed scenes: narration,
focus targets, actions, and minimum scene durations. Actions use actual visible
controls, including keyboard holds for destructive confirmation. Each action waits
briefly before proceeding. Captions and speech share the same narration field,
word for word. Every clip must fit its timed scene. Change narration here and
rerun `bun run showcase` to regenerate voices. The funds scene opens Add credits
and backs out without submitting checkout.

The showcase and all preview imports are separate build entries only in preview
mode. Production builds exclude them. The existing asset assertion also rejects
preview directories and documentation during Worker packaging. Generated narration,
preview builds, and `artifacts/showcase/` recordings are ignored by Git; none is
published with the app.
