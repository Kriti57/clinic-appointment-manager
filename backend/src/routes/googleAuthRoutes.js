import { Router } from "express";
import { getAuthUrl, handleOAuthCallback } from "../services/calendarService.js";
import { protect } from "../middleware/auth.js";

const router = Router();

// Frontend calls this (while logged in) to get the Google consent URL to redirect the user to
router.get("/google/connect", protect, (req, res) => {
  const url = getAuthUrl(req.user._id.toString());
  res.json({ url });
});

// Google redirects here after the user consents
router.get("/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query; // state = userId we passed in
    await handleOAuthCallback(code, state);
    res.redirect(`${process.env.CLIENT_URL}/settings?calendarConnected=true`);
  } catch (err) {
    console.error("Google OAuth callback failed:", err.message);
    res.redirect(`${process.env.CLIENT_URL}/settings?calendarConnected=false`);
  }
});

export default router;
