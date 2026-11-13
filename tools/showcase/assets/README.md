# Walkthrough music

`flavour-trip-brunch-excerpt.m4a` preserves the music used by the Console walkthrough:

- **Credit:** Flavour Trip — *Easy Morning Brunch House Music Mix - Chill Jazzy & Latin DJ Set In Barcelona | Cooking Playlist*.
- **Excerpt:** 00:33.040–02:33.040 of the supplied recording; 120 seconds at 118 BPM.
- **Encoding:** stereo AAC, 48 kHz, 192 kb/s target bitrate; about 3 MB.

The file already starts at the edit's music cue. Pass it directly to
`bun run showcase:compose` without trimming another 33.04 seconds. It covers the
current approximately 83-second walkthrough plus roughly 37 seconds for extensions.
The opening audio matches the previously used local excerpt sample for sample.

This third-party recording retains its original rights; the repository's MIT
license does not relicense the music. The full recording is not included.
Keep this source asset outside frontend and Worker production assets; only the
finished walkthrough is delivered on the website.
