import { Router, Request, Response } from 'express';
import { protect, extractUserInfo } from '../middleware/keycloak.js';
import { prisma } from '../config/database.js';

const router = Router();

// All routes require authentication
router.use(protect, extractUserInfo);

// Get notifications for current user
router.get('/', async (req: Request, res: Response) => {
  try {
    const keycloakId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 20;
    const unreadOnly = req.query.unreadOnly === 'true';

    const user = await prisma.user.findFirst({
      where: { keycloakId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const whereClause: any = {
      userId: user.id,
    };

    if (unreadOnly) {
      whereClause.isRead = false;
    }

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId: user.id,
        isRead: false,
      },
    });

    res.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.put('/:id/read', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const keycloakId = req.user?.id;

    const user = await prisma.user.findFirst({
      where: { keycloakId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify notification belongs to user
    const notification = await prisma.notification.findFirst({
      where: { id, userId: user.id },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await prisma.notification.update({
      where: { id },
      data: { 
        isRead: true,
        readAt: new Date(),
      },
    });

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.put('/read-all', async (req: Request, res: Response) => {
  try {
    const keycloakId = req.user?.id;

    const user = await prisma.user.findFirst({
      where: { keycloakId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await prisma.notification.updateMany({
      where: { 
        userId: user.id,
        isRead: false,
      },
      data: { 
        isRead: true,
        readAt: new Date(),
      },
    });

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Delete notification
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const keycloakId = req.user?.id;

    const user = await prisma.user.findFirst({
      where: { keycloakId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify notification belongs to user
    const notification = await prisma.notification.findFirst({
      where: { id, userId: user.id },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await prisma.notification.delete({
      where: { id },
    });

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Create notification (for admin or system use)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { userId, title, message, type, entityType, entityId } = req.body;

    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type: type || 'INFO',
        entityType,
        entityId,
      },
    });

    res.status(201).json(notification);
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

export default router;
