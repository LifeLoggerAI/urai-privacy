import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions();

export const secureWrite = httpsCallable(functions, "secureWrite");
export const secureRead = httpsCallable(functions, "secureRead");
export const getInsightExplanation = httpsCallable(functions, "getInsightExplanation");
export const requestDataExport = httpsCallable(functions, "requestDataExport");
export const requestDeletion = httpsCallable(functions, "requestDeletion");
export const generateMonetizationUnit = httpsCallable(functions, "generateMonetizationUnit");

export async function writeSensitiveRecord(payload: any) {
  return secureWrite(payload);
}

export async function readSensitiveRecord(payload: any) {
  return secureRead(payload);
}

export async function explainInsight(payload: any) {
  return getInsightExplanation(payload);
}
