import { NextRequest, NextResponse } from 'next/server';

// This endpoint is called by Vercel Cron to trigger the ingest
// It's a simple wrapper that calls the actual ingest endpoint

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');

  // Verify the cron secret
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Construct URL to the ingest endpoint
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const ingestUrl = `${baseUrl}/api/ingest`;

    // Call the ingest endpoint
    const response = await fetch(ingestUrl, {
      method: 'POST',
      headers: {
        'x-cron-secret': process.env.INGEST_CRON_SECRET || '',
      },
    });

    const result = await response.json();

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      result,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}