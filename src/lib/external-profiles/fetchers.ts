import {
  GitHubCommitItem,
  GitHubStats,
  GitHubContributionCalendar,
  LeetCodeStats,
  CodeforcesStats,
  CodeChefStats,
} from '@/types/codingProfiles';

const FETCH_TIMEOUT_MS = 6000;

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'CODAK-Academic-Platform',
        Accept: 'application/json',
        ...(options.headers || {}),
      },
      next: { revalidate: 180 }, // 3 min cache
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 1. Fetch REAL GitHub user profile, contribution graph calendar, and public commits
 * Zero synthetic / fake demo data.
 */
export async function fetchGitHubData(
  username: string
): Promise<{ stats: GitHubStats; commits: GitHubCommitItem[]; calendar: GitHubContributionCalendar } | null> {
  const cleanUsername = username.trim().replace(/^@/, '');
  if (!cleanUsername) return null;

  try {
    // A. Fetch official user profile
    const userRes = await fetchWithTimeout(`https://api.github.com/users/${cleanUsername}`);
    if (!userRes.ok) {
      if (userRes.status === 404) return null; // user does not exist
    }
    const userData = userRes.ok ? await userRes.json() : null;

    // B. Fetch real Contribution Heatmap Calendar
    let calendar: GitHubContributionCalendar = {
      totalContributions: 0,
      days: [],
    };

    try {
      const calRes = await fetchWithTimeout(
        `https://github-contributions-api.jogruber.de/v4/${cleanUsername}?y=last`
      );
      if (calRes.ok) {
        const calJson = await calRes.json();
        const total =
          typeof calJson.total?.lastYear === 'number'
            ? calJson.total.lastYear
            : typeof calJson.total === 'number'
            ? calJson.total
            : 0;

        calendar = {
          totalContributions: total,
          days: Array.isArray(calJson.contributions) ? calJson.contributions : [],
        };
      }
    } catch (e) {
      console.warn(`[GitHub Calendar] Could not fetch calendar for ${cleanUsername}:`, e);
    }

    // C. Fetch real commits from both Events and User's recently pushed repositories
    const commitsMap = new Map<string, GitHubCommitItem>();

    // C1. Check events
    try {
      const eventsRes = await fetchWithTimeout(
        `https://api.github.com/users/${cleanUsername}/events?per_page=30`
      );
      if (eventsRes.ok) {
        const events = await eventsRes.json();
        if (Array.isArray(events)) {
          for (const ev of events) {
            if (ev.type === 'PushEvent' && ev.payload?.commits && Array.isArray(ev.payload.commits)) {
              const repoName = ev.repo?.name || 'repository';
              const repoUrl = `https://github.com/${repoName}`;
              for (const c of ev.payload.commits) {
                const sha = c.sha;
                if (sha && !commitsMap.has(sha)) {
                  commitsMap.set(sha, {
                    id: sha,
                    shortSha: sha.slice(0, 7),
                    message: c.message ? c.message.split('\n')[0] : 'Update code',
                    repoName,
                    repoUrl,
                    commitUrl: `${repoUrl}/commit/${sha}`,
                    committedAt: ev.created_at || new Date().toISOString(),
                    authorName: c.author?.name || cleanUsername,
                  });
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn(`[GitHub Events] Error fetching events for ${cleanUsername}:`, e);
    }

    // C2. Check top recently pushed repositories directly for author's real commits
    try {
      const reposRes = await fetchWithTimeout(
        `https://api.github.com/users/${cleanUsername}/repos?sort=pushed&per_page=4`
      );
      if (reposRes.ok) {
        const repos = await reposRes.json();
        if (Array.isArray(repos)) {
          for (const repo of repos.slice(0, 3)) {
            if (!repo.full_name) continue;
            try {
              const repoCommitsRes = await fetchWithTimeout(
                `https://api.github.com/repos/${repo.full_name}/commits?author=${cleanUsername}&per_page=10`
              );
              if (repoCommitsRes.ok) {
                const repoCommits = await repoCommitsRes.json();
                if (Array.isArray(repoCommits)) {
                  for (const rc of repoCommits) {
                    const sha = rc.sha;
                    if (sha && !commitsMap.has(sha)) {
                      commitsMap.set(sha, {
                        id: sha,
                        shortSha: sha.slice(0, 7),
                        message: rc.commit?.message ? rc.commit.message.split('\n')[0] : 'Commit',
                        repoName: repo.full_name,
                        repoUrl: repo.html_url || `https://github.com/${repo.full_name}`,
                        commitUrl: rc.html_url || `https://github.com/${repo.full_name}/commit/${sha}`,
                        committedAt: rc.commit?.author?.date || rc.commit?.committer?.date || new Date().toISOString(),
                        authorName: rc.commit?.author?.name || cleanUsername,
                      });
                    }
                  }
                }
              }
            } catch {
              // Ignore single repo failure
            }
          }
        }
      }
    } catch (e) {
      console.warn(`[GitHub Repos] Error fetching repos for ${cleanUsername}:`, e);
    }

    const commits = Array.from(commitsMap.values()).sort(
      (a, b) => new Date(b.committedAt).getTime() - new Date(a.committedAt).getTime()
    );

    const stats: GitHubStats = {
      username: cleanUsername,
      name: userData?.name || cleanUsername,
      avatarUrl: userData?.avatar_url || `https://avatars.githubusercontent.com/${cleanUsername}`,
      publicRepos: typeof userData?.public_repos === 'number' ? userData.public_repos : 0,
      followers: typeof userData?.followers === 'number' ? userData.followers : 0,
      following: typeof userData?.following === 'number' ? userData.following : 0,
      bio: userData?.bio || undefined,
      profileUrl: `https://github.com/${cleanUsername}`,
      recentCommitsCount: commits.length,
      totalContributions: calendar.totalContributions,
    };

    return { stats, commits, calendar };
  } catch (error) {
    console.warn(`[GitHub Fetcher] Error fetching for ${cleanUsername}:`, error);
    return null;
  }
}

/**
 * 2. Fetch REAL Codeforces stats using official public API
 * Zero synthetic / fake demo data.
 */
export async function fetchCodeforcesData(handle: string): Promise<CodeforcesStats | null> {
  const cleanHandle = handle.trim();
  if (!cleanHandle) return null;

  try {
    const res = await fetchWithTimeout(
      `https://codeforces.com/api/user.info?handles=${encodeURIComponent(cleanHandle)}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'OK' && Array.isArray(data.result) && data.result.length > 0) {
        const u = data.result[0];
        return {
          handle: u.handle,
          rating: u.rating ?? 0,
          maxRating: u.maxRating ?? 0,
          rank: u.rank || 'unranked',
          maxRank: u.maxRank || 'unranked',
          contribution: u.contribution ?? 0,
          avatar: u.avatar || u.titlePhoto,
          profileUrl: `https://codeforces.com/profile/${u.handle}`,
        };
      }
    }
  } catch (error) {
    console.warn(`[Codeforces Fetcher] Error fetching ${cleanHandle}:`, error);
  }

  return null;
}

/**
 * 3. Fetch REAL LeetCode stats
 * Zero synthetic / fake demo data.
 */
export async function fetchLeetCodeData(username: string): Promise<LeetCodeStats | null> {
  const cleanUsername = username.trim();
  if (!cleanUsername) return null;

  // Try LeetCode public proxy
  try {
    const proxyRes = await fetchWithTimeout(
      `https://leetcode-stats-api.herokuapp.com/${encodeURIComponent(cleanUsername)}`
    );
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data.status === 'success') {
        return {
          username: cleanUsername,
          ranking: data.ranking || undefined,
          totalSolved: data.totalSolved || 0,
          easySolved: data.easySolved || 0,
          mediumSolved: data.mediumSolved || 0,
          hardSolved: data.hardSolved || 0,
          reputation: data.reputation || 0,
          profileUrl: `https://leetcode.com/u/${cleanUsername}`,
        };
      }
    }
  } catch {
    // Continue to GraphQL
  }

  // Direct GraphQL query
  try {
    const gqlRes = await fetchWithTimeout('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query getUserProfile($username: String!) {
            matchedUser(username: $username) {
              username
              profile { ranking reputation }
              submitStatsGlobal {
                acSubmissionNum { difficulty count }
              }
            }
          }
        `,
        variables: { username: cleanUsername },
      }),
    });

    if (gqlRes.ok) {
      const json = await gqlRes.json();
      const user = json?.data?.matchedUser;
      if (user) {
        const counts = user.submitStatsGlobal?.acSubmissionNum || [];
        const all = counts.find((c: any) => c.difficulty === 'All')?.count || 0;
        const easy = counts.find((c: any) => c.difficulty === 'Easy')?.count || 0;
        const med = counts.find((c: any) => c.difficulty === 'Medium')?.count || 0;
        const hard = counts.find((c: any) => c.difficulty === 'Hard')?.count || 0;

        return {
          username: cleanUsername,
          ranking: user.profile?.ranking || undefined,
          totalSolved: all,
          easySolved: easy,
          mediumSolved: med,
          hardSolved: hard,
          reputation: user.profile?.reputation || 0,
          profileUrl: `https://leetcode.com/u/${cleanUsername}`,
        };
      }
    }
  } catch (error) {
    console.warn(`[LeetCode Fetcher] Error fetching ${cleanUsername}:`, error);
  }

  return null;
}

/**
 * 4. Fetch REAL CodeChef stats
 * Zero synthetic / fake demo data.
 */
export async function fetchCodeChefData(handle: string): Promise<CodeChefStats | null> {
  const cleanHandle = handle.trim();
  if (!cleanHandle) return null;

  try {
    const res = await fetchWithTimeout(
      `https://codechef-api.vercel.app/handle/${encodeURIComponent(cleanHandle)}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.success !== false && data.currentRating) {
        const r = Number(data.currentRating) || 0;
        return {
          handle: cleanHandle,
          rating: r,
          highestRating: Number(data.highestRating) || r,
          stars: data.stars || '1★',
          globalRank: data.globalRank || undefined,
          countryRank: data.countryRank || undefined,
          division: r >= 2000 ? 'Div 1' : r >= 1600 ? 'Div 2' : 'Div 3',
          profileUrl: `https://www.codechef.com/users/${cleanHandle}`,
        };
      }
    }
  } catch (error) {
    console.warn(`[CodeChef Fetcher] Error fetching ${cleanHandle}:`, error);
  }

  return null;
}
