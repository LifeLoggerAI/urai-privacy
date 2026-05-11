
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase/firebase';
import { logAuditEvent } from './audit';

export const requestAccountDeletion = async () => {
  if (!auth.currentUser) throw new Error('User is not authenticated');

  const deletionRequest = {
    userId: auth.currentUser.uid,
    status: 'pending',
    createdAt: serverTimestamp(),
  };

  await addDoc(collection(db, 'deletion_requests'), deletionRequest);
  await logAuditEvent('account_deletion_requested', {});
};
