import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  NoSubscriberBehavior,
  entersState,
  demuxProbe
} from '@discordjs/voice';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

// Ensure prism-media and internal FFmpeg spawns immediately locate the bundled static binary
if (ffmpegPath) {
  process.env.FFMPEG_PATH = ffmpegPath;
}

const isWin = process.platform === 'win32';
const customYtdlPath = path.resolve(process.cwd(), 'bin', isWin ? 'yt-dlp.exe' : 'yt-dlp');

export function getYtdlExecutable() {
  if (fs.existsSync(customYtdlPath)) {
    if (!isWin) {
      try { fs.chmodSync(customYtdlPath, 0o755); } catch {}
    }
    return customYtdlPath;
  }
  return isWin ? 'yt-dlp.exe' : 'yt-dlp';
}

export function initMusicEngine() {
  if (fs.existsSync(customYtdlPath) && !isWin) {
    try {
      fs.chmodSync(customYtdlPath, 0o755);
      console.log(`[Music] Standalone yt-dlp binary ready at ${customYtdlPath}`);
    } catch (err) {
      console.warn('[Music] Chmod error:', err.message);
    }
  }
}

/**
 * Sanitizes YouTube links to isolate the single video ID and strip playlist / radio / mix parameters.
 * E.g.: https://www.youtube.com/watch?v=XYZ&list=RD... -> https://www.youtube.com/watch?v=XYZ
 */
export function sanitizeTrackUrl(input) {
  if (!input || typeof input !== 'string') return '';
  const trimmed = input.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.includes('youtube.com') && parsed.searchParams.has('v')) {
      const v = parsed.searchParams.get('v');
      return `https://www.youtube.com/watch?v=${v}`;
    }
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.replace(/^\//, '').split('/')[0];
      if (id) {
        return `https://www.youtube.com/watch?v=${id}`;
      }
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

function executeMetadataExtraction(target, extraArgs) {
  return new Promise((resolve, reject) => {
    const bin = getYtdlExecutable();
    const cleanTarget = sanitizeTrackUrl(target);
    const cookiesPath = path.resolve(process.cwd(), 'cookies.txt');
    const cookieArgs = fs.existsSync(cookiesPath) ? ['--cookies', cookiesPath] : [];

    const args = [
      ...extraArgs,
      ...cookieArgs,
      '--dump-single-json',
      '--no-playlist',
      '--no-warnings',
      '--default-search', 'ytsearch',
      cleanTarget
    ];
    const cp = spawn(bin, args);
    let stdout = '';
    let stderr = '';

    cp.stdout.on('data', chunk => {
      stdout += chunk;
    });
    cp.stderr.on('data', chunk => {
      stderr += chunk;
    });

    cp.on('error', err => {
      reject(new Error(`Failed to launch yt-dlp: ${err.message}`));
    });

    cp.on('close', code => {
      if (code !== 0) {
        return reject(new Error(`yt-dlp failed (exit code ${code}): ${stderr.slice(0, 150)}`));
      }
      try {
        const json = JSON.parse(stdout);
        resolve(json);
      } catch (err) {
        reject(new Error(`Failed to parse yt-dlp output: ${err.message}`));
      }
    });
  });
}

/**
 * Extracts metadata for a track or query using multi-tiered fallback to bypass datacenter bot detection.
 */
export async function getTrackMetadata(target) {
  const strategies = [
    // Primary: Android client skipping webpage HTML download (bypasses bot verification page)
    ['--extractor-args', 'youtube:player_client=android;player_skip=webpage,configs'],
    // Secondary: Android + Mobile Web
    ['--extractor-args', 'youtube:player_client=android,mweb'],
    // Tertiary: Embedded TV client
    ['--extractor-args', 'youtube:player_client=tv_embedded,android']
  ];

  let lastError = null;
  for (const strategy of strategies) {
    try {
      return await executeMetadataExtraction(target, strategy);
    } catch (err) {
      lastError = err;
      console.warn(`[Music] Strategy ${strategy.join(' ')} failed, falling back...:`, err.message);
    }
  }
  throw lastError;
}

// Map storing active guild queues: guildId -> MusicQueue
const guildQueues = new Map();

class MusicQueue {
  constructor(guildId, voiceChannel, textChannel) {
    this.guildId = guildId;
    this.voiceChannel = voiceChannel;
    this.textChannel = textChannel;
    this.connection = null;
    this.subscription = null;
    this.player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play
      }
    });
    this.tracks = [];
    this.currentTrack = null;
    this.currentResource = null;
    this.currentProcess = null;
    this.volume = 1.0; // 0.0 to 1.0 (1.0 = 100%)
    this.isLooping = false;
    this.isPlaying = false;

    this.setupPlayerListeners();
  }

  setupPlayerListeners() {
    this.player.on('stateChange', (oldState, newState) => {
      console.log(`[Music Player ${this.guildId}] State: ${oldState.status} -> ${newState.status}`);
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      this.cleanupProcess();

      if (this.isLooping && this.currentTrack) {
        // Replay current track on loop
        this.playStream(this.currentTrack).catch(err => {
          console.error('[Music] Error looping track:', err);
          this.playNext();
        });
      } else {
        this.playNext();
      }
    });

    this.player.on('error', err => {
      console.error('[Music] Audio Player Error:', err.message);
      this.cleanupProcess();
      if (this.textChannel) {
        this.textChannel.send(`⚠️ Audio playback error: ${err.message}`).catch(() => null);
      }
      this.playNext();
    });
  }

  cleanupProcess() {
    if (this.currentProcess) {
      try {
        this.currentProcess.kill('SIGKILL');
      } catch {}
      this.currentProcess = null;
    }
  }

  async playStream(track) {
    this.cleanupProcess();
    this.currentTrack = track;

    try {
      const bin = getYtdlExecutable();
      const cleanUrl = sanitizeTrackUrl(track.url);
      const cookiesPath = path.resolve(process.cwd(), 'cookies.txt');
      const cookieArgs = fs.existsSync(cookiesPath) ? ['--cookies', cookiesPath] : [];

      console.log(`[Music] Launching stream for: ${cleanUrl} using ${bin}`);
      const cp = spawn(bin, [
        cleanUrl,
        '--extractor-args', 'youtube:player_client=android;player_skip=webpage,configs',
        ...cookieArgs,
        '-o', '-',
        '-q',
        '-f', 'bestaudio/best',
        '--no-playlist',
        '--no-warnings'
      ], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.currentProcess = cp;

      cp.on('error', err => {
        console.warn('[Music] yt-dlp spawn error:', err.message);
      });

      if (cp.stderr) {
        cp.stderr.on('data', data => {
          const msg = data.toString();
          if (msg.toLowerCase().includes('error')) {
            console.warn('[Music yt-dlp stderr]:', msg.trim());
          }
        });
      }

      // Demux probe with a 15-second timeout to prevent indefinite hanging
      const probePromise = demuxProbe(cp.stdout);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Audio stream demux probe timed out after 15s')), 15000)
      );
      const probe = await Promise.race([probePromise, timeoutPromise]);
      console.log(`[Music] Demux probe resolved stream type: ${probe.type}`);

      const resource = createAudioResource(probe.stream, {
        inputType: probe.type,
        inlineVolume: true
      });

      if (resource.volume) {
        resource.volume.setVolume(this.volume);
      }

      resource.playStream.on('error', err => {
        console.error('[Music AudioResource] Stream error:', err.message);
      });

      this.currentResource = resource;
      this.player.play(resource);
      this.isPlaying = true;
    } catch (err) {
      console.error(`[Music] Failed to stream ${track.url}:`, err);
      this.cleanupProcess();
      throw err;
    }
  }

  async playNext() {
    this.cleanupProcess();

    if (this.tracks.length === 0) {
      this.isPlaying = false;
      this.currentTrack = null;
      this.currentResource = null;
      if (this.textChannel) {
        this.textChannel.send('🎶 Queue concluded. Add more tracks with `-play <song or url>`.').catch(() => null);
      }
      return;
    }

    const nextTrack = this.tracks.shift();
    try {
      await this.playStream(nextTrack);
      if (this.textChannel) {
        this.textChannel.send(`▶️ **Now Playing:** **${nextTrack.title}** (${nextTrack.duration || 'Live/Unknown'}) • Added by <@${nextTrack.requesterId}>`).catch(() => null);
      }
    } catch (err) {
      if (this.textChannel) {
        this.textChannel.send(`⚠️ Failed to play **${nextTrack.title}**: ${err.message}`).catch(() => null);
      }
      this.playNext();
    }
  }

  setVolume(level) {
    const normalized = Math.max(1, Math.min(100, level)) / 100;
    this.volume = normalized;
    if (this.currentResource?.volume) {
      this.currentResource.volume.setVolume(this.volume);
    }
    return Math.round(this.volume * 100);
  }

  pause() {
    if (this.player.state.status === AudioPlayerStatus.Playing) {
      this.player.pause();
      return true;
    }
    return false;
  }

  resume() {
    if (this.player.state.status === AudioPlayerStatus.Paused) {
      this.player.unpause();
      return true;
    }
    return false;
  }

  async replay() {
    if (this.currentTrack) {
      await this.playStream(this.currentTrack);
      return true;
    }
    return false;
  }

  toggleLoop() {
    this.isLooping = !this.isLooping;
    return this.isLooping;
  }

  destroy() {
    this.cleanupProcess();
    this.tracks = [];
    this.currentTrack = null;
    this.isPlaying = false;
    try {
      this.player.stop(true);
    } catch {}
    try {
      if (this.connection) {
        this.connection.destroy();
      }
    } catch {}
    guildQueues.delete(this.guildId);
  }
}

/**
 * Connects the bot to the specified voice channel and awaits the Ready state.
 */
export async function joinVoice(voiceChannel, textChannel) {
  if (!voiceChannel) throw new Error('Voice channel required.');

  let queue = guildQueues.get(voiceChannel.guild.id);
  if (!queue) {
    queue = new MusicQueue(voiceChannel.guild.id, voiceChannel, textChannel);
    guildQueues.set(voiceChannel.guild.id, queue);
  } else {
    queue.voiceChannel = voiceChannel;
    if (textChannel) queue.textChannel = textChannel;
  }

  let connection = queue.connection;
  const isDead = !connection ||
    connection.state.status === VoiceConnectionStatus.Destroyed ||
    connection.state.status === VoiceConnectionStatus.Disconnected;

  if (isDead) {
    connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true
    });

    queue.connection = connection;
    queue.subscription = connection.subscribe(queue.player);

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000)
        ]);
      } catch {
        queue.destroy();
      }
    });

    connection.on('stateChange', (oldState, newState) => {
      console.log(`[VoiceConnection ${voiceChannel.guild.id}] State: ${oldState.status} -> ${newState.status}`);
    });

    connection.on('error', err => {
      console.warn('[VoiceConnection] error:', err.message);
    });
  } else if (connection.joinConfig?.channelId !== voiceChannel.id) {
    connection.rejoin({
      channelId: voiceChannel.id,
      selfDeaf: true
    });
  }

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
  } catch (err) {
    console.warn('[VoiceConnection] Connection did not reach Ready state in 20s:', err.message);
  }

  return queue;
}

/**
 * Searches and queues or plays a track from a YouTube URL or keyword query.
 */
export async function playMusic(voiceChannel, textChannel, query, member) {
  if (!query || query.trim() === '') {
    throw new Error('Please specify a song name or YouTube link to play.');
  }

  const queue = await joinVoice(voiceChannel, textChannel);

  const cleanQuery = query.trim();
  const isUrl = /^https?:\/\//i.test(cleanQuery);
  const target = isUrl ? sanitizeTrackUrl(cleanQuery) : cleanQuery;

  let meta;
  try {
    meta = await getTrackMetadata(target);
  } catch (err) {
    console.error('[Music] Metadata extraction error:', err);
    throw new Error(`Could not load track: ${err.message?.slice(0, 100) || 'Unknown error'}`);
  }

  const item = meta.entries && meta.entries.length > 0 ? meta.entries[0] : meta;
  if (!item || !item.title) {
    throw new Error(`No tracks found for "${cleanQuery}".`);
  }

  const durationSec = item.duration;
  let durationStr = 'Unknown';
  if (durationSec && typeof durationSec === 'number') {
    const mins = Math.floor(durationSec / 60);
    const secs = Math.floor(durationSec % 60);
    durationStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  } else if (item.duration_string) {
    durationStr = item.duration_string;
  }

  const cleanUrl = sanitizeTrackUrl(
    item.webpage_url || item.url || (item.id ? `https://www.youtube.com/watch?v=${item.id}` : cleanQuery)
  );

  const trackInfo = {
    title: item.title,
    url: cleanUrl,
    duration: durationStr,
    requesterId: member.id
  };

  if (!queue.isPlaying && !queue.currentTrack) {
    await queue.playStream(trackInfo);
    return { status: 'playing', track: trackInfo };
  } else {
    queue.tracks.push(trackInfo);
    return { status: 'queued', track: trackInfo, position: queue.tracks.length };
  }
}

/**
 * Adjusts volume (1-100).
 */
export function setMusicVolume(guildId, level) {
  const queue = guildQueues.get(guildId);
  if (!queue) throw new Error('No active music session in this server.');
  return queue.setVolume(level);
}

/**
 * Pauses music playback.
 */
export function pauseMusic(guildId) {
  const queue = guildQueues.get(guildId);
  if (!queue) throw new Error('No active music session in this server.');
  return queue.pause();
}

/**
 * Resumes music playback.
 */
export function resumeMusic(guildId) {
  const queue = guildQueues.get(guildId);
  if (!queue) throw new Error('No active music session in this server.');
  return queue.resume();
}

/**
 * Replays current track from start.
 */
export async function replayMusic(guildId) {
  const queue = guildQueues.get(guildId);
  if (!queue) throw new Error('No active music session in this server.');
  return await queue.replay();
}

/**
 * Toggles repeat/loop mode for current track.
 */
export function toggleMusicLoop(guildId) {
  const queue = guildQueues.get(guildId);
  if (!queue) throw new Error('No active music session in this server.');
  return queue.toggleLoop();
}

/**
 * Stops playback, clears queue, and leaves voice channel.
 */
export function leaveVoice(guildId) {
  const queue = guildQueues.get(guildId);
  if (!queue) throw new Error('Bot is not currently in a voice channel.');
  queue.destroy();
  return true;
}

/**
 * Retrieves the current guild music queue state.
 */
export function getMusicQueue(guildId) {
  return guildQueues.get(guildId) || null;
}

