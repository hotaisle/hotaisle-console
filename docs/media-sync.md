# Console media synchronization

Use this process whenever a Console change affects published screenshots or the
walkthrough. The Console owns the UI, fixtures, storyboard, narration, and master
captures. The website owns delivery assets shared by Quick Start and the launch
blog post. Neither repository automatically regenerates the other's media.

## Decide before opening a PR

Review the complete diff, including changes made after the last capture. Changes
to visible text, layout, themes, hardware, controls, navigation, sign-in, teams,
credits/rebill, launch, machine actions/history, or settings can invalidate media.
Backend-only changes need a refresh only if they change the demonstrated behavior.

If affected media is stale and a sync is not already authorized, ask:

> These changes affect the published Console media. Should I refresh the affected
> README screenshots, website/blog images, and walkthrough before opening the PR?

Name the affected subset; do not ask to redo unrelated media. An explicit request
to regenerate media is sufficient authorization. When a release already authorizes
that regeneration, complete it without another confirmation. If the user chooses
to defer, record that decision and the remaining media in the PR. Documentation-only
changes to this process do not require new captures.

Include one media status in every relevant PR description:

- **Refreshed:** what was regenerated, the source revision, and companion PR links.
- **Not affected:** why the current media still depicts the changed application.
- **Deferred:** the user's decision and exactly which assets remain stale.

This is a required human/agent workflow check, not an automated stale-media test.
Passing application CI does not prove the screenshots or video are current.

## Sources and destinations

Paths in this document are relative to the named repository. Keep public records
free of personal paths, credentials, real account data, and raw control-plane logs;
follow [the publication policy](SECURITY-PUBLICATION.md).

| Source in Console | Responsibility |
| --- | --- |
| `web/src/`, `web/dev/` | Real components plus browser-only preview fixtures |
| `web/dev/showcase/storyboard.ts` | Actions, exact spoken/subtitle text, scene durations |
| `worker/scripts/prepare-showcase.ts` | Local Kokoro voice generation |
| `worker/scripts/showcase-edit.ts` | Intro, URL typing, credits pause, closing, timeline retiming |
| `worker/scripts/showcase-artwork.ts`, `web/public/favicon.svg` | Matching opening/closing branding |
| `worker/scripts/compose-showcase.ts` | Timestamped frames, voice, music, captions, master MP4 |
| `artifacts/showcase/<take>/` | Ignored raw captures, timing, masters, delivery copies, QA, manifests |

Capture four lossless PNG sources: `machine-light.png`, `machine-dark.png`,
`order-light.png`, and `order-dark.png`. Use this mapping for the published JPEGs:

| Capture | Console destinations | Website destinations |
| --- | --- | --- |
| `machine-light.png` | `docs/machine.jpg` | `public/assets/quickstart/hotaisle-console.jpg`; blog `header.jpg`, `machine-light.jpg` |
| `machine-dark.png` | `docs/machine-dark.jpg` | `public/assets/quickstart/hotaisle-console-dark.jpg`; blog `header-dark.jpg`, `machine-dark.jpg` |
| `order-light.png` | `docs/order.jpg` | Blog `order-light.jpg` |
| `order-dark.png` | — | Blog `order-dark.jpg` |

Here, blog sources live in website
`src/content/blog/assets/introducing-hotaisle-console/`. Every website JPEG also
has full-size WebP and AVIF companions. The two Quick Start images additionally
have `-480w`, `-672w`, and `-800w` WebP/AVIF variants. That is **36 website image
files plus three Console JPEGs** for a complete screenshot refresh.

Quick Start and the blog share these four website delivery files; do not create
another independent video copy for the blog:

```text
public/assets/quickstart/hotaisle-console-walkthrough.mp4
public/assets/quickstart/hotaisle-console-walkthrough.en.vtt
public/assets/quickstart/hotaisle-console-walkthrough-transcript.txt
public/assets/quickstart/hotaisle-console-walkthrough-poster.webp
```

The blog references them in `src/content/blog/introducing-hotaisle-console.md`.
Preserve its copy, date, and funding section unless an editorial change is also
requested. A media refresh must not silently remove funding or other paragraphs.

## Prepare one coherent take

Finish UI changes first. Use descriptive non-default branches in both repositories,
inspect existing changes, and record the source revision plus any uncommitted UI
diff in an ignored take manifest. Never infer the newest take by filename or mtime;
select one explicitly. Retain earlier captures until the replacement is verified.

Use Bun 1.4.4, FFmpeg/ffprobe, and the optional locked showcase tools. With the
existing development process already running, execute from the Console root:

```sh
bun install --cwd tools/showcase --frozen-lockfile
bun run showcase
```

`showcase` prepares narration and builds preview assets; it does not start a server.
For screenshot-only changes, `bun run --cwd web build:preview` is sufficient.
Do not start/restart a server, watcher, or tunnel during browser verification. If
the existing preview cannot be reached, report that prerequisite instead.

Open `http://preview.localhost:8787/__preview/` for screenshots and
`http://preview.localhost:8787/__preview/showcase.html` for the video, using Chrome's
Hot Aisle profile through the relay. Use fixtures only: no real sign-in, keys,
checkout, email invitations, or machine operations. Keep the simulated-data label
on the walkthrough. Preview source, voice caches, raw music, docs, and take files
must stay outside production assets.

## Capture screenshots and footage

1. Record the original Chrome window position/size, zoom, and emulation settings.
   Keep Chrome in the background. Restore the exact settings in success and error
   cleanup, and close only capture tabs that you created.
2. Use a **1920 × 1080 content viewport**, excluding browser controls. Check actual
   PNG and screencast frame dimensions, not just requested CDP dimensions. In the
   last refresh, viewport emulation produced narrower screencast frames even though
   screenshots were correct. A background tab could also retain its previous size
   after a native resize. A fresh capture tab at the verified native content size
   resolved it; restore the original window afterwards.
3. Wait for the drawer to finish opening, the fan slowdown and selected GPU rings
   to settle, and the specs/callout to appear. Avoid transitional frames, clipping,
   focus/hover artifacts, or truncated text. Capture the running two-GPU machine
   and the two-GPU vLLM launch view in both themes from the same source version.
   Hide preview-only scenario controls or the automation cursor for stills if
   needed, and remove temporary capture styling afterwards.
4. Use lossless PNG screenshots; do not extract low-quality JPEG video frames for
   the README. Inspect all four PNGs before generating their derivatives.
5. For the video, reset fixtures and keep studio camera motion **off**. Start in
   dark mode; light mode appears only when the story selects it in Settings. Use
   the existing flow: welcome/URL typing, email approval, team creation, credits,
   automatic rebill options, two GPUs/vLLM, launch/ready, release, history, settings,
   closing card. Credits and rebill are demonstrations that back out of payment.
6. Use the [recording guide](showcase.md#record) for tab recording or background CDP
   screencast capture. With CDP, save and promptly acknowledge each frame, retain
   its timestamp in `frames.json`, stop the screencast in cleanup, and save the
   completed studio timing. Keep the original `timing.json` distinct from the
   composer's edited `.timing.json`. Reject failed or incomplete stories. Inspect
   frame dimensions and gaps; static scenes need not emit frames continuously.

## Generate image variants

Use the website's installed `sharp` from a Bun/TypeScript helper; do not add a
second image dependency to Console. The last refresh encoded the lossless sources
with these settings:

```ts
const jpeg = await sharp(source)
	.jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
	.toBuffer();
const webp = await sharp(source).webp({ effort: 6, quality: 82 }).toBuffer();
const avif = await sharp(source).avif({ effort: 8, quality: 55 }).toBuffer();
// For each Quick Start width: 480, 672, 800.
const small = await sharp(source)
	.resize({ width, withoutEnlargement: true })
	.webp({ effort: 6, quality: 82 })
	.toBuffer();
// Generate the corresponding AVIF with effort 8, quality 55 too.
```

Encode each capture once per format/size and copy those bytes to every mapped
destination; copy the matching full-size JPEGs to Console's `docs/`. Stage the
36 website files under the ignored take directory first. Write a manifest of
destination, byte count, new SHA-256, and previous destination SHA-256. Validate
all inputs, dimensions, destinations, and existing-file hashes before replacing
anything. Back up previous media locally; abort if a destination changed since
staging rather than overwriting another person's changes.

Website `bun run generate:images` generates missing/stale variants and mirrors
blog sources to ignored `public/assets/blog/`; `bun run build` also runs this step.
It does not capture the UI or refresh Console's README. Its normal JPEG-derived
variants can differ from the last refresh's directly PNG-derived variants, so
inspect any derivative diff. CI normally skips encoding: commit all variants,
not just JPEGs. Edit the blog source asset directory, never its generated mirror.

## Compose the video and delivery copy

Follow [music and beat timing](showcase.md#music-and-beat-timing) for the exact
local excerpt and existing voice configuration. Current composition uses the
provided Flavour Trip excerpt beginning at 33.04 seconds, 118 BPM, Bella's original
voice pitch/speed, and at most 6 dB music ducking. Keep these choices unless the
user changes them; raw music stays local and its availability is not guaranteed
by a clone. Do not silently substitute a different song or voice.

From the Console root, with paths to the explicitly chosen take:

```sh
bun run showcase:compose artifacts/showcase/<take>/frames.json artifacts/showcase/<take>/timing.json artifacts/showcase/<take>/master.mp4 music-excerpt.m4a 118
```

The composer creates the master, edited SRT/timing, and closing PNG/SVG. It uses
the exact current narration and rejects stale clips. The source grid is 125 BPM;
composition retimes footage, voice, and captions together to the music BPM. Do not
feed the edited timing back into composition or add the intro/credits pause twice.
The current finished story is about 83 seconds. The opening logo is frame one,
the greeting accompanies URL typing after a short hold, and the final line appears
with the matching closing card and website address.

Create a separate small delivery MP4; retain the master. The last 1080p delivery
used two-pass encoding at 2150 kbit/s video and was about 19.5 MiB. These commands
run from the take directory, using a unique local pass-log prefix:

```sh
ffmpeg -y -i master.mp4 -map 0:v:0 -c:v libx264 -preset slow -b:v 2150k -maxrate 2500k -bufsize 5000k -pix_fmt yuv420p -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 -pass 1 -passlogfile encode-pass -an -f null /dev/null
ffmpeg -y -i master.mp4 -map 0:v:0 -map 0:a:0 -c:v libx264 -preset slow -b:v 2150k -maxrate 2500k -bufsize 5000k -pix_fmt yuv420p -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 -pass 2 -passlogfile encode-pass -c:a copy -movflags +faststart delivery.mp4
ffmpeg -y -i master.mp4 -frames:v 1 first-frame.png
ffmpeg -v error -i delivery.mp4 -f null /dev/null
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate -of json delivery.mp4
ffmpeg -v error -i master.mp4 -map 0:a:0 -c copy -f hash -hash sha256 -
ffmpeg -v error -i delivery.mp4 -map 0:a:0 -c copy -f hash -hash sha256 -
```

Check 1920 × 1080, 30 fps, H.264/yuv420p, matching duration and audio hashes, and a
complete error-free decode. Keep the delivery file below Cloudflare's documented
25 MiB static-asset limit; do not assume that a previous bitrate still fits a
longer edit. Adjust video bitrate if necessary, preserving audio and legibility.

Prepare the four shared delivery files as one set:

- Copy `delivery.mp4` to the mapped website MP4.
- Convert the **new composition's SRT** to WebVTT (`WEBVTT` header and decimal-dot
  timestamps), with a background-music cue before the first spoken cue. Do not use
  pre-edit studio captions: they lack the composer's pauses and tempo changes.
- Build the transcript from that composition's ordered `cues[].text`, retaining
  descriptions of music, opening/URL typing, and closing artwork. It should match
  the spoken words exactly.
- Encode `first-frame.png` as the poster WebP (quality 88, effort 6). Verify the
  complete Hot Aisle Console logo and website are visible at the first frame.

As with screenshots, stage and hash the set, check previous hashes, back up existing
files, then replace the four destinations. An unchanged poster/transcript need not
produce a Git diff, but must still be checked against the new composition.

## Verify, review, and release

Watch the finished delivery copy, including sign-in, team-to-credits transition,
rebill opening/fields/cancel, size/image selection, launch, release, history,
theme change, and both cards. Confirm captions/voice agree, actions land in their
scenes, pauses are readable, the song remains audible, and text stays in place.
Check both themes, selected-GPU rings, drawer/fans, specs edges, panel scrolling,
and unclipped content. A successful encode alone is not visual QA.

In Console, run the required checks for changed code and the Worker suite before
each commit. For media packaging changes, verify the normal production build and
asset guard still exclude preview/source/docs. In the website root:

```sh
bun run check
bun run build
bun run test src/scripts/video-modal.test.ts src/scripts/blog-image-modal.test.ts src/lib/blog-tldr.test.ts
```

Check Quick Start and the blog use the same MP4, poster, captions, and transcript;
verify their light/dark images, large play control, and “Click to play the video”
text. Keep README and website media commits coherent and link companion PRs. Do
not commit raw captures, voice caches, source music, generated app output, or
local hash manifests. Keep documentation under Console `docs/`, outside assets.

When release is authorized, merge through each repository's normal checks, then
wait for both production deployments. Preserve Console's canonical PR-number
suffix/trailer when customizing a squash commit; see [native build provenance](cloudflare-builds.md).
After deployment, verify the Console build footer points to its merged PR and
fetch the public video, captions, poster, and representative light/dark images to
compare hashes with the reviewed files. A HEAD response may omit content length;
use the actual bytes rather than treating that omission as a failed deployment.
Confirm the blog's funding copy remains intact and both working trees contain
only intended changes.
