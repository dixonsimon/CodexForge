import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/utils/supabase/auth';

// 1. GET: Retrieve all active locks for a project
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;

  try {
    const now = new Date();

    // First, purge expired locks for this project to keep DB clean
    await prisma.fileLock.deleteMany({
      where: {
        projectId,
        expiresAt: { lt: now }
      }
    });

    // Fetch all currently active locks
    const locks = await prisma.fileLock.findMany({
      where: {
        projectId,
        expiresAt: { gte: now }
      }
    });

    return NextResponse.json(locks);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Database error.' }, { status: 500 });
  }
}

// 2. POST: Acquire or renew a lock on a file
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;

  try {
    const { filePath } = await req.json();
    if (!filePath) {
      return NextResponse.json({ error: 'filePath parameter is required.' }, { status: 400 });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 1000); // Expires in 30 seconds

    // Check if there is an active lock on this file
    const existingLock = await prisma.fileLock.findUnique({
      where: {
        projectId_filePath: {
          projectId,
          filePath
        }
      }
    });

    if (existingLock) {
      // If it is active (not expired) AND held by a different user, reject
      if (existingLock.expiresAt > now && existingLock.userId !== user.id) {
        return NextResponse.json(
          {
            error: 'File is locked by another user.',
            lock: existingLock
          },
          { status: 409 }
        );
      }

      // If it is held by the same user, or is expired, we can overwrite/renew it
      const updatedLock = await prisma.fileLock.update({
        where: {
          id: existingLock.id
        },
        data: {
          userId: user.id,
          userName: user.user_metadata?.full_name || user.email || 'Developer',
          expiresAt
        }
      });

      return NextResponse.json(updatedLock);
    }

    // Otherwise, create a fresh lock
    const newLock = await prisma.fileLock.create({
      data: {
        projectId,
        filePath,
        userId: user.id,
        userName: user.user_metadata?.full_name || user.email || 'Developer',
        expiresAt
      }
    });

    return NextResponse.json(newLock);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Database error.' }, { status: 500 });
  }
}

// 3. DELETE: Release a lock on a file
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;

  try {
    const { filePath } = await req.json();
    if (!filePath) {
      return NextResponse.json({ error: 'filePath parameter is required.' }, { status: 400 });
    }

    // Find the lock first
    const lock = await prisma.fileLock.findUnique({
      where: {
        projectId_filePath: {
          projectId,
          filePath
        }
      }
    });

    if (!lock) {
      return NextResponse.json({ message: 'No lock found to release.' });
    }

    // Reject if trying to delete another user's active lock
    const now = new Date();
    if (lock.expiresAt > now && lock.userId !== user.id) {
      return NextResponse.json({ error: 'Cannot release a lock held by another user.' }, { status: 403 });
    }

    // Otherwise delete it
    await prisma.fileLock.delete({
      where: {
        id: lock.id
      }
    });

    return NextResponse.json({ message: 'Lock released successfully.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Database error.' }, { status: 500 });
  }
}
