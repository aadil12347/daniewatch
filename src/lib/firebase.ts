import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBlBAHLfy9txHoDUNPruWxW1RpNo0fVfls",
  authDomain: "daniewatch-2026.firebaseapp.com",
  projectId: "daniewatch-2026",
  storageBucket: "daniewatch-2026.firebasestorage.app",
  messagingSenderId: "150686032824",
  appId: "1:150686032824:web:33eb34b86513724b2ce54d",
  measurementId: "G-1S4MET0TTS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics (only in browser environment)
let analytics: ReturnType<typeof getAnalytics> | null = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
});

export { app, analytics };
