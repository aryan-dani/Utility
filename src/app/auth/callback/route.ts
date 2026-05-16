import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';

function getSafeRedirectPath(next: string | null) {
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return '/';
  }

  return next;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const redirectCookie = request.headers
    .get('cookie')
    ?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith('utility_oauth_redirect='))
    ?.split('=')[1];
  const next = getSafeRedirectPath(
    redirectCookie ? decodeURIComponent(redirectCookie) : null,
  );

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const response = NextResponse.redirect(new URL(next, requestUrl.origin));
      response.cookies.delete('utility_oauth_redirect');
      return response;
    }
  }

  const response = NextResponse.redirect(new URL('/login', requestUrl.origin));
  response.cookies.delete('utility_oauth_redirect');
  return response;
}
