import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState
} from '@discordjs/voice';
import play from 'play-dl';

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
    this.volume = 1.0; // 0.0 to 2.0 (1.0 = 100%)
    this.isLooping = false;
    this.isPlaying = false;

    this.setupPlayerListeners();
  }

  setupPlayerListeners() {
    this.player.on(AudioPlayerStatus.Idle, () => {
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
      if (this.textChannel) {
        this.textChannel.send(`⚠️ Audio playback error: ${err.message}`).catch(() => null);
      }
      this.playNext();
    });
  }

  async playStream(track) {
    this.currentTrack = track;
    let stream;
    try {
      stream = await play.stream(track.url);
    } catch (err) {
      console.error(`Failed to create stream for ${track.url}:`, err);
      throw err;
    }

    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
      inlineVolume: true
    });

    resource.volume?.setVolume(this.volume);
    this.currentResource = resource;
    this.player.play(resource);
    this.isPlaying = true;
  }

  async playNext() {
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

  let trackInfo = null;
  const isUrl = /^https?:\/\//i.test(query.trim());

  if (isUrl) {
    const videoData = await play.video_basic_info(query.trim()).catch(() => null);
    if (videoData && videoData.video_details) {
      trackInfo = {
        title: videoData.video_details.title || 'YouTube Track',
        url: videoData.video_details.url || query.trim(),
        duration: videoData.video_details.durationRaw || 'Unknown',
        requesterId: member.id
      };
    } else {
      trackInfo = {
        title: query.trim(),
        url: query.trim(),
        duration: 'Unknown',
        requesterId: member.id
      };
    }
  } else {
    const searchResults = await play.search(query.trim(), { limit: 1 }).catch(() => []);
    if (!searchResults || searchResults.length === 0) {
      throw new Error(`No tracks found for: "${query}"`);
    }
    const best = searchResults[0];
    trackInfo = {
      title: best.title || query.trim(),
      url: best.url,
      duration: best.durationRaw || 'Unknown',
      requesterId: member.id
    };
  }

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
 * Pauses current music playback.
 */
export function pauseMusic(guildId) {
  const queue = guildQueues.get(guildId);
  if (!queue || !queue.isPlaying) throw new Error('No music is currently playing.');
  return queue.pause();
}

/**
 * Resumes paused music playback.
 */
export function resumeMusic(guildId) {
  const queue = guildQueues.get(guildId);
  if (!queue) throw new Error('No music session in this server.');
  return queue.resume();
}

/**
 * Replays the current track.
 */
export async function replayMusic(guildId) {
  const queue = guildQueues.get(guildId);
  if (!queue || !queue.currentTrack) throw new Error('No track has been played yet.');
  return queue.replay();
}

/**
 * Toggles looping.
 */
export function toggleMusicLoop(guildId) {
  const queue = guildQueues.get(guildId);
  if (!queue) throw new Error('No active music session in this server.');
  return queue.toggleLoop();
}

/**
 * Stops music and disconnects from voice channel.
 */
export function leaveVoice(guildId) {
  const queue = guildQueues.get(guildId);
  if (!queue) return false;
  queue.destroy();
  return true;
}

/**
 * Retrieves the current queue info.
 */
export function getMusicQueue(guildId) {
  return guildQueues.get(guildId) || null;
}
