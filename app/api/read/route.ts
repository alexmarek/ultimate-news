import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const USER_ID = 'default';

export async function POST(req: NextRequest) {
  try {
    const { articleId } = await req.json();
    if (!articleId) return NextResponse.json({ error: 'articleId required' }, { status: 400 });

    await prisma.articleRead.upsert({
      where: { userId_articleId: { userId: USER_ID, articleId } },
      create: { userId: USER_ID, articleId },
      update: {},
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
