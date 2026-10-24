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

export interface GitHubContributionDay {
  date: string; // "YYYY-MM-DD"
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface GitHubContributionCalendar {
  totalContributions: number;
  days: GitHubContributionDay[];
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
  totalContributions?: number;
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
  rank: string;
  maxRank: string;
  contribution: number;
  avatar?: string;
  profileUrl: string;
}

export interface CodeChefStats {
  handle: string;
  rating: number;
  highestRating: number;
  stars: string;
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
  githubCalendar?: GitHubContributionCalendar | null;
  lastSyncedAt: string | null;
  verificationToken?: string | null;
  githubVerified?: boolean;
  leetcodeVerified?: boolean;
  codeforcesVerified?: boolean;
  codechefVerified?: boolean;
  verifiedAt?: string | null;
}
