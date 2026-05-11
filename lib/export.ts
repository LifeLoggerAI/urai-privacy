
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase/firebase';
import { logAuditEvent } from './audit';

export const requestDataExport = async () => {
  if (!auth.currentUser) throw new Error('User is not authenticated');

  const exportRequest = {
    userId: auth.currentUser.uid,
    status: 'pending',
    createdAt: serverTimestamp(),
  };

  await addDoc(collection(db, 'export_requests'), exportRequest);
  await logAuditEvent('data_export_requested', {});
};
