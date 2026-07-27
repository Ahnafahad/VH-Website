export interface MiniEntry {
  rank:        number;
  userId:      number;
  displayName: string;
  points:      number;
  isMe:        boolean;
}

export interface MiniLeaderboardResponse {
  top:        MiniEntry[];       // top 5 by best single run
  lifetime:   MiniEntry[];       // top 5 by cumulative points
  myTop:      MiniEntry | null;  // my row, only when outside `top`
  myLifetime: MiniEntry | null;  // my row, only when outside `lifetime`
}
