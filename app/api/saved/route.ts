import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const USER_ID = 'default';

export async function POST(req: NextRequest) {
  try {
    const { articleId } = await req.json();
    if (!articleId) return NextResponse.json({ error: 'articleId required' }, { status: 400 });

    const existing = await prisma.articleSaved.findUnique({
      where: { userId_articleId: { userId: USER_ID, articleId } },
    });

    if (existing) {
      await prisma.articleSaved.delete({
        where: { userId_articleId: { userId: USER_ID, articleId } },
      });
      return NextResponse.json({ saved: false });
    }

    await prisma.articleSaved.create({
      data: { userId: USER_ID, articleId },
    });
    return NextResponse.json({ saved: true });
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const saved = await prisma.articleSaved.findMany({
      where: { userId: USER_ID },
      select: { articleId: true },
      orderBy: { savedAt: 'desc' },
    });
    return NextResponse.json({ savedIds: saved.map((s) => s.articleId) });
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
