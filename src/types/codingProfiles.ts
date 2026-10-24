export interface GitHubCommitItem {
  id: string; // sha
  shortSha: string;
  message: string;
  repoName: string;
  repoUrl: string;
  commitUrl: string;
  committedAt: string;
  authorName: string;
}

export interface GitHubStats {
  username: string;
  name?: string;
  avatarUrl?: string;
  publicRepos: number;
  followers: number;
  following: number;
  bio?: string;
  profileUrl: string;
  recentCommitsCount: number;
}

export interface LeetCodeStats {
  username: string;
  ranking?: number;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  reputation?: number;
  profileUrl: string;
}

export interface CodeforcesStats {
  handle: string;
  rating: number;
  maxRating: number;
  rank: string; // e.g. "specialist", "candidate master"
  maxRank: string;
  contribution: number;
  avatar?: string;
  profileUrl: string;
}

export interface CodeChefStats {
  handle: string;
  rating: number;
  highestRating: number;
  stars: string; // e.g. "3★"
  globalRank?: number | string;
  countryRank?: number | string;
  division?: string;
  profileUrl: string;
}

export interface StudentCodingProfilesData {
  studentId: string;
  leetcodeHandle: string | null;
  githubUsername: string | null;
  codeforcesHandle: string | null;
  codechefHandle: string | null;
  githubStats: GitHubStats | null;
  leetcodeStats: LeetCodeStats | null;
  codeforcesStats: CodeforcesStats | null;
  codechefStats: CodeChefStats | null;
  recentGithubCommits: GitHubCommitItem[];
  lastSyncedAt: string | null;
}
