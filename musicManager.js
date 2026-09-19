import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  demuxProbe
} from '@discordjs/voice';
import fs from 'fs';
import path from 'path';
import youtubedl from 'youtube-dl-exec';
import ffmpegPath from 'ffmpeg-static';

const isWin = process.platform === 'win32';
const customYtdlPath = path.resolve(process.cwd(), 'bin', isWin ? 'yt-dlp.exe' : 'yt-dlp');
const ytdl = fs.existsSync(customYtdlPath) ? youtubedl.create(customYtdlPath) : youtubedl;

// Map storing active guild queues: guildId -> MusicQueue
const guildQueues = new Map();

class MusicQueue {
  constructor(guildId, voiceChannel, textChannel) {
    this.guildId = guildId;
    this.voiceChannel = voiceChannel;
    this.textChannel = textChannel;
    this.connection = null;
    this.player = createAudioPlayer();
    this.tracks = [];
    this.currentTrack = null;
    this.currentResource = null;
    this.currentProcess = null;
    this.volume = 1.0; // 0.0 to 2.0 (1.0 = 100%)
    this.isLooping = false;
    this.isPlaying = false;

    this.setupPlayerListeners();
  }

  setupPlayerListeners() {
    this.player.on(AudioPlayerStatus.Idle, () => {
      this.cleanupProcess();

      if (this.isLooping && this.currentTrack) {
        // Replay current track on loop
        this.playStream(this.currentTrack).catch(err => {
          console.error('Error looping track:', err);
          this.playNext();
        });
      } else {
        this.playNext();
      }
    });

    this.player.on('error', err => {
      console.error('Audio Player Error:', err.message);
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
        this.currentProcess.kill();
      } catch {}
      this.currentProcess = null;
    }
  }

  async playStream(track) {
    this.cleanupProcess();
    this.currentTrack = track;

    try {
      const cp = ytdl.exec(track.url, {
        output: '-',
        format: 'bestaudio/best',
        noWarnings: true,
        preferFreeFormats: true,
        ffmpegLocation: ffmpegPath
      });

      this.currentProcess = cp;

      cp.on('error', err => {
        console.warn('yt-dlp child process error:', err.message);
      });

      const probe = await demuxProbe(cp.stdout);

      const resource = createAudioResource(probe.stream, {
        inputType: probe.type,
        inlineVolume: true
      });

      if (resource.volume) {
        resource.volume.setVolume(this.volume);
      }

      this.currentResource = resource;
      this.player.play(resource);
      this.isPlaying = true;
    } catch (err) {
      console.error(`Failed to stream ${track.url}:`, err);
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
 * Connects the bot to the specified voice channel.
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

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: true
  });

  queue.connection = connection;
  connection.subscribe(queue.player);

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
  const target = isUrl ? cleanQuery : `ytsearch1:${cleanQuery}`;

  let meta;
  try {
    meta = await ytdl(target, {
      dumpSingleJson: true,
      noWarnings: true,
      defaultSearch: 'ytsearch',
      ffmpegLocation: ffmpegPath
    });
  } catch (err) {
    console.error('Metadata extraction error:', err);
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

  const trackInfo = {
    title: item.title,
    url: item.webpage_url || item.url || cleanQuery,
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
