# Nhipo MCP server – let your AI assistant edit videos on your PC

[Nhipo](https://discord.gg/N2J3XP6puh) is an AI video editor that runs **entirely on your computer**. Your footage is never
uploaded. Nhipo ships with a built-in [Model Context Protocol](https://modelcontextprotocol.io) server, so Claude Code,
Claude Desktop, Cursor and any other MCP client can drive it: "turn these clips into a 30-second vertical video with
captions", "dub this drama into English", "check my export for cut-off faces", "make me a whoosh sound".

- **Local:** the server talks over stdio only. It opens no network port and never posts anything online.
- **Same engine as the app:** cuts, captions, music, framing, sound effects, animated stories and the video checker are
  the ones the Nhipo app uses, with the same plan limits.
- **One install:** the server is part of the Nhipo app (`Nhipo.exe --mcp`). There is nothing else to download.

## Requirements

- Windows 10 or 11, 64-bit
- Nhipo **2.7.7 or newer**. Download it for free from the `#download` channel of the
  [Nhipo Discord](https://discord.gg/N2J3XP6puh).

## Connect your AI assistant

**Easiest:** in Nhipo, open the menu ☰ → **Connect an AI assistant (MCP)**, then click **Connect** next to Claude Desktop
or Cursor. Nhipo adds itself to that app's MCP config (it keeps your other servers and saves a backup) and shows the
command for Claude Code. Restart the assistant afterwards.

**By hand:** the default install folder is `%LOCALAPPDATA%\Programs\Nhipo`. Change the path below if you installed Nhipo somewhere
else.

**Claude Code**

```powershell
claude mcp add nhipo -s user -- "$env:LOCALAPPDATA\Programs\Nhipo\Nhipo.exe" --mcp
```

**Claude Desktop** (`%APPDATA%\Claude\claude_desktop_config.json`), **Cursor** (`.cursor\mcp.json`) and other clients:

```json
{
  "mcpServers": {
    "nhipo": {
      "command": "C:\\Users\\YOU\\AppData\\Local\\Programs\\Nhipo\\Nhipo.exe",
      "args": ["--mcp"]
    }
  }
}
```

The server runs without a window. It works whether or not the Nhipo app is open.

## Tools

| Tool | What it does |
|---|---|
| `create_from_videos` | AI-edits a short video from 1–20 source clips (cuts, captions, music, framing; 9:16, 1:1 or 16:9) and exports an MP4 |
| `export_status` | Progress and result of a video job: percent, step, time left, then the MP4 path, size and duration |
| `job_status` / `job_cancel` | Status of any long job, or cancel it |
| `dub_video` | Translates a video's speech into one of 12 languages and dubs it with new voices: keeps the background music, reads burned-in subtitles and covers them with translated ones |
| `sfx_generate` | Text description → new sound effect (WAV) |
| `story_build` | Animated storytelling video (AI-written story, on-device painter, voice-over) |
| `review_video` | Watches a video and lists flaws (cut-off faces, captions over faces, frozen or flickering frames, blur…) with timestamps and fixes |
| `nhipo_status` | Version, your plan and its limits, folders the server may use, running jobs |

Long jobs run one at a time in the background. A tool returns a `jobId` straight away, and your assistant follows up with
`export_status` or `job_status`.

## Plans

The MCP server uses your Nhipo plan, exactly like the app. The Free plan can export AI edits of up to 60 seconds and has
small daily quotas for AI effects and stories. Ask your assistant to run `nhipo_status` to see your limits. Keys and
upgrades are in the [Nhipo Discord](https://discord.gg/N2J3XP6puh).

## Files and privacy

- **Reads** video files from your Videos, Desktop, Downloads, Documents and Pictures folders, and from Nhipo's export
  folder.
- **Writes** only to Nhipo's export folder (Settings → video folder, `Videos\Nhipo` by default).
- Paths must be absolute. Network paths and NTFS alternate data streams are refused.
- The server never reads your account tokens or API keys and has no tool that publishes anything.

## Try it

> Edit `C:\Users\me\Videos\trip\*.mp4` into a 30-second 9:16 video with captions, then check it for problems.

> Dub `C:\Users\me\Downloads\drama-ep1.mp4` into English and cover the Chinese subtitles.

> Make a short animated story about a cat who learns to surf, 9:16.

> Generate a soft "pop" UI sound and save it to my Nhipo video folder.

## Help

Questions, bug reports and feature ideas: [Nhipo Discord](https://discord.gg/N2J3XP6puh).

---

### Tiếng Việt

Nhipo là app dựng video bằng AI chạy hoàn toàn trên máy bạn. Từ bản 2.7.7, Nhipo có sẵn máy chủ MCP: trợ lý AI (Claude
Code, Claude Desktop, Cursor…) dựng video, tạo âm thanh, làm hoạt hình kể chuyện và soi lỗi video bằng Nhipo. Kết nối
Claude Code bằng lệnh ở trên (`Nhipo.exe --mcp`). Tải Nhipo miễn phí và hỏi đáp tại [Discord Nhipo](https://discord.gg/N2J3XP6puh).

---

This repository holds documentation only. Nhipo is free to download. © Nhipo.
