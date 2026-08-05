import { Metadata } from 'next';
import AvatarRequestsClient from './AvatarRequestsClient';

export const metadata: Metadata = {
  title: 'Avatar Requests — VH Admin',
};

export default function AdminAvatarRequestsPage() {
  return <AvatarRequestsClient />;
}
