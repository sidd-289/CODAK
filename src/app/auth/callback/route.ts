import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchGitHubData, cleanHandle } from '@/lib/external-profiles/fetchers';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Automatically sync and verify GitHub profile if linked via OAuth
      if (user) {
        const ghIdentity = user.identities?.find((id) => id.provider === 'github');
        const rawGhUsername =
          (ghIdentity?.identity_data?.user_name as string) ||
          (user.user_metadata?.user_name as string) ||
          (user.user_metadata?.preferred_username as string);

        const ghUsername = cleanHandle(rawGhUsername);

        if (ghUsername) {
          try {
            const admin = createAdminClient();
            const ghData = await fetchGitHubData(ghUsername);

            // Fetch existing coding profile to preserve other platform handles
            const { data: existing } = await admin
              .from('student_coding_profiles')
              .select('*')
              .eq('student_id', user.id)
              .maybeSingle();

            await admin.from('student_coding_profiles').upsert(
              {
                student_id: user.id,
                github_username: ghUsername,
                github_stats: ghData?.stats || existing?.github_stats || {},
                recent_github_commits: ghData?.commits || existing?.recent_github_commits || [],
                github_calendar: ghData?.calendar || existing?.github_calendar || {},
                github_verified: true,
                verified_at: new Date().toISOString(),
                last_synced_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'student_id' }
            );
          } catch (e) {
            console.error('Error linking verified GitHub in callback:', e);
          }
        }
      }

      // Determine destination: respect explicit non-root next, or resolve by profile role
      let destination = next;
      if (destination === '/' || !destination) {
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, campus_id')
            .eq('id', user.id)
            .maybeSingle();

          const role = profile?.role || 'student';
          if (role === 'faculty') {
            destination = '/faculty';
          } else if (role === 'admin') {
            destination = '/admin';
          } else {
            destination = profile?.campus_id ? '/student' : '/select-campus';
          }
        } else {
          destination = '/student';
        }
      }

      const forwardedHost = request.headers.get('x-forwarded-host');
      const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
      const isLocalEnv = process.env.NODE_ENV === 'development';
      const origin = isLocalEnv
        ? requestUrl.origin
        : forwardedHost
        ? `${forwardedProto}://${forwardedHost}`
        : requestUrl.origin;

      return NextResponse.redirect(`${origin}${destination}`);
    }
    console.error('OAuth code exchange error:', error);
  }

  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const isLocalEnv = process.env.NODE_ENV === 'development';
  const origin = isLocalEnv
    ? requestUrl.origin
    : forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : requestUrl.origin;

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
}
