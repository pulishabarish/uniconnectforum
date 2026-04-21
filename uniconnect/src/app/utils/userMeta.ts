import { Category, NotificationPreferences, User } from '../types';

export const defaultNotificationPreferences = (): NotificationPreferences => ({
  approvals: true,
  replies: true,
  classActivity: true,
  moderation: true,
  digestFrequency: 'daily',
  emailStyleSummary: true,
});

export const mergeUserWithStoredMeta = (user: User): User => {
  return {
    ...user,
    bio: user.bio || '',
    department: user.department || '',
    verifiedRole: user.verifiedRole !== false,
    verifiedDepartment: Boolean(user.verifiedDepartment || user.department),
    officeAddress: user.officeAddress || '',
    officeHours: user.officeHours || '',
    interests: Array.isArray(user.interests) ? user.interests : [],
    academicInterests: Array.isArray(user.academicInterests) ? user.academicInterests : [],
    notificationPreferences: {
      ...defaultNotificationPreferences(),
      ...(user.notificationPreferences || {}),
    },
  };
};

export const parseCategoryList = (rawValue: string): Category[] => {
  return rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value): value is Category => value.includes('-'));
};

export const parseTagList = (rawValue: string): string[] => {
  return rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
};
