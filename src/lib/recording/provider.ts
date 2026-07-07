// ─── Recording Provider Abstraction ──────────────────────────────────────────
// Interface that any recording provider (Recall.ai, Skribby, MeetingBaaS, etc.)
// must implement. Import getRecordingProvider() from ./recall to get the
// concrete implementation. Returns null if the provider is not configured.

export interface ScheduleBotArgs {
  meetingUrl: string;
  joinAt: Date;
  botName?: string;
}

export interface ScheduleBotResult {
  botId: string;
}

export interface RecordingProvider {
  /**
   * Schedule a recording bot to join a meeting.
   */
  scheduleBot(args: ScheduleBotArgs): Promise<ScheduleBotResult>;

  /**
   * Cancel a previously scheduled or active bot.
   */
  cancelBot(botId: string): Promise<void>;

  /**
   * Reschedule a bot (cancel + recreate).
   * Returns the new botId.
   */
  rescheduleBot(
    botId: string,
    args: ScheduleBotArgs,
  ): Promise<ScheduleBotResult>;

  /**
   * Given a bot payload object (from a webhook) or a bot id string,
   * return the video download URL from the provider, or null if not ready.
   */
  getVideoUrl(botPayloadOrId: unknown): Promise<string | null>;
}
