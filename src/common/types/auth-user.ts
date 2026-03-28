export interface AuthUser {
  userId: string | null;
  firebaseUid: string;
  email?: string;
  name?: string;
  picture?: string;
  emailVerified?: boolean;
  subscriptionStatus: string | null;
}
