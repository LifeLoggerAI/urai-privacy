
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.submitPrivacyRequest = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { userId, requestType, data } = req.body;

  if (!userId || !requestType) {
    return res.status(400).send('Missing userId or requestType');
  }

  try {
    const db = admin.firestore();
    await db.collection('privacy_requests').add({
      userId,
      requestType,
      data,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return res.status(200).send({ success: true });
  } catch (error) {
    console.error("Error submitting privacy request:", error);
    return res.status(500).send('Internal Server Error');
  }
});

exports.submitSecurityReport = functions.https.onRequest(async (req, res) => {
  // TODO: Add validation and implementation
  res.status(200).send("Security report submitted.");
});

exports.logTransparencyUpdate = functions.https.onRequest(async (req, res) => {
  // TODO: Add validation and implementation
  res.status(200).send("Transparency update logged.");
});
