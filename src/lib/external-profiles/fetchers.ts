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
        'User-Agent': 'Mozilla/5.0 (compatible; CODAK-Academic/1.0)',
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
 * Strips URLs, domain prefixes, path segments, and @ symbols from user inputs.
 * e.g. "https://github.com/sidd-289/" -> "sidd-289"
 * e.g. "https://leetcode.com/u/neal_wu" -> "neal_wu"
 * e.g. "codeforces.com/profile/tourist" -> "tourist"
 * e.g. "https://codechef.com/users/gennady" -> "gennady"
 */
export function cleanHandle(input?: string | null): string | null {
  if (!input) return null;
  let val = input.trim().replace(/^@/, '');
  try {
    if (val.startsWith('http://') || val.startsWith('https://')) {
      const url = new URL(val);
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length > 0) {
        return segments[segments.length - 1];
      }
    }
  } catch {
    // fallback to regex parsing
  }
  val = val.replace(/^https?:\/\//i, '');
  val = val.replace(/^www\./i, '');
  val = val.replace(/^github\.com\//i, '');
  val = val.replace(/^leetcode\.com\/(u\/)?/i, '');
  val = val.replace(/^codeforces\.com\/(profile\/)?/i, '');
  val = val.replace(/^codechef\.com\/(users\/)?/i, '');
  const segments = val.split('/').filter(Boolean);
  if (segments.length > 0) {
    val = segments[segments.length - 1];
  }
  val = val.split('?')[0].split('#')[0].trim();
  return val || null;
}

/**
 * 1. Fetch REAL GitHub user profile, contribution graph calendar, and public commits
 * Zero synthetic / fake demo data.
 */
export async function fetchGitHubData(
  username: string
): Promise<{ stats: GitHubStats; commits: GitHubCommitItem[]; calendar: GitHubContributionCalendar } | null> {
  const cleanUsername = cleanHandle(username);
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

    // B1. Primary: jogruber API
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

        if (Array.isArray(calJson.contributions) && calJson.contributions.length > 0) {
          calendar = {
            totalContributions: total,
            days: calJson.contributions,
          };
        }
      }
    } catch (e) {
      console.warn(`[GitHub Calendar API] Failed for ${cleanUsername}:`, e);
    }

    // B2. Fallback: Direct GitHub HTML parsing if primary returned 0 days
    if (calendar.days.length === 0) {
      try {
        const directRes = await fetchWithTimeout(
          `https://github.com/users/${cleanUsername}/contributions`,
          { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CODAK/1.0)' } }
        );
        if (directRes.ok) {
          const html = await directRes.text();
          const matchTotal = html.match(/([\d,]+)\s+contributions\s+in the last year/i);
          const total = matchTotal ? parseInt(matchTotal[1].replace(/,/g, ''), 10) : 0;
          const days: { date: string; level: 0 | 1 | 2 | 3 | 4; count: number }[] = [];
          const dayRegex = /data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-level="(\d)"/g;
          let match;
          while ((match = dayRegex.exec(html)) !== null) {
            const lvl = parseInt(match[2], 10) as 0 | 1 | 2 | 3 | 4;
            days.push({
              date: match[1],
              level: lvl,
              count: lvl > 0 ? 1 : 0,
            });
          }
          if (days.length > 0) {
            calendar = {
              totalContributions: total,
              days,
            };
          }
        }
      } catch (directErr) {
        console.warn(`[GitHub Calendar] Direct fallback failed for ${cleanUsername}:`, directErr);
      }
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
          for (const repo of repos) {
            if (!repo.full_name) continue;
            try {
              const repoCommitsRes = await fetchWithTimeout(
                `https://api.github.com/repos/${repo.full_name}/commits?author=${cleanUsername}&per_page=5`
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
  const clean = cleanHandle(handle);
  if (!clean) return null;

  try {
    const res = await fetchWithTimeout(
      `https://codeforces.com/api/user.info?handles=${encodeURIComponent(clean)}`
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
    console.warn(`[Codeforces Fetcher] Error fetching ${clean}:`, error);
  }

  return null;
}

/**
 * 3. Fetch REAL LeetCode stats
 * Zero synthetic / fake demo data.
 */
export async function fetchLeetCodeData(username: string): Promise<LeetCodeStats | null> {
  const clean = cleanHandle(username);
  if (!clean) return null;

  // Try LeetCode public proxy
  try {
    const proxyRes = await fetchWithTimeout(
      `https://leetcode-stats-api.herokuapp.com/${encodeURIComponent(clean)}`
    );
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data.status === 'success') {
        return {
          username: clean,
          ranking: data.ranking || undefined,
          totalSolved: data.totalSolved || 0,
          easySolved: data.easySolved || 0,
          mediumSolved: data.mediumSolved || 0,
          hardSolved: data.hardSolved || 0,
          reputation: data.reputation || 0,
          profileUrl: `https://leetcode.com/u/${clean}`,
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
              profile { ranking reputation aboutMe }
              submitStatsGlobal {
                acSubmissionNum { difficulty count }
              }
            }
          }
        `,
        variables: { username: clean },
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
          username: clean,
          ranking: user.profile?.ranking || undefined,
          totalSolved: all,
          easySolved: easy,
          mediumSolved: med,
          hardSolved: hard,
          reputation: user.profile?.reputation || 0,
          profileUrl: `https://leetcode.com/u/${clean}`,
        };
      }
    }
  } catch (error) {
    console.warn(`[LeetCode Fetcher] Error fetching ${clean}:`, error);
  }

  return null;
}

/**
 * 4. Fetch REAL CodeChef stats
 * Zero synthetic / fake demo data.
 */
export async function fetchCodeChefData(handle: string): Promise<CodeChefStats | null> {
  const clean = cleanHandle(handle);
  if (!clean) return null;

  try {
    const res = await fetchWithTimeout(
      `https://codechef-api.vercel.app/handle/${encodeURIComponent(clean)}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.success !== false && data.currentRating) {
        const r = Number(data.currentRating) || 0;
        return {
          handle: clean,
          rating: r,
          highestRating: Number(data.highestRating) || r,
          stars: data.stars || '1★',
          globalRank: data.globalRank || undefined,
          countryRank: data.countryRank || undefined,
          division: r >= 2000 ? 'Div 1' : r >= 1600 ? 'Div 2' : 'Div 3',
          profileUrl: `https://www.codechef.com/users/${clean}`,
        };
      }
    }
  } catch (error) {
    console.warn(`[CodeChef Fetcher] Error fetching ${clean}:`, error);
  }

  return null;
}

/**
 * 5. Verifies if an external account contains the student's unique challenge token in public bio/details
 */
export async function verifyPlatformBio(
  platform: 'github' | 'leetcode' | 'codeforces' | 'codechef',
  username: string,
  verificationToken: string
): Promise<{ verified: boolean; error?: string }> {
  const clean = cleanHandle(username);
  if (!clean) return { verified: false, error: 'Invalid username' };
  if (!verificationToken) return { verified: false, error: 'Missing verification token' };

  try {
    if (platform === 'github') {
      const userRes = await fetchWithTimeout(`https://api.github.com/users/${clean}`);
      if (userRes.ok) {
        const data = await userRes.json();
        const bio = `${data.bio || ''} ${data.company || ''} ${data.blog || ''}`;
        if (bio.toUpperCase().includes(verificationToken.toUpperCase())) {
          return { verified: true };
        }
      }
      // Also check if user has created a public gist with the token
      try {
        const gistRes = await fetchWithTimeout(`https://api.github.com/users/${clean}/gists?per_page=5`);
        if (gistRes.ok) {
          const gists = await gistRes.json();
          if (Array.isArray(gists)) {
            for (const g of gists) {
              if (
                (g.description || '').toUpperCase().includes(verificationToken.toUpperCase()) ||
                Object.keys(g.files || {}).some((k) => k.toUpperCase().includes(verificationToken.toUpperCase()))
              ) {
                return { verified: true };
              }
            }
          }
        }
      } catch {}
      return {
        verified: false,
        error: `Could not find verification code "${verificationToken}" in GitHub bio or public gists for @${clean}.`,
      };
    }

    if (platform === 'leetcode') {
      const gqlRes = await fetchWithTimeout('https://leetcode.com/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query getUserProfile($username: String!) {
              matchedUser(username: $username) {
                profile { aboutMe realName }
              }
            }
          `,
          variables: { username: clean },
        }),
      });
      if (gqlRes.ok) {
        const json = await gqlRes.json();
        const profile = json?.data?.matchedUser?.profile;
        const text = `${profile?.aboutMe || ''} ${profile?.realName || ''}`;
        if (text.toUpperCase().includes(verificationToken.toUpperCase())) {
          return { verified: true };
        }
      }
      return {
        verified: false,
        error: `Could not find verification code "${verificationToken}" in LeetCode About Me / Summary for @${clean}.`,
      };
    }

    if (platform === 'codeforces') {
      const cfRes = await fetchWithTimeout(`https://codeforces.com/api/user.info?handles=${clean}`);
      if (cfRes.ok) {
        const json = await cfRes.json();
        if (json.status === 'OK' && json.result?.length > 0) {
          const u = json.result[0];
          const text = [u.organization, u.city, u.country, u.firstName, u.lastName].filter(Boolean).join(' ');
          if (text.toUpperCase().includes(verificationToken.toUpperCase())) {
            return { verified: true };
          }
        }
      }
      return {
        verified: false,
        error: `Could not find verification code "${verificationToken}" in Codeforces profile (Organization, City, or Name) for @${clean}.`,
      };
    }

    if (platform === 'codechef') {
      const ccRes = await fetchWithTimeout(`https://www.codechef.com/users/${clean}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (ccRes.ok) {
        const html = await ccRes.text();
        if (html.toUpperCase().includes(verificationToken.toUpperCase())) {
          return { verified: true };
        }
      }
      return {
        verified: false,
        error: `Could not find verification code "${verificationToken}" on CodeChef profile for @${clean}.`,
      };
    }

    return { verified: false, error: 'Unsupported platform' };
  } catch (err: any) {
    return { verified: false, error: err.message || 'Verification check failed' };
  }
}
