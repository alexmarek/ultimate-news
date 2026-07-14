import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

const ONE_WEEK = 60 * 60 * 24 * 7;
const MAX_WIDTH = 800;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'UltimateNews/1.0' },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const buffer = await response.arrayBuffer();

    if (buffer.byteLength === 0) {
      return NextResponse.json({ error: 'Empty image' }, { status: 404 });
    }

    const webpBuffer = await sharp(Buffer.from(buffer))
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    return new NextResponse(new Uint8Array(webpBuffer), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': `public, max-age=${ONE_WEEK}, immutable`,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
  }
}
