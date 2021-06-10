import { formatDuration } from "../Util";
import Song from "./Song";
import DisTube from "../DisTube";
import Discord from "discord.js";
import { Readable } from "stream";
import { DisTubeBase, DisTubeHandler } from "../core";
import SearchResult from "./SearchResult";
import { AudioPlayer, AudioResource, VoiceConnection } from "@discordjs/voice";

/**
 * Represents a queue.
 * @extends DisTubeBase
 */
export class Queue extends DisTubeBase {
  id: Discord.Snowflake;
  /**
   * Audio Player
   * @type {AudioPlayer?}
   */
  audioPlayer?: AudioPlayer;
  /**
   * Voice connection.
   * @type {VoiceConnection?}
   */
  connection?: VoiceConnection;
  /**
   * Stream volume. Default value: `50`.
   * @type {number}
   */
  volume: number;
  /**
   * List of songs in the queue (The first one is the playing song)
   * @type {Song[]}
   */
  songs: Song[];
  /**
   * List of the previous songs.
   * @type {Song[]}
   */
  previousSongs: Song[];
  /**
   * Whether stream is currently stopped.
   * @type {boolean}
   * @private
   */
  stopped: boolean;
  /**
   * Whether or not the last song was skipped to next song.
   * @type {boolean}
   * @private
   */
  next: boolean;
  /**
   * Whether or not the last song was skipped to previous song.
   * @type {boolean}
   * @private
   */
  prev: boolean;
  /**
   * Whether or not the stream is currently playing.
   * @type {boolean}
   */
  playing: boolean;
  /**
   * Whether or not the stream is currently paused.
   * @type {boolean}
   */
  paused: boolean;
  /**
   * Type of repeat mode (`0` is disabled, `1` is repeating a song, `2` is repeating all the queue).
   * Default value: `0` (disabled)
   * @type {number}
   */
  repeatMode: number;
  /**
   * Whether or not the autoplay mode is enabled.
   * Default value: `false`
   * @type {boolean}
   */
  autoplay: boolean;
  /**
   * Enabled audio filters.
   * Available filters: {@link Filters}
   * @type {string[]}
   */
  filters: string[];
  /**
   * What time in the song to begin (in seconds).
   * @type {number}
   */
  beginTime: number;
  /**
   * The text channel of the Queue. (Default: where the first command is called).
   * @type {Discord.TextChannel?}
   */
  textChannel: any;
  /**
   * @type {DisTubeHandler}
   * @private
   */
  handler: DisTubeHandler;
  /**
   * Timeout for checking empty channel
   * @type {NodeJS.Timeout?}
   * @private
   */
  emptyTimeout?: NodeJS.Timeout;
  /**
   * Audio Resource
   */
  audioResource?: AudioResource;
  /** Client's member of this queue's guild */
  private clientMember: Discord.GuildMember;
  /**
   * Create a queue
   * @param {DisTube} distube DisTube
   * @param {Discord.Message|Discord.VoiceChannel|Discord.StageChannel} message Message
   * @param {Song|Song[]} song First song(s)
   * @param {Discord.TextChannel?} textChannel Default text channel
   */
  constructor(distube: DisTube, message: Discord.Message | Discord.VoiceChannel | Discord.StageChannel, song: Song | Song[], textChannel: Discord.TextChannel | null = null) {
    super(distube);
    this.clientMember = (message.guild as Discord.Guild).me as Discord.GuildMember;
    /**
     * Queue id (Guild id)
     * @type {Discord.Snowflake}
     */
    this.id = (message.guild as Discord.Guild).id;
    /**
     * Audio Player.
     * @type {AudioPlayer?}
     */
    this.audioPlayer = undefined;
    /**
     * Voice connection.
     * @type {VoiceConnection?}
     */
    this.connection = undefined;
    /**
     * Stream volume. Default value: `50`.
     * @type {number}
     */
    this.volume = 50;
    /**
     * List of songs in the queue (The first one is the playing song)
     * @type {Array<Song>}
     */
    this.songs = Array.isArray(song) ? [...song] : [song];
    /**
     * List of the previous songs.
     * @type {Array<Song>}
     */
    this.previousSongs = [];
    /**
     * Whether stream is currently stopped.
     * @type {boolean}
     * @private
     */
    this.stopped = false;
    /**
     * Whether or not the last song was skipped to next song.
     * @type {boolean}
     * @private
     */
    this.next = false;
    /**
     * Whether or not the last song was skipped to previous song.
     * @type {boolean}
     * @private
     */
    this.prev = false;
    /**
     * Whether or not the stream is currently playing.
     * @type {boolean}
     */
    this.playing = true;
    /**
     * Whether or not the stream is currently paused.
     * @type {boolean}
     */
    this.paused = false;
    /**
     * Type of repeat mode (`0` is disabled, `1` is repeating a song, `2` is repeating all the queue).
     * Default value: `0` (disabled)
     * @type {number}
     */
    this.repeatMode = 0;
    /**
     * Whether or not the autoplay mode is enabled.
     * Default value: `false`
     * @type {boolean}
     */
    this.autoplay = false;
    /**
     * Enabled audio filters.
     * Available filters: {@link Filters}
     * @type {Array<string>}
     */
    this.filters = [];
    /**
     * What time in the song to begin (in seconds).
     * @type {number}
     */
    this.beginTime = 0;
    /**
     * The text channel of the Queue. (Default: where the first command is called).
     * @type {Discord.TextChannel?}
     */
    this.textChannel = (message as Discord.Message)?.channel as Discord.TextChannel || textChannel;
    /**
     * @type {DisTubeHandler}
     * @private
     */
    this.handler = this.distube.handler;
    /**
     * Timeout for checking empty channel
     * @type {*}
     * @private
     */
    this.emptyTimeout = undefined;
    /**
     * Audio resource
     * @type {AudioResource}
     */
    this.audioResource = undefined;
  }
  /**
   * Formatted duration string.
   * @type {string}
   */
  get formattedDuration() {
    return formatDuration(this.duration);
  }
  /**
   * Queue's duration.
   * @type {number}
   */
  get duration() {
    return this.songs.length ? this.songs.reduce((prev, next) => prev + next.duration, 0) : 0;
  }
  /**
   * What time in the song is playing (in seconds).
   * @type {number}
   */
  get currentTime() {
    return this.audioResource ? (this.audioResource.playbackDuration / 1e3) + this.beginTime : 0;
  }
  /**
   * Formatted {@link Queue#currentTime} string.
   * @type {string}
   */
  get formattedCurrentTime() {
    return formatDuration(this.currentTime);
  }
  /**
   * The voice channel playing in.
   * @type {Discord.VoiceChannel|Discord.StageChannel|null}
   */
  get voiceChannel() {
    return this.clientMember.voice.channel;
  }
  /**
   * Add a Song or an array of Song to the queue
   * @param {Song|Song[]} song Song to add
   * @param {number} [position=-1] Position to add, < 0 to add to the end of the queue
   * @throws {Error}
   * @returns {Queue} The guild queue
   */
  addToQueue(song: Song | SearchResult | (Song | SearchResult)[], position = -1): Queue {
    const isArray = Array.isArray(song);
    if (!song || (isArray && !(song as Song[]).length)) throw new Error("No Song provided.");
    if (position === 0) throw new SyntaxError("Cannot add Song before the playing Song.");
    if (position < 0) {
      if (isArray) this.songs.push(...song as Song[]);
      else this.songs.push(song as Song);
    } else if (isArray) this.songs.splice(position, 0, ...song as Song[]);
    else this.songs.splice(position, 0, song as Song);
    if (isArray) (song as Song[]).map(s => delete s.info);
    else delete (song as Song).info;
    return this;
  }
  /**
   * Pause the guild stream
   * @returns {Queue} The guild queue
   */
  pause(): Queue {
    if (this.paused) throw new Error("The queue has been paused already.");
    this.playing = false;
    this.paused = true;
    this.audioPlayer?.pause();
    return this;
  }
  /**
   * Resume the guild stream
   * @returns {Queue} The guild queue
   */
  resume(): Queue {
    if (this.playing) throw new Error("The queue has been playing already.");
    this.playing = true;
    this.paused = false;
    this.audioPlayer?.unpause();
    return this;
  }
  /**
   * Stop the guild stream
   */
  stop() {
    this.stopped = true;
    try { this.audioPlayer?.stop() } catch { }
    if (this.options.leaveOnStop) {
      try { this.connection?.destroy() } catch { }
      this.distube.connections.delete(this.id);
    }
    this.distube._deleteQueue(this);
  }
  /**
   * Set the guild stream's volume
   * @param {number} percent The percentage of volume you want to set
   * @returns {Queue} The guild queue
   */
  setVolume(percent: number): Queue {
    if (typeof percent !== "number") throw new Error("Volume percent must be a number.");
    this.volume = percent;
    this.audioResource?.volume?.setVolume(this.volume / 100);
    return this;
  }

  /**
   * Skip the playing song
   * @returns {Song} The song will skip to
   * @throws {Error}
   */
  skip(): Song {
    if (this.songs.length <= 1 && !this.autoplay) throw new Error("There is no song to skip.");
    const song = this.songs[1];
    this.next = true;
    this.audioPlayer?.stop();
    return song;
  }

  /**
   * Play the previous song
   * @returns {Song} The guild queue
   * @throws {Error}
   */
  previous(): Song {
    if (!this.options.savePreviousSongs) throw new Error("savePreviousSongs is disabled.");
    if (this.previousSongs?.length === 0 && this.repeatMode !== 2) throw new Error("There is no previous song.");
    const song = this.repeatMode === 2 ? this.songs[this.songs.length - 1] : this.previousSongs[this.previousSongs.length - 1];
    this.prev = true;
    this.audioPlayer?.stop();
    return song;
  }
  /**
   * Shuffle the queue's songs
   * @returns {Queue} The guild queue
   */
  shuffle(): Queue {
    if (!this.songs.length) return this;
    const playing = this.songs.shift() as Song;
    for (let i = this.songs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.songs[i], this.songs[j]] = [this.songs[j], this.songs[i]];
    }
    this.songs.unshift(playing);
    return this;
  }
  /**
   * Jump to the song number in the queue.
   * The next one is 1, 2,...
   * The previous one is -1, -2,...
   * @param {number} num The song number to play
   * @returns {Queue} The guild queue
   * @throws {Error} if `num` is invalid number
   */
  jump(num: number): Queue {
    if (typeof num !== "number") throw new TypeError("num must be a number.");
    if (num > this.songs.length || -num > this.previousSongs.length || num === 0) throw new RangeError("InvalidSong");
    if (num > 0) {
      this.songs = this.songs.splice(num - 1);
      this.next = true;
    } else if (!this.distube.options.savePreviousSongs) throw new RangeError("InvalidSong");
    else {
      this.prev = true;
      if (num !== -1) this.songs.unshift(...this.previousSongs.splice(num + 1));
    }
    this.audioPlayer?.stop();
    return this;
  }
  /**
   * Set the repeat mode of the guild queue.
   * Turn off if repeat mode is the same value as new mode.
   * Toggle mode: `mode = null` `(0 -> 1 -> 2 -> 0...)`
   * @param {number?} [mode] The repeat modes `(0: disabled, 1: Repeat a song, 2: Repeat all the queue)`
   * @returns {number} The new repeat mode
   */
  setRepeatMode(mode: number | null = null): number {
    if (mode !== null && typeof mode !== "number") throw new TypeError("mode must be a number or null.");
    if (!mode && mode !== 0) this.repeatMode = (this.repeatMode + 1) % 3;
    else if (this.repeatMode === mode) this.repeatMode = 0;
    else this.repeatMode = mode;
    return this.repeatMode;
  }
  /**
   * Enable or disable filter of the queue.
   * Available filters: {@link Filters}
   * @param {string|false} filter A filter name, `false` to clear all the filters
   * @returns {Array<string>} Enabled filters.
   * @throws {Error}
   */
  setFilter(filter: string | false): Array<string> {
    if (filter === false) this.filters = [];
    else if (!Object.prototype.hasOwnProperty.call(this.distube.filters, filter)) throw new TypeError(`${filter} is not a filter name.`);
    else if (this.filters.includes(filter)) this.filters.splice(this.filters.indexOf(filter), 1);
    else this.filters.push(filter);
    this.beginTime = this.currentTime;
    this.handler.playSong(this);
    return this.filters;
  }
  /**
   * Set the playing time to another position
   * @param {number} time Time in seconds
   * @returns {Queue} The guild queue
   */
  seek(time: number): Queue {
    this.beginTime = time;
    this.handler.playSong(this);
    return this;
  }
  /**
   * Add a related song of the playing song to the queue
   * @returns {Promise<Queue>} The guild queue
   * @throws {Error}
   */
  async addRelatedSong(): Promise<Queue> {
    if (!this.songs?.[0]) throw new Error("There is no playing song.");
    const related = this.songs[0].related.find(v => !this.previousSongs.map(s => s.id).includes(v.id));
    if (!related || !(related instanceof Song)) throw new Error("Cannot find any related songs.");
    this.addToQueue(await this.handler.resolveSong(this.clientMember, related.url) as Song);
    return this;
  }
  /**
   * Toggle autoplay mode
   * @returns {boolean} Autoplay mode state
   */
  toggleAutoplay(): boolean {
    this.autoplay = !this.autoplay;
    return this.autoplay;
  }
}

export default Queue;